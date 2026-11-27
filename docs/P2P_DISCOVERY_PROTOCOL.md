# Appointment LAN Discovery Protocol v1

This document is the wire contract shared by the native Windows EXE and the Android APK.

## Transport

| Property | Value |
|---|---|
| Network | IPv4 multicast |
| Multicast group | `239.255.42.99` |
| UDP port | `45871` |
| TTL | `1` (link-local; routers must not forward it) |
| Encoding | UTF-8 JSON |
| Maximum datagram | 1,024 bytes |
| Announcement interval | 3 seconds |
| Peer expiry | 12 seconds without a new announcement |
| Maximum cached peers | 128 |

## Announcement

Every native node sends this exact logical object:

```json
{
  "protocolVersion": 1,
  "peerId": "a1b2c3d4-e5f6-47a8-9012-1234567890ab"
}
```

`peerId` is a stable, installation-local UUID. Windows stores it under the current user's Appointment directory in `%LOCALAPPDATA%`; Android stores it in `getNoBackupFilesDir()` so it is not copied by Android Auto Backup.

Receivers must reject unsupported protocol versions, malformed UUIDs, their own `peerId`, oversized datagrams and non-LAN source addresses. Accepted IPv4 sources are RFC 1918 private ranges, link-local 169.254.0.0/16 and RFC 6598 shared space 100.64.0.0/10. Duplicate announcements refresh the peer's last-seen time. A peer is removed after 12 seconds without a valid announcement.

## Security boundary

The announcement contains **no** workspace identifier, account identifier, credentials, access token, business record, event payload, public key or service port. A discovered address is untrusted metadata. It is not proof of device identity, user identity, workspace membership or authorization.

This protocol only discovers candidates. It does not open a TCP listener, pair devices, establish an encrypted channel, exchange data or mark records synchronized. Those operations require the separate authenticated transport and replication protocol.

## Platform behavior

- Windows starts discovery with the native Win32 application and displays the number of peers found.
- Android starts discovery through the native Capacitor plugin. It holds the Wi-Fi multicast lock only while the worker is active and stops discovery while the Activity is backgrounded.
- Android target SDK 36 normally has implicit local-network access through `INTERNET`. If Android 16's opt-in local-network compatibility protection blocks multicast, the plugin requests `NEARBY_WIFI_DEVICES` only after the socket is denied. `ACCESS_LOCAL_NETWORK` is required only when the app targets SDK 37 or higher.
- Browser-only web builds cannot open raw UDP multicast sockets and do not participate in this discovery protocol.

## Network limitations

Both devices must be on the same IPv4 multicast-capable LAN segment. Guest Wi-Fi client isolation, VLAN separation, multicast filtering, endpoint firewalls or a disabled multicast-capable interface can block discovery. This protocol does not cross routers, the public Internet or NAT boundaries.


## Browser compatibility — important

The multicast implementation is native-only. The following combinations do **not** discover one another:

| Device A | Device B | LAN discovery |
|---|---|---|
| Appointment Windows native EXE | Appointment Android native APK | Supported, subject to same-LAN multicast and firewall conditions |
| Appointment Web in Microsoft Edge | Appointment Web in Chrome/Chrome Canary on Android | Not supported |
| Appointment Web in Edge | Appointment Android native APK | Not supported |
| Appointment Web in Chrome on Android | Appointment Windows native EXE | Not supported |

Edge and Chrome Canary are browser runtimes. They do not load the Capacitor Android UDP multicast plugin, and a browser page cannot open the raw IPv4 multicast socket used by protocol v1. Changing browser brand, browser channel or Android device does not change this platform boundary.

For the reported setup (Edge on the PC + Chrome Canary on the OPPO), zero detected peers is the expected behavior, not evidence of a Wi-Fi fault. To validate the existing discovery implementation, install and launch the **native Appointment Windows EXE** on the PC and the **native Appointment Android APK** on the OPPO, put both on the same non-isolated IPv4 Wi-Fi/LAN, keep both apps in the foreground, and allow the app through the Windows firewall on Private networks. The peer indicator reports presence only; it does not mean that business data is synchronized.

Browser-to-browser discovery needs a separate implementation: authenticated signaling (for example a workspace-scoped Supabase Realtime channel), WebRTC data channels, STUN and a TURN fallback for restrictive NAT/firewalls, device pairing and key authentication. It must not be represented as LAN multicast or trusted coordination authority. This transport is not implemented by protocol v1.
