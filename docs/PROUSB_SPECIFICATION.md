# ProUSB Hotel Lock System — Spécification Technique Complète

> Reverse Engineering Dossier — Document de référence pour la reconstruction dans React/OmniBook
> Source : Logiciel original `CardLock.Exe` (Delphi/VCL, x86 PE) + `CardLock.mdb` (Access/Jet)
> Date de l'analyse : Octobre 2026

---

## 1. Vue d'ensemble du système

### 1.1 Architecture matérielle

| Composant | Description |
|-----------|-------------|
| **Encodeur USB** | proUSB-TEMIC (Reader_0000016), VID `0x9915`, PID `0x1116` |
| **Interface** | USB HID, Usage Page `0x85FF` (Vendor Defined), Rapport 65 octets |
| **Support de données** | Cartes MIFARE 1K (RFID 13.56 MHz, 16 octets par secteur) |
| **Serrure** | Serrure électronique d'hôtel avec pêne dormant, mémoire audit 33 slots |
| **Base de données** | Microsoft Access (Jet DB), fichier `CardLock.mdb`, mot de passe `pradlock` |

### 1.2 Architecture logicielle originale

| Élément | Technologie |
|---------|-------------|
| **Application principale** | `CardLock.Exe` — Delphi/VCL, x86 PE, MFC runtime |
| **Base de données** | `CardLock.mdb` — Access/Jet DB |
| **Encodeur USB** | `Mwic_32.dll` — API MWIC (MIFARE Write/IC) |
| **Communication série** | `d12c.dll` / `d12.dll` — Protocole série custom |
| **Logique métier** | `proRFL.dll` — Package Delphi (proRFL) |
| **Interface** | Skins `mxskin*.skn` (mxSkin/MxSkin framework) |
| **Rapports** | Templates Excel `ReportCards.xls`, `ReportGuests.xls`, `ReportOpen.xls` |

### 1.3 Fichiers de configuration

| Fichier | Rôle |
|---------|------|
| `System.ini` | Paramètres système (hôtel, entreprise, heures checkout, skin, licence) |
| `Reg.ini` | Enregistrement dongle/licence (SN, dates, ReaderInfo) |
| `CardLock.mdb` | Base de données principale (cartes, audit, configuration) |

---

## 2. Protocole de communication HID

### 2.1 Trames host → lecteur

```
AA <length> <command> <payload...> <checksum>
```

- `AA` : Octet de début (FRAME_START = 0xAA)
- `length` : Nombre d'octets suivants incluant la commande et le payload
- `command` : Code opération (voir ci-dessous)
- `payload` : Données variables
- `checksum` : XOR de tous les octets précédents (y compris AA)

### 2.2 Trames lecteur → host

```
55 <length> <status> <data...> <checksum>
```

- `55` : Octet de début (RESPONSE_START = 0x55)
- `length` : Nombre d'octets suivants incluant le statut et les données
- `status` : `0x01` = accepté, autre = erreur
- `data` : Données de réponse
- `checksum` : XOR de tous les octets précédents (y compris 55)

### 2.3 Commandes disponibles

| Code | Nom | Description | Trame complète |
|------|-----|-------------|----------------|
| `0x80` | Buzzer | Signal sonore | `AA 02 80 01 29` (on) / `AA 02 80 00 28` (off) |
| `0x96` | IniCard Step 0 | Réinitialisation serrure (étape 1) | `AA 01 96 3D` |
| `0x69` | IniCard Step 1 | Réinitialisation serrure (étape 2) | `AA 01 69 C2` |
| `0x56` | IniCard Step 2 | Réinitialisation serrure (étape 3) | `AA 01 56 FD` |
| `0xE4` | ReadCard | Lecture carte dans le slot | `AA 01 E4 4F` → `55 15 01 <20 octets> <checksum>` |
| `0xEC` | WriteCard | Écriture 16 octets sur la carte | `AA 11 EC <16 octets> <checksum>` (20 octets total) |
| `0x82` | ReadRecord | Lecture journal d'audit | `AA 01 82 29` → `55 25 01 <37 octets> <checksum>` |
| `0x47` | ReadE2 | Lecture EEPROM | `AA 02 47 <addr> <addr ^ 0xEF>` → 32 octets |

### 2.4 Rapport HID

- **Report ID sortie** : `0x40` (64 octets de charge utile)
- **Report ID entrée** : variable (0x00-0xFF)
- **Taille totale** : 65 octets (1 report ID + 64 données)

### 2.5 File d'entrée : purger avant chaque échange

Le lecteur émet un rapport HID pour **chaque** commande, y compris pour
`WriteCard`. Ces accusés de réception n'ont pas de consommateur : ils
s'accumulent dans la file d'entrée et la lecture suivante les prend pour la
carte.

Conséquences observées sur matériel réel :

- écriture réussie **une seule fois**, puis « L'écriture n'a pas pu être
  vérifiée en relecture » sur toutes les tentatives suivantes ;
- retour au fonctionnement normal après rafraîchissement de la page (la file
  est vidée avec la session HID).

Correctif implémenté :

1. `LockTransport.drain()` vide la file avant chaque écriture **et** avant
   chaque lecture de vérification (`lockManager.writeAndVerifyCard`,
   `readCurrentCard`) ;
2. `transact()` accepte `minDataLength` : une réponse plus courte que 16 octets
   est ignorée et la commande est réessayée, au lieu d'être renvoyée comme
   contenu de carte ;
3. en cas d'échec, l'erreur contient la trame écrite, la trame relue et la cause
   exacte (timeout, erreur transport, contenu différent).

---

## 3. Base de données CardLock.mdb

### 3.1 Mot de passe et accès

```
Provider: Microsoft.Jet.OLEDB.4.0 (ou Microsoft.ACE.OLEDB.12.0)
Data Source: C:\Program Files (x86)\ProUSB SOFTWARE\proUSBHotelLockSystem\CardLock.mdb
Jet OLEDB:Database Password: pradlock
```

> **Attention — virtualisation UAC.** `CardLock.exe` est un binaire 32 bits sans
> manifeste installé sous `Program Files (x86)` : Windows redirige donc ses
> **écritures** vers
> `%LOCALAPPDATA%\VirtualStore\Program Files (x86)\ProUSB SOFTWARE\proUSBHotelLockSystem\CardLock.mdb`.
> Sur une installation réelle, le fichier de `Program Files` était resté figé au
> `12/12/2023` (62 cartes) alors que la copie VirtualStore contenait 88 cartes,
> modifiées le jour même. **La copie VirtualStore est la base vivante** : c'est
> elle qu'il faut lire et modifier. Le script de synchronisation de l'app la
> détecte à l'exécution (copie la plus récemment modifiée).

Le mot de passe apparaît en clair dans `CardLock.Exe`, à côté du format de
connexion (`0x5b84ac`) :

```text
Provider=Microsoft.Jet.OLEDB.4.0;Data Source=%s;Persist Security Info=False; Jet OLEDB:DataBase Password=%s
```

Jet 4.0 n'existe qu'en **32 bits** : toute écriture doit passer par
`C:\Windows\SysWOW64\wscript.exe` (ou `cscript.exe`). Sans le mot de passe, Jet
répond `Mot de passe non valide` ; `mdb-reader` (lecture des pages) n'en a pas
besoin.

### 3.2 Schéma des tables

#### Table `CardInfo` — Cartes émises

Schéma réel (vérifié avec `mdb-reader` sur `CardLock.mdb`, 62 lignes) :

| Colonne | Type | Rôle |
|---------|------|------|
| `ID` | AutoNumber (long) | Identifiant unique attribué par Jet — c'est l'**ID** affiché par `CardLock.exe` |
| `CardData` | Text(100) | Trame complète de la carte, 32 caractères hexadécimaux |
| `Holder` | Text(100) | Nom du titulaire (vide pour les cartes système) |
| `GongHao` | Text(40) | **Operator Code** — `Admin` pour toutes les cartes de cette base |
| `BeiZhu` | Text(200) | Commentaire libre |
| `Status` | Text(100) | `""`, `Erased Card Successfully`, `New Check-In && Cover Cards Before` |

Il n'existe **aucune** colonne `CardType`, `IssueDate`, `ExpiryDate`, `RoomNo`,
`Operator` ni `CardIndex` : le type, les dates et la chambre sont lus dans les
16 octets de `CardData`.

Recherche utilisée par `CardLock.exe` pour retrouver une carte lue :

```sql
SELECT * FROM CardInfo WHERE Mid(CardData,19,8)=:a
```

soit les caractères 19 à 26 = octets `[9..12]` (type + date d'émission). Si la
ligne n'existe pas, l'ID et l'Operator Code restent vides même si la carte est
valide pour la serrure.

Insertion faite par le logiciel d'origine à l'émission
(`FUN_006d4dd0`, chaîne à `0x6d51c8`) :

```sql
INSERT INTO CardInfo VALUES(:ID,:CardData,:Holder,:Operator,:BeiZhu,:Status)
```

Notre application reproduit l'insertion avec une liste de colonnes explicites
(`INSERT INTO CardInfo (CardData, Holder, GongHao, BeiZhu, Status) …`) afin de
laisser Jet attribuer l'`ID` — voir `README_SYSTEM_CARD.md` §11.

#### Table `RecordOpen` — Journal d'audit des serrures

| Colonne | Type | Description |
|---------|------|-------------|
| `OrderFlag` | Number | Position dans la mémoire de la serrure (1-33) |
| `RecData` | Text (8 hex) | Données brutes de l'ouverture (8 octets) |
| `OpenTime` | DateTime | Horodatage de l'ouverture |
| `CardType` | Number | Type de carte utilisée |
| `CardNo` | Text | Identifiant de la carte |
| `RoomNo` | Text | Chambre concernée |

#### Table `Dai` — Mapping types de cartes

| Colonne | Type | Description |
|---------|------|-------------|
| `CardType` | Number | Code famille (0x00-0xD0) |
| `Dai` | Text | Nom/description du type de carte |

#### Table `RegInfo` — Informations d'enregistrement

| Colonne | Type | Description |
|---------|------|-------------|
| `Registor` | Text | Identifiant du lecteur (ex: "proM9-20121130-14") |
| `RegDate` | Date | Date d'enregistrement du lecteur |

### 3.3 Données types (table Dai)

| Code | Nom | Description |
|------|-----|-------------|
| `0x00` | Reset/IniCard | Carte de réinitialisation usine |
| `0x10` | Record/Audit Card | Carte de relevé d'audit |
| `0x20` | Room Set Card | Carte d'affectation de chambre |
| `0x30` | Time Set Card | Carte de synchronisation horloge |
| `0x40` | Limit/Blacklist Card | Carte de restriction/révocation |
| `0x50` | Group Set Card | Carte de configuration de groupe |
| `0x60` | Guest Card | Carte client (accès chambre) |
| `0x70` | Check-Out Card | Carte d'annulation de séjour |
| `0x80` | Group Card | Carte d'accès groupe |
| `0xA0` | Emergency Card | Carte d'urgence (ouvre pêne dormant) |
| `0xB0` | Master Card | Carte maître (ouvre toutes les chambres) |
| `0xC0` | Building Card | Carte bâtiment (ouvre tout le bâtiment) |
| `0xD0` | Floor Card | Carte étage (ouvre tout l'étage) |

---

## 4. Les 13 familles de cartes — Détail complet

### 4.1 Structure commune (16 octets)

Toutes les cartes proUSB partagent une structure de base de 16 octets :

```
Octet 0:  0xC9 (Magic constant)
Octet 1:  0x12 (Site code high)
Octet 2:  Site code low (octet bas)
Octet 3:  Site code high (octet haut) — bits 14-15 pour options
Octet 4:  Variable (dépend du type)
Octet 5:  Variable (dépend du type)
Octet 6:  Variable (dépend du type)
Octet 7:  Variable (dépend du type)
Octet 8:  Options (bit 0 = porte publique)
Octet 9:  Type famille (0x00-0xD0) + index carte (0-15)
Octet 10: Date début (byte 0)
Octet 11: Date début (byte 1)
Octet 12: Date début (byte 2)
Octet 13: Date fin (byte 0)
Octet 14: Date fin (byte 1)
Octet 15: Date fin (byte 2)
```

### 4.2 Encodage date/heure (3 octets)

```
Byte 0: ((YY % 100 & 0x0F) << 4) | (MM & 0x0F)
Byte 1: ((DD & 0x1F) << 3) | ((HH >> 2) & 0x07)
Byte 2: ((HH & 0x03) << 6) | (MIN & 0x3F)
```

- YY : Année (0-9, représentant 2000-2009 puis 2010-2019...)
- MM : Mois (1-12)
- DD : Jour (1-31)
- HH : Heure (0-23)
- MIN : Minute (0-59)

### 4.3 Carte Client (Guest Card) — 0x60

**Rôle** : Accès à une chambre spécifique pendant une période donnée.

**Structure des données** :
```
Octet 0:  0xC9 (Magic)
Octet 1:  0x12 (Site high)
Octet 2:  Site low & 0xFF (avec bit 14 = cover cards before)
Octet 3:  (Site low >> 8) & 0xFF
Octet 4:  0xE3 (Sentinelle constante : 0x63 | 0x80)
Octet 5:  (Room % 100) | 0x80 (numéro de chambre modulo 100)
Octet 6:  (Floor) | 0x80 (étage = Room / 100)
Octet 7:  0x01 (Séquence / nuits)
Octet 8:  0x01 si accès porte publique, sinon 0x00
Octet 9:  0x60 | cardIndex (0-15)
Octet 10-12: Date/heure de début
Octet 13-15: Date/heure de fin
```

**Options** :
- `allowDeadbolt` : Autorise le déverrouillage si le pêne dormant est engagé
- `coverCardsBefore` : Invalide les cartes précédentes pour cette chambre (bit 14 de siteLow)
- `openPublicDoor` : Accès aux portes publiques/ascenseurs (octet 8)

**Exemple réel** : `C9 12 24 B6 E3 81 81 01 01 62 65 DB 15 65 E3 00`
- Chambre 101, étage 1
- Index carte 2
- Accès porte publique : Oui
- Validité : du 23/10/2026 14:00 au 27/10/2026 12:00

**Ce que fait la serrure** :
1. Vérifie que le code site correspond (0x12C9)
2. Vérifie que le type est 0x60 (Guest)
3. Vérifie que le numéro de chambre correspond à la serrure
4. Vérifie que la date/heure actuelle est dans la fenêtre de validité
5. Vérifie les options (pêne dormant, porte publique)
6. Si tout est OK : déverrouille la porte
7. Enregistre l'ouverture dans la mémoire d'audit (slot)

### 4.4 Carte Maître (Master Card) — 0xB0

**Rôle** : Passe-partout général ouvrant toutes les chambres de l'établissement.

**Structure des données** :
```
Octet 0:  0xC9
Octet 1:  0x12
Octet 2-3: Site code (0x24B6)
Octet 4:  0xFF (ouvre tout)
Octet 5:  0x00
Octet 6:  pseudoRand (nonce)
Octet 7:  0x80
Octet 8:  0x00
Octet 9:  0xB0 | cardIndex
Octet 10-12: Date de début
Octet 13-15: Date de fin
```

**Ce que fait la serrure** :
1. Vérifie le code site
2. Vérifie le type 0xB0 (Master)
3. Ignore le numéro de chambre (ouvre tout)
4. Vérifie la validité temporelle
5. Déverrouille la porte
6. Enregistre dans l'audit comme "master_open"

### 4.5 Carte Étage (Floor Card) — 0xD0

**Rôle** : Ouvre toutes les chambres d'un étage sélectionné.

**Différence avec Master** :
- Octet 4 = numéro d'étage (1-6)
- Octet 9 = `0xD0 | cardIndex`

**Ce que fait la serrure** :
1. Vérifie le code site
2. Vérifie le type 0xD0
3. Vérifie que l'étage de la serrure correspond à l'octet 4
4. Vérifie la validité temporelle
5. Si correspondance : déverrouille

### 4.6 Carte Bâtiment (Building Card) — 0xC0

**Rôle** : Ouvre toutes les chambres d'un bâtiment entier.

**Différence** :
- Octet 4 = numéro de bâtiment (1-3)
- Octet 9 = `0xC0 | cardIndex`

### 4.7 Carte Urgence (Emergency Card) — 0xA0

**Rôle** : Déverrouillage d'urgence immédiat, outrepasse le pêne dormant intérieur.

**Différence** :
- Octet 4 = 0xFF
- Octet 9 = `0xA0 | cardIndex`
- **Ignore la validité temporelle** (toujours valide)
- **Outrepasse le pêne dormant** (force l'ouverture)

**Ce que fait la serrure** :
1. Vérifie le code site
2. Vérifie le type 0xA0
3. Déverrouille immédiatement, même si le pêne dormant est engagé
4. Enregistre dans l'audit comme "emergency_open"

### 4.8 Carte Groupe (Group Card) — 0x80

**Rôle** : Accès simultané à plusieurs chambres liées dans un groupe.

**Différence** :
- Octet 9 = `0x80 | cardIndex`
- Nécessite une configuration préalable via la Group Set Card

### 4.9 Carte Check-Out — 0x70

**Rôle** : Invalide immédiatement la carte précédente dans la serrure.

**Structure** :
```
Octet 4:  (Room % 100) — numéro de chambre
Octet 5:  (Floor) — étage
Octet 9:  0x70 | cardIndex
```

**Ce que fait la serrure** :
1. Vérifie le code site et le type 0x70
2. Vérifie le numéro de chambre
3. **Efface la carte précédente** de la mémoire de la serrure
4. La carte client précédente devient invalide
5. Enregistre l'opération dans l'audit

### 4.10 Carte Limite (Limit Card) — 0x40

**Rôle** : Restreint les horaires ou la validité d'accès d'une serrure.

**Utilisation** : Configure les paramètres de restriction dans la serrure.

### 4.11 Carte Config Groupe (Group Set Card) — 0x50

**Rôle** : Programme le code groupe dans la mémoire de la serrure.

**Ce que fait la serrure** :
1. Vérifie le code site et le type 0x50
2. Programme le code groupe dans la mémoire
3. Les cartes Group (0x80) peuvent ensuite ouvrir les chambres de ce groupe

### 4.12 Carte N° Chambre (Room Set Card) — 0x20

**Rôle** : Étape 2 de la mise en service — affecte le numéro de chambre à la serrure.

**Structure** :
```
Octet 4:  BuildingNo (numéro de bâtiment)
Octet 5:  FloorNo (numéro d'étage)
Octet 6:  Room % 100 (numéro de chambre modulo 100)
Octet 7:  0x80
Octet 8:  0x00
Octet 9:  0x20 | cardIndex
Octet 13-15: Données pseudo-aléatoires (nonce)
```

**Ce que fait la serrure** :
1. Vérifie le code site et le type 0x20
2. Programme le numéro de bâtiment, étage et chambre dans la mémoire
3. La serrure émet 2 bips pour confirmer
4. La serrure est maintenant associée à cette chambre

### 4.13 Carte Horloge (Time Set Card) — 0x30

**Rôle** : Étape 3 de la mise en service — synchronise l'horloge interne de la serrure.

**Structure** :
```
Octet 4-7: Données pseudo-aléatoires (nonce)
Octet 8:  0x00
Octet 9:  0x30 | cardIndex
Octet 10-12: Date/heure actuelle (à programmer)
Octet 13-15: Données pseudo-aléatoires
```

**Ce que fait la serrure** :
1. Vérifie le code site et le type 0x30
2. Lit la date/heure des octets 10-12
3. Programme l'horloge interne (quartz)
4. La serrure utilise cette horloge pour valider les cartes Guest

### 4.14 Carte Journal (Record Card) — 0x10

**Rôle** : Relève l'historique d'ouvertures de la serrure (33 slots).

**Ce que fait la serrure** :
1. Vérifie le code site et le type 0x10
2. Retourne les 33 paquets d'audit (37 octets chacun)
3. Chaque paquet contient : OrderFlag, RecData (8 octets), OpenTime

**Format d'un paquet d'audit** :
```
Octet 0:  0x55 (début)
Octet 1:  0x25 (37 octets)
Octet 2:  0x01 (statut OK)
Octet 3-10: RecData (8 octets de données)
Octet 11-36: Données supplémentaires
Octet 36:  Séquence (0-32)
```

### 4.15 Carte Reset (IniCard) — 0x00

**Rôle** : Étape 1 de la mise en service — réinitialise la serrure en paramètres d'usine.

**Processus** :
1. Envoi de 3 commandes IniCard consécutives :
   - `AA 01 96 3D` (Step 0)
   - `AA 01 69 C2` (Step 1)
   - `AA 01 56 FD` (Step 2)
2. La serrure émet 3 bips
3. La mémoire de la serrure est effacée
4. La serrure est prête pour la configuration (Room Set → Time Set)

---

## 5. Workflow complet — Mise en service d'une nouvelle serrure

```
┌─────────────────────────────────────────────────────────────┐
│  ÉTAPE 1 : RÉINITIALISATION USINE (Reset Card)             │
│                                                             │
│  1. Générer la carte Reset (IniCard)                       │
│  2. Présenter la carte sur la serrure neuve                │
│  3. La serrure émet 3 bips                                 │
│  4. La mémoire de la serrure est effacée                   │
│  5. La serrure est en mode "non configuré"                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│  ÉTAPE 2 : AFFECTATION CHAMBRE (Room Set Card)             │
│                                                             │
│  1. Saisir le numéro de bâtiment, étage et chambre         │
│  2. Générer la carte Room Set (0x20)                       │
│  3. Présenter la carte sur la serrure                      │
│  4. La serrure programme BldNo, FloorNo, RoomNo            │
│  5. La serrure émet 2 bips                                 │
│  6. La serrure est associée à cette chambre                │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│  ÉTAPE 3 : SYNCHRONISATION HORLOGE (Time Set Card)         │
│                                                             │
│  1. L'heure actuelle est injectée dans la carte            │
│  2. Générer la carte Time Set (0x30)                       │
│  3. Présenter la carte sur la serrure                      │
│  4. La serrure programme son horloge interne (quartz)      │
│  5. La serrure est prête à recevoir des cartes Guest       │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Workflow complet — Émission d'une carte client

```
┌─────────────────────────────────────────────────────────────┐
│  1. SÉLECTION DE LA RÉSERVATION                            │
│                                                             │
│  - Choisir une réservation dans le planning OmniBook       │
│  - Extraction automatique : chambre, client, dates         │
│  - Ou saisie manuelle des paramètres                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│  2. CONFIGURATION DES PARAMÈTRES                           │
│                                                             │
│  - Numéro de chambre (ex: 101)                            │
│  - Nom du client                                           │
│  - Date/heure d'arrivée (check-in)                        │
│  - Date/heure de départ (check-out)                       │
│  - Options :                                               │
│    • Cover Cards Before (invalider anciennes cartes)       │
│    • Allow Deadbolt (pêne dormant autorisé)               │
│    • Open Public Door (portes publiques)                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│  3. ENCODAGE DE LA CARTE                                   │
│                                                             │
│  - Calcul des 16 octets selon la formule vérifiée          │
│  - Vérification du checksum XOR                            │
│  - Affichage de la trame hex dans la console               │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│  4. ÉCRITURE SUR L'ENCODEUR USB                            │
│                                                             │
│  - Envoi de la trame AA 11 EC <16 octets> <checksum>      │
│  - L'encodeur écrit sur la carte MIFARE                   │
│  - Émission d'un bip sonore de confirmation               │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│  5. VÉRIFICATION PAR RELCTURE                              │
│                                                             │
│  - Envoi de AA 01 E4 4F (ReadCard)                        │
│  - Réception de 55 15 01 <20 octets>                      │
│  - Comparaison des données lues avec les données écrites   │
│  - Si mismatch : réessai (jusqu'à 3 tentatives)           │
│  - Si OK : carte validée                                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│  6. ENREGISTREMENT DANS LA BASE                            │
│                                                             │
│  - Insertion dans CardInfo (CardData, Status, Holder, etc.)│
│  - Mise à jour de l'interface (tableau des cartes)        │
│  - Notification de succès à l'utilisateur                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Paramètres système (System.ini)

### 7.1 Section [SYSTEM]

| Paramètre | Valeur exemple | Description |
|-----------|---------------|-------------|
| `CompanyName` | Card Lock | Nom de l'entreprise |
| `CompanyPhone` | (vide) | Téléphone |
| `CompanyWEB` | (vide) | Site web |
| `CompanyMisc` | (vide) | Informations diverses |
| `Skin` | mxskin20.skn | Fichier de thème visuel |
| `HotelName` | Grand Hotel Oran | Nom de l'hôtel |
| `DBBakPath` | D:\proUSB_DBBak | Chemin de sauvegarde DB |
| `dlsCoID` | 1180475 | ID compagnie (dongle) |
| `CheckOutTime` | 12:00:00 | Heure de check-out standard |
| `VIPCheckOutTime` | 14:00:00 | Heure de check-out VIP |
| `FlagCheckOut` | 0 | Flag de check-out |
| `GuestLLock` | 1 | Pêne dormant autorisé pour les clients |
| `BaoJing` | 128 | Alarme sonore forçage (128 = activé) |
| `TiShi` | 152 | Rappel fermeture de porte (152 = activé) |
| `SA` | 708EE4C560EDC47C | Clé de licence A |
| `SB` | 231212 | Clé de licence B (date) |
| `SC` | 4080 | Clé de licence C (jours restants) |

### 7.2 Section [READONLY]

| Paramètre | Valeur | Description |
|-----------|--------|-------------|
| `DaysNote` | 5 | Jours de notification avant expiration |
| `DateChange` | 0 | Changement de date autorisé |
| `DateLimit` | 0 | Limite de date |
| `CheckBlank` | 0 | Vérification des champs vides |
| `ClrPrice` | 0 | Effacement des prix |

### 7.3 Section [FONT]

| Paramètre | Valeur | Description |
|-----------|--------|-------------|
| `Name` | (liste) | Polices disponibles (System, Arial) |
| `Size` | 12 | Taille de police |
| `Height` | -16 | Hauteur de police |
| `CharSet` | 1 | Jeu de caractères (1 = DEFAULT_CHARSET) |

### 7.4 Section [ROOMSDEFINATION]

| Paramètre | Valeur | Description |
|-----------|--------|-------------|
| `WidthOfBldNo` | 140 | Largeur colonne n° bâtiment |
| `WidthOfBldName` | 370 | Largeur colonne nom bâtiment |

---

## 8. Reg.ini — Enregistrement dongle/licence

### 8.1 Structure

Chaque entrée contient :
```
<Date> <Heure>
    SN:         <Serial Number>
    Date:       <Date format YYMMDD>
    Days:       <Jours de validité>
    SerialNo1:  <SN précédent>
    SerialNo2:  <SN2 précédent> [ErrRDN si erreur]
    ReaderInfo: <Hex encodé>
```

### 8.2 ReaderInfo (hexadécimal)

Le champ ReaderInfo contient des chaînes ASCII encodées :
- `2D 70 72 6F 4D 39 2D 32 30 31 32 31 31 33 30 2D 31 34` = `-proM9-20121130-14`
- `2D 70 72 6F 55 53 42 32 30 31 34 30 31 30 37` = `-proUSB20140107`
- `0xCC 0xCC` : Padding
- `0x55` : Marqueur de fin

### 8.3 Licence et bridage

Le logiciel original utilise un système de licence basé sur :
- **SN** : Numéro de série du dongle USB
- **Days** : Nombre de jours de validité restants (4095 = illimité)
- **SA/SB/SC** : Clés de licence dans System.ini
- **ErrRDN** : Indique une erreur de lecture du dongle

Dans la reconstruction React, ce bridage est **supprimé** — l'accès est libre et permanent.

---

## 9. Skins (thèmes visuels)

| Fichier | Taille | Description |
|---------|--------|-------------|
| `mxskin10.skn` | 9 KB | Thème clair basique |
| `mxskin20.skn` | 63 KB | Thème par défaut (mxSkin) |
| `mxskin22.skn` | 32 KB | Thème alternatif |
| `mxskin24.skn` | 47 KB | Thème sombre |
| `mxskin28.skn` | 53 KB | Thème étendu |

Le skin par défaut est `mxskin20.skn` (configuré dans System.ini).

---

## 10. Rapports (templates Excel)

| Fichier | Description |
|---------|-------------|
| `ReportCards.xls` | Rapport des cartes émises |
| `ReportGuests.xls` | Rapport des clients/nuitées |
| `ReportOpen.xls` | Rapport des ouvertures de serrures |

---

## 11. Hiérarchie des rôles opérateurs

| Code | Rôle | Privilèges |
|------|------|-----------|
| `S` | Super Administrateur | Gestion des profils et options serrures |
| `A` | Administrateur | Mise en service des serrures et passes généraux |
| `M` | Manager d'Étage | Attribution des cartes étages et check-out |
| `G` | Opérateur Général (Réception) | Émission quotidienne des cartes clients |

---

## 12. Paramètres de comportement des serrures

| Paramètre | Valeur | Description |
|-----------|--------|-------------|
| `GuestLLock` | 1 | Pêne dormant autorisé pour les clients (Guest Access Bolt) |
| `BaoJing` | 128 | Alarme sonore forçage (déclenchée si gâche forcée) |
| `TiShi` | 152 | Rappel fermeture de porte (bip si porte entrouverte > 30s) |
| `lockAfterReleaseKnob` | true | Re-verrouillage après relâchement de la poignée |
| `dontDisturbMode` | true | Mode ne pas déranger |
| `ignoreCoverFunction` | false | Ignorer la fonction cover (invalider anciennes cartes) |

---

## 13. Communication USB — Détails techniques

### 13.1 API MWIC (Mwic_32.dll)

| Fonction | Description |
|----------|-------------|
| `DES_Encrypt` | Chiffrement DES des données de carte |
| `DES_Decrypt` | Déchiffrement DES |
| `Init_45` | Initialisation du lecteur type 45 |
| `Read_45` | Lecture type 45 |
| `Write_45` | Écriture type 45 |
| `asc_asc` | Conversion ASCII vers ASCII |
| `asc_hex` | Conversion ASCII vers hexadécimal |
| `auto_chk` | Vérification automatique |
| `auto_init` | Initialisation automatique |
| `auto_pull` | Extraction automatique |
| `chk_*` | Fonctions de vérification (101, 102, 1604, etc.) |
| `clrpr_*` | Effacement de protection |
| `clrrd_*` | Effacement de lecture |
| `cmp_dvsc` | Comparaison de données |
| `cpu_comres` | Communication série |
| `cpu_protocol` | Protocole CPU |
| `cpu_reset` | Reset CPU |
| `csc_*` | Fonctions CSC (101, 102, 1604, etc.) |

### 13.2 Protocole série (d12c.dll)

Le lecteur communique via un protocole série custom :
- `readPortPro` : Lecture du port (proUSB)
- `readPortb` : Lecture brute du port
- `writePort` : Écriture sur le port

### 13.3 Rapport HID détaillé

```
Report ID: 0x40 (64 octets de charge utile)
Structure de sortie: AA <len> <cmd> <payload...> <checksum> (max 63 octets)
Structure d'entrée: 55 <len> <status> <data...> <checksum> (max 63 octets)
```

---

## 14. Mémoire d'audit de la serrure

### 14.1 Capacité

- **33 slots** de mémoire (OrderFlag 1-33)
- **37 octets** par paquet d'audit
- **Format** : `55 25 01 <8 octets RecData> <28 octets supplémentaires>`

### 14.2 Types d'événements

| Type | Code | Description |
|------|------|-------------|
| `guest_open` | 0x60 | Ouverture par carte client |
| `master_open` | 0xB0 | Ouverture par carte maître |
| `emergency_open` | 0xA0 | Ouverture d'urgence |
| `key_open` | 0x10 | Ouverture par clé physique |
| `deadbolt_forced` | — | Tentative de forçage du pêne |
| `invalid_card` | — | Carte invalide présentée |

### 14.3 Extraction des données

1. Présenter la carte Record (0x10) sur la serrure
2. La serrure retourne 33 paquets de 37 octets
3. Chaque paquet est parsé : OrderFlag, RecData (8 octets), OpenTime
4. Les données sont stockées dans la table RecordOpen de CardLock.mdb

---

## 15. Résumé des fonctionnalités du logiciel original

### 15.1 Réception (onglet 1)

- Émission de cartes client (Guest Card 0x60)
- Liaison avec les réservations (auto-remplissage)
- Configuration des dates/heures de validité
- Options de sécurité (cover cards, deadbolt, porte publique)
- Lecture de carte (inspecteur)
- Tableau des cartes émises

### 15.2 Cartes de service (onglet 2)

- Émission de 7 types de cartes de fonction :
  - Master (passe général)
  - Floor (étage)
  - Building (bâtiment)
  - Emergency (urgence)
  - Group (groupe)
  - Check-Out (annulation)
  - Limit (restriction)
- Configuration de la durée de validité
- Sélection de l'étage/bâtiment pour les cartes spécifiques

### 15.3 Mise en service (onglet 3)

- Étape 1 : Carte Reset (IniCard) — réinitialisation usine
- Étape 2 : Carte Room Set — affectation chambre
- Étape 3 : Carte Time Set — synchronisation horloge

### 15.4 Journal d'audit (onglet 4)

- Émission de carte Record
- Import du journal depuis la serrure
- Affichage des 33 slots d'audit
- Filtrage par type d'événement

### 15.5 Encodeur & Console (onglet 5)

- Spécifications du matériel (VID/PID, rapport HID)
- Connexion WebHID
- Commandes matérielles directes (buzzer)
- Console hex en temps réel (TX/RX)

### 15.6 Paramètres & Rôles (onglet 6)

- Comportement des serrures (pêne dormant, alarme, rappel)
- Hiérarchie des rôles opérateurs
- Licence libre (suppression du bridage)
- Paramètres système depuis System.ini

---

## 16. Tableau récapitulatif — Carte → Action dans la serrure

| Carte | Type | Action dans la serrure |
|-------|------|----------------------|
| **Guest** (0x60) | Accès chambre | Vérifie site, type, chambre, validité, options → déverrouille si OK |
| **Master** (0xB0) | Passe général | Vérifie site, type → déverrouille toute chambre (ignore n° chambre) |
| **Floor** (0xD0) | Passe étage | Vérifie site, type, étage → déverrouille si étage correspond |
| **Building** (0xC0) | Passe bâtiment | Vérifie site, type, bâtiment → déverrouille si bâtiment correspond |
| **Emergency** (0xA0) | Urgence | Vérifie site, type → déverrouille immédiatement (outrepasse pêne) |
| **Group** (0x80) | Passe groupe | Vérifie site, type, groupe configuré → déverrouille si groupe correspond |
| **Check-Out** (0x70) | Annulation | Vérifie site, type, chambre → efface la carte précédente |
| **Limit** (0x40) | Restriction | Configure les restrictions d'accès dans la serrure |
| **Group Set** (0x50) | Config groupe | Programme le code groupe dans la mémoire |
| **Room Set** (0x20) | Affectation | Programme BldNo, FloorNo, RoomNo dans la mémoire |
| **Time Set** (0x30) | Horloge | Programme la date/heure dans le quartz |
| **Record** (0x10) | Audit | Retourne les 33 paquets d'audit |
| **Reset** (0x00) | Réinitialisation | Efface la mémoire, remet en mode usine |

---

## 17. Formule de vérification — Exemple Guest Card

**Données d'entrée** :
- Chambre : 101
- Index carte : 2
- Site code : 0x12B6 (0x12 high, 0x24B6 low)
- Date début : 23/10/2026 14:00
- Date fin : 27/10/2026 12:00
- Options : coverCardsBefore=true, openPublicDoor=true

**Calcul** :
```
card[0] = 0xC9 (magic)
card[1] = 0x12 (site high)
card[2] = 0xB6 (site low & 0xFF, avec bit 14 pour cover)
card[3] = 0x24 (site low >> 8)
card[4] = 0xE3 (0x63 | 0x80 sentinelle)
card[5] = 0x81 (101 % 100 = 1, | 0x80)
card[6] = 0x81 (101 / 100 = 1, | 0x80)
card[7] = 0x01 (séquence)
card[8] = 0x01 (porte publique)
card[9] = 0x62 (0x60 | 2 index)
card[10] = packDateTime(2026, 10, 23, 14, 0)[0] = 0x63
card[11] = packDateTime(2026, 10, 23, 14, 0)[1] = 0x81
card[12] = packDateTime(2026, 10, 23, 14, 0)[2] = 0x81
card[13] = packDateTime(2026, 10, 27, 12, 0)[0] = 0x65
card[14] = packDateTime(2026, 10, 27, 12, 0)[1] = 0x81
card[15] = packDateTime(2026, 10, 27, 12, 0)[2] = 0x00
```

**Résultat** : `C9 12 B6 24 E3 81 81 01 01 62 63 81 81 65 81 00`

---

## 21. Carte Système et Configuration du système

### 21.1 Vue d'ensemble

La "carte système" n'est pas un type de carte physique dans le sens traditionnel (comme les 13 familles de cartes RFID). C'est l'ensemble des **mécanismes de configuration et de maintenance du système** qui sont gérés par le logiciel `CardLock.Exe` via l'interface `frmSystemMaintenance` et `frmLockConfiguration`.

### 21.2 Onglet "System Registe" (Activation/Licence)

**Formulaire** : `frmSystemMaintenance` → onglet "System Registe"

**Procédure** (documentée verbatim dans FORMS.md) :
1. **Étape 1** : "Get the Device No. and tell it to the vendor" — Le numéro de lecteur (`Reader_0000016`) est affiché dans `lblReaderNo`
2. **Étape 2** : "Input the Serial No. and Click Registe" — 4 champs `edtRegistor1..4` + bouton `cmdRegiste` + case `chkTest` ("For Test Only")

**Mécanisme** :
- Le numéro de série est un code **émis par le vendeur**, dérivé du numéro de device, portant un compteur de jours
- Chaque enregistrement ajoute un bloc à `Reg.ini` et met à jour la ligne `RegInfo`
- Le `SN` de la nouvelle entrée répète le `SerialNo1` précédent → les activations forment une **chaîne**
- Quand le compteur de jours est épuisé → "Sorry, The register expired."

**Données stockées** :
- `Reg.ini` : timestamp, SN, Date, Days, SerialNo1, SerialNo2, ReaderInfo (hex avec ASCII)
- `CardLock.mdb/RegInfo` : Registor (date), RegDate (hash 8 octets)

**Dans la reconstruction React** : Ce mécanisme est **supprimé**. L'application n'a pas de gate d'activation. L'écran équivalent affiche uniquement l'identité du lecteur, le firmware et la version.

### 21.3 Configuration des serrures (frmLockConfiguration)

**Formulaire** : `frmLockConfiguration` (32 composants)

**Paramètres configurables par serrure** :

| Paramètre | Source | Description |
|-----------|--------|-------------|
| `GuestLLock` | System.ini | Pêne dormant autorisé pour les clients |
| `BaoJing` | System.ini | Alarme sonore forçage (128 = activé) |
| `TiShi` | System.ini | Rappel fermeture de porte (152 = activé) |
| `lockAfterReleaseKnob` | Lock config | Re-verrouillage après relâchement poignée |
| `dontDisturbMode` | Lock config | Mode ne pas déranger |
| `ignoreCoverFunction` | Lock config | Ignorer la fonction cover |
| `alarmForcedPin` | Lock config | Alarme forçage |
| `remindCloseDoor` | Lock config | Rappel porte ouverte |
| `defaultBuildingNo` | Lock config | Bâtiment par défaut |

**Stockage** : Ces paramètres sont stockés dans `System.ini` (section [SYSTEM]) et dans la mémoire de la serrure (EEPROM via ReadE2/WriteE2).

### 21.4 Définition des pièces (frmRoomsDefination)

**Formulaire** : `frmRoomsDefination`

**Données gérées** :
- `BuildingInfo` : BldNo (Byte), BldName (text)
- `RoomInfo` : BldNo, FlrNo, RomID, RomID2, RoomNo, sType, Status, Price, Dai, CardCount, MaxCards, PublicDoor, BeiZhu, ReservCkIn, FirstCkOut, HourRateStartup, HourRatePrice

**Colonnes configurables** :
- `WidthOfBldNo` = 140 (largeur colonne n° bâtiment)
- `WidthOfBldName` = 370 (largeur colonne nom bâtiment)

### 21.5 Gestion des opérateurs (OperatorInfo)

**Table** : `OperatorInfo`

| Colonne | Type | Description |
|---------|------|-------------|
| `GongHao` | Text | Login de l'opérateur |
| `Name` | Text | Nom complet |
| `MiMa` | Text | Mot de passe (en clair !) |
| `QuanXian` | Text | Permission : `A` (Admin), `S` (Super Admin), ou `proQuanXian_*` |
| `BeiZhu` | Text | Remarques |

**Hiérarchie** :
- `S` : Super Administrateur — Gestion des profils et options serrures
- `A` : Administrateur — Mise en service des serrures et passes généraux
- `M` : Manager d'Étage — Attribution des cartes étages et check-out
- `G` : Opérateur Général (Réception) — Émission quotidienne des cartes clients

### 21.6 Maintenance système (frmSystemMaintenance)

**Formulaire** : `frmSystemMaintenance` (49 composants)

**Onglets** :
1. **System Registe** : Activation/licence (voir 21.2)
2. **Options** : Paramètres système (voir 21.3)
3. **Operators** : Gestion des opérateurs (voir 21.5)

**Fonctions** :
- Enregistrement de la licence (cmdRegiste)
- Test de la licence ("For Test Only" checkbox)
- Gestion des opérateurs (ajout, modification, suppression)
- Configuration des options système
- Affichage du numéro de device (lblReaderNo)

### 21.7 EEPROM de la serrure (ReadE2/WriteE2)

**Commande** : `ReadE2` (0x47) — `AA 02 47 <addr> <addr ^ 0xEF>`

**Fonction** : Lit 32 octets de l'EEPROM de la serrure à l'adresse spécifiée.

**Utilisation** :
- Lecture des paramètres de configuration de la serrure
- Vérification de l'état de la serrure
- Diagnostic matériel

**Note** : `WriteE2` n'est pas documenté dans le protocole actuel. La configuration de la serrure se fait principalement via les cartes (Room Set, Time Set, Limit, Group Set).

### 21.8 Résumé — Ce que le "système" fait

| Fonction | Mécanisme | Stockage |
|----------|-----------|----------|
| Activation licence | frmSystemMaintenance → Reg.ini + RegInfo | Reg.ini (append-only) |
| Configuration serrure | frmLockConfiguration → System.ini + EEPROM | System.ini + EEPROM |
| Définition pièces | frmRoomsDefination → BuildingInfo + RoomInfo | CardLock.mdb |
| Gestion opérateurs | frmSystemMaintenance → OperatorInfo | CardLock.mdb |
| Sauvegarde DB | System.ini (DBBakPath) | D:\proUSB_DBBak |
| Thème visuel | System.ini (Skin) | mxskin*.skn |
| Paramètres font | System.ini (FONT) | System.ini |

---

## 21. Carte Système et Configuration du système

### 18.1 Suppression du bridage licence

Le logiciel original utilise un système de licence basé sur :
- Numéro de série du dongle (Reg.ini)
- Compte à rebours de jours (SC dans System.ini)
- Clés SA/SB/SC

Dans la reconstruction React, **ce bridage est supprimé** — l'accès à l'encodeur USB HID fonctionne en direct sans aucune licence ni restriction de durée.

### 18.2 Accès à la base de données

- Mot de passe MDB : `pradlock` (récupéré par RE)
- En production, utiliser un backend Node.js/Electron avec OLEDB
- Ne jamais exposer le mot de passe dans le code client

### 18.3 Communication USB

- WebHID nécessite HTTPS ou localhost
- VID/PID filtrés : 0x9915/0x1116
- Rapport HID de 65 octets (report ID 0x40)

---

## 19. Références

- **Logiciel original** : `C:\Program Files (x86)\ProUSB SOFTWARE\proUSBHotelLockSystem\`
- **Base de données** : `CardLock.mdb` (Access/Jet, password: `pradlock`)
- **Configuration** : `System.ini`, `Reg.ini`
- **DLLs** : `Mwic_32.dll`, `d12c.dll`, `d12.dll`, `proRFL.dll`
- **Encodeur** : proUSB-TEMIC (Reader_0000016), VID 0x9915, PID 0x1116
- **Skins** : `mxskin10.skn` à `mxskin28.skn`
- **Rapports** : `ReportCards.xls`, `ReportGuests.xls`, `ReportOpen.xls`

---

*Document généré par reverse engineering du logiciel proUSB Hotel Lock System.*
*Ne pas distribuer sans autorisation. Usage réservé à l'interopérabilité et la reconstruction.*
## 20. Limites et contraintes du système

### 20.1 Limites des cartes

| Carte | Limite | Description |
|-------|--------|-------------|
| **Guest** (0x60) | 1 carte active par chambre | La nouvelle carte invalide la précédente (si Cover Cards Before) |
| **Master** (0xB0) | Illimité | Pas de limite d'émission |
| **Floor** (0xD0) | 1 par étage | Une carte par étage configuré |
| **Building** (0xC0) | 1 par bâtiment | Une carte par bâtiment configuré |
| **Emergency** (0xA0) | 1 par établissement | Une seule carte d'urgence |
| **Group** (0x80) | 1 par groupe | Une carte par groupe configuré |
| **Check-Out** (0x70) | Illimité | Peut être émise à tout moment |
| **Limit** (0x40) | 1 par serrure | Configure les restrictions |
| **Group Set** (0x50) | 1 par groupe | Programme le code groupe |
| **Room Set** (0x20) | 1 par serrure | Affecte le numéro de chambre |
| **Time Set** (0x30) | 1 par serrure | Synchronise l'horloge |
| **Record** (0x10) | 1 par serrure | Relève l'audit |
| **Reset** (0x00) | 1 par serrure | Réinitialise la serrure |

### 20.2 Limites temporelles

| Paramètre | Valeur | Description |
|-----------|--------|-------------|
| Durée max Guest Card | 365 jours | Validité maximale d'une carte client |
| Durée max Master Card | 3650 jours | Validité maximale d'une carte maître (10 ans) |
| Granularité horaire | 1 heure | Les heures sont encodées en heures pleines |
| Minutes de fin | 0 ou 59 | Les minutes de fin sont soit 00 soit 59 |
| Année | 0-9 | Encodée sur 4 bits (modulo 10, 2000-2009 puis 2010-2019...) |
| Mois | 1-12 | Mois standard |
| Jour | 1-31 | Jour standard |
| Heure | 0-23 | Heure 24h |

### 20.3 Limites de la mémoire d'audit

| Paramètre | Valeur | Description |
|-----------|--------|-------------|
| Slots d'audit | 33 | Nombre maximum d'entrées dans la mémoire de la serrure |
| Taille par slot | 37 octets | Taille d'un paquet d'audit |
| Données par slot | 8 octets (RecData) | Données brutes de l'ouverture |
| Capacité totale | 1221 octets | 33 x 37 octets |
| Écrasement | FIFO | Les nouvelles entrées écrasent les plus anciennes |

### 20.4 Limites de l'encodeur USB

| Paramètre | Valeur | Description |
|-----------|--------|-------------|
| Taille rapport HID | 65 octets | 1 report ID + 64 données |
| Taille max trame | 63 octets | Payload maximum par trame |
| VID | 0x9915 | Vendor ID |
| PID | 0x1116 | Product ID |
| Report ID sortie | 0x40 | Report ID pour les commandes |
| Timeout réponse | 2500 ms | Temps d'attente maximum pour une réponse |
| Tentatives max | 3 | Nombre maximum de tentatives d'écriture |

### 20.5 Limites de la base de données

| Paramètre | Valeur | Description |
|-----------|--------|-------------|
| Mot de passe MDB | pradlock | Mot de passe de la base Access |
| Provider | Jet 4.0 / ACE 12.0 | Fournisseur OLEDB |
| Tables principales | 4 | CardInfo, RecordOpen, Dai, RegInfo |
| Taille max carte | 16 octets | Données encodées par carte |
| Taille max audit | 8 octets | Données brutes par entrée d'audit |

### 20.6 Limites des options de carte

| Option | Bit | Description |
|--------|-----|-------------|
| Cover Cards Before | Bit 14 de siteLow | Invalide les cartes précédentes pour cette chambre |
| Allow Deadbolt | Octet 8 = 0x01 | Autorise le déverrouillage si pêne dormant engagé |
| Open Public Door | Octet 8 = 0x01 | Accès aux portes publiques/ascenseurs |

### 20.7 Limites des rôles opérateurs

| Rôle | Code | Privilèges | Limitations |
|------|------|-----------|-------------|
| Super Admin | S | Tout | Aucune |
| Admin | A | Mise en service, passes généraux | Pas de gestion des profils |
| Manager | M | Cartes étages, check-out | Pas de mise en service |
| Réception | G | Cartes clients uniquement | Pas de passes, pas de mise en service |

### 20.8 Limites des bâtiments et étages

| Paramètre | Valeur | Description |
|-----------|--------|-------------|
| Bâtiments max | 3 | Bâtiment 1, 2, 3 |
| Étages max | 6 | Étages 1 à 6 |
| Chambres par étage | 99 | Chambres 01 à 99 par étage |
| Numérotation | BBECCC | BB = bâtiment, E = étage, CCC = chambre |

### 20.9 Limites de la licence (supprimée dans React)

| Paramètre | Valeur originale | Description |
|-----------|-----------------|-------------|
| Days | 4095 (max) | Jours de validité restants |
| SA | 708EE4C560EDC47C | Clé de licence A |
| SB | 231212 | Clé de licence B (date) |
| SC | 4080 | Clé de licence C (jours) |
| ErrRDN | Présent si erreur | Erreur de lecture du dongle |

> Note : Dans la reconstruction React, tout le système de licence est supprimé. L'accès est libre et permanent.
## 22. Carte Hard Reset Persistant (Securite Admin)

### 22.1 Vue d'ensemble

La Carte Hard Reset Persistant est une carte de securite de niveau administrateur qui permet de reinitialiser definitivement une serrure, meme si elle est deja configuree avec un autre systeme de cartes.

### 22.2 Caracteristiques

| Propriete | Valeur |
|-----------|--------|
| Type | hard_reset |
| Famille byte | 0x00 (marqueur admin) |
| Niveau d'acces | Administrateur uniquement (role S ou A) |
| Persistance | Permanente |
| Fiabilite | Double round + verification + 3 bips |
| Securite | Double confirmation utilisateur |

### 22.3 Processus

1. Double confirmation utilisateur (2 popups)
2. Round 1 : Reset standard (3 commandes IniCard)
3. Round 2 : Reset renforce (3 commandes repeteess)
4. Verification par lecture de la carte
5. Confirmation sonore (3 bips longs)
6. Enregistrement dans issuedCards + log console

### 22.4 Structure de la carte

Octet 0: 0xC9 (Magic)
Octet 1: 0x12 (Site high)
Octet 2-3: Site code
Octet 4-8: 0xFF (marqueur reset force)
Octet 9: 0x00 | cardIndex (famille reset)
Octet 10: 0xAD (marqueur admin)
Octet 11: 0xDE (marqueur device)
Octet 12: 0xAD (verification)
Octet 13-15: Timestamp

### 22.5 Marqueurs d'authentification

| Octet | Valeur | Signification |
|-------|--------|---------------|
| 10 | 0xAD | Admin marker |
| 11 | 0xDE | Device marker |
| 12 | 0xAD | Verification |

### 22.6 Difference avec Reset standard

| Aspect | Reset standard | Hard Reset Persistant |
|--------|---------------|----------------------|
| Rounds | 1 (3 commandes) | 2 (6 commandes) |
| Verification | Aucune | Lecture carte |
| Confirmation | 3 bips courts | 3 bips longs |
| Niveau acces | Tout utilisateur | Admin uniquement |
| Confirmation UI | Aucune | Double confirmation |

### 22.7 Cas d'usage

1. Recuperation d'urgence : serrure configuree avec systeme inconnu
2. Changement de systeme : migration de cartes
3. Serrure bloquee : ne repond plus aux cartes normales
4. Audit de securite : verification etat d'usine
