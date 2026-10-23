# proUSB Hotel Lock System — card format & encoder protocol

> Recovered by static decompilation of the shipped DLLs (Ghidra 12.1.4 via REA).
> Confidence labels: **verified** = read directly from decompiled code; **inferred** = derived
> from code shape + database correlation; **unknown** = not yet resolved.
>
> Scope: this documents an **installed, owned** system for interoperability / maintenance.
> It is not a guide for accessing locks you do not administer.

## 1. Layer stack

```
CardLock.Exe  (Delphi 7, business logic, DB)
   └─ proRFL.dll        builds the card record + wraps it in a frame
        ├─ d12.dll      legacy transport  (AVR USB device, custom kernel driver)
        └─ d12c.dll     "Pro" transport   (USB HID, report 0x40)
```

`proRFL` exports (30, **verified**): `initializeUSB`, `GuestCard`, `MasterCard`, `FloorCard`,
`BuildingCard`, `GroupCard`, `GroupSetCard`, `EmergencyCard`, `CheckOutCard`, `LimitCard`,
`RecordCard`, `RoomSetCard`, `TimeSetCard`, `IniCard`, `IniCard1`, `ResetCard`, `CloseCard`,
`CardErase`, `ReadCard`, `ReadRecord`, `ReadE2`, `WriteCard`, `WriteE2`, `DirectReadUSB`,
`DirectWriteUSB`, `Buzzer`, `proTest`, `a_hex`, `hex_a`, `GetDLLVersion`.

## 2. Transport selection (**verified**)

Every card function takes a port selector as its first argument:

```c
void initializeUSB(char pro) {
    if (pro == 0) IniUsb();      /* d12.dll  — legacy AVR driver  */
    else          IniUsbPro();   /* d12c.dll — USB HID "Pro"     */
}

/* and in the writer */
void write_port(char pro, uint32 len, void *buf) {
    if (pro == 0) writePortb(len, buf);   /* d12.dll  */
    else          writePortPro(len, buf); /* d12c.dll */
}
```

So `0` selects the legacy device and any non-zero value selects the HID device.

## 3. Legacy transport — `d12.dll` (**verified**)

* Vendor source paths embedded in the binary: `D:\avr-usb\d12\d12.cpp`, `D:\avr-usb\d12\OpenByIntf.cpp`
  → the encoder is an **AVR-based USB device** with a custom kernel driver.
* Device open: `SetupDiGetClassDevs` + `SetupDiGetDeviceInterfaceDetail` + `CreateFile`
  (interface GUID at `d12!DAT_10017678`).
* Every transfer is one IOCTL:

```c
DeviceIoControl(handle, 0x22200C, buf, len, buf, len, &returned, NULL);
```

`0x22200C` decodes as DeviceType `0x22`, Function `0x803`, Method `0` (buffered), Access `0`.
The same buffer is used for input and output.

* `writePortb(len, buf)` and `readPortb(len, buf)` are thin wrappers around this IOCTL.

## 4. "Pro" transport — `d12c.dll`, USB HID (**verified**)

### 4.1 Device discovery (`IniUsbPro`)

1. `HidD_GetHidGuid(&guid)`
2. `SetupDiGetClassDevsA(&guid, NULL, NULL, 0x12 /* PRESENT|DEVICEINTERFACE */)`
3. loop `SetupDiEnumDeviceInterfaces` + `SetupDiGetDeviceInterfaceDetailA` → `DevicePath`
4. `CreateFileA(path, 0, FILE_SHARE_READ|WRITE, NULL, OPEN_EXISTING, 0, NULL)`
5. `HidD_GetAttributes` and **filter**:

| Field | Accepted value |
|---|---|
| `VendorID` | **0x9915** (comparison constant `-0x66EB` sign-extended) |
| `ProductID` | **0x1116** |

6. `HidP_GetCaps` → `InputReportByteLength` / `OutputReportByteLength`
   (also rejects HID devices whose report lengths identify a mouse `0x102` or keyboard `0x106`)
7. second `CreateFileA(path, GENERIC_WRITE, …)` → handle used for writes

### 4.2 Write (`writePortPro` → `FUN_10001a60`) (**verified on hardware**)

The decompiled order of the two first statements is a debug-build dead store: the report ID is
written and then zeroed.

```c
BYTE report[65];
DAT_10132d80 = 0x40;              /* HID report ID …                      */
memset(&DAT_10132d80, 0, 0x41);   /* … immediately overwritten with 0x00  */
memcpy(&DAT_10132d81, frame, 63); /* 63-byte payload at offset 1          */
WriteFile(hWrite, report, OutputReportByteLength, &written, NULL);
```

Report ID `0x40` is the one that actually drives the device: three buzzer frames sent with it
produced three audible beeps (§4.4). `WriteFile` also accepts `0x00` and even `0x41`, so a
successful write is not proof of anything — only the buzzer or a card read-back is.

### 4.3 Read (`readPortPro` → `FUN_100018c0`) (**verified on hardware**)

* read handle: `CreateFileA(path, GENERIC_READ, FILE_SHARE_READ|WRITE, NULL, OPEN_EXISTING,
  FILE_FLAG_OVERLAPPED, NULL)` — opening with access `0` fails with `ERROR_ACCESS_DENIED (5)`
* manual-reset event + overlapped `ReadFile`, then `WaitForSingleObject(event, 2000)` → 2 s timeout
* one input report is **65 bytes**: `report[0]` is the report ID (`0x00` on this device) and the
  useful payload starts at `report[1]`; `d12c.dll` copies from `&DAT_10132d3c + 1`, i.e. it skips
  byte 0 and hands 63 bytes to the caller

### 4.4 Hardware validation (**verified**)

Measured against the installed encoder (`USB\VID_9915&PID_1116\READER_0000016`):

| Property | Value |
|---|---|
| `HidD_GetAttributes` | VID `0x9915`, PID `0x1116`, version `0x0120` |
| Usage Page / Usage | `0x85FF` (vendor) / `0x0000` |
| `InputReportByteLength` | 65 |
| `OutputReportByteLength` | 65 |
| `FeatureReportByteLength` | 0 |
| Manufacturer | `Card Lock TEMIC_PRAD` |
| Product | `proUSB-TEMIC` |
| Serial | `Reader_0000016` |

Exercised commands:

| Command | Frame | Observed result |
|---|---|---|
| `Buzzer` on / off | `AA 02 80 01 29` / `AA 02 80 00 28` | **three distinct beeps**, send path proven |
| `ReadCard` | `AA 01 E4 4F` | `55 15 01 <20 bytes> <xor>` + `0xFF` padding, byte-for-byte reproducible |
| `WriteCard` | `AA 21 EC …` | no reply (nominal — `WriteCard` never reads); card content confirmed by read-back |
| `ReadRecord` | `AA 01 82 29` | no reply on a master card |
| `IniCard` 0 / 1 / 2 | `AA 01 96 3D` / `69 C2` / `56 FD` | no reply on a master card |

`IOCTL_HID_GET_REPORT_DESCRIPTOR` (`0x000B0000`) returns `ERROR_INVALID_FUNCTION (1)` on this
device and Windows exposes no `ReportDescriptor` registry value, so the descriptor itself could not
be dumped. Report lengths are taken from `HidP_GetCaps`.

The device also **re-enumerates intermittently**: roughly one probe in three finds no matching
interface for a few hundred milliseconds, so every hardware call needs a retry loop.

## 5. Frame format (**verified**)

Every request follows the same grammar:

```
offset 0      AA       start marker
offset 1      n        payload length + 1 (bytes that follow, checksum excluded)
offset 2      cmd
offset 3..    payload  n-1 bytes
offset 2+n    xor      XOR of every preceding byte (§5.1)
```

`WriteCard(port, record)` is the `cmd = 0xEC` case with a 32-byte payload:

```
AA 21 EC | payload[32] | xor        = 36 meaningful bytes
```

The transfer length is **64 bytes** (`write_port(port, 0x40, frame)`). On the HID path the rest of
the report is whatever was left in the caller's buffer — `proRFL` sends `0xCC` stack filler, the
vendor EXE sends zeros — and the reader ignores it.

### 5.1 Checksum rule — one rule for every frame (**verified**)

In every frame observed, both request and response, the **last byte is the XOR of all the bytes
before it**:

```
Buzzer    AA 02 80 01 29      → AA ^ 02 ^ 80 ^ 01 = 29
IniCard   AA 01 96 3D         → AA ^ 01 ^ 96      = 3D
ReadCard  AA 01 E4 4F         → AA ^ 01 ^ E4      = 4F
ReadRec.  AA 01 82 29         → AA ^ 01 ^ 82      = 29
Response  55 15 01 … 46 6D 1E → 1E
```

The `0x67` seed is only the initial accumulator inside `WriteCard`, not a second scheme.

### 5.2 Response frame (**verified**)

```
55 15 01 | <20-byte card area> | <xor>
   │  │  └ status: 0x01 observed on success
   │  └ 0x15 = 21 = 20 data bytes + 1 checksum
   └ start marker (the only byte `ReadRecord` tests)
```

Input reports are `0xFF`-padded to 65 bytes. `ReadCard` output is reproducible byte-for-byte
across reads, so the random nonce of §7.2 is stored on the card, not regenerated at read time.

### 5.3 Write payload length is variable (**verified on hardware**)

`n` is not fixed at `0x21`: the reader accepts a **16-byte** payload for `cmd = 0xEC` as well.

| Frame | Total | Result |
|---|---|---|
| `AA 21 EC` + 32-byte payload + xor | 36 | accepted (`proRFL.WriteCard`) |
| `AA 11 EC` + 16-byte record + xor | 20 | **accepted — card read back the exact record** |

Both were sent to the same TEMIC card through `d12c.writePortPro(0x40, …)` and read back with
`ReadCard`:

```
AA21EC C9121722FF00318000B919D2C029D5FB 00×16 72   → nonce 0x29 became 0x31 on the card
AA11EC C91224B6E3818101016265DB1565E300 B2          → guest record stored byte-for-byte
```

So a rebuild only needs the compact form (`n = 0x11`); the reader still keeps a **20-byte card
area** (record + its own 4-byte trailer, §9 item 1), and the extra 16 bytes of the `0x21` form are
ignored.

## 6. Card type selector — record byte 9 (**verified**)

Byte 9 (offset `0x3B` in the builder stack frame) is `type | (index & 0x0F)`:

| Byte 9 | Card |
|---|---|---|
| `0x10 + n` | `RecordCard` (lock record readout) |
| `0x20 + n` | `RoomSetCard` (assign room number to lock) |
| `0x30 + n` | `TimeSetCard` (set lock clock) |
| `0x40 + n` | `LimitCard` |
| `0x50 + n` | `GroupSetCard` |
| `0x60 + n` | `GuestCard` |
| `0x70 + n` | `CheckOutCard` |
| `0x80 + n` | `GroupCard` |
| `0xA0 + n` | `EmergencyCard` |
| `0xB0 + n` | `MasterCard` |
| `0xC0 + n` | `BuildingCard` (`(n & 0xF) - 0x40`) |
| `0xD0 + n` | `FloorCard` (`(n & 0xF) - 0x30`) |

`n` is the card sequence/index handed in by the caller.

**Cross-check against the installed database** (62 `CardInfo` rows): byte 9 values are
`0x60,0x61,0x62,0x69,0x6C,0x6F` (guest) and `0xB0…0xBF` (master) plus 16 rows in a different
layout (see §9). This matches the table above and confirms the mapping.

## 7. Record layout

### 7.1 Common head

| Byte | Value |
|---|---|
| 0 | `0xC9` (magic) |
| 1 | high byte of a 24-bit site/serial parameter (`param_2`); `0x12` in all observed cards |
| 2–3 | `|param_2| & 0x3FFF`, little-endian (observed `0x0000`) |
| 8 | `param_4` (caller-supplied) |
| 9 | card type + index (§6) |

### 7.2 MasterCard (**verified** — matches 44 DB rows)

Arguments: `(port, param_2, param_3, param_4, param_5, param_6, param_7, d8, d9, d10, outHex)`
where `d8`, `d9`, `d10` are decimal digit strings read as 2-character pairs.

```
p8[2..3] -> A      p9[0..1] -> I     p10[2..3] -> E
p8[4..5] -> B      p9[2..3] -> J     p10[4..5] -> F
p8[6..7] -> C                        p10[6..7] -> G
p8[8..9] -> D                        p10[8..9] -> H
p8[0..1] -> M = (value - 9) & 0x0F
p10[0..1]-> O = (value - 9) & 0x0F
```

| Byte | Expression |
|---|---|
| 4 | `param_7` (minus `0x80` when `param_5 != 0`) |
| 5 | `(J / 10) + I * 8` |
| 6 | `rand() & 0xFF` **(random nonce)** |
| 7 | `param_6 << 4` |
| 8 | `param_4` |
| 9 | `0xB0 \| (param_3 & 0x0F)` |
| 10 | `((M & 0x0F) << 4) \| A` |
| 11 | `(C >> 2) \| (B << 3)` |
| 12 | `((C & 3) << 6) \| D` |
| 13 | `((O & 0x0F) << 4) \| E` |
| 14 | `(G >> 2) \| (F << 3)` |
| 15 | `((G & 3) << 6) \| H` |

Decoding a real row (`CardData = C9120000FF00298000B1881BC2F81DFB`, `ID=3`):

| Field | Value |
|---|---|
| bytes 0–3 | `C9 12 00 00` |
| byte 4 (`param_7`) | `0xFF` |
| byte 5 | `0x00` → `I = 0`, `J < 10` |
| byte 6 | `0x29` → random nonce |
| byte 7 | `0x80` → `param_6 = 8` |
| byte 8 (`param_4`) | `0x00` |
| byte 9 | `0xB1` → MasterCard, index 1 |
| byte 10 | `0x88` → `M = 8`, `A = 8` |
| byte 11 | `0x1B` → `B = 3`, `C >> 2 = 3` |
| byte 12 | `0xC2` → `C & 3 = 3` ⇒ `C = 15`, `D = 2` |
| byte 13 | `0xF8` → `O = 15`, `E = 8` |
| byte 14 | `0x1D` → `F = 3`, `G >> 2 = 5` |
| byte 15 | `0xFB` → `G & 3 = 3` ⇒ `G = 23`, `H = 59` |

Reading the two groups as timestamps gives **2015‑08‑03** and **2023‑08‑03 23:59** — consistent
with a validity window (**inferred**: start / end). `M` and `O` are two extra 4-bit fields whose
meaning is **unknown** (weekday, card counter, or part of a checksum).

**Cross-check on a real card** (`ReadCard` against the connected encoder, `byte 9 = 0xB9`):

```
record16 = C9 12 17 22 FF 00 29 80 00 B9 19 D2 C0 29 D5 FB
```

| Byte | Raw | Decode |
|---|---|---|
| 4 | `FF` | `param_7` |
| 5 | `00` | `I = 0`, `J < 10` |
| 6 | `29` | random nonce (stable across reads) |
| 7 | `80` | `param_6 = 8` |
| 8 | `00` | `param_4` |
| 9 | `B9` | **MasterCard, index 9** |
| 10 | `19` | `M = 1`, `A = 9` |
| 11 | `D2` | `B = 26`, `C >> 2 = 2` |
| 12 | `C0` | `C & 3 = 3` ⇒ `C = 11`, `D = 0` |
| 13 | `29` | `O = 2`, `E = 9` |
| 14 | `D5` | `F = 26`, `G >> 2 = 5` |
| 15 | `FB` | `G & 3 = 3` ⇒ `G = 23`, `H = 59` |

→ **2011‑09‑26** → **2023‑09‑26 23:59**. Same bit layout as the database rows, and `H = 59`
confirms the last field is a minute. `D` (0 here, 2 in the row above) is still ambiguous — hour or
minute of the start instant.

### 7.3 GuestCard (**verified** — builder, database and hardware round-trip)

The EXE does **not** call `proRFL.GuestCard` (that export is not imported); it assembles the record
itself in `FUN_006cea00` and writes it with its own frame (§7.7).

The single input string `s` (`*(AnsiString*)([0x6ed3bc] + 0x64)`) is four 2-character decimal
fields:

```
s = I I  J J  K K  L L          e.g. "01 01 01 99"
     ││   ││   ││   └┴─ L = 99, constant sentinel (never varies in the database)
     ││   ││   └┴─────── K = room within the floor  (room mod 100)
     ││   └┴─────────── J = floor                    (room div 100)
     └┴──────────────── I = card index (same value as the low nibble of byte 9)
```

| Byte | Expression | Observed |
|---|---|---|
| 0–1 | `site >> 16` | `C9 12` |
| 2–3 | `site & 0x3FFF` (+`0x4000` when the cover flag is set) | `24 B6`, `31 6A`, `16 9A`, `03 3B` |
| 4 | `L & 0x7F \| 0x80` | `E3` in **all 10** guest rows |
| 5 | `K & 0x7F \| 0x80` | `1-101`→`81`, `1-102`→`82`, `1-205`→`85` |
| 6 | `J & 0x7F \| 0x80` | `1-xxx`→`81`, `2-xxx`→`82` |
| 7 | `I & 0xFF \| ((index & 3) << 6)` | `01` in all 10 rows |
| 8 | scalar from the settings object (`[0x6ed3bc] + 0x28`) | `00`, `01`, `02` |
| 9 | `0x60 \| (index & 0x0F)` | `62`, `69`, `6C`, `6F`, … |
| 10–15 | start / expiry, same bit-packing as §7.2 (`YYMMDDHH` per group) | see below |

**Worked example** — `CardInfo.ID = 2`, `Holder = [WalkIn]1-101`,
`CardData = C91224B6E3818101016265DB1565E300`:

```
C9 12 | 24 B6 | E3 | 81 | 81 | 01 | 01 | 62 | 65 DB 15 | 65 E3 00
 │  │    │      │    │    │    │    │    │    └─ expiry  2012-05-28 00:00
 │  │    │      │    │    │    │    │    └────── start   2012-05-27 21:00
 │  │    │      │    │    │    │    └─────────── 0x62 = GuestCard, index 2
 │  │    │      │    │    │    └──────────────── byte 8 = 1
 │  │    │      │    │    └───────────────────── byte 7 = I = 1
 │  │    │      │    └────────────────────────── byte 6 = J | 0x80 → floor 1
 │  │    │      └─────────────────────────────── byte 5 = K | 0x80 → room 101 → 1
 │  │    └────────────────────────────────────── byte 4 = 99 | 0x80
 │  └─────────────────────────────────────────── site & 0x3FFF
 └────────────────────────────────────────────── site >> 16
```

Room mapping checked against **all 10** guest rows (`1-101/102/103/104`, `1-202`, `1-205`, plus
three `wanzhou home` cards) — `J`/`K` always equal `room div 100` / `room mod 100`.

This exact record was **written to the connected encoder and read back byte-for-byte** (§5.3,
§10), so the input encoding is measured, not inferred. `L = 99` is the only field still without a
known meaning; it is constant, so a rebuild can hard-code it.

### 7.4 RoomSetCard (**verified**)

```
0x3B = 0x20 + (param_3 & 0x0F)
byte 4 = p7[0..1] pair      byte 5 = p7[2..3]
byte 6 = p7[4..5]           byte 7 = param_5<<4 | (p6[0..1] & 0x0F)
byte 8 = param_4            byte 9 = (param_3 & 0x0F) + 0x20
byte 10 = ((p6[0..1]-9)&0xF)<<4 | p6[2..3]
byte 11 = (C>>2) | (B<<3)   byte 12 = ((C&3)<<6) | D
byte 13..15 = rand()        (random nonce)
```

### 7.5 TimeSetCard (**verified**)

`0x3B = (param_3 & 0x0F) + 0x30`; bytes 4–7 are `rand()`; byte 8 = `param_4`;
byte 9 = `0x30 + n`; byte 10 = `(p6[0..1]-9)<<4 | p6[2..3]`; bytes 11–12 = packed `p6` pairs;
byte 13 = `param_5 & 7`; bytes 14–15 = `rand()`.

### 7.6 Other types

`FloorCard`, `BuildingCard`, `GroupCard`, `EmergencyCard`, `CheckOutCard`, `LimitCard`,
`GroupSetCard`, `RecordCard` all use the same `0xC9` + type-byte scheme; their per-field packing
was not fully transcribed. `CardErase`, `ResetCard`, `CloseCard` and `IniCard` use a **different,
shorter frame** (`AA …` command frames, no `0xC9` record).

### 7.7 How `CardLock.Exe` writes a guest card (**verified**)

`FUN_006cea00` (reached only from the writer dispatcher `FUN_006d8c44`, case `6`) ends with:

```c
local_9c = "ec" + <32 hex chars of the record>   /* Concat, literal at 0x6cf24c = "ec" */
FUN_006ce8cc(local_9c);
```

`FUN_006ce8cc` then serialises the frame in **legacy line order** and pushes it straight to the HID
port:

```c
n    = Length(local_9c) / 2 + 3;      /* 34/2 + 3 = 0x14 = 20 */
hdr  = Format('%.2x', n);             /* "14" */
body = local_9c + hdr;                /* EC, record[16], 0x14 */
xor  = XOR of every byte of body;
buf  = body + xor + "00" × 16;        /* 19 + 16 = 35 bytes */
a_hex(buf, [0x6ece6c], 0x80);         /* hex → bytes, stops at the first non-hex char */
writePortPro(0x40, [0x6ece6c]);       /* 64-byte report */
```

`[0x6ece6c]` is a zero-filled 1 KB scratch buffer (cleared by `rep movsd` / `0x401` bytes at
`0x6cd153`), so the last 29 bytes of the report are zeros.

That is the **same logical frame as `AA 11 EC` + record + xor**, only serialised for the old
`d12.dll` line protocol: command first, *total* length last (`0x14` = 20 = the size of
`AA 11 EC` + 16 + xor). Sent to the USB reader unchanged it is ignored — verified on hardware:
the card did not change.

The form the USB firmware accepts is the `AA` envelope of §5:

```
AA 11 EC | record[16] | xor          /* 20 bytes — verified, card read back identically */
```

Consequence for a rebuild: build the 16-byte record per §7.3 and send
`AA 11 EC <record> <xor>` through `writePortPro(0x40, buf)` (or write report id `0x40` directly on
the HID device). Do not reproduce the legacy ordering.

## 8. `IniCard` — lock initialisation (**verified**)

```c
frame = { 0xAA, 0x01, m0, m1 }      /* 4 bytes */
m0,m1 = { 0x69,0xC2 }  when mode == 1
        { 0x96,0x3D }  when mode == 0
        { 0x56,0xFD }  when mode == 2

write_port(port, 0x40, frame);
if (port == 0) read_port(port, 0x40, resp);   /* legacy only */
Sleep(mode == 2 ? 100 : 1200);
read_port(port, 0x40, resp);
hex_a(resp, out, 0x24);                       /* 36-byte response → 72 hex chars */
```

This is the **Reset Card** step of the commissioning sequence.

## 9. Open items

1. **Record length — resolved on hardware.** The card area returned by `ReadCard` is **20 bytes**
   (`55 15 01` + 21 = 20 data + 1 checksum). The first 16 bytes are the record the builders
   produce and the database stores (`CardInfo.CardData`, 32 hex chars). The last 4 bytes are
   **computed by the reader**: `50 29 46 6D` was sent in the payload and `50 50 00 83` was stored;
   rewriting the same payload reproduces the same trailer. `WriteCard` still transmits 32 bytes —
   12 of them (zero padding on our harness, stack garbage in the vendor application) are ignored
   beyond the 20-byte area.
2. **Trailer algorithm unknown.** It is deterministic and data-dependent, but not a standard
   CRC-32 (zlib / reflected / non-reflected, with and without init/xorout, over 16, 20 or 32
   bytes — see `tools/re-proUSB/trailer-crc-guess.mjs`). A rebuild using the same reader hardware
   does not need it.
3. **Guest card input encoding — resolved** (§7.3): `IIJJKKLL` decimal string → bytes 4–7, and the
   card is written with `AA 11 EC` + record + xor (§5.3, §7.7), verified on hardware. The only
   unknown left is the constant `L = 99`.
4. **16 anomalous `CardInfo` rows** (byte 9 = `0x01,0x08,0x0A,0x0B,0x0F,0x1D,0x1E`, prefixes
   `C912033B / C912169A / C912316A`) that do not fit the type table. Probably records produced by
   an older build or a different card family.
5. **`param_2` (24-bit site/serial)** and the meaning of the `M` / `O` nibbles in the date groups.
   `A/B/C/D` and `E/F/G/H` are month/day/year/hour: the guest row reads 2012‑05‑27 21:00 →
   2012‑05‑28 00:00.
6. **`IniCard` does not answer on a master card.** Read/init commands are silent while `ReadCard`
   and `WriteCard` work, so the reset step presumably targets a record card only. Needs a blank
   record card to confirm.

## 10. Hardware test log (2026‑10‑23)

The encoder was connected for this analysis (`Reader_0000016`).

* The card left in the reader was **not blank**: it held a valid master card (`0xB9`,
  2011‑09‑26 → 2023‑09‑26), i.e. an expired card from the previous installation.
* Its 16-byte record was read, rewritten unchanged, read back identically, then modified
  (nonce `29` → `2A`), observed on the card, and restored to the original value.
* The 4-byte trailer could not be restored to its pre-test value (`50 29 46 6D`) because the
  reader always recomputes it; the card now carries `50 50 00 83`. The 16-byte record — the part
  the database and the builders use — is byte-identical to the original.
* No lock was available, so **no card produced by this analysis has been presented to a lock**.

### 10.1 Guest-record round trip (same session)

| Step | Frame sent | Record on the card after |
|---|---|---|
| baseline | `AA 01 E4 4F` | `C9121722FF00298000B919D2C029D5FB` (master, nonce `29`) |
| control | `AA 21 EC` + payload + xor | `C9121722FF00318000B919D2C029D5FB` (nonce `29`→`31`) |
| legacy order (§7.7) | `EC` + record + `14` + xor + `00`×16 | **unchanged** — the firmware ignores it |
| 16-byte guest | `AA 11 EC` + `C91224B6…E300` + `B2` | `C91224B6E3818101016265DB1565E300` |
| restore | `AA 21 EC` + master record + `00`×16 + `6A` | `C9121722FF00298000B919D2C029D5FB` |

Every write blocks the reader for ~2 s (the `readPortPro` call that follows takes 2004–2015 ms
instead of 2 ms) and emits the audible beep sequence; `cmd = 0xEC` never returns a reply. The card
is back to its original 16-byte master record, trailer `50 50 00 83` as in §10.
