# Rebuild plan — proUSB Hotel Lock System → Omnibook module

Goal: rebuild **every functional capability** of the vendor application inside Omnibook
(React 19 / Vite / Capacitor), drive the same encoder and the same locks, and keep the
existing booking app working.

This document is the checklist. A part is "done" only when its acceptance criteria are
green and the hardware behaviour matches the vendor software on the owned encoder.

---

## 0. Scope and non-goals

**In scope**

- the 13 card types, byte-for-byte identical to `proRFL`
- the reader protocol (frames, checksums, retries, re-enumeration)
- read/write of the card area, the EEPROM (`ReadE2`/`WriteE2`) and the lock log (`ReadRecord`)
- the data model (10 tables) and its migration path from `CardLock.mdb`
- the 8 real screens, the dialogs and the reports
- fr / en / ar (RTL) for every new string

**Out of scope (deliberate)**

- **Generating vendor activation serials.** `Reg.ini` records a vendor-issued,
  reader-bound, time-limited activation (see `ARCHITECTURE.md` §5.1). Reproducing the
  vendor's key derivation is licence circumvention and is not part of this rebuild.
  The rebuilt application is our own software and has **no activation gate**; the
  equivalent screen only shows reader identity, firmware and version.
- reusing vendor binaries at runtime (`proRFL.dll`, `d12c.dll`, `CardLock.Exe`). They are
  used **only** as an oracle while building and testing the clone.

---

## 1. Source of truth

| Question | Document |
|---|---|
| Stack, modules, data flow, activation | `ARCHITECTURE.md` |
| Frames, checksums, transports, record bytes | `CARD-API.md` |
| Encoder bring-up and harnesses | `ENCODER.md` |
| Screens, widgets, event handlers | `FORMS.md` |
| Tables, columns, SQL used by the EXE | `DATA-MODEL.md` |

---

## 2. Feature inventory (nothing omitted)

### 2.1 Screens — 11 forms, 4 dialogs

| Form | Role | Rebuild target |
|---|---|---|
| `frmLogon` | operator login | `LockLoginScreen` |
| `frmMain` | shell, menu, toolbar | `LockShell` |
| `frmReceiption` | check-in, check-out, card search, room state | `LockReceptionScreen` |
| `frmKeysForStaff` | staff cards: floor, building, master, emergency, group, **record**, blacklist, check-out, issue | `LockStaffCardsScreen` |
| `frmLockConfiguration` | per-lock parameters (alarm, remind, no-disturb, knob, music, cover…) | `LockConfigScreen` |
| `frmRoomsDefination` | buildings, floors, rooms, lock addressing | `LockRoomsScreen` |
| `frmReports` | occupancy, openings, guest history | `LockReportsScreen` |
| `frmSystemMaintenance` | options, **System Registe** tab, operator management | `LockSettingsScreen` |
| `LoginDialog` | DB login | inline dialog |
| `PasswordDialog` | password entry / change | inline dialog |
| `ProgressDialog` | progress | inline status |
| `TData1`, `TData2`, `TDSSCubeEditor`, `TRzFrmCustomizeToolbar` | third-party/library artefacts | **not rebuilt** |

### 2.2 Card types — 13

Selector byte 9 = `0xTT | (index & 0x0F)`.

| # | Type | `TT` | Vendor export | Status |
|---|---|---|---|---|
| 0 | Reset | — | `ResetCard` | layout to transcribe |
| 1 | Record (lock log) | `0x10` | `RecordCard` | **decoded** |
| 2 | RoomSet | `0x20` | `RoomSetCard` | to transcribe |
| 3 | TimeSet | `0x30` | `TimeSetCard` | to transcribe |
| 4 | Limit | `0x40` | `LimitCard` | to transcribe |
| 5 | GroupSet | `0x50` | `GroupSetCard` | to transcribe |
| 6 | Guest | `0x60` | `GuestCard` | **decoded + hardware-verified** |
| 7 | CheckOut | `0x70` | `CheckOutCard` | to transcribe |
| 8 | Group | `0x80` | `GroupCard` | to transcribe |
| 10 | Emergency | `0xA0` | `EmergencyCard` | to transcribe |
| 11 | Master | `0xB0` | `MasterCard` | partially |
| 12 | Building | `0xC0` | `BuildingCard` | to transcribe |
| 13 | Floor | `0xD0` | `FloorCard` | to transcribe |

Writer dispatcher: `FUN_006d8c44` (case = type). Builders captured in
`proRFL.dll` at `0x10001005…0x100010a0` (decompiled dump kept outside the repo).

### 2.3 Reader / communication operations — 26 exports

`initializeUSB`, `Buzzer`, `CardErase`, `CloseCard`, `proTest`, `GetDLLVersion`,
`ResetCard`, `RecordCard`, `RoomSetCard`, `TimeSetCard`, `LimitCard`, `GroupSetCard`,
`GuestCard`, `CheckOutCard`, `GroupCard`, `EmergencyCard`, `MasterCard`, `BuildingCard`,
`FloorCard`, `IniCard`, `IniCard1`, `ReadCard`, `WriteCard`, `ReadRecord`, `ReadE2`,
`WriteE2`, plus helpers `a_hex`, `hex_a`.

### 2.4 Data model — 10 tables

`BuildingInfo`, `RoomInfo`, `GuestInfo`, `CardInfo`, `OperatorInfo`, `RecordOpen`,
`RegInfo`, `LogInfo`, `CaoZuoInfo`, `Dai`.

Rebuild: SQLite schema with the same semantics; import from `CardLock.mdb` via a
one-shot migration (read-only, password from local config).

### 2.5 Global options

`System.ini [SYSTEM]`: hotel name, skin, `DBBakPath`, checkout times, VIP checkout,
guest bolt, alarm, remind, no-disturb, knob, music, cover.

---

## 3. Target architecture

```
src/locks/
  protocol/      frames, checksums, command builders, response parsing
  transport/     LockTransport interface + webhid / capacitor-usb / windows-agent / mock
  cards/         one module per card type + registry + decode/encode
  reader/        high-level operations (issue, read, erase, log, memory)
  domain/        rooms, guests, cards, records (pure, testable)
  data/          sqlite/schema, mdb migration, repositories
  ui/            screens, dialogs, i18n keys
```

Rules

- `protocol/` and `cards/` are **pure**: no DOM, no hardware, no React. Fully unit-tested.
- Only `transport/` touches a device; swapping transport must not change upper layers.
- Every user-facing string goes through the existing i18n mechanism (fr/en/ar).

Transport options, in order of preference

1. **WebHID** — the reader is a vendor-defined HID device (VID `0x9915`, PID `0x1116`).
   Works in the browser and in the Windows WebView shell; no agent to install.
2. **Capacitor USB host** — the Android build, same protocol over `UsbManager`.
3. **Windows agent** — small local HTTP service wrapping the HID stack, as a fallback
   for environments where WebHID is blocked.
4. **Mock** — scripted responses for tests and CI.

---

## 4. Parts

| Part | Content | Acceptance |
|---|---|---|
| **P0** | Inventory + architecture (this file) | reviewed, committed |
| **P1** | `protocol/`: frame grammar, XOR checksum, command builders, response parser, `MockTransport` | unit tests green, frames match `CARD-API.md` §5 |
| **P2** | `cards/`: 16-byte record model + guest/master/record codecs | byte-identical to vendor output on the same inputs |
| **P3** | `cards/`: remaining 10 types, transcribed from the decompiled builders | byte-identical against the capture table |
| **P4** | `transport/webhid` + `reader/` high-level ops | read + write + log on the owned encoder |
| **P5** | `data/`: schema + `CardLock.mdb` import | row counts match the vendor DB |
| **P6** | `domain/`: room/lock state machine, check-in/out, expiry | unit tests |
| **P7** | UI: reception + staff cards | fr/en/ar, RTL, responsive, a11y |
| **P8** | UI: rooms, lock config, settings, operators | idem |
| **P9** | Reports + exports (PDF/CSV) | idem |
| **P10** | Wiring into Omnibook navigation + permissions | no regression on the booking app |

Status: **P0 done, P1 in progress.**

---

## 5. Verification strategy

1. **Byte-level oracle** — call the `proRFL` exports with fixed inputs and diff their
   output against our encoder. Any mismatch is a bug on our side.
2. **Hardware round trip** — write a record, read it back, compare 16 bytes
   (`card-rw.ps1` does this already).
3. **Lock acceptance** — a card is only "correct" when the lock accepts it (beeps,
   opens, or writes its log).
4. **Unit tests** — protocol/cards/domain are pure and must stay covered.

## 6. Risks

- The 4-byte trailer written by the reader is recomputed on board; we never need to
  produce it, but we must not treat it as data (`CARD-API.md` §9.1).
- The reader re-enumerates periodically: every operation needs bounded retries.
- `ReadRecord` streams 37-byte packets with a sequence byte; behaviour on a real record
  card still has to be observed end to end.
- Some card fields are still unverified (`L = 99`, the `M`/`O` nibble meaning).
  They are encoded exactly as the vendor does, and flagged in code with a comment.
