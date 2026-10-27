/**
 * Contrôles reproductibles de la synchronisation `CardInfo` (CardLock.mdb).
 *
 *   npx tsx scripts/verify-cardinfo.ts
 */
import {
  buildCardInfoSyncScript,
  cardInfoId,
  cardInfoSyncFileName,
  CARD_LOCK_MDB_DEFAULT_PATH,
  CARD_LOCK_MDB_PASSWORD,
} from '../src/locks/database/cardInfoSync';

let ok = 0;
let ko = 0;

function check(label: string, condition: boolean, detail = '') {
  if (condition) {
    ok += 1;
    console.log(`  OK   ${label}${detail ? ` — ${detail}` : ''}`);
  } else {
    ko += 1;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

console.log('1. ID = Mid(CardData,19,8) — caractères 19..26 de la trame hex');
check('carte système #61', cardInfoId('C912033BFCC480980001EC631B2923BE') === '01EC631B', cardInfoId('C912033BFCC480980001EC631B2923BE'));
check('carte client 2015', cardInfoId('C91224B6E3818101016265DB1565E300') === '6265DB15', cardInfoId('C91224B6E3818101016265DB1565E300'));
check('carte master 0xB0', cardInfoId('C9120000FF00298000B0944C5AA44DFB') === 'B0944C5A', cardInfoId('C9120000FF00298000B0944C5AA44DFB'));
check('trame invalide → vide', cardInfoId('C912') === '');
check('minuscules acceptées', cardInfoId('c912033bfcc480980001ec631b2923be') === '01EC631B');

console.log('2. Script de synchronisation');
const rows = [
  { cardData: 'C912033BFCC4809C000E1ACA582923BE', holder: '', operator: 'Admin' },
  { cardData: 'C912033BE38181010162EC631CEC6B00', holder: "Réception O'Neil — غرفة", operator: 'Admin' },
  // doublon volontaire : même Mid(CardData,19,8) que la première carte
  { cardData: 'C912033BFCC4809C000E1ACA58999999', holder: 'Doublon', operator: 'Admin' },
];
const script = buildCardInfoSyncScript(rows, { generatedAt: '2026-10-27T00:00:00.000Z' });

check('mot de passe Jet du fournisseur', CARD_LOCK_MDB_PASSWORD === 'pradlock');
check('chemin par défaut', script.includes(CARD_LOCK_MDB_DEFAULT_PATH));
check('mot de passe présent dans le script', script.includes('Const MDB_PASSWORD = "pradlock"'));
check('relance 32 bits (Jet 4.0)', script.includes('SysWOW64') && script.includes('wscript.exe'));
check('auto-élévation', script.includes('"runas"'));
check('sauvegarde avant écriture', script.includes('.backup-'));
check('INSERT avec colonnes explicites (ID = AutoNumber)', script.includes('INSERT INTO CardInfo (CardData, Holder, GongHao, BeiZhu, Status)'));
check('lookup identique à CardLock.exe', script.includes("SELECT COUNT(*) AS n FROM CardInfo WHERE Mid(CardData,19,8)='"));
check('dédoublonnage par ID', (script.match(/INSERT INTO CardInfo/g) ?? []).length === 1);
check('2 cartes uniques (doublon écarté)', (script.match(/^ {2}Array\(/gm) ?? []).length === 2, `${(script.match(/^ {2}Array\(/gm) ?? []).length} entrée(s)`);
check('texte Unicode encodé (aucun accent dans le fichier)', /^[\x09\x0A\x0D\x20-\x7E]*$/.test(script), 'ASCII seulement');
check('apostrophe échappée en SQL', script.includes('Function Q(value)') && script.includes('Replace(value, "\'", "\'\'")'));
check('CRLF (Windows)', script.includes('\r\n') && !/[^\r]\n/.test(script));
check('nom de fichier horodaté', /^CardLock-CardInfo-\d{8}-\d{4}\.vbs$/.test(cardInfoSyncFileName(new Date(2026, 9, 27, 14, 5))), cardInfoSyncFileName(new Date(2026, 9, 27, 14, 5)));

console.log('');
if (ko === 0) {
  console.log(`TOUT EST VERT (${ok} contrôles)`);
} else {
  console.log(`${ko} échec(s) sur ${ok + ko} contrôles`);
  process.exitCode = 1;
}
