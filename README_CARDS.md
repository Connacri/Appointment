# proUSB Card Differences — Master vs Group & All Roles

From `docs/PROUSB_SPECIFICATION.md` (§2, §3.3, §4) and `src/locks/cards/types.ts`.

## Difference: Master (0xB0) vs Group (0x80)

| | **Master (Passe Générale)** | **Group (Groupe)** |
|---|---|---|
| **Code** | `0xB0` | `0x80` |
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
| `0x00` | Reset / IniCard | Réinitialisation usine | **Système / Mise en service** — pas de date d'expiration (action immédiate) |
| `0x10` | Record / Audit | Relevé d'audit | **Lecture système** — lit le journal des ouvertures (39 slots) |
| `0x20` | Room Set | Affectation chambre | **Configuration** — assigne un numéro de chambre à la serrure |
| `0x30` | Time Set | Synchronisation heure | **Configuration** — règle l'horloge interne du lecteur |
| `0x40` | Limit / Blacklist | Restriction / Révocation | **Système** — bloque l'accès d'une carte existante |
| `0x50` | Group Set | Config groupe | **Système** — définit quel groupe peut accéder |
| `0x60` | Guest | Carte Client | **Lecture / Écriture** — accès chambre, max 365j, check-in < check-out |
| `0x70` | Check-Out | Annulation séjour | **Écriture** — invalide la carte guest précédente |
| `0x80` | Group | Carte d'accès groupe | **Lecture / Écriture** — limité aux salles du groupe (voir diff. ci-dessus) |
| `0xA0` | Emergency | Urgence | **Lecture / Écriture** — ouvre le pêne dormant, priorité max |
| `0xB0` | Master | Passe maître | **Lecture / Écriture** — toutes chambres (voir diff. ci-dessus) |
| `0xC0` | Building | Bâtiment | **Lecture / Écriture** — tout le bâtiment |
| `0xD0` | Floor | Étage | **Lecture / Écriture** — tout un étage |

---

## Business Rules (Expert Hôtelier) — Applied in Code

- `encodeGuestCard`: `endMs > startMs`; `endMs - startMs ≤ 365 days`
- `AppContext.addBooking`: `startDate < endDate`; stay ≤ 365 days
- `decodeCardRecord`: year decoded with `baseYear = 2016 + nibble` (v2026.1)
- `handleReadCard`: **3 bips courts** (150ms) — distinct from write (2 longs 300ms)
- `handleIssueGuestCardFromBooking`: auto-issues card on `hotel` / `residence` booking confirm
- `clearPersistedData`: clears `omnibook_prousb_issued_cards`, `audit_records`, `settings`
