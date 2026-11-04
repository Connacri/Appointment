# Backend Supabase — Appointment PMS

## Projet cible

- Projet : `Appointment`
- Project ref : `vkmgakmujipnpjlawjqm`
- Région : `eu-central-1`
- PostgreSQL : 17
- API : `https://vkmgakmujipnpjlawjqm.supabase.co`

Le projet `CyberScrape` est hors périmètre.

## Configuration

Variables frontend :

```dotenv
VITE_SUPABASE_URL=https://vkmgakmujipnpjlawjqm.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Le client React/Android/Windows utilise exclusivement la clé publishable. Une clé `service_role` ou `sb_secret_*` ne doit jamais être intégrée au bundle.

## Schéma distant vérifié

Le schéma `public` contient 16 tables, toutes avec RLS activée :

- Identité/tenants : `profiles`, `workspaces`, `workspace_members`
- Établissements et inventaire : `establishments`, `resource_groups`, `resources`
- PMS : `guests`, `bookings`, `booking_payments`, `pms_tasks`
- Finance : `invoices`, `invoice_items`
- Exploitation : `stock_items`, `stock_movements`, `dynamic_rates`, `audit_events`

Les relations établissement/workspace sont protégées par des clés étrangères composites. Les politiques RLS reposent sur les fonctions privées `private.has_workspace_access` et `private.has_workspace_role`. Le contrôle de sécurité Supabase ne signale actuellement aucun finding.

### Métadonnées de synchronisation ajoutées

Les entités mutables suivantes disposent maintenant de `version bigint` et `deleted_at timestamptz` : établissements, groupes, ressources, clients, réservations, factures, tâches, articles de stock et tarifs dynamiques.

- La version démarre à 1 et s'incrémente sur chaque UPDATE via `private.bump_entity_version()`.
- Les index `(workspace_id, updated_at, id)` servent de curseurs de lecture incrémentale.
- Les suppressions synchronisables doivent être réalisées par tombstone (`deleted_at`), pas par DELETE physique.
- Les paiements, lignes de facture, mouvements de stock et journaux d'audit restent des écritures financières/opérationnelles distinctes ; ne pas les traiter comme des entités éditables ordinaires.

Migrations distantes enregistrées :

1. `20261103172324_initial_pms_multi_tenant_schema`
2. `20261103172339_tenant_integrity_and_membership_hardening`
3. `20261103172454_foreign_key_indexes_and_policy_cleanup`
4. `20261104094208_sync_metadata`
5. `20261104094214_dynamic_rates_sync_metadata`

## Code frontend présent

- Client Supabase singleton configuré par variables Vite et typé avec `src/services/supabase/database.types.ts`, généré depuis le schéma distant.
- Authentification e-mail/mot de passe.
- Repository PMS pour workspaces, établissements, ressources, réservations, tâches et stock.
- Les lectures du repository excluent les enregistrements portant un tombstone.

## Limites fonctionnelles non résolues

Le schéma et le client sont alignés sur le socle PMS, mais le produit n'est pas encore synchronisé de bout en bout :

- Les mutations de `AppContext` restent majoritairement locales (localStorage/IndexedDB) et ne passent pas toutes par `pmsRepository`.
- Aucun sélecteur de workspace/établissement ne pilote encore les mutations de l'application.
- Un Outbox IndexedDB transactionnel est livré en étape partielle (stores versionnés, isolation par workspace, clés d'idempotence, tombstones). Le CRUD des réservations y est raccordé uniquement pour les enregistrements non-démo et lorsqu'un workspace est actif.
- Aucun moteur pull/push automatique ne consomme encore l'Outbox ; les autres domaines métier ne sont pas encore raccordés.
- Les conflits, curseurs et l'idempotence côté serveur ne sont pas encore implémentés. L'Outbox conserve les tentatives et leur prochaine date de reprise, mais aucun worker ne les exécute encore.
- Les repositories financiers pour factures/lignes et paiements ne sont pas complets.
- Les domaines Spa Full, Facility universel, événements, locations commerciales et contrôle d'accès générique ne sont pas encore matérialisés dans le schéma.
- Les données de démonstration ne sont pas importées dans Supabase. Les tables sont restées vides lors de l'audit.

## Historique local des migrations

Les trois migrations initiales sont présentes dans l'historique distant, mais leur SQL source n'était pas versionné dans le dépôt au moment de l'alignement. Les deux migrations incrémentales récentes sont sous `supabase/migrations/`.

Avant toute installation vierge ou reconstruction d'environnement, il faut récupérer et versionner le baseline exact des trois migrations historiques. Ne pas prétendre que le dossier local permet encore de recréer seul l'intégralité du schéma de production.

## Règles d'exploitation

- IndexedDB reste la persistance locale prioritaire.
- Une mutation locale ne doit être considérée comme synchronisée qu'après ACK serveur, jamais sur la seule base de `navigator.onLine`.
- Ne jamais écraser une mutation locale en attente lors du pull initial.
- Ne pas appliquer Last Write Wins aux réservations et aux documents financiers.
- Les réservations concurrentes et multi-ressources devront être validées dans une transaction serveur.
- Ne jamais exposer une clé secrète dans le frontend.
