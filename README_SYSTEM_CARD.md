# Guide — Carte Système (System Card) proUSB

> **Statut** : format **vérifié octet par octet** sur la base réelle
> `CardLock.mdb` (62 enregistrements) et sur une carte système lue depuis
> l'encodeur physique (`proUSB-TEMIC`, VID `0x9915` / PID `0x1116`).

## 1. Ce qu'est réellement une carte système

Une carte système n'est pas une commande envoyée à la serrure : c'est une
**carte physique** (MIFARE) contenant un enregistrement de 16 octets que
`CardLock.exe` écrit avec `WriteCard`, exactement comme une carte client.

C'est cette carte que l'on présente ensuite devant une serrure pour la
réinitialiser, changer son code site, etc. **Si aucune carte n'est écrite,
la serrure n'a rien à lire** — c'est l'erreur qui faisait échouer tous les
« reset » précédents.

## 2. Format réel (16 octets)

```
C9 12 | 03 3B | FC C4 | 80 | 98 | 00 | 0E | 1A CA 58 | 29 23 BE
│     │  │     │       │    │     │    │    │          │
│     │  │     │       │    │     │    │    │          └─ queue de famille (constante)
│     │  │     │       │    │     │    │    └──────────── date d'émission (3 octets)
│     │  │     │       │    │     │    └───────────────── type de carte système 0x01..0x0F
│     │  │     │       │    │     └────────────────────── 00
│     │  │     │       │    └──────────────────────────── 98 (base) / 9C selon la session
│     │  │     │       └───────────────────────────────── 80
│     │  │     └───────────────────────────────────────── marqueur famille système
│     │  └─────────────────────────────────────────────── code site (big-endian)
│     └──────────────────────────────────────────────────── 0x12 constante
└────────────────────────────────────────────────────────── 0xC9 magie
```

### Champs

| Octets | Rôle | Valeur observée |
|---|---|---|
| `[0]` | Magie | `0xC9` |
| `[1]` | Constante | `0x12` |
| `[2..3]` | **Code site** (big-endian) | `03 3B` (2022+), `24 B6` (2015), `16 9A` (2022) |
| `[4..5]` | Marqueur famille système | `FC C4` |
| `[6]` | — | `80` |
| `[7]` | Variante de session | `98` ou `9C` |
| `[8]` | — | `00` |
| `[9]` | **Type système** | `0x01` … `0x0F` |
| `[10..12]` | **Date d'émission** | voir §4 |
| `[13..15]` | Queue de famille | `29 23 BE` (constant sur toutes les cartes système observées) |

### Preuves

| Carte | Hex | Type |
|---|---|---|
| `CardInfo` #61 | `C912033BFCC480980001EC631B2923BE` | `0x01` |
| `CardInfo` #54 | `C912033BFCC480980008E25BC12923BE` | `0x08` |
| `CardInfo` #56 | `C912033BFCC48098000AE25BC72923BE` | `0x0A` |
| `CardInfo` #57 | `C912033BFCC48098000BE25BC72923BE` | `0x0B` |
| `CardInfo` #33 | `C912316ACE958098000F895AD02923BE` | `0x0F` |
| Encodeur réel | `C912033BFCC4809C000E1ACA582923BE` | `0x0E` |

Les six cartes proviennent de trois installations différentes (2017, 2023,
2026) et partagent pourtant la même queue `29 23 BE` : ce n'est **pas** une
signature calculée sur le contenu, mais une constante de famille. La queue ne
dépend donc ni du type, ni de la date, ni du numéro de série.

## 3. D'où viennent les valeurs

Le logiciel d'origine ne stocke **pas** ces valeurs dans `System.ini` ni dans
`Reg.ini`. Le code site n'existe que dans les cartes elles-mêmes, dans
`CardInfo.CardData`. L'application les relit donc directement :

```
CardLock.mdb → table CardInfo → carte système la plus récente
             → site  = octets [2..3]
             → marker/header/tail = octets [4..5] / [6..8] / [13..15]
```

C'est ce que fait `deriveSystemProfile()` dans
`src/locks/database/mdbImport.ts`. Sans base importée, un modèle par défaut
est utilisé (`DEFAULT_SYSTEM_CARD_TEMPLATE`).

## 4. Encodage de la date (identique à toutes les familles)

Trois octets, mêmes règles pour les cartes client, master et système :

```
b0 = (((année - 2009) & 0x0F) << 4) | (mois & 0x0F)
b1 = ((jour & 0x1F) << 3) | ((heure >> 2) & 0x07)
b2 = ((heure & 0x03) << 6) | (minute & 0x3F)
```

Vérifications sur des cartes réelles :

| Source | Date réelle | Octets |
|---|---|---|
| `CardInfo` #2 (client 101) | 2015-05-27 12:21 | `65 DB 15` |
| `CardInfo` #35 (client 201) | 2017-09-11 11:18 | `89 5A D2` |
| `CardInfo` #53 (client 202) | 2022-04-06 21:31 | `D4 35 5F` |
| `CardInfo` #62 (client 103) | 2023-12-12 12:28 | `EC 63 1C` |
| Carte système lue | 2026-10-25 09:24 | `1A CA 58` |

Le champ année fait 4 bits : la fenêtre fait 16 ans, base **2009**. C'est
pourquoi `2010` et `2026` partagent le même nibble (`1`) — l'ancienne version
affichait donc `2010` pour une carte de 2026.

`unpackDateTime()` résout l'ambiguïté en faisant glisser la fenêtre vers le
présent :

```ts
let year = 2009 + nibble;                        // 2009..2024
while (year + 16 <= currentYear + 1) year += 16; // → 2025..2040
```

Une carte de 2015 (nibble `6`) reste décodée `2015`, une carte de 2026
(nibble `1`) devient `2026`.

## 5. Types de cartes système

`[9] = 0x01 … 0x0F`. L'application écrit :

| Action | Type | Remarque |
|---|---|---|
| Carte Reset | `0x01` | présent aussi dans la base (CardInfo #61, #1) |
| Carte Hard Reset | `0x0E` | **exactement** le type de la carte lue sur l'encodeur réel |

Les autres types observés dans la base (`0x08`, `0x0A`, `0x0B`, `0x0F`) sont
produits par le logiciel d'origine ; leur rôle exact (config, horloge, relevé)
reste à confirmer par tests terrain.

## 6. Pourquoi les anciennes cartes étaient refusées

Trois bugs cumulés, tous corrigés :

1. **Aucune écriture de carte.** `reset` et `hard_reset` n'envoyaient que les
   commandes `IniCard` et fabriquaient un enregistrement local
   (`C9 … AD DE AD`). La carte physique n'était jamais programmée.
2. **Code site inversé.** `DEFAULT_SITE_LOW = 0x24B6` était écrit
   `B6 24` au lieu de `24 B6` (little-endian au lieu de big-endian).
   La serrure comparait `24 B6` ≠ `B6 24` → `N9067 not a card for this system`.
3. **Bit 14 parasite.** `coverCardsBefore` faisait `site |= 0x4000`, ce qui
   transformait `03 3B` en `43 3B` — code site invalide.

Erreurs associées et leur cause réelle :

| Erreur du logiciel d'origine | Cause |
|---|---|
| `N9067 not a card for this system` | code site erroné (inversé ou bit 14) |
| `E0043 "2025/0/1 0:0:0,0" is not valid date and time` | année encodée sur la mauvaise base |
| `system card [00000000] date of issue : 30/12/1899 00:00` | octets de date laissés à `00` |

## 7. Procédure dans l'application

1. Onglet **Mise en service**.
2. Section **Base de données CardLock.mdb** → sélectionner
   `C:\Program Files (x86)\ProUSB SOFTWARE\proUSBHotelLockSystem\CardLock.mdb`.
   Le badge passe à **CONNECTÉE** et affiche le code site réel
   (ex. `033B`), le nombre de cartes / chambres / séjours.
3. **HARD RESET PERSISTANT** (ou **Carte Reset**) : l'app envoie les trames
   `IniCard`, puis écrit la carte système (`WriteCard`) et la relit pour
   vérifier (`ReadCard`). Cette relecture est la preuve que la carte contient
   bien les 16 octets attendus.
4. La console affiche la ligne :
   `Carte système 0x0E — site=033B émise=27/10/2026 12:33 (modèle DB #61)`

Sans base importée, l'application reste autonome : elle utilise le modèle par
défaut (`site 03 3B`, `marker FC C4`, `header 80 98 00`, `tail 29 23 BE`).

## 8. Règles métier appliquées

- `encodeGuestCard` : `end > start` ; durée ≤ 365 jours
- `encodeMasterCard` : site `00 00` (une master ouvre toutes les serrures du
  lecteur, conformément aux cartes `B0`…`B9` de la base)
- `decodeCardRecord` : site lu en big-endian, dates décodées avec fenêtre
  glissante de 16 ans
- Lecture = 3 bips courts, écriture = 2 bips longs, succès/échec distincts

## 9. Vérification reproductible

```bash
npx tsx scripts/verify-mdb.ts   "<...>\CardLock.mdb"
npx tsx scripts/verify-codec.ts
```

`verify-codec.ts` reconstruit **sept** cartes réelles (client 2015, client
2023, master `0xB0`, système `0x01` et `0x0E`) et vérifie le décodage des
dates. Sortie attendue : `TOUT EST VERT`.

## 10. Liens utiles

- `docs/PROUSB_SPECIFICATION.md` — spécification RE du protocole
- `README_CARDS.md` — différences Master / Groupe / 13 familles
- `src/locks/cards/codec.ts` — encodage / décodage
- `src/locks/database/mdbImport.ts` — import réel de `CardLock.mdb`
- `src/locks/lockManager.ts` — écriture vérifiée des cartes système
- `src/components/ProUsbLockSystemView.tsx` — onglet Mise en Service

---
*Format établi par analyse des 62 enregistrements de `CardLock.mdb` et d'une
carte système lue sur l'encodeur physique. Les cartes générées sont
structurellement identiques à celles du logiciel d'origine ; la validation
finale se fait en présentant la carte devant une serrure réelle.*
