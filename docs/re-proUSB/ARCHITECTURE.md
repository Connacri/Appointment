# proUSB Hotel Lock System — Architecture

> Reverse-engineering notes for the locally installed **proUSBHotelLockSystem** (`CardLock.Exe`).
> Everything below is derived from static inspection of the shipped artifacts plus the app's own
> database. Statements are labelled **observed**, **inferred**, or **unknown**.

## 1. Target identity

| Item | Value |
|---|---|
| Install dir | `C:\Program Files (x86)\ProUSB SOFTWARE\proUSBHotelLockSystem` |
| Main executable | `CardLock.Exe` — 4 165 632 bytes, PE32 **x86**, native (no CLI/.NET header) |
| SHA-256 | `06965b8ae63576c2ede293c24454ef792068f4e0a62b0d01de1166d1fed9fdc1` |
| Database | `CardLock.mdb` — Microsoft Access (Jet 4.0), **password protected** |
| Vendor lineage | `proM9-20121130-14`, `proUSB20140107`, `proUSB2014` strings in `Reg.ini` / reader IDs |

**Observed** (REA `inspect_managed_artifact`): *"The PE has no CLI data directory; managed metadata and CIL are unavailable."*
→ the binary is native, so there is no IL to decompile; analysis is x86 native code.

## 2. Toolchain

| Layer | Technology | Evidence |
|---|---|---|
| Language / VCL | **Borland Delphi 7** with Tnt Unicode controls | compile paths `d:\program files (x86)\borland\delphi7\Lib\TntControls.pas`, `TntForms.pas`, `TntActnList.pas` |
| UI | VCL forms + skins | 15 embedded `TPF0` DFM forms; `mxskin10/20/22/24/28.skn`; `Skin = mxskin20.skn` |
| UI extras | Raize components | `TRzFrmCustomizeToolbar` |
| DB access | **DevArt DAC** (BDE + OLE DB + MySQL providers) | `D:\Projects\Delphi\Dac\Common\Source\CR*.pas`, `MyDac*`, `IDAPI32.DLL`, `libmysql.dll`, `xolehlp.dll` |
| Reports | Excel templates | `Reports\ReportGuests.xls`, `ReportCards.xls`, `ReportOpen.xls` |
| Crypto (optional) | OpenSSL | `libeay32.dll`, `ssleay32.dll` |

The presence of `libmysqld.dll` / `MySQLUniProvider` means the app can run against MySQL instead of
Access — the Access file is the single-user default.

## 3. Component map

| Module | Role | Key facts |
|---|---|---|
| `CardLock.Exe` | UI, business logic, DB, card-record construction | Delphi 7, 15 forms, ~108 859 unique ASCII strings |
| `proRFL.dll` | **Card model API** — builds/writes each card type | 30 exports (see `CARD-API.md`), imports `d12.dll` + `d12c.dll` |
| `d12.dll` | USB bridge to the encoder hardware | exports `IniUsb`, `readPorta/b`, `writePorta/b`; uses `SETUPAPI` + `DeviceIoControl` |
| `d12c.dll` | MFC wrapper/protocol layer for `d12` | MFC-based (hence shipped `MFC42D.DLL`, `MSVCRTD.DLL`) |
| `Mwic_32.dll` | Smart-card / memory-card command library + DES | 244 exports: chip families, `DES_Encrypt/Decrypt`, `Read_45/Write_45` |
| `accesspv.exe` | Access runtime helper (2002 build) | unused by the modern path |
| `CardLock.mdb` | Primary datastore | 8 tables, see `DATA-MODEL.md` |

**Data flow (inferred from exports + UI handlers):**

```
frmReceiption (cmd*CardClick)
        │  builds a 16-byte card record from RoomInfo/GuestInfo + operator
        ▼
   proRFL.dll  GuestCard / FloorCard / MasterCard / RoomSetCard / TimeSetCard / …
        │  card-type encoding + checksum
        ▼
   d12.dll  writePorta/writePortb (USB, byte-wise port protocol)
        │
        ▼
   USB encoder + lock cards (memory/CPU cards handled via Mwic_32 where applicable)
```

The DB row `CardInfo.CardData` stores the same 16-byte record as hex (32 chars), which makes the
card format partially observable **without** the hardware.

## 4. Operational model (from DFM captions + hints)

Lock commissioning is a documented 3-step card sequence:

1. **Reset Card** — hint: *"1st step, Reset the Lock"*
2. **RoomNo. Setting** — *"2nd step, Set a RoomNo. to Lock"*
3. **Lock Clock Setting** — *"3rd, Initialize the Lock Clock"*

Card types the system can issue (each a separate handler → `proRFL` export):

`GuestCard` (Issue Card), `FloorCard`, `BuildingCard`, `MasterCard`, `EmergencyCard`, `GroupCard`,
`RecordCard`, `BlackNameCard` (blacklist), `CheckOutCard`, `RoomSetCard`, `TimeSetCard`,
`GroupSetCard`, `LimitCard`, `IniCard`, plus `ReadCard` / `ReadE2` / `ReadRecord` for retrieval.

Guest lifecycle: check-in (`frmReceiption`), card search (`cmdSearchCardNo`), check-out by card or
without card (`CheckOutByCard` / `CheckOutNoCard`), room status changes (`CloseModiRoomStatus`).

## 5. Configuration state

| File | Contents (observed) |
|---|---|
| `System.ini` | `[SYSTEM]` hotel name, skin, `DBBakPath`, `dlsCoID=1180475`, checkout times, `SA`/`SB`/`SC` (licence triple) |
| `Reg.ini` | Append-only **activation log**: timestamp, `SN`, `Date`, `Days`, `SerialNo1/2`, `ReaderInfo` hex (contains `proM9-…` / `proUSB2014…` ASCII inside the blob) |
| `CardLock.mdb/RegInfo` | `Registor` date (2008-11-11) + `RegDate` 8-byte hash |

`Reg.ini` shows repeated re-activations (2015 → 2023) with `Days` = 100, 3000, 4095, 4080, 4094 and
occasional `ErrRDN` flags — trial/renewal metering, not a hardware dongle.

### 5.1 Activation ("Serial No.") — what it gates

`frmSystemMaintenance` → tab **System Registe** states the procedure verbatim (`FORMS.md`):

1. *"Step 1: Get the Device No. and tell it to the vendor"* — shown in `lblReaderNo`, i.e. the reader
   identity (`Reader_0000016` on the machine analysed here).
2. *"Step 2: Input the Serial No. and Click Registe"* — four edits `edtRegistor1..4` + `cmdRegiste`,
   plus a `chkTest` box labelled *"For Test Only"*.

The serial is therefore a **vendor-issued code derived from the device number and carrying a day
count**, not something the app computes locally. Each registration appends a block to `Reg.ini` and
updates the `RegInfo` row; a new entry's `SN` repeats the previous `SerialNo1`, so activations form a
**chain** (the vendor issues the next code from the previous one). When the day count is exhausted the
app shows *"Sorry, The register expired."* (string at `0x6dd77c`, referenced from `0x6dcab7`).

The gate belongs to the **application**. It is not enforced by the hardware layer: `d12c.dll`,
`d12.dll` and `proRFL.dll` contain no activation logic, and card reads/writes succeed through
`d12c.dll` alone (see `ENCODER.md` §6) with no valid registration present. Rebuilding the card-writing
path needs no serial — only reusing the vendor UI does. Generating such a code is the vendor's
licensing mechanism and is deliberately out of scope for this dossier.

## 6. Coverage and limitations

* Forms: **15/15** recovered (binary DFM parsed with a purpose-written reader, `tools/re-proUSB/pe-resources.mjs`).
* DB: schema + row counts + card payloads recoverable (password recovered from the EXE's own
  connection-string template — see `DATA-MODEL.md`).
* Native code: `proRFL.dll`, `d12.dll` and `d12c.dll` decompiled with Ghidra 12.1.4 (REA rejects 12.2;
  12.1.x is required). Card record layout, frame format and the encoder bring-up sequence are
  documented in `CARD-API.md` and `ENCODER.md`.
* `CardLock.Exe` (4 MB Delphi binary) is mapped structurally: string table, DFM resources, 23 imported
  `proRFL` exports, writer dispatcher `FUN_006d8c44` and its 13 card types. The call sites that fill
  the remaining card-type records are still the main open item (`CARD-API.md` §9).
* Runtime observation **was** performed on the owned encoder and a disposable card: command/response
  framing, the 20-byte card area, the reader-computed 4-byte trailer, and a byte-exact guest-record
  round trip are hardware-verified (`CARD-API.md` §7.3, §7.7; `ENCODER.md` §6).
