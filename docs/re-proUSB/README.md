# proUSB Hotel Lock System — reverse-engineering dossier

Static analysis of the locally installed **proUSBHotelLockSystem** (vendor: proUSB / proM9),
performed on an owned installation for interoperability, maintenance and data-recovery purposes.

Nothing in this folder is needed to *use* the software; it exists to understand and re-implement it.

## Documents

| File | Contents |
|---|---|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | stack, modules, data flow, operational model, licensing surface |
| [`DATA-MODEL.md`](DATA-MODEL.md) | Access schema, table/column inventory, SQL recovered from the EXE |
| [`CARD-API.md`](CARD-API.md) | card record layout, type bytes, frame format, DLL export map |
| [`ENCODER.md`](ENCODER.md) | how to bring up and drive the encoder (HID / legacy), with a Python harness |
| [`FORMS.md`](FORMS.md) | all 15 Delphi forms with captions, handlers and the UI→code map |

## Key results

* **Stack** — Delphi 7 + Tnt Unicode, DevArt DAC (BDE / OLE DB / MySQL), VCL skins, Excel reports;
  native PE32 x86, no .NET.
* **Data** — Microsoft Access, Jet 4.0, password available from the EXE's own connection-string
  template. Full schema and 62 stored card records recovered.
* **Cards** — 16-byte record (`C9 12 …`), byte 9 = `type | index` (`0x6n` guest, `0xBn` master,
  `0x2n` room-set, `0x3n` clock, …), framed as `AA 21 EC + 32 bytes + XOR checksum`, sent as a
  64-byte transfer.
* **Encoder** — USB HID (`VID 0x9915` / `PID 0x1116`, report `0x40`) through `d12c.dll`,
  or the legacy AVR device through `d12.dll` (`DeviceIoControl` IOCTL `0x22200C`).
* **Commissioning** — Reset Card → RoomNo. Setting → Lock Clock Setting, matching the vendor hints.

## Method and reproducibility

All work is **static**; the application and the encoder were never executed.

| Tool | Purpose |
|---|---|
| REA + Ghidra 12.1.4 | PE inspection, decompilation, snapshots |
| `tools/re-proUSB/pe-resources.mjs` | PE resource walker + Delphi binary-DFM (TPF0) parser |
| `tools/re-proUSB/forms-summary.mjs` | form JSON → `FORMS.md` |
| `tools/re-proUSB/pe-exports.mjs` | export/import table dumper |
| `tools/re-proUSB/read-json.mjs` | encoding-tolerant reader for REA CLI output |

```powershell
# forms + resources
node tools/re-proUSB/pe-resources.mjs "C:\Program Files (x86)\ProUSB SOFTWARE\proUSBHotelLockSystem\CardLock.Exe" out\forms
node tools/re-proUSB/forms-summary.mjs out\forms docs\re-proUSB\FORMS.md

# exports
node tools/re-proUSB/pe-exports.mjs "...\proRFL.dll" "...\d12.dll" "...\d12c.dll"

# decompilation (Ghidra 12.1.x required by REA)
$env:GHIDRA_INSTALL_DIR = "C:\tools\ghidra\ghidra_12.1.4_PUBLIC"
npx rea-agents@latest analyze "...\proRFL.dll" --provider ghidra --snapshot proRFL.snapshot --format md
npx rea-agents@latest decompile "...\proRFL.dll" --procedure MasterCard --provider ghidra --snapshot proRFL.snapshot --format json
```

The database password used for the read-only schema extraction is kept out of the repository in
`tools/re-proUSB/local.env` (git-ignored).

## Known gaps

See `CARD-API.md` §9. The main one is the record-length mismatch (20 bytes built, 32 bytes
transmitted, 16 bytes stored), which can only be settled by decompiling `CardLock.Exe` and reading
the call sites.

## Legal / ethical scope

This dossier documents software installed on the machine it was analysed on, for interoperability
with locks the owner administers. It is not a key-generation guide for third-party installations.
