# Guide — Carte Système (System Card) proUSB

> **Statut** : format **extrait du code d'origine**, pas d'une inférence.
> La fonction exportée `ResetCard` de `proRFL.dll`
> (`C:\Program Files (x86)\ProUSB SOFTWARE\proUSBHotelLockSystem\proRFL.dll`,
> corps réel à `0x10001d50`) a été décompilée : elle écrit exactement les
> 16 octets décrits ci-dessous. Le résultat est confronté aux 62
> enregistrements de `CardLock.mdb` et à une carte lue sur l'encodeur physique.

## 1. Ce qu'est réellement une carte système

Une carte système n'est pas une commande envoyée à la serrure : c'est une
**carte physique** (MIFARE) contenant un enregistrement de 16 octets que le
logiciel écrit avec `WriteCard`, exactement comme une carte client.

C'est cette carte que l'on présente ensuite devant une serrure pour la
réinitialiser, changer son code site, etc. **Si aucune carte n'est écrite,
la serrure n'a rien à lire.**

## 2. Signature de la fonction d'origine

```c
void ResetCard(
  char  port,        // port USB (0 = auto)
  uint  site,        // code site 24 bits : 0x0012xxxx
  byte  typeIndex,   // -> octet [9], masqué à 0x0F
  byte  p4,          // -> octet [8]
  byte  p5,          // -> octet [6]
  byte  p6,          // -> octet [7]
  char *datetime,    // "YYMMDDHHmm" (décimal)
  int   outHex       // sortie : 32 caractères hexadécimaux
);
```

## 3. Format réel (16 octets)

```
C9 12 | 03 3B | FC C4 | 80 98 00 | 01 | EC 63 1B | 29 23 BE
│  │     │        │        │        │      │           │
│  │     │        │        │        │      │           └─ [13..15] rand() ×3 (padding)
│  │     │        │        │        │      └───────────── [10..12] date d'émission
│  │     │        │        │        └──────────────────── [9]      type & 0x0F
│  │     │        │        └───────────────────────────── [6..8]   p5, p6, p4
│  │     │        └────────────────────────────────────── [4..5]   ~site (complément)
│  │     └─────────────────────────────────────────────── [2..3]   code site
│  └───────────────────────────────────────────────────── [1]      (site >> 16) = 0x12
└──────────────────────────────────────────────────────── [0]      0xC9
```

### Champs (source : `ResetCard`)

| Octets | Rôle | Calcul dans `proRFL.dll` |
|---|---|---|
| `[0]` | Magie | `0xC9` |
| `[1]` | Site haut | `(site >> 16) & 0xFF` |
| `[2]` | Site milieu | `(site >> 8) & 0x3F` |
| `[3]` | Site bas | `site & 0xFF` |
| `[4]` | **Complément du site** | `~((site >> 8) & 0xFF)` |
| `[5]` | **Complément du site** | `~(site & 0xFF)` |
| `[6]` | paramètre `p5` | `80` sur toutes les cartes observées |
| `[7]` | paramètre `p6` | `98` (session DB) / `9C` (carte lue) |
| `[8]` | paramètre `p4` | `00` |
| `[9]` | **Type système** | `typeIndex & 0x0F` |
| `[10..12]` | **Date d'émission** | `packDateTime(date)` — voir §4 |
| `[13..15]` | **Aléatoire** | `rand() & 0xFF` appelé trois fois |

### Le complément `[4..5]` est la vraie clé

Ce n'est pas un « marqueur de famille » figé : c'est le **complément binaire
du code site**, c'est-à-dire un contrôle d'intégrité que le lecteur/serrure
peut vérifier. Preuve sur les six cartes système de `CardLock.mdb` :

| Site `[2..3]` | `[4..5]` attendu = `~site` | Présent sur les cartes |
|---|---|---|
| `03 3B` | `FC C4` | #54, #56, #57, #61 |
| `31 6A` | `CE 95` | #33 |
| `24 B6` | `DB 49` | #1 |
| `00 00` | `FF FF` | *(carte universelle, voir §7)* |

### `[13..15]` est aléatoire, pas une constante

`ResetCard` termine par trois appels `rand()`. Le `29 23 BE` répété sur
plusieurs cartes n'est donc **pas** une signature : c'est la début de la
séquence du `rand()` non seedé, identique à chaque démarrage du programme.
Les cartes créées plus tard dans la même session portent d'autres valeurs
(`84 E1 6C` sur #56, `D6 AE 52` sur #57). Toute valeur est acceptée.

### Preuves

| Carte | Hex | Type |
|---|---|---|
| `CardInfo` #61 | `C912033BFCC480980001EC631B2923BE` | `0x01` |
| `CardInfo` #54 | `C912033BFCC480980008E25BC12923BE` | `0x08` |
| `CardInfo` #56 | `C912033BFCC48098000AE25BC784E16C` | `0x0A` |
| `CardInfo` #57 | `C912033BFCC48098000BE25BC7D6AE52` | `0x0B` |
| `CardInfo` #33 | `C912316ACE958098000F895AD02923BE` | `0x0F` |
| `CardInfo` #1 | `C91224B6DB498098000165DB152923BE` | `0x01` |
| Encodeur réel | `C912033BFCC4809C000E1ACA582923BE` | `0x0E` |

## 4. Encodage de la date (identique à toutes les familles)

`ResetCard`, `GuestCard` et `MasterCard` parsent une chaîne `"YYMMDDHHmm"`
en décimal puis packagent :

```
b0 = (((AA - 9) & 0x0F) << 4) | (mois & 0x0F)     AA = année sur 2 chiffres
b1 = ((jour & 0x1F) << 3) | ((heure >> 2) & 0x07)
b2 = ((heure & 0x03) << 6) | (minute & 0x3F)
```

`(AA - 9)` sur 8 bits équivaut à `(année - 2009) & 0x0F`.

| Source | Date réelle | Octets |
|---|---|---|
| `CardInfo` #2 (client 101) | 2015-05-27 12:21 | `65 DB 15` |
| `CardInfo` #35 (client 201) | 2017-09-11 11:18 | `89 5A D2` |
| `CardInfo` #53 (client 202) | 2022-04-06 21:31 | `D4 35 5F` |
| `CardInfo` #62 (client 103) | 2023-12-12 12:28 | `EC 63 1C` |
| Carte système lue | 2026-10-25 09:24 | `1A CA 58` |

Le champ année fait 4 bits : la fenêtre boucle tous les 16 ans (2010 et 2026
partagent le nibble `1`). La lecture résout l'ambiguïté avec
`resolveYear(nibble, refYear)` qui retient le plus grand candidat **≤ année
de référence + 1** :

- carte de 2026 (nibble `1`) lue en 2026 → **2026** (et non 2010) ;
- carte de 2015 (nibble `6`) → **2015** (et non 2031) ;
- carte émise en 2027 (nibble `2`) → **2027**.

Pour une **date d'expiration**, la résolution se fait par rapport à la date de
début (`resolveYearAtLeast`) : une carte ne peut jamais expirer avant d'être
créée, même si son nibble boucle.

## 5. Types de cartes système

`[9] = 0x01 … 0x0F`. L'application écrit :

| Action | Type | Remarque |
|---|---|---|
| Carte Reset | `0x01` | présent aussi dans la base (CardInfo #61, #1) |
| Carte Hard Reset | `0x0E` | **exactement** le type de la carte lue sur l'encodeur réel |

Les autres types observés dans la base (`0x08`, `0x0A`, `0x0B`, `0x0F`) sont
produits par le logiciel d'origine ; leur rôle exact (config, horloge, relevé)
reste à confirmer par tests terrain.

Depuis la correction du décodage, le type est résolu par le **nibble bas** pour
la famille `0x00` : `0x01` → `reset`, `0x0E` → `hard_reset`. Auparavant toutes
les cartes `0x00` étaient annoncées `hard_reset`.

## 6. Carte système **universelle** (site `0000`)

### Pourquoi c'est possible

Le logiciel d'origine écrit déjà ses **cartes maîtresses** avec le site
`00 00` (`MasterCard` reçoit `site = 0`) : une master de la base —
`C912 0000 FF00 2980 00 B0 94 4C 5A A4 4D FB` — n'est liée à aucun site et
ouvre toutes les serrures. `0000` est donc la valeur **wildcard** du système.

`ResetCard` accepte `site` en paramètre. Avec `site = 0x0000` :

```
[2..3] = 00 00
[4..5] = ~00 ~00 = FF FF     ← complément auto-cohérent
```

La carte reste valide vis-à-vis du contrôle d'intégrité `[4..5] = ~[2..3]`,
mais ne désigne plus aucun système : elle doit donc être acceptée par une
serrure de **n'importe quel** système.

```
C9 12 00 00 FF FF 80 98 00 01 1A CA 58 .. .. ..
   │        │        │     │  │        └─ date d'émission réelle
   │        │        │     │  └─ 0x01 = reset (0x0E = hard reset)
   │        │        │     └─ header du modèle importé
   │        └────────┴─ complément du site 0000
   └─ magie + 0x12
```

### Utilisation

Onglet **Mise en service** → carte **Reset** ou **Hard Reset** → cocher
**« Carte universelle (site 0000) »** → *Émettre*.

- case **décochée** : la carte est écrite pour le site importé
  (`03 3B` → `03 3B FC C4`) — comportement du logiciel d'origine ;
- case **cochée** : `00 00 FF FF` — la carte n'appartient à aucun système.

> **Limite honnête** : ce comportement repose sur la convention wildcard
> `0000` prouvée par les cartes maîtresses et sur le fait que `ResetCard`
> laisse le site en paramètre. La validation finale se fait **sur une serrure
> réelle** : présenter la carte universelle devant une serrure d'un autre
> système, puis devant une serrure du système importé.

## 7. D'où viennent les valeurs du modèle

Le logiciel d'origine ne stocke **pas** le site dans `System.ini` ni `Reg.ini` :
il n'existe que dans les cartes, colonne `CardInfo.CardData`. L'application le
relit donc directement :

```
CardLock.mdb → CardInfo → carte la plus récente avec un site non nul
             → site   = octets [2..3]
             → header = octets [6..8] de la carte système la plus récente
```

`[4..5]` et `[13..15]` ne sont **pas** recopiés depuis la base : ils sont
recalculés (`~site`) ou tirés au hasard, comme le fait `ResetCard`. Une carte
corrompue dans la base ne peut donc pas contaminer les cartes suivantes.

C'est ce que fait `deriveSystemProfile()` dans
`src/locks/database/mdbImport.ts`. Sans base importée, un modèle par défaut
est utilisé (`DEFAULT_SYSTEM_CARD_TEMPLATE`).

## 8. Lecture exacte des cartes

`decodeCardRecord()` suit désormais le layout réel de chaque famille :

| Famille | `[4..5]` | `[13..15]` |
|---|---|---|
| Système `0x00` | `~site` (vérifié, exposé via `siteComplementOk`) | **aléatoire** → `endIsUnknown: true`, aucune expiration affichée |
| Client `0x60` | sentinelle `E3` / chambre | date de fin de séjour |
| Master / étage / bâtiment `0xA0..0xD0` | niveau | date de fin de validité |

Garanties :

- jamais de date inventée : `mois = 0`, `jour = 0` ou `minute > 59` renvoient
  `null` (l'ancienne version fabriquait le 1er janvier → `2025/0/1 0:0:0`) ;
- jamais de `1899` : plus aucun chemin ne produit de date nulle ;
- le site est exposé en clair (`siteValue`) et une carte `0000` est signalée
  `isUniversalSite` ;
- le type affiché vient du nibble bas, avec l'octet brut dans `rawTypeIndex`.

## 9. Pourquoi les anciennes cartes étaient refusées

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
| `N9067 not a card for this system` | code site erroné (inversé, bit 14, ou carte non écrite) |
| `E0043 "2025/0/1 0:0:0,0" is not valid date and time` | année encodée sur la mauvaise base, ou mois nul |
| `system card [00000000] date of issue : 30/12/1899 00:00` | octets de date laissés à `00` |

## 10. Procédure dans l'application

1. Onglet **Mise en service**.
2. Section **Base de données CardLock.mdb** → sélectionner
   `C:\Program Files (x86)\ProUSB SOFTWARE\proUSBHotelLockSystem\CardLock.mdb`.
   Le badge passe à **CONNECTÉE** et affiche le code site réel
   (ex. `033B`), le nombre de cartes / chambres / séjours.
3. Cocher ou non **Carte universelle (site 0000)**.
4. **HARD RESET PERSISTANT** (ou **Carte Reset**) : l'app envoie les trames
   `IniCard`, puis écrit la carte système (`WriteCard`) et la relit pour
   vérifier (`ReadCard`). Cette relecture est la preuve que la carte contient
   bien les 16 octets attendus.
5. La console affiche la ligne :
   `Carte système 0x0E — site=033B complément=FC C4 émise=27/10/2026 12:33 (modèle DB #61)`
   ou, en mode universel : `site=0000 (UNIVERSELLE) complément=FF FF`.

Sans base importée, l'application reste autonome : elle utilise le modèle par
défaut (`site 03 3B`, `header 80 98 00`).

## 11. ID et Operator Code — ils ne sont pas sur la carte

C'est le point le plus contre-intuitif du système d'origine.

| Ce que montre `CardLock.exe` | D'où ça vient |
|---|---|
| **ID** | colonne `CardInfo.ID` (AutoNumber) de `CardLock.mdb` |
| **Operator Code** (`Admin`) | colonne `CardInfo.GongHao` |
| **Holder** | colonne `CardInfo.Holder` |
| **Card Data** | colonne `CardInfo.CardData` (la trame 32 caractères hex) |

La carte physique ne contient que 16 octets, sans nom ni opérateur. À la
lecture, `CardLock.exe` calcule la clé :

```sql
SELECT * FROM CardInfo WHERE Mid(CardData,19,8)=:a
```

soit les **caractères 19 à 26** de la trame hexadécimale = **octets `[9..12]`**
(type + date d'émission). Si aucune ligne ne correspond, le dialogue affiche des
champs vides — la carte reste parfaitement valide pour la serrure, mais le
logiciel d'origine n'a rien à afficher.

Une carte écrite par cette application n'existe donc **pas** dans `CardInfo` :
l'app n'écrit jamais dans le fichier JET4 (impossible depuis un navigateur,
`mdb-reader` est en lecture seule).

### Solution intégrée : « Synchroniser CardLock.mdb »

Dans l'onglet **Réception**, le tableau *Dernières Cartes Clés Émises* affiche
pour chaque carte :

- son **ID** calculé (`Mid(CardData,19,8)`), identique à celui du logiciel ;
- un badge **MDB** (déjà dans la base) ou **à sync** (absente) ;
- l'**Opérateur** enregistré.

Le bouton **Synchroniser CardLock.mdb** télécharge un fichier
`CardLock-CardInfo-AAAAMMJJ-HHMM.vbs` qui, en un double-clic :

1. se relance en **32 bits** (`SysWOW64\wscript.exe`) — Jet 4.0 n'existe qu'en
   32 bits ;
2. demande l'**élévation** si la base est sous `Program Files` ;
3. **sauvegarde** `CardLock.mdb` en `.backup-AAAAMMJJ-HHMMSS.bak` ;
4. insère les cartes absentes
   (`INSERT INTO CardInfo (CardData, Holder, GongHao, BeiZhu, Status) …`,
   `GongHao = Admin`) ;
5. vérifie chaque insertion et propose une **restauration** en cas d'échec.

Le script est idempotent : une carte déjà présente (même `Mid(CardData,19,8)`)
est ignorée. `ID` est un AutoNumber, il est attribué par Jet (par exemple
`1353`), exactement comme lorsque le logiciel d'origine émet une carte.

### Mot de passe de la base

`CardLock.mdb` est protégé par un mot de passe **Jet** :
`pradlock`. Il figure en clair dans `CardLock.Exe`, juste à côté de sa chaîne de
connexion :

```text
Provider=Microsoft.Jet.OLEDB.4.0;Data Source=%s;Persist Security Info=False; Jet OLEDB:DataBase Password=%s
```

Ce mot de passe n'empêche pas la lecture des pages (l'app et `mdb-reader`
lisent déjà la base sans lui) : ce n'est pas un secret, seulement une protection
contre l'ouverture accidentelle dans Access.

## 12. Règles métier appliquées

- `encodeGuestCard` : `end > start` ; durée ≤ 365 jours
- `encodeMasterCard` : site `00 00` (une master ouvre toutes les serrures du
  lecteur, conformément aux cartes `B0`…`B9` de la base)
- `decodeCardRecord` : site lu en big-endian, dates décodées avec fenêtre
  glissante de 16 ans, expiration résolue après le début
- Lecture = 3 bips courts, écriture = 2 bips longs, succès/échec distincts

## 13. Vérification reproductible

```bash
npx tsx scripts/verify-mdb.ts   "<...>\CardLock.mdb"
npx tsx scripts/verify-codec.ts
npx tsx scripts/verify-cardinfo.ts
```

`verify-codec.ts` contrôle :

- la reconstruction de 5 cartes réelles (client 2015, client 2023, master
  `0xB0`, système `0x01` et `0x0E`) ;
- le complément `[4..5] = ~site` pour les quatre sites observés
  (`033B`, `316A`, `24B6`, `0000`) ;
- la génération d'une carte **universelle** `C9 12 00 00 FF FF …` ;
- l'absence de queue figée (`[13..15]` distinct sur 32 cartes) ;
- le décodage exact des dates (2026, 2015, 2018) et l'absence d'expiration
  inventée sur les cartes système ;
- la détection d'une carte système dont le complément a été altéré.

`verify-cardinfo.ts` contrôle la synchronisation `CardInfo` : calcul de l'ID
(`Mid(CardData,19,8)`) sur trois cartes réelles, mot de passe Jet, relance
32 bits, auto-élévation, sauvegarde, `INSERT` avec colonnes explicites,
dédoublonnage par ID, encodage Unicode ASCII et fins de ligne Windows.

Sortie attendue : `TOUT EST VERT`.

## 14. Liens utiles

- `docs/PROUSB_SPECIFICATION.md` — spécification RE du protocole
- `README_CARDS.md` — différences Master / Groupe / 13 familles
- `src/locks/cards/codec.ts` — encodage / décodage
- `src/locks/database/mdbImport.ts` — import réel de `CardLock.mdb`
- `src/locks/database/cardInfoSync.ts` — génération du script `CardInfo`
- `src/locks/lockManager.ts` — écriture vérifiée des cartes système
- `src/components/ProUsbLockSystemView.tsx` — onglet Mise en Service

---
*Format établi par décompilation de `proRFL.dll` (`ResetCard`), confronté aux
62 enregistrements de `CardLock.mdb` et à une carte lue sur l'encodeur
physique. Les cartes générées sont structurellement identiques à celles du
logiciel d'origine ; la validation finale se fait en présentant la carte
devant une serrure réelle.*
