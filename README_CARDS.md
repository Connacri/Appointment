# proUSB Card Differences — Master vs Group & All Roles

Format établi par **décompilation de `proRFL.dll`** (`ResetCard`, `GuestCard`,
`MasterCard`) puis confirmé sur les **62 cartes réelles** de `CardLock.mdb` et
sur des lectures matérielles (`proUSB-TEMIC`, VID `0x9915` / PID `0x1116`).
Détail complet du format : [`README_SYSTEM_CARD.md`](./README_SYSTEM_CARD.md).

## Structure d'un enregistrement (16 octets)

```
[0]     0xC9                     magie
[1]     0x12                     constante (site >> 16)
[2..3]  code site                big-endian (03 3B, 24 B6, 16 9A…)
[4..5]  champ de famille         système : ~site  ·  master : FF 00  ·  client : E3 xx
[6..8]  en-tête de famille       système : p5 p6 p4
[9]     type / index             famille sur 4 bits + index sur 4 bits
[10..12] date de début / émission
[13..15] fin de validité …       … ou aléatoire pur pour les cartes système
```

- Le **code site est stocké en big-endian** : `24 B6` se lit `0x24B6`.
  Il n'est jamais modifié par un flag : la serrure compare les 16 bits entiers
  et répond `N9067 not a card for this system` sinon.
- Les **cartes master** portent le site `00 00` : elles ne sont pas rattachées
  à une installation et ouvrent toutes les serrures du lecteur.
- Les **cartes système** portent `[4..5] = ~site` (contrôle d'intégrité :
  `03 3B` → `FC C4`) et une date d'émission en `[10..12]`. Leurs octets
  `[13..15]` sont **aléatoires** (`rand()` ×3) : ce n'est pas une date de fin.
- Une carte système au site `00 00` (`00 00 FF FF`) est **universelle** : elle
  réinitialise une serrure de n'importe quel système. Voir
  `README_SYSTEM_CARD.md` §6.

## Difference: Master (0xB0) vs Group (0x80)

| | **Master (Passe Générale)** | **Group (Groupe)** |
|---|---|---|
| **Code** | `0xB0` | `0x80` |
| **Code site** | `00 00` (universel) | code site de l'installation |
| **Portée** | **Toutes les chambres** du bâtiment / établissement | **Seulement les chambres** assignées au groupe configuré |
| **Autorité** | Plus haut niveau (Direction, Admin) | Intermédiaire (service, étage, département) |
| **Usage** | Passe-partout général, ouverture d'urgence | Accès limité à un groupe (ex: spa, restaurant) |
| **Badge** | `purple` | `blue` |
| **Restriction** | Aucune (sauf expiration) | Dépend de la config `GroupSet` (0x50) |
| **Validité max** | 3650 jours (10 ans) | 365 jours (standard) |

---

## All 13 Card Families — Roles, Restrictions, Differences

| Code | Name (FR/EN) | Role | Restrictions / Notes |
|---|---|---|---|
| `0x00` | Reset / IniCard | Réinitialisation usine | **Système** — carte physique à présenter devant la serrure (`0x01` reset, `0x0E` hard reset). Site `0000` = universelle |
| `0x10` | Record / Audit | Relevé d'audit | **Lecture système** — lit le journal des ouvertures |
| `0x20` | Room Set | Affectation chambre | **Configuration** — assigne un numéro de chambre à la serrure |
| `0x30` | Time Set | Synchronisation heure | **Configuration** — règle l'horloge interne du lecteur |
| `0x40` | Limit / Blacklist | Restriction / Révocation | **Système** — bloque l'accès d'une carte existante |
| `0x50` | Group Set | Config groupe | **Système** — définit quel groupe peut accéder |
| `0x60` | Guest | Carte Client | **Lecture / Écriture** — accès chambre, max 365j, check-in < check-out |
| `0x70` | Check-Out | Annulation séjour | **Écriture** — invalide la carte guest précédente |
| `0x80` | Group | Carte d'accès groupe | **Lecture / Écriture** — limité aux salles du groupe |
| `0xA0` | Emergency | Urgence | **Lecture / Écriture** — ouvre le pêne dormant, priorité max |
| `0xB0` | Master | Passe maître | **Lecture / Écriture** — toutes chambres, site `00 00` |
| `0xC0` | Building | Bâtiment | **Lecture / Écriture** — tout le bâtiment |
| `0xD0` | Floor | Étage | **Lecture / Écriture** — tout un étage |

---

## Business Rules (Expert Hôtelier) — Applied in Code

- `encodeGuestCard`: `endMs > startMs`; `endMs - startMs ≤ 365 days`; heure
  d'émission réelle (`startMinute`) conservée comme sur les cartes d'origine
- `encodeMasterCard`: site `00 00` pour master / emergency
- `AppContext.addBooking`: `startDate < endDate`; stay ≤ 365 days
- `decodeCardRecord`: année = fenêtre glissante de 16 ans résolue autour de
  l'année de référence → une carte de 2026 n'est plus lue « 2010 », une carte
  de 2015 reste 2015 ; l'expiration est résolue **après** le début
- `decodeCardRecord`: une date impossible (`mois = 0`, `jour = 0`) n'est plus
  remplacée par le 1er janvier — elle est signalée absente
- `encodeSystemCard`: `[4..5] = ~site`, `[13..15] = rand()` (comme `ResetCard`) ;
  option `universal` → site `0000`
- `handleReadCard`: **3 bips courts** (150ms) — distinct from write (2 longs 300ms)
- `handleIssueGuestCardFromBooking`: auto-issues card on `hotel` / `residence` booking confirm
- `clearPersistedData`: clears `omnibook_prousb_issued_cards`, `audit_records`, `settings`,
  `omnibook_prousb_mdb_snapshot`
