package com.planning.oran;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.net.wifi.WifiManager;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.net.DatagramPacket;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.MulticastSocket;
import java.net.NetworkInterface;
import java.net.SocketException;
import java.nio.charset.StandardCharsets;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import java.util.UUID;

@CapacitorPlugin(
    name = "LanDiscovery",
    permissions = {
        @Permission(
            alias = "nearbyDevices",
            strings = { Manifest.permission.NEARBY_WIFI_DEVICES }
        ),
        @Permission(
            alias = "localNetwork",
            strings = { "android.permission.ACCESS_LOCAL_NETWORK" }
        )
    }
)
public final class LanDiscoveryPlugin extends Plugin {
    private static final String MULTICAST_GROUP = "239.255.42.99";
    private static final int DISCOVERY_PORT = 45871;
    private static final int PROTOCOL_VERSION = 1;
    private static final int MAX_PACKET_BYTES = 1024;
    private static final int MAX_DISCOVERED_PEERS = 128;
    private static final long ANNOUNCE_INTERVAL_MS = 3000L;
    private static final long PEER_TIMEOUT_MS = 12000L;
    private static final int RECEIVE_TIMEOUT_MS = 250;

    private static final class PeerSeen {
        final String address;
        final long lastSeenAt;

        PeerSeen(String address, long lastSeenAt) {
            this.address = address;
            this.lastSeenAt = lastSeenAt;
        }
    }

    private final Object workerLock = new Object();
    private volatile boolean stopRequested;
    private volatile MulticastSocket socket;
    private volatile Thread worker;
    private volatile boolean discoveryRequested;
    private volatile String nodeId;
    private WifiManager.MulticastLock multicastLock;

    @PluginMethod
    public void startDiscovery(PluginCall call) {
        try {
            nodeId = getOrCreateNodeId();
            String missingAlias = requiredPermissionAlias();
            if (missingAlias != null && !hasPermission(missingAlias)) {
                saveCall(call);
                requestPermissionForAlias(missingAlias, call, "lanPermissionCallback");
                return;
            }
            startForCall(call);
        } catch (Exception error) {
            call.reject("Impossible d'initialiser l'identité P2P : " + error.getMessage());
        }
    }

    @PermissionCallback
    private void lanPermissionCallback(PluginCall call) {
        String alias = requiredPermissionAlias();
        if (alias != null && !hasPermission(alias)) {
            call.reject("L'autorisation Android d'accès au réseau local est nécessaire à la découverte des appareils Appointment.");
            return;
        }
        startForCall(call);
    }

    private void startForCall(PluginCall call) {
        try {
            startWorker();
            JSObject result = new JSObject();
            result.put("nodeId", nodeId);
            result.put("protocolVersion", PROTOCOL_VERSION);
            result.put("discoveryOnly", true);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("La découverte LAN Appointment n'a pas pu démarrer : " + error.getMessage());
        }
    }

    @PluginMethod
    public void stopDiscovery(PluginCall call) {
        discoveryRequested = false;
        stopWorker();
        call.resolve();
    }

    private String getOrCreateNodeId() throws Exception {
        // noBackupFilesDir prevents Android Auto Backup from cloning one node ID
        // onto multiple installations during device migration or restore.
        File identityFile = new File(getContext().getNoBackupFilesDir(), "p2p-node-id");
        if (identityFile.isFile() && identityFile.length() <= 64) {
            try (FileInputStream input = new FileInputStream(identityFile)) {
                byte[] bytes = new byte[64];
                int length = input.read(bytes);
                if (length > 0) {
                    try {
                        return UUID.fromString(new String(bytes, 0, length, StandardCharsets.UTF_8).trim()).toString();
                    } catch (IllegalArgumentException ignored) {
                        // Replace a corrupted local identity; it is not an authorization credential.
                    }
                }
            }
        }

        String created = UUID.randomUUID().toString();
        File temporaryFile = new File(identityFile.getParentFile(), "p2p-node-id.tmp");
        try (FileOutputStream output = new FileOutputStream(temporaryFile, false)) {
            output.write(created.getBytes(StandardCharsets.UTF_8));
            output.flush();
            output.getFD().sync();
        }
        if (identityFile.exists() && !identityFile.delete()) {
            temporaryFile.delete();
            throw new IllegalStateException("Impossible de remplacer l'identité P2P locale.");
        }
        if (!temporaryFile.renameTo(identityFile)) {
            temporaryFile.delete();
            throw new IllegalStateException("Impossible d'enregistrer l'identité P2P locale.");
        }
        return created;
    }

    private String requiredPermissionAlias() {
        if (Build.VERSION.SDK_INT >= 37
            && getContext().getApplicationInfo().targetSdkVersion >= 37) {
            return "localNetwork";
        }
        // Android 16's opt-in local-network protection uses Nearby devices
        // permission as the compatibility grant. Earlier releases do not gate LAN sockets.
        if (Build.VERSION.SDK_INT >= 36) {
            return "nearbyDevices";
        }
        return null;
    }

    private boolean hasPermission(String alias) {
        final String permission = "localNetwork".equals(alias)
            ? "android.permission.ACCESS_LOCAL_NETWORK"
            : Manifest.permission.NEARBY_WIFI_DEVICES;
        return getContext().checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED;
    }

    private void startWorker() throws Exception {
        synchronized (workerLock) {
            if (worker != null && worker.isAlive() && socket != null && !socket.isClosed()) {
                discoveryRequested = true;
                return;
            }

            InetAddress group = InetAddress.getByName(MULTICAST_GROUP);
            NetworkInterface network = findLanMulticastInterface();
            MulticastSocket newSocket = new MulticastSocket(null);
            try {
                newSocket.setReuseAddress(true);
                newSocket.bind(new InetSocketAddress(DISCOVERY_PORT));
                newSocket.setSoTimeout(RECEIVE_TIMEOUT_MS);
                newSocket.setTimeToLive(1);
                newSocket.setNetworkInterface(network);
                newSocket.joinGroup(new InetSocketAddress(group, DISCOVERY_PORT), network);
                acquireMulticastLock();

                socket = newSocket;
                stopRequested = false;
                discoveryRequested = true;
                worker = new Thread(
                    () -> discoveryLoop(newSocket, group),
                    "appointment-lan-discovery"
                );
                worker.setDaemon(true);
                worker.start();
            } catch (Exception error) {
                newSocket.close();
                releaseMulticastLock();
                throw error;
            }
        }
    }

    private NetworkInterface findLanMulticastInterface() throws Exception {
        Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
        if (interfaces == null) throw new SocketException("Aucune interface réseau disponible.");

        while (interfaces.hasMoreElements()) {
            NetworkInterface candidate = interfaces.nextElement();
            String name = candidate.getName().toLowerCase();
            if (!candidate.isUp() || candidate.isLoopback() || !candidate.supportsMulticast()
                || name.startsWith("rmnet") || name.startsWith("tun") || name.startsWith("ppp")) {
                continue;
            }
            Enumeration<InetAddress> addresses = candidate.getInetAddresses();
            while (addresses.hasMoreElements()) {
                InetAddress address = addresses.nextElement();
                if (address instanceof Inet4Address
                    && !address.isAnyLocalAddress()
                    && !address.isLoopbackAddress()
                    && !address.isMulticastAddress()
                    && (address.isSiteLocalAddress() || address.isLinkLocalAddress())) {
                    return candidate;
                }
            }
        }
        throw new SocketException("Aucune interface Wi-Fi ou Ethernet IPv4 compatible multicast n'est active.");
    }

    private void acquireMulticastLock() {
        WifiManager wifi = (WifiManager) getContext().getApplicationContext()
            .getSystemService(Context.WIFI_SERVICE);
        if (wifi == null) return;
        multicastLock = wifi.createMulticastLock("appointment-p2p-discovery");
        multicastLock.setReferenceCounted(false);
        multicastLock.acquire();
    }

    private void releaseMulticastLock() {
        WifiManager.MulticastLock lock = multicastLock;
        multicastLock = null;
        if (lock != null && lock.isHeld()) {
            try { lock.release(); } catch (RuntimeException ignored) { }
        }
    }

    private void discoveryLoop(MulticastSocket activeSocket, InetAddress group) {
        final byte[] receiveBuffer = new byte[MAX_PACKET_BYTES + 1];
        final Map<String, PeerSeen> lastSeen = new HashMap<>();
        long nextAnnouncement = 0L;

        try {
            while (!stopRequested && !activeSocket.isClosed()) {
                long now = System.currentTimeMillis();
                if (now >= nextAnnouncement) {
                    byte[] announcement = announcementBytes();
                    activeSocket.send(new DatagramPacket(
                        announcement, announcement.length, group, DISCOVERY_PORT
                    ));
                    nextAnnouncement = now + ANNOUNCE_INTERVAL_MS;
                }

                DatagramPacket incoming = new DatagramPacket(receiveBuffer, receiveBuffer.length);
                try {
                    activeSocket.receive(incoming);
                    if (incoming.getLength() > MAX_PACKET_BYTES) continue;
                    JSONObject message = new JSONObject(new String(
                        incoming.getData(), incoming.getOffset(), incoming.getLength(),
                        StandardCharsets.UTF_8
                    ));
                    if (message.optInt("protocolVersion", -1) != PROTOCOL_VERSION) continue;
                    String remoteId;
                    try {
                        remoteId = UUID.fromString(message.optString("peerId", "")).toString();
                    } catch (IllegalArgumentException invalidId) {
                        continue;
                    }
                    InetAddress remoteAddress = incoming.getAddress();
                    if (remoteId.equals(nodeId) || !(remoteAddress instanceof Inet4Address)
                        || remoteAddress.isAnyLocalAddress() || remoteAddress.isLoopbackAddress()
                        || remoteAddress.isMulticastAddress()) {
                        continue;
                    }

                    String remoteIp = remoteAddress.getHostAddress();
                    if (!lastSeen.containsKey(remoteId) && lastSeen.size() >= MAX_DISCOVERED_PEERS) continue;
                    long seenAt = System.currentTimeMillis();
                    PeerSeen previous = lastSeen.put(remoteId, new PeerSeen(remoteIp, seenAt));
                    if (previous == null || !previous.address.equals(remoteIp)) {
                        JSObject peer = new JSObject();
                        peer.put("peerId", remoteId);
                        peer.put("address", remoteIp);
                        peer.put("protocolVersion", PROTOCOL_VERSION);
                        notifyListeners("peerFound", peer);
                    }
                } catch (java.net.SocketTimeoutException timeout) {
                    // Periodic tick: send announcements and expire stale peer entries.
                } catch (org.json.JSONException malformedPacket) {
                    // Malformed or forged multicast datagrams are discarded, not fatal to discovery.
                }

                long expiryNow = System.currentTimeMillis();
                Iterator<Map.Entry<String, PeerSeen>> iterator = lastSeen.entrySet().iterator();
                while (iterator.hasNext()) {
                    Map.Entry<String, PeerSeen> peer = iterator.next();
                    if (expiryNow - peer.getValue().lastSeenAt > PEER_TIMEOUT_MS) {
                        JSObject expired = new JSObject();
                        expired.put("peerId", peer.getKey());
                        notifyListeners("peerExpired", expired);
                        iterator.remove();
                    }
                }
            }
        } catch (Exception error) {
            if (!stopRequested) {
                JSObject detail = new JSObject();
                detail.put("message", error.getMessage() == null ? "Erreur socket LAN." : error.getMessage());
                notifyListeners("discoveryError", detail);
            }
        } finally {
            activeSocket.close();
            synchronized (workerLock) {
                // A pause/resume can replace the socket before this worker exits.
                // An obsolete worker must never release the new worker's multicast lock.
                if (socket == activeSocket) {
                    socket = null;
                    if (worker == Thread.currentThread()) worker = null;
                    releaseMulticastLock();
                }
            }
        }
    }

    private byte[] announcementBytes() throws Exception {
        JSONObject json = new JSONObject();
        json.put("protocolVersion", PROTOCOL_VERSION);
        json.put("peerId", nodeId);
        byte[] packet = json.toString().getBytes(StandardCharsets.UTF_8);
        if (packet.length > MAX_PACKET_BYTES) throw new IllegalStateException("Annonce LAN trop volumineuse.");
        return packet;
    }

    private void stopWorker() {
        synchronized (workerLock) {
            stopRequested = true;
            MulticastSocket activeSocket = socket;
            socket = null;
            if (activeSocket != null) activeSocket.close();
            releaseMulticastLock();
        }
    }

    @Override
    protected void handleOnPause() {
        super.handleOnPause();
        if (discoveryRequested) stopWorker();
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        if (discoveryRequested) {
            try {
                startWorker();
            } catch (Exception error) {
                JSObject detail = new JSObject();
                detail.put("message", error.getMessage() == null ? "Redémarrage LAN impossible." : error.getMessage());
                notifyListeners("discoveryError", detail);
            }
        }
    }

    @Override
    protected void handleOnDestroy() {
        discoveryRequested = false;
        stopWorker();
        super.handleOnDestroy();
    }
}
