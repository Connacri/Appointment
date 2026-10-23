# Driving the card encoder

> Practical notes for re-using the installed proUSB encoder with your own tooling.
> Only for locks you own or administer.
>
> **Status: validated on real hardware.** Every frame, report ID and checksum below was executed
> against the connected encoder (`Reader_0000016`) and the resulting card content was read back.

## 1. What the encoder is

| Mode | Device | Driver | API |
|---|---|---|---|
| Legacy | AVR USB device (`D:\avr-usb\d12\d12.cpp`) | vendor kernel driver installed by the setup | `d12.dll` → `DeviceIoControl(IOCTL 0x22200C)` |
| **Pro** | **USB HID**, `VID 0x9915` / `PID 0x1116` | none (Windows HID) | `d12c.dll` → HID output report `0x40` |

The application picks the mode with `initializeUSB(0)` (legacy) or `initializeUSB(1)` (HID) and
passes the same flag to every card function.

## 2. Identifying the connected device

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/re-proUSB/hid-probe.ps1 -Action probe
```

Measured on the installed unit:

| Property | Value |
|---|---|
| PnP instance | `USB\VID_9915&PID_1116\READER_0000016` |
| VID / PID | `0x9915` / `0x1116` |
| bcdDevice | `0x0120` |
| Usage Page / Usage | `0x85FF` (vendor-defined) / `0x0000` |
| Input report length | **65 bytes** |
| Output report length | **65 bytes** |
| Feature report length | 0 |
| Manufacturer string | `Card Lock TEMIC_PRAD` |
| Product string | `proUSB-TEMIC` |
| Serial string | `Reader_0000016` |

The vendor-defined usage page is what separates it from keyboards/mice, which `d12c.dll` filters
out by report length (`0x102`, `0x106`).

## 3. Wire format (verified on hardware)

```
HID report  = [0x40] [ frame bytes … ] [ 0x00 padding ]   → exactly 65 bytes
```

`frame` for a card write:

```
AA 21 EC | 32 payload bytes | XOR checksum
                             ^ seeded with 0x67: 0x67 ^ payload[0] ^ … ^ payload[31]
```

`frame` for a command (buzzer, read, init):

```
AA <cmd> <args…> <xor of every preceding byte>
```

**One checksum rule covers every frame**: the last byte is the XOR of all bytes before it.
The `0x67` seed is only the initial accumulator value inside `WriteCard`, not a second scheme.

Reads return one 65-byte input report:

```
report[0] = 0x00 (report ID)   report[1] = 0x55 (frame start)   …
```

so the caller must skip byte 0 — which is exactly what `d12c.dll` does (`(&DAT_10132d3d)[i]`).

Response frame, observed from `ReadCard`:

```
55 15 01 | <20-byte card area> | <xor>
   │  │  └ status (0x01 = ok)
   │  └ 0x15 = 21 = 20 data bytes + 1 checksum
   └ start marker
```

Trailing bytes of the 65-byte report are `0xFF` padding.

## 4. Commands confirmed on the wire

| Action | Frame | Response |
|---|---|---|
| `ReadCard` | `AA 01 E4 4F` | `55 15 01 …` (24 meaningful bytes) |
| `ReadRecord` | `AA 01 82 29` | none on a non-record card |
| `Buzzer` on | `AA 02 80 01 29` | none — audible only |
| `Buzzer` off | `AA 02 80 00 28` | none |
| `WriteCard` | `AA 21 EC…` (§3) | **none by design** |
| `IniCard` mode 0 / 1 / 2 | `AA 01 96 3D` / `AA 01 69 C2` / `AA 01 56 FD` | none on a master card |

Notes:

* **`WriteCard` never reads a reply.** The decompiled function ends with a single
  `write_port(0x40, frame)` and returns; a silent write is therefore the nominal case, not a
  failure. Verify the write by reading the card back.
* `IniCard` *does* read (after a `Sleep` of 1200 ms, or 100 ms for mode 2), so silence there means
  the command does not apply to the card in the reader.
* `Buzzer` is the only command with an effect you can observe without software — it is the ideal
  transport test.

## 5. Harness in this repository

`tools/re-proUSB/hid-probe.ps1` — P/Invoke over `setupapi` + `hid`, no dependency to install.

```powershell
# enumerate and dump capabilities
… -Action probe

# one pending read, print the hex report
… -Action read -TimeoutMs 3000

# write a frame, wait, read one report
… -Action send -Hex "AA01E44F" -ReportId 64 -ReadDelayMs 400 -TimeoutMs 3000

# issue the read BEFORE the write (some devices answer only then)
… -Action listen -Hex "AA01963D" -TimeoutMs 4000

# audible test: level 1, pause, level 0
… -Action beep -ReportId 64 -BeepMs 600

# raw 65-byte report, byte 0 included (diagnostics only)
… -Action write -Hex "40AA01963D"
```

`-ReportId` defaults to `0x40`; use `0` to reproduce the exact buffer `d12c.dll` builds, since its
`DAT_10132d80 = 0x40;` is immediately followed by `memset(&DAT_10132d80, 0, 0x41)`.

`tools/re-proUSB/vendor-dll-test.ps1` — calls the vendor `d12c.dll` itself
(`IniUsbPro` / `writePortPro` / `readPortPro`). Must run under 32-bit PowerShell:

```powershell
& "$env:WINDIR\SysWOW64\WindowsPowerShell\v1.0\powershell.exe" `
  -NoProfile -ExecutionPolicy Bypass -File tools\re-proUSB\vendor-dll-test.ps1 -FrameHex "AA01963D"
```

Use it as ground truth: if the vendor DLL behaves like your harness, any difference with the
vendor application is in the caller, not in the transport.

## 6. End-to-end write test (performed)

The card left in the reader was **not blank** — it already held a master record (`byte 9 = 0xB9`).
The 16-byte record was read, rewritten unchanged, and read back identically; a one-byte change was
then written and observed, and the original record restored.

```
read  : 55 15 01 C9 12 17 22 FF 00 29 80 00 B9 19 D2 C0 29 D5 FB 50 29 46 6D 1E
write : AA 21 EC C9121722FF00298000B919D2C029D5FB 5029466D 000000000000000000000000 38
read  : 55 15 01 C9 12 17 22 FF 00 29 80 00 B9 19 D2 C0 29 D5 FB 50 50 00 83 CF
```

The 16-byte record round-tripped exactly. The 4 trailing bytes are **recomputed by the reader**:
`50 29 46 6D` was sent, `50 50 00 83` was stored. Writing the same payload again reproduces the
same trailer, so it is a deterministic function of the written data, not a timestamp or counter.

Practical consequence for a rebuild: **the host does not compute those 4 bytes.** Supply the
16-byte record (the value stored in `CardInfo.CardData`) and let the reader fill the trailer.

## 7. Commissioning sequence (as the vendor UI describes it)

1. **Reset Card** — `IniCard(port, mode, out)`, mode `0` / `1` / `2`, frame `AA 01 96 3D`,
   `AA 01 69 C2` or `AA 01 56 FD`; the reader answers with a 36-byte response.
2. **RoomNo. Setting** — `RoomSetCard(...)`, record byte 9 = `0x20 + n`.
3. **Lock Clock Setting** — `TimeSetCard(...)`, record byte 9 = `0x30 + n`.

Then guest/master cards (`0x60 + n`, `0xB0 + n`) are accepted by the lock.

Only step 1 failed to answer on the card at hand (a master card), which is consistent with
"reset applies to a record card", not with a broken link.

## 8. Caveats

* The legacy path needs the vendor's kernel driver; the HID path does not.
* Windows may hold the HID device exclusively while `CardLock.Exe` is running — close it first.
* **The device re-enumerates intermittently.** Roughly one probe in three finds no matching
  interface for a few hundred milliseconds. Any automation must retry (the scripts here loop up to
  six times); a production tool should also reopen both handles after a failure.
* `ReadFile` needs a handle opened with `GENERIC_READ` + `FILE_FLAG_OVERLAPPED`. Opening with
  access `0` — as the decompiler rendered it — fails with `ERROR_ACCESS_DENIED (5)`.
* `WriteFile` succeeds for report IDs the descriptor may not even define (`0x41` "works"), so a
  successful write proves nothing. Only the buzzer or a read-back proves the path.
* `IOCTL_HID_GET_REPORT_DESCRIPTOR` (`0x000B0000`) returns `ERROR_INVALID_FUNCTION (1)` on this
  device through the HID interface, and Windows publishes no `ReportDescriptor` registry value, so
  the descriptor itself could not be dumped. Report lengths come from `HidP_GetCaps`.
* The 4-byte trailer's algorithm and the meaning of several packed fields are still unresolved
  (`CARD-API.md` §9); do not assume a generated record will be accepted by a lock until you test
  it on a lock you administer.
