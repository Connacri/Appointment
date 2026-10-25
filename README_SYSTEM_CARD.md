# Guide — Carte Système (System Card) proUSB

> Source : analyse REA de `CardLock.Exe` (PE32 x86, `sha256 06965...`) + `docs/PROUSB_SPECIFICATION.md` + `src/locks/cards/codec.ts`

## 1. Qu'est-ce qu'une "carte système" ?

Dans le logiciel original `proUSBHotelLockSystem` :

- **Reset / IniCard (`0x00`)** : commande de réinitialisation usine
- **Hard Reset (`0x00` + marqueurs admin)** : réinitialisation persistante (irréversible)
- **RoomSet (`0x20`)** : affectation chambre
- **TimeSet (`0x30`)** : synchronisation horloge
- **Record (`0x10`)** : relevé d'audit
- **GroupSet (`0x50`)** : configuration groupe

Ces cartes ne sont **pas des cartes d'accès client** (`0x60 Guest`). Elles sont des **commandes de configuration** envoyées au lecteur via `iniCard` (`AA 01 96 3D`, etc.).

## 2. Différence : Master (0xB0) vs Group (0x80)

| | **Master / Passe Générale** | **Groupe** |
|---|---|---|
| Code | `0xB0` | `0x80` |
| Portée | **Toutes** les chambres du bâtiment | **Seulement** celles du groupe configuré (`0x50`) |
| Autorité | Direction / Admin | Service / Département / Étage |
| Restriction | Aucune (sauf expiration) | Dépend de `GroupSet` |
| Validité max | 3650 jours | 365 jours |
| Badge UI | `purple` | `blue` |

## 3. Comment créer la carte système (3 méthodes)

### Méthode A — Depuis le logiciel original (PC)

1. Ouvrir `CardLock.exe` → `frmLockConfiguration`
2. Sélectionner l'action (`Reset`, `Hard Reset`, `Room Set`, `Time Set`)
3. L'application envoie directement au lecteur : `AA 01 96 3D` (Step 0) → `AA 01 69 C2` (Step 1) → `AA 01 56 FD` (Step 2)
4. Vérifier la réponse : `55 15 01 ...`

**Important** : la serrure doit être ouverte avec le bon `reportId` (`0x40` pour `iniCard`).

### Méthode B — Depuis l'app Appointment (Web / Android USB-C)

1. Ouvrir l'onglet **"3. Mise en Service Serrure"** (`commissioning`)
2. Utiliser le bouton **"HARD RESET PERSISTANT"** (admin) ou **"Émettre Carte Reset"** / **"Carte N° Chambre"**
3. Vérifier la console **"Console des Trames USB / WebHID"** :
   - Doit montrer : `Sending report 0x40 (...)` (pas `0x00`)
   - Si `0x00` échoue : le code fait automatiquement `retry with forced 0x40`
   - Doit montrer : `Connected to proUSB-TEMIC` (VID `0x9915` / PID `0x1116`)
4. La serrure émet ses bips : **3 bips longs** (`300ms`) pour hard reset réussi

### Méthode C — Depuis l'encodeur connecté au smartphone Android (USB-C)

- Même procédure que B, mais le lecteur doit être détecté automatiquement (`autoConnectEnabled` dans `WebHidTransport`)
- Vérifier dans **TopBar** : `Encodeur USB Connecté` (pas `Simulateur Actif`)

## 4. Pourquoi le reset échoue sur serrure déjà configurée ?

Raison trouvée par REA (`CardLock.Exe` / `Reg.ini` / `System.ini`) :

- La serrure a déjà reçu `RoomSet` + `TimeSet` + `System.ini` (`Skin = mxskin20.skn`)
- Son `ReaderInfo` est enregistré (`Reader_0000016`)
- Un simple `Reset` (`0x00`) est **ignoré** par le verrou — il faut le **double round** (`hard_reset`) avec les marqueurs admin (`0xAD/0xDE`)
- Le `WebHidTransport` doit utiliser `reportId = 0x40` (le code fait le retry automatiquement)

**Fix dans le code** (`transport.ts`) :
```ts
try { await this.device.sendReport(reportId, payload); }
catch (firstErr) { if (reportId === 0x00) await this.device.sendReport(0x40, payload); }
```

## 5. Règles métier expert hôtelier (appliquées dans le code)

- `encodeGuestCard` : `endMs > startMs`; `endMs - startMs ≤ 365 jours`
- `AppContext.addBooking` : `check-in < check-out`; séjour ≤ 365 jours
- `decodeCardRecord` : année `2026` (base 2016 + nibble high) — pas `2010`
- `handleReadCard` : bip lecture = 3 courts (`150ms`) — distinct d'écriture (2 longs `300ms`)
- `handleIssueGuestCardFromBooking` : carte émise automatiquement sur réservation hôtel / résidence
- `clearPersistedData` : supprime `omnibook_prousb_issued_cards`, `audit_records`, `settings`

## 6. Lecture d'une carte système (ReadCard)

Dans l'application : bouton **"Actualiser la lecture de la carte"** (`handleReadCard`)

Résultat attendu pour une carte système créée avec le logiciel :
- **Type affiché** : `RESET` / `HARD_RESET` / `MASTER` / `GROUP` / etc.
- **Hex** : `C9 12 ...` avec `byte 9 = 0x00` (Reset) ou `0xB0` (Master) ou `0x80` (Group)
- **Dates** : `Début: 24/10/2026 14:00`, `Exp: 27/10/2026 12:00`

Si l'affichage donne un type aléatoire : le décodage (`decodeCardRecord`) détecte `byte9` — vérifiez que la carte physique correspond bien au format attendu (pas de bruit HID).

## 7. Liens utiles

- `docs/PROUSB_SPECIFICATION.md` — spécification complète RE du logiciel
- `README_CARDS.md` — différences Master / Group / 13 familles
- `src/locks/cards/codec.ts` — encodage / décodage
- `src/locks/protocol/transport.ts` — WebHID avec retry 0x40
- `src/components/ProUsbLockSystemView.tsx` — onglet Mise en Service

---
*Document généré par analyse REA du logiciel proUSB Hotel Lock System (`CardLock.Exe`) et correction du code React. Pour le logiciel original, utiliser `frmLockConfiguration` sur PC ; pour le hardware direct, utiliser l'onglet Mise en Service de l'app avec le bouton Hard Reset.*
