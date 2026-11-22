//! Coordinator-free IPv4 multicast discovery shared by Windows native and Android APK.
//!
//! Discovery advertises only a stable installation UUID. It does not advertise a
//! listening port until an authenticated peer transport exists. A discovered peer
//! is not trusted, paired, authorized, or synchronized by discovery alone.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::{Ipv4Addr, SocketAddr, UdpSocket};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};
use uuid::Uuid;

pub const DISCOVERY_MULTICAST: Ipv4Addr = Ipv4Addr::new(239, 255, 42, 99);
pub const DISCOVERY_PORT: u16 = 45_871;
pub const DISCOVERY_PROTOCOL_VERSION: u16 = 1;
const ANNOUNCE_INTERVAL: Duration = Duration::from_secs(3);
const PEER_TIMEOUT: Duration = Duration::from_secs(12);
const RECEIVE_TIMEOUT: Duration = Duration::from_millis(250);
const MAX_DATAGRAM_BYTES: usize = 1024;

#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
struct Announcement {
    protocol_version: u16,
    peer_id: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DiscoveredPeer {
    pub peer_id: String,
    pub address: SocketAddr,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum DiscoveryEvent {
    PeerFound(DiscoveredPeer),
    PeerExpired { peer_id: String },
}

pub struct LanDiscovery {
    stop: Arc<AtomicBool>,
    events: mpsc::Receiver<DiscoveryEvent>,
    worker: Option<JoinHandle<()>>,
}

impl LanDiscovery {
    /// Starts discovery using the same JSON announcement consumed by the Android plugin.
    pub fn start(peer_id: &str) -> Result<Self, String> {
        let peer_id = Uuid::parse_str(peer_id)
            .map_err(|_| "LAN peer identity must be a UUID.".to_string())?
            .hyphenated()
            .to_string();

        let socket = UdpSocket::bind((Ipv4Addr::UNSPECIFIED, DISCOVERY_PORT))
            .map_err(|error| format!("Cannot bind LAN discovery socket: {error}"))?;
        socket
            .join_multicast_v4(&DISCOVERY_MULTICAST, &Ipv4Addr::UNSPECIFIED)
            .map_err(|error| format!("Cannot join LAN discovery multicast group: {error}"))?;
        socket
            .set_multicast_loop_v4(false)
            .map_err(|error| format!("Cannot configure multicast loopback: {error}"))?;
        socket
            .set_multicast_ttl_v4(1)
            .map_err(|error| format!("Cannot restrict discovery to the local network: {error}"))?;
        socket
            .set_read_timeout(Some(RECEIVE_TIMEOUT))
            .map_err(|error| format!("Cannot configure discovery receive timeout: {error}"))?;

        let announcement = Announcement {
            protocol_version: DISCOVERY_PROTOCOL_VERSION,
            peer_id: peer_id.clone(),
        };
        let packet = serde_json::to_vec(&announcement)
            .map_err(|error| format!("Cannot serialize LAN announcement: {error}"))?;
        if packet.len() > MAX_DATAGRAM_BYTES {
            return Err("LAN discovery announcement exceeds its packet limit.".into());
        }

        let (sender, events) = mpsc::channel();
        let stop = Arc::new(AtomicBool::new(false));
        let worker_stop = Arc::clone(&stop);
        let worker = thread::Builder::new()
            .name("appointment-lan-discovery".into())
            .spawn(move || discovery_loop(socket, packet, peer_id, sender, worker_stop))
            .map_err(|error| format!("Cannot start LAN discovery worker: {error}"))?;

        Ok(Self {
            stop,
            events,
            worker: Some(worker),
        })
    }

    /// Non-blocking event retrieval for integration with the Win32 message loop.
    pub fn try_recv(&self) -> Result<DiscoveryEvent, mpsc::TryRecvError> {
        self.events.try_recv()
    }
}

impl Drop for LanDiscovery {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::Release);
        if let Some(worker) = self.worker.take() {
            let _ = worker.join();
        }
    }
}

fn discovery_loop(
    socket: UdpSocket,
    packet: Vec<u8>,
    own_peer_id: String,
    sender: mpsc::Sender<DiscoveryEvent>,
    stop: Arc<AtomicBool>,
) {
    let destination = SocketAddr::from((DISCOVERY_MULTICAST, DISCOVERY_PORT));
    let mut last_announcement = Instant::now() - ANNOUNCE_INTERVAL;
    let mut peers = HashMap::<String, (DiscoveredPeer, Instant)>::new();
    let mut buffer = [0u8; MAX_DATAGRAM_BYTES + 1];

    while !stop.load(Ordering::Acquire) {
        if last_announcement.elapsed() >= ANNOUNCE_INTERVAL {
            let _ = socket.send_to(&packet, destination);
            last_announcement = Instant::now();
        }

        match socket.recv_from(&mut buffer) {
            Ok((length, source)) if length <= MAX_DATAGRAM_BYTES => {
                if let Ok(message) = serde_json::from_slice::<Announcement>(&buffer[..length]) {
                    if let Some(peer) = validate_announcement(message, &own_peer_id, source) {
                        let now = Instant::now();
                        let changed = peers
                            .get(&peer.peer_id)
                            .map(|(existing, _)| existing != &peer)
                            .unwrap_or(true);
                        peers.insert(peer.peer_id.clone(), (peer.clone(), now));
                        if changed && sender.send(DiscoveryEvent::PeerFound(peer)).is_err() {
                            break;
                        }
                    }
                }
            }
            Ok(_) => {
                // Oversized datagrams are discarded; peer input never controls allocation.
            }
            Err(error)
                if matches!(
                    error.kind(),
                    std::io::ErrorKind::WouldBlock | std::io::ErrorKind::TimedOut
                ) => {}
            Err(_) => break,
        }

        let now = Instant::now();
        let expired: Vec<String> = peers
            .iter()
            .filter(|(_, (_, seen))| now.duration_since(*seen) > PEER_TIMEOUT)
            .map(|(id, _)| id.clone())
            .collect();
        for peer_id in expired {
            peers.remove(&peer_id);
            if sender
                .send(DiscoveryEvent::PeerExpired { peer_id })
                .is_err()
            {
                return;
            }
        }
    }
}

fn validate_announcement(
    message: Announcement,
    own_peer_id: &str,
    source: SocketAddr,
) -> Option<DiscoveredPeer> {
    if message.protocol_version != DISCOVERY_PROTOCOL_VERSION
        || source.ip().is_unspecified()
        || source.ip().is_multicast()
        || source.ip().is_broadcast()
        || source.ip().is_loopback()
    {
        return None;
    }
    let peer_id = Uuid::parse_str(&message.peer_id).ok()?.hyphenated().to_string();
    if peer_id == own_peer_id {
        return None;
    }
    Some(DiscoveredPeer {
        peer_id,
        address: source,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn announcement(peer_id: &str) -> Announcement {
        Announcement {
            protocol_version: DISCOVERY_PROTOCOL_VERSION,
            peer_id: peer_id.into(),
        }
    }

    #[test]
    fn discovery_rejects_invalid_identity_and_wrong_protocol() {
        let own = "a1b2c3d4-e5f6-47a8-9012-1234567890ab";
        let source = SocketAddr::from(([192, 168, 1, 10], DISCOVERY_PORT));
        assert!(validate_announcement(announcement("not-a-uuid"), own, source).is_none());

        let mut wrong_protocol = announcement("b1b2c3d4-e5f6-47a8-9012-1234567890ab");
        wrong_protocol.protocol_version = 99;
        assert!(validate_announcement(wrong_protocol, own, source).is_none());
    }

    #[test]
    fn discovery_ignores_self_and_accepts_valid_lan_peer() {
        let own = "a1b2c3d4-e5f6-47a8-9012-1234567890ab";
        let remote = "b1b2c3d4-e5f6-47a8-9012-1234567890ab";
        let source = SocketAddr::from(([192, 168, 1, 10], DISCOVERY_PORT));

        assert!(validate_announcement(announcement(own), own, source).is_none());
        let peer = validate_announcement(announcement(remote), own, source).unwrap();
        assert_eq!(peer.peer_id, remote);
        assert_eq!(peer.address.ip(), source.ip());
    }

    #[test]
    fn discovery_rejects_multicast_unspecified_and_loopback_sources() {
        let own = "a1b2c3d4-e5f6-47a8-9012-1234567890ab";
        let remote = "b1b2c3d4-e5f6-47a8-9012-1234567890ab";
        for address in [[0, 0, 0, 0], [239, 255, 42, 99], [127, 0, 0, 1]] {
            assert!(validate_announcement(
                announcement(remote),
                own,
                SocketAddr::from((address, DISCOVERY_PORT))
            )
            .is_none());
        }
    }

    #[test]
    fn announcement_packet_is_bounded_and_contains_no_tenant_or_credentials() {
        let packet = serde_json::to_vec(&announcement(
            "b1b2c3d4-e5f6-47a8-9012-1234567890ab",
        ))
        .unwrap();
        assert!(packet.len() <= MAX_DATAGRAM_BYTES);
        assert_eq!(
            String::from_utf8(packet).unwrap(),
            r#"{"protocolVersion":1,"peerId":"b1b2c3d4-e5f6-47a8-9012-1234567890ab"}"#
        );
    }
}
