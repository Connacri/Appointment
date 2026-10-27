/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * CardLock.mdb → CardInfo synchronisation.
 *
 * A proUSB card only carries 16 bytes. The **ID** and the **Operator Code**
 * displayed by `CardLock.exe` are *not* encoded inside the card: they are two
 * columns of the `CardInfo` table of `CardLock.mdb` (JET4 / Access 2000):
 *
 *   ID        AutoNumber   ← the "ID" shown by the software
 *   CardData  Text(100)    ← the 32-hex card image
 *   Holder    Text(100)    ← guest / staff name
 *   GongHao   Text(40)     ← "Operator Code" ("Admin" in the real database)
 *   BeiZhu    Text(200)
 *   Status    Text(100)
 *
 * `CardLock.exe` finds a card with:
 *
 *   SELECT * FROM CardInfo WHERE Mid(CardData,19,8)=:a
 *
 * i.e. characters 19..26 of the hex image = bytes [9..12] (type + issue date).
 * When the row is missing the dialog simply stays empty — the card itself is
 * still valid for the lock, but the original software shows no ID and no
 * operator.
 *
 * This app never writes into the JET4 file (browsers cannot). Instead it
 * produces a small, reviewable, self-contained Windows script that inserts the
 * missing rows (with a backup + rollback) into a local `CardLock.mdb`.
 */

/** Default install location of the original software on Windows. */
export const CARD_LOCK_MDB_DEFAULT_PATH =
  'C:\\Program Files (x86)\\ProUSB SOFTWARE\\proUSBHotelLockSystem\\CardLock.mdb';

/**
 * The vendor ships `CardLock.mdb` with a Jet *database password*: Jet refuses
 * to open it without it (`Mot de passe non valide`). The literal is embedded in
 * `CardLock.Exe`, right next to its connection string:
 *
 *   Provider=Microsoft.Jet.OLEDB.4.0;Data Source=%s;Persist Security Info=False;
 *   Jet OLEDB:DataBase Password=%s
 *
 * It protects the file against accidental opening in Access — the cards,
 * rooms and guests are not encrypted (any reader can parse the pages), so this
 * is not a secret of ours.
 */
export const CARD_LOCK_MDB_PASSWORD = 'pradlock';

export interface CardInfoSyncRow {
  /** 32-hex card image (`rawHex`). */
  cardData: string;
  holder?: string;
  /** Stored in `CardInfo.GongHao` — "Operator Code" in the original software. */
  operator?: string;
  status?: string;
}

export interface CardInfoSyncOptions {
  mdbPath?: string;
  /** Jet database password — defaults to the vendor one. */
  mdbPassword?: string;
  /** ISO timestamp stamped in the generated script header. */
  generatedAt?: string;
}

export function normalizeCardHex(value: string): string {
  return (value || '').replace(/[^0-9a-fA-F]/g, '').toUpperCase();
}

/**
 * "Card id" as computed by `CardLock.exe`: `Mid(CardData,19,8)`.
 * 1-based characters 19..26 === 0-based slice(18, 26) === bytes [9..12].
 */
export function cardInfoId(cardData: string): string {
  const hex = normalizeCardHex(cardData);
  return hex.length === 32 ? hex.slice(18, 26) : '';
}

/** UTF-16 code units → 4-hex-digit string (ASCII-only VBScript literal). */
function toUtf16Hex(value: string): string {
  let out = '';
  for (let i = 0; i < value.length; i += 1) {
    out += value.charCodeAt(i).toString(16).toUpperCase().padStart(4, '0');
  }
  return out || '0000';
}

function vbString(value: string): string {
  if (!value) return '""';
  return `U("${toUtf16Hex(value)}")`;
}

/**
 * Builds a self-contained `.vbs` script that inserts the given cards into
 * `CardInfo` (idempotent: a card already present — same `Mid(CardData,19,8)` —
 * is skipped). The script:
 *
 *  1. re-launches itself under `SysWOW64\wscript.exe` (Jet 4.0 is 32-bit only);
 *  2. self-elevates when the database lives under `Program Files`;
 *  3. backs the database up before touching it;
 *  4. inserts the missing rows and reports every failure;
 *  5. offers a one-click rollback if anything failed.
 */
export function buildCardInfoSyncScript(
  rows: CardInfoSyncRow[],
  options: CardInfoSyncOptions = {}
): string {
  const mdbPath = options.mdbPath || CARD_LOCK_MDB_DEFAULT_PATH;
  const mdbPassword = options.mdbPassword ?? CARD_LOCK_MDB_PASSWORD;
  const generatedAt = options.generatedAt ?? new Date().toISOString();

  const seen = new Set<string>();
  const cleaned: Array<{ cardData: string; holder: string; operator: string; status: string }> = [];
  for (const row of rows) {
    const cardData = normalizeCardHex(row.cardData);
    if (cardData.length !== 32) continue;
    const id = cardInfoId(cardData);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    cleaned.push({
      cardData,
      // Colonnes Jet : Holder Text(100), GongHao Text(40), Status Text(100).
      holder: (row.holder || '').trim().slice(0, 100),
      operator: ((row.operator || 'Admin').trim() || 'Admin').slice(0, 40),
      status: (row.status || '').trim().slice(0, 100),
    });
  }

  const entries = cleaned
    .map(
      (r) =>
        `  Array(${vbString(r.cardData)}, ${vbString(r.holder)}, ${vbString(
          r.operator
        )}, ${vbString(r.status)})`
    )
    .join(', _\r\n');

  const rowsBlock = entries ? `Dim rows\r\nrows = Array( _\r\n${entries})\r\n` : 'Dim rows\r\nrows = Array()\r\n';

  const header = [
    "' ============================================================================",
    "'  Planning Oran - synchronisation de la table CardInfo (CardLock.mdb)",
    "' ----------------------------------------------------------------------------",
    `'  Genere le ${generatedAt}`,
    `'  Cartes a inserer : ${cleaned.length}`,
    `'  Base visee       : ${mdbPath}`,
    "'",
    "'  ID et Operator Code ne sont pas graves sur la carte : CardLock.exe les lit",
    "'  dans la table CardInfo. Ce script ajoute les lignes manquantes",
    "'  (GongHao = Admin) apres avoir sauvegarde la base.",
    "'",
    "'  Fermez CardLock.exe puis double-cliquez sur ce fichier.",
    "' ============================================================================",
    'Option Explicit',
    '',
    'Const APP_TITLE = "Planning Oran - CardLock.mdb"',
    `Const MDB_PATH = "${mdbPath.replace(/"/g, '""')}"`,
    `Const MDB_PASSWORD = "${mdbPassword.replace(/"/g, '""')}"`,
  ].join('\r\n');

  const body = `
Dim fso, sh, wow
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")

' --- Jet 4.0 est un fournisseur 32 bits : relancer sous SysWOW64 ------------
If InStr(1, LCase(WScript.FullName), "syswow64", vbTextCompare) = 0 Then
  wow = sh.ExpandEnvironmentStrings("%SystemRoot%") & "\\SysWOW64\\wscript.exe"
  If fso.FileExists(wow) Then
    sh.Run Chr(34) & wow & Chr(34) & " " & Chr(34) & WScript.ScriptFullName & Chr(34), 1, False
    WScript.Quit 0
  End If
End If

If Not fso.FileExists(MDB_PATH) Then
  MsgBox "Base introuvable :" & vbCrLf & vbCrLf & MDB_PATH & vbCrLf & vbCrLf & _
         "Ouvrez ce script avec le Bloc-notes et adaptez la constante MDB_PATH.", _
         vbCritical, APP_TITLE
  WScript.Quit 1
End If

' --- Droits d'ecriture (Program Files exige l'elevation) --------------------
If Not CanWrite(MDB_PATH) Then
  If Not HasArg("--elevated") Then
    On Error Resume Next
    CreateObject("Shell.Application").ShellExecute "wscript.exe", _
      Chr(34) & WScript.ScriptFullName & Chr(34) & " --elevated", "", "runas", 1
    If Err.Number <> 0 Then
      MsgBox "Droits insuffisants pour modifier :" & vbCrLf & MDB_PATH & vbCrLf & vbCrLf & _
             "Relancez le script en tant qu'administrateur.", vbCritical, APP_TITLE
    End If
    On Error GoTo 0
    WScript.Quit 0
  End If
  MsgBox "Droits insuffisants pour modifier :" & vbCrLf & MDB_PATH & vbCrLf & vbCrLf & _
         "Relancez le script en tant qu'administrateur.", vbCritical, APP_TITLE
  WScript.Quit 1
End If

' --- Sauvegarde -------------------------------------------------------------
Dim stamp, backup
stamp = Year(Now) & Right("0" & Month(Now), 2) & Right("0" & Day(Now), 2) & "-" & _
        Right("0" & Hour(Now), 2) & Right("0" & Minute(Now), 2) & Right("0" & Second(Now), 2)
backup = MDB_PATH & ".backup-" & stamp & ".bak"
On Error Resume Next
fso.CopyFile MDB_PATH, backup, True
If Err.Number <> 0 Then
  MsgBox "Sauvegarde impossible :" & vbCrLf & backup & vbCrLf & vbCrLf & Err.Description, _
         vbCritical, APP_TITLE
  WScript.Quit 1
End If
Err.Clear
On Error GoTo 0

' --- Cartes a synchroniser --------------------------------------------------
${rowsBlock}
' --- Insertion --------------------------------------------------------------
Dim cn, rs, inserted, skipped, failed, detail, i, key, cur, sql, n
inserted = 0
skipped = 0
failed = 0
detail = ""

Set cn = CreateObject("ADODB.Connection")
On Error Resume Next
cn.Open "Provider=Microsoft.Jet.OLEDB.4.0;Data Source=" & MDB_PATH & ";Persist Security Info=False; Jet OLEDB:DataBase Password=" & MDB_PASSWORD & ";"
If Err.Number <> 0 Then
  MsgBox "Connexion Jet 4.0 impossible :" & vbCrLf & vbCrLf & Err.Description & vbCrLf & vbCrLf & _
         "Le moteur Microsoft Jet 4.0 (composant Windows) est requis.", _
         vbCritical, APP_TITLE
  WScript.Quit 1
End If
On Error GoTo 0

For i = 0 To UBound(rows)
  cur = rows(i)
  key = Mid(cur(0), 19, 8)
  n = 0
  On Error Resume Next
  Set rs = cn.Execute("SELECT COUNT(*) AS n FROM CardInfo WHERE Mid(CardData,19,8)='" & key & "'")
  If Err.Number = 0 Then n = rs.Fields(0).Value
  rs.Close
  Set rs = Nothing
  If Err.Number <> 0 Then
    failed = failed + 1
    detail = detail & vbCrLf & "  " & key & " : " & Err.Description
    Err.Clear
  ElseIf n > 0 Then
    skipped = skipped + 1
  Else
    sql = "INSERT INTO CardInfo (CardData, Holder, GongHao, BeiZhu, Status) VALUES ('" & _
          Q(cur(0)) & "','" & Q(cur(1)) & "','" & Q(cur(2)) & "','','" & Q(cur(3)) & "')"
    cn.Execute sql
    If Err.Number <> 0 Then
      failed = failed + 1
      detail = detail & vbCrLf & "  " & key & " : " & Err.Description
      Err.Clear
    Else
      inserted = inserted + 1
    End If
  End If
  On Error GoTo 0
Next

cn.Close
Set cn = Nothing

If failed = 0 Then
  MsgBox "Synchronisation terminee." & vbCrLf & vbCrLf & _
         "Ajoutees       : " & inserted & vbCrLf & _
         "Deja presentes : " & skipped & vbCrLf & vbCrLf & _
         "Sauvegarde :" & vbCrLf & backup, vbInformation, APP_TITLE
Else
  MsgBox "Synchronisation partielle." & vbCrLf & vbCrLf & _
         "Ajoutees       : " & inserted & vbCrLf & _
         "Deja presentes : " & skipped & vbCrLf & _
         "Echecs         : " & failed & vbCrLf & vbCrLf & _
         "Details :" & detail & vbCrLf & vbCrLf & _
         "Sauvegarde :" & vbCrLf & backup, vbExclamation, APP_TITLE
  If inserted > 0 Then
    If MsgBox("Restaurer la sauvegarde (annule les " & inserted & " lignes ajoutees) ?", _
              vbQuestion + vbYesNo, APP_TITLE) = vbYes Then
      On Error Resume Next
      fso.CopyFile backup, MDB_PATH, True
      If Err.Number <> 0 Then
        MsgBox "Restauration impossible : " & Err.Description & vbCrLf & backup, vbCritical, APP_TITLE
      Else
        MsgBox "Base restauree depuis :" & vbCrLf & backup, vbInformation, APP_TITLE
      End If
      On Error GoTo 0
    End If
  End If
End If

If failed = 0 Then
  WScript.Quit 0
Else
  WScript.Quit 1
End If

' --- Helpers ----------------------------------------------------------------
Function HasArg(name)
  Dim k
  HasArg = False
  For k = 0 To WScript.Arguments.Count - 1
    If LCase(WScript.Arguments(k)) = LCase(name) Then HasArg = True
  Next
End Function

Function CanWrite(path)
  Dim tf, fl, f
  CanWrite = False
  If Not fso.FileExists(path) Then Exit Function
  Set fl = fso.GetFile(path)
  If (fl.Attributes And 1) <> 0 Then Exit Function
  tf = path & ".sync-test"
  On Error Resume Next
  Set f = fso.CreateTextFile(tf, True)
  f.Close
  If Err.Number = 0 Then
    fso.DeleteFile tf, True
    CanWrite = True
  End If
  Err.Clear
  On Error GoTo 0
End Function

Function Q(value)
  Q = Replace(value, "'", "''")
End Function

Function U(h)
  Dim j, s
  s = ""
  For j = 1 To Len(h) Step 4
    s = s & ChrW(CLng("&H" & Mid(h, j, 4)))
  Next
  U = s
End Function
`;

  return `${header}\r\n${body}\r\n`.replace(/\r?\n/g, '\r\n');
}

export function cardInfoSyncFileName(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(
    now.getHours()
  )}${p(now.getMinutes())}`;
  return `CardLock-CardInfo-${stamp}.vbs`;
}
