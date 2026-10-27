# proUSB Card Differences — Master vs Group & All Roles

Format établi sur les **62 cartes réelles** de `CardLock.mdb` et sur des
lectures matérielles (`proUSB-TEMIC`, VID `0x9915` / PID `0x1116`).
Détail complet du format : [`README_SYSTEM_CARD.md`](./README_SYSTEM_CARD.md).

## Structure d'un enregistrement (16 octets)

```
[0]     0xC9                     magie
[1]     0x12                     constante
[2..3]  code site                big-endian (03 3B, 24 B6, 16 9A…)
[4..5]  marqueur de famille      FF00 master · E3xx chambre · FCC4 système
[6..8]  en-tête de famille
[9]     type / index             famille sur 4 bits + index sur 4 bits
[10..12] date de début / émission
[13..15] date de fin / queue de famille
```

- Le **code site est stocké en big-endian** : `24 B6` se lit `0x24B6`.
  Il n'est jamais modifié par un flag : la serrure compare les 16 bits entiers
  et répond `N9067 not a card for this system` sinon.
- Les **cartes master** portent le site `00 00` : elles ne sont pas rattachées
  à une installation et ouvrent toutes les serrures du lecteur.
- Les **cartes système** portent la queue constante `29 23 BE` et une date
  d'émission en `[10..12]`.

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
| `0x00` | Reset / IniCard | Réinitialisation usine | **Système** — carte physique à présenter devant la serrure (type `0x01`…`0x0F`) |
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
- `decodeCardRecord`: année = `2009 + nibble`, fenêtre glissante de 16 ans
  → une carte de 2026 n'est plus lue « 2010 »
- `handleReadCard`: **3 bips courts** (150ms) — distinct from write (2 longs 300ms)
- `handleIssueGuestCardFromBooking`: auto-issues card on `hotel` / `residence` booking confirm
- `clearPersistedData`: clears `omnibook_prousb_issued_cards`, `audit_records`, `settings`,
  `omnibook_prousb_mdb_snapshot`
