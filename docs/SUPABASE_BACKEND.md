# Backend Supabase — Appointment PMS

## Projet cible

- Projet Supabase : `Appointment`
- Project ref : `vkmgakmujipnpjlawjqm`
- Région : `eu-central-1`
- PostgreSQL : 17
- URL API : `https://vkmgakmujipnpjlawjqm.supabase.co`

Ne pas connecter ce dépôt au projet `CyberScrape`.

## Configuration frontend

Copier `.env.example` vers `.env.local`, puis renseigner :

```dotenv
VITE_SUPABASE_URL=https://vkmgakmujipnpjlawjqm.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Seule la clé publishable est autorisée dans le client React, Android ou Windows. Ne jamais intégrer une clé `sb_secret_*` ou `service_role` dans un bundle.

## Schéma déployé

Migrations actuellement enregistrées sur le projet Supabase :

1. `20261103172324_initial_pms_multi_tenant_schema`
2. `20261103172339_tenant_integrity_and_membership_hardening`
3. `20261103172454_foreign_key_indexes_and_policy_cleanup`

Tables métier (16) :

- `profiles`, `workspaces`, `workspace_members`
- `establishments`, `resource_groups`, `resources`
- `guests`, `bookings`, `booking_payments`
- `invoices`, `invoice_items`
- `pms_tasks`, `stock_items`, `stock_movements`
- `dynamic_rates`, `audit_events`

Toutes les tables du schéma public ont RLS activée. Les relations entre données métier sont également contraintes par workspace, afin d'empêcher de relier une réservation, une chambre, un client ou une facture appartenant à des espaces différents.

## Code présent dans cette branche

- Client Supabase singleton configuré par variables Vite.
- Authentification e-mail/mot de passe (inscription et connexion).
- Repository de base pour workspaces, établissements, groupes/ressources, réservations, tâches, stock et mouvements.
- Suppression logique des réservations.
- Le stockage IndexedDB/localStorage existant reste en place.

## Intégration applicative restant à terminer

Cette branche constitue le socle backend, pas encore une migration complète de tous les écrans :

- Relier les mutations de `AppContext` au repository et à une outbox durable.
- Ajouter le sélecteur/créateur de workspace et l'onboarding d'établissements.
- Charger les établissements, ressources, réservations et modules par workspace authentifié.
- Implémenter le moteur de synchronisation offline-first (idempotence, retries, conflits, tombstones, curseurs).
- Compléter les repositories pour factures/lignes, paiements, tarifs, housekeeping, canal manager et proUSB selon les données effectivement synchronisables.
- Ajouter les tests d'intégration RLS multi-workspace et les tests de concurrence de réservation.
- Générer et versionner les fichiers de migration locaux depuis l'historique distant avec Supabase CLI (`supabase db pull`), puis vérifier la reproduction sur un projet/branch de développement.

Aucune donnée de démonstration issue de `mockData.ts` n'a été envoyée dans le projet distant. Les 16 tables sont vides à ce stade.

## Vérifications effectuées

- 16 tables publiques détectées.
- RLS activée sur 16/16 tables.
- 55 contraintes de clés étrangères et 55 index correspondants.
- Security advisors : aucun finding.
- Performance advisors : uniquement des avertissements informatifs d'index non encore utilisés sur une base fraîche (pas de charge métier).
