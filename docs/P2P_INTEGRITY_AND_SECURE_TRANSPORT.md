# P2P Integrity and Secure Transport — implementation contract

## Booking conflict detection

A booking conflict is a business-level invariant violation, not an event-ID collision. Two offline installations can create different booking IDs for the same resource and overlapping stay. The detector therefore groups the immutable event log by booking entity ID, retains each booking's causally maximal event(s), and compares active booking intervals across distinct IDs.

The detector uses the persisted business fields `resourceId`, `sector`, `startDate`, `endDate`, `checkInTime`, `checkOutTime`, and `status`. Cancelled bookings do not occupy a slot. Missing hotel times default to 14:00 check-in and 12:00 check-out. The existing symmetric ten-minute hotel turnover is applied if either booking is a hotel booking.

Date/time comparison is performed as a timezone-independent wall-clock minute calculation. This avoids a device's OS timezone changing the outcome of a replicated conflict calculation. It does not reinterpret the property's local wall clock as a UTC instant for display.

## Conflict lifecycle (required persistence/UI integration)

The deterministic conflict key is derived from workspace ID and the sorted pair of immutable event IDs. The conflict snapshot retains both booking IDs, both event IDs, resource ID, overlap interval, detection timestamp and pending status. A conflict remains pending until a separately replicated resolution event is committed.

Resolution must name the selected booking, the actor/device, a reason, and the exact source conflict ID. The resolution event must causally include both conflicting source events. The IndexedDB implementation now records `keep_booking` and `reject_both` decisions as immutable `booking_conflict` events; it writes the corresponding cancellation booking events first, then emits the decision event with source and cancellation event references. A receiving peer leaves the conflict pending until those cancellation events are present in the current booking frontiers and causally included by the decision event. Never delete either source event or silently mutate its payload.

## Pair identity and transport security requirements

LAN discovery remains unauthenticated candidate discovery only. A peer announcement must never be treated as authorization.

Each installation needs a persistent signing identity. Pairing must be user-approved and bind the peer public key, peer ID, workspace ID, protocol version, and trust state. Every subsequent connection must prove possession of the paired private key and establish an authenticated encrypted session. Revocation must persist a deny state and invalidate all future sessions for that peer. Resetting the installation UUID must not silently inherit old trust.

Use a reviewed platform cryptographic implementation. Do not implement cryptographic primitives in TypeScript or hand-roll key exchange. The transport must provide mutual authentication, forward secrecy, integrity, replay protection, bounded frame sizes, and explicit protocol negotiation. TLS 1.3 with pinned peer identity is the preferred transport profile where supported.

## Durable delivery contract

A sender persists the offered page and cursor before transmission. A receiver validates the authenticated peer, workspace scope, event envelope, batch count and byte limit; then commits the complete inbound batch and its cursor in one strict durable transaction. Only after that transaction completes may the receiver return an ACK. The sender accepts an ACK only for the exact offered cursor. Retries are at-least-once; event IDs and content hashes make replay idempotent. A crash before ACK causes safe retransmission.

## Convergence acceptance criteria

- Same booking overlap is detected for distinct booking IDs after both events arrive.
- Event arrival order and duplicate delivery do not change the conflict set.
- A causally newer booking update removes a stale overlap only when it actually changes the interval or status.
- A pending conflict survives process restart.
- A resolution is replicated as an immutable event and converges on all trusted peers.
- Revoked peers cannot establish a new authenticated session.
- Windows and Android pass the same protocol fixtures.
