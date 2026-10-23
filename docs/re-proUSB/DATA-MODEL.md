# proUSB Hotel Lock System — Data model

**Observed** by opening `CardLock.mdb` read-only with the Jet 4.0 provider.

## Connection string (recovered from `CardLock.Exe`)

The EXE contains this literal template (string at the `.mdb` reference cluster):

```
Provider=Microsoft.Jet.OLEDB.4.0;Data Source=%s;Persist Security Info=False; Jet OLEDB:DataBase Password=%s
```

The password is a **constant in the binary**, also present as a nearby literal.
It is stored locally in `tools/re-proUSB/local.env` (git-ignored) — not in this document.

## Tables

| Table | Rows (local install) | Purpose |
|---|---:|---|
| `BuildingInfo` | 1 | buildings |
| `RoomInfo` | 10 | rooms + lock configuration |
| `GuestInfo` | 10 | current/active guests |
| `CardInfo` | 62 | **issued card payloads** (hex) |
| `OperatorInfo` | 6 | staff accounts + permission level |
| `RecordOpen` | 256 | lock audit / opening records |
| `RegInfo` | 1 | activation record |
| `LogInfo` | 0 | operator session log |
| `CaoZuoInfo` | 0 | operation log |
| `Dai` | 16 | card-type → "dai" override map (all `0` locally) |

Jet type codes below: `17`=Byte, `3`=Integer, `2`=SmallInt, `130`=Unicode text, `7`=Date/Time,
`6`=Currency.

### BuildingInfo
`BldNo` (Byte) · `BldName` (text)

### RoomInfo
`BldNo` (Byte) · `FlrNo` (Byte) · `RomID` (Byte) · `RomID2` (Byte) · `RoomNo` (text) ·
`sType` (text) · `Status` (text: `Vacant`/`Guest`) · `Price` · `Dai` (Byte) · `CardCount` ·
`MaxCards` · `PublicDoor` (Byte) · `BeiZhu` (remark) · `ReservCkIn`/`FirstCkOut` (date) ·
`HourRateStartup`/`HourRatePrice`

### GuestInfo
`ID` (Integer) · `BldRoomNo` (text) · `Name` · `Sex` · `CType` · `CNo` · `ComeTime` (date) ·
`GoTime` (date) · `CardID` (text) · `Flag` (text) · `BeiZhu` · `Price` · `YaJin` (deposit)

### CardInfo
`ID` (Integer) · **`CardData`** (32 hex chars = 16 bytes) · `Holder` · `GongHao` (operator) ·
`BeiZhu` · `Status`

### OperatorInfo
`GongHao` (login) · `Name` · `MiMa` (password) · `QuanXian` (permission: `A`, `S`, or a
`proQuanXian_*` role placeholder) · `BeiZhu`

### RecordOpen
`OrderFlag` (Byte) · `RecData` (16 hex chars = 8 bytes) · `OpenTime` (date)

## Recovery-relevant queries inside the EXE

```sql
SELECT * FROM CardInfo WHERE CardData=:a
SELECT * FROM CardInfo WHERE Mid(CardData,19,8)=:a        -- card identity substring (chars 19..26)
SELECT * FROM GuestInfo WHERE CardID=:a
SELECT * FROM GuestInfo WHERE ((BldRoomNo=:a) AND ((Flag=:b) OR (Flag=:c) OR (Flag=:d))) ORDER BY Name,ID DESC
DELETE FROM GuestInfo WHERE (Flag=:a) OR (ComeTime<:b) OR (GoTime<:c) OR ([ComeTime] is Null) OR ([GoTime] is Null)
INSERT INTO GuestInfo VALUES(:ID,:BldRoomNo,:Name,:Sex,:CType,:CNo,:ComeTime,:GoTime,:CardID,:Flag,:BeiZhu,:Price,:YaJin)
INSERT INTO CardInfo VALUES(:ID,:CardData,:Holder,:Operator,:BeiZhu,:Status)
INSERT INTO RecordOpen VALUES(:OrderFlag,:RecData,:OpenTime)
```

`CardData` is indexed by a **string substring** (`Mid(CardData,19,8)`), i.e. the stable card
identity lives at a fixed hex offset — see `CARD-API.md`.

## Observations

* `GuestInfo.Flag` drives room state (`status=Guest` rows have matching live guests).
* `RoomInfo.CardCount` is a per-room issued-card counter maintained on issue/erase.
* `OperatorInfo` stores passwords in cleartext (`MiMa`).
* `RegInfo.RegDate` is an 8-byte value (16 hex), consistent with a machine-bound activation hash.
* No guest personal data is reproduced in this repository; only schema and counts are recorded here.
