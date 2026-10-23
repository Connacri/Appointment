# Driving the card encoder

> Practical notes for re-using the installed proUSB encoder with your own tooling.
> Only for locks you own or administer.

## 1. What the encoder is

| Mode | Device | Driver | API |
|---|---|---|---|
| Legacy | AVR USB device (`D:\avr-usb\d12\d12.cpp`) | vendor kernel driver installed by the setup | `d12.dll` → `DeviceIoControl(IOCTL 0x22200C)` |
| **Pro** | **USB HID**, `VID 0x9915` / `PID 0x1116` | none (Windows HID) | `d12c.dll` → HID output report `0x40` |

The application picks the mode with `initializeUSB(0)` (legacy) or `initializeUSB(1)` (HID) and
passes the same flag to every card function.

## 2. Is the encoder present?

```powershell
Get-PnpDevice -PresentOnly |
  Where-Object { $_.InstanceId -match 'VID_9915' -or $_.InstanceId -match 'PID_1116' } |
  Format-List Status, Class, FriendlyName, InstanceId
```

At the time of this analysis **no such device was present** on the machine — the encoder was not
plugged in, so nothing below has been exercised against hardware.

## 3. Wire format (recap)

Every card write is one 64-byte transfer:

```
AA 21 EC | 32 payload bytes | XOR checksum | zero padding
                             ^ 0x67 ^ payload[0..31]
```

HID framing adds the report ID:

```
report[0]    = 0x40
report[1..63]= frame (padded with 0x00)
WriteFile(handle, report, OutputReportByteLength)
```

Reads are the mirror image: one input report, 63 payload bytes, 2 s timeout.

## 4. Commissioning sequence (as the vendor UI describes it)

1. **Reset Card** — `IniCard(port, mode, out)`, mode `0` / `1` / `2`, frame `AA 01 96 3D`,
   `AA 01 69 C2` or `AA 01 56 FD`; the lock answers with a 36-byte response.
2. **RoomNo. Setting** — `RoomSetCard(...)`, record byte 9 = `0x20 + n`.
3. **Lock Clock Setting** — `TimeSetCard(...)`, record byte 9 = `0x30 + n`.

Then guest/master cards (`0x60 + n`, `0xB0 + n`) are accepted by the lock.

## 5. Minimal HID harness (Python)

```python
# pip install hidapi
import hid

VID, PID = 0x9915, 0x1116

def open_encoder():
    for d in hid.enumerate(VID, PID):
        # usage_page/usage distinguish the vendor collection from keyboard/mouse ones
        dev = hid.device()
        dev.open_path(d["path"])
        return dev
    raise SystemExit("encoder not found")

def xor_checksum(payload32: bytes) -> int:
    c = 0x67
    for b in payload32:
        c ^= b
    return c & 0xFF

def frame(payload32: bytes) -> bytes:
    assert len(payload32) == 32
    body = bytes([0xAA, 0x21, 0xEC]) + payload32 + bytes([xor_checksum(payload32)])
    return body.ljust(63, b"\x00")

def write_card(dev, payload32: bytes):
    report = bytes([0x40]) + frame(payload32)      # 64 bytes
    dev.write(report)

def read_card(dev) -> bytes:
    data = dev.read(64, timeout_ms=2000)           # strips nothing: check your hidapi build
    return bytes(data[1:64])                       # skip report ID
```

`hid.device.write` prepends nothing; the first byte of the buffer **is** the report ID, which is
why `report[0] = 0x40`. If your `hidapi` build expects a different convention, the device will
simply not answer — verify with a read after the write.

## 6. Replaying an existing card (safest first test)

The database already stores 16-byte records (`CardInfo.CardData`, 32 hex chars). A card whose
record was issued by this system can be reproduced without rebuilding the field semantics:

```python
rec16 = bytes.fromhex("C9120000FF00298000B1881BC2F81DFB")   # CardInfo.CardData
payload32 = rec16 + bytes(16)                                # see CARD-API.md §9 (length open item)
write_card(dev, payload32)
```

This is the quickest way to confirm the transport, checksum and report framing on real hardware
before generating new records.

## 7. Verifying a write

1. `write_card(...)` must not raise.
2. Immediately `read_card(...)`: the lock/encoder echoes a 36-byte response for `IniCard`; for
   record writes the reply is the device status.
3. Present the card to a lock you administer and use the vendor UI's *Card Info* / *Record* read to
   confirm the record matches `CardInfo.CardData`.

## 8. Caveats

* The legacy path needs the vendor's kernel driver; the HID path does not.
* Windows may hold the HID device exclusively while `CardLock.Exe` is running — close it first.
* The 4 bytes after the 16-byte record and the exact meaning of several packed fields are still
  unresolved (`CARD-API.md` §9); do not assume a generated record is valid until a lock accepts it.
