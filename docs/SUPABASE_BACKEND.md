# Backend Supabase — Appointment PMS

## Projet cible

- Projet : `Appointment`
- Project ref : `vkmgakmujipnpjlawjqm`
- Région : `eu-central-1`
- PostgreSQL : 17.11
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

Le schéma `public` contient 21 tables, toutes avec RLS activée (deux tables techniques n'ont volontairement aucune policy, donc restent inaccessibles via les rôles API standards) :

- Identité/tenants : `profiles`, `workspaces`, `workspace_members`
- Établissements et inventaire : `establishments`, `resource_groups`, `resources`
- PMS : `guests`, `bookings`, `booking_payments`, `pms_tasks`
- Finance : `invoices`, `invoice_items`
- Exploitation : `stock_items`, `stock_movements`, `dynamic_rates`, `audit_events`, `pms_mdb_imports`, `keepalive_pings`
- Approvisionnement/RH : `stock_suppliers`, `purchase_orders`, `staff_members`

Les relations établissement/workspace sont protégées par des clés étrangères composites. Les politiques RLS reposent sur les fonctions privées `private.has_workspace_access` et `private.has_workspace_role`. Les nouvelles tables `stock_suppliers`, `purchase_orders` et `staff_members` ont RLS, policies workspace-scoped et grants limités à `authenticated`/`service_role`. Le dernier Security Advisor signale encore deux tables RLS sans policy (`keepalive_pings`, `pms_mdb_imports`, accès API refusé par défaut), la protection des mots de passe compromis désactivée. Le search_path de `keepalive_cap` a été durci par la migration 20261126131639. Aucun finding RLS ne concerne les trois nouvelles tables.

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
6. `20261119122428_fix_personal_workspace_owner_membership`
7. `20261120131109_allow_same_day_bookings`
8. `20261120184245_20261121120000_pms_mdb_imports_sync`
9. `20261124140011_enable_workspace_realtime`
10. `20261126125047_align_inventory_procurement_and_staff_entities`
11. `20261126125222_enable_procurement_and_staff_realtime`
12. `20261126125552_enforce_supplier_establishment_scope`
13. `20261126125656_apply_stock_movement_atomically`
14. `20261126130041_align_stock_preferred_supplier_reference`
15. `20261126130712_fix_stock_movement_retry_after_soft_delete`
16. `20261126131639_harden_keepalive_function_search_path`
17. `20261127180000_apply_purchase_order_receipt_atomically`

## Code frontend présent

- Client Supabase singleton configuré par variables Vite et typé avec `src/services/supabase/database.types.ts`, généré depuis le schéma distant.
- Authentification e-mail/mot de passe.
- Repository PMS pour workspaces, établissements, ressources, réservations, tâches, stock, mouvements, fournisseurs, commandes d'achat, personnel et profil d'établissement.
- Les lectures du repository excluent les tombstones ; les tombstones des tâches, articles stock, fournisseurs, commandes et personnel sont également récupérés pour application locale.
- Les mutations de stock passent par `apply_stock_movement`, transaction PostgreSQL qui verrouille l'article, vérifie l'idempotence, interdit un solde négatif, insère le mouvement et met à jour la quantité dans une seule transaction.
- Realtime publie les changements de fournisseurs, commandes et personnel. Les notifications déclenchent une relecture RLS, elles ne sont pas utilisées comme payload métier.

## Écart de modèle métier à résoudre

Le schéma Supabase actuel ne représente pas encore la hiérarchie métier cible :
- aucune table `hotels` (entité hôtelière parente) ;
- `establishments` ne porte pas de `hotel_id` ; il n'est donc pas possible de rattacher plusieurs bâtiments à un même hôtel ;
- aucun référentiel `floors` ; `resources.building` et `resources.floor` restent des champs texte ;
- les clés étrangères de réservation/tâche vers ressource contrôlent le workspace, mais pas encore le triplet ressource + établissement + workspace au niveau SQL.

Les vérifications de cohérence exécutées sur les données distantes ont retourné zéro ligne pour les divergences réservation/ressource, tâche/ressource, groupe/établissement et les clés de ressources dupliquées. Le contrôle applicatif bloque désormais les écritures de réservation si la ressource n'appartient pas au workspace et à l'établissement sélectionnés. L'import cloud CardLock de plusieurs bâtiments est bloqué plutôt que de rattacher tous les bâtiments à un seul établissement.

La migration relationnelle `Hotel → Establishment → Floor → Resource` reste à versionner et à tester. Des migrations additives ont été appliquées au projet Supabase le 26/11/2026 pour les fournisseurs, commandes d'achat, personnel, Realtime, références fournisseurs et RPC de mouvements de stock.

## Limites fonctionnelles non résolues

Le schéma et le client sont alignés sur le socle PMS, mais le produit n'est pas encore synchronisé de bout en bout :

- Les tâches, articles stock, mouvements, fournisseurs, commandes, personnel et profil d'établissement écrivent maintenant un événement P2P et une mutation Outbox générique IndexedDB lorsque le workspace Supabase est vérifié. La projection générique est restaurée au démarrage.
- Le moteur pull/push consomme ces types Outbox ; les suppressions des tâches, articles, fournisseurs, commandes et personnel utilisent des tombstones côté serveur et sont rapatriées dans IndexedDB.
- Le raccordement UI est encore fire-and-forget : l'interface ne bloque pas systématiquement son commit sur le résultat IndexedDB. Cette limite reste un release blocker.
- Les factures et tarifs dynamiques ne sont pas encore dans le Supabase Outbox : les écritures de facture nécessitent une transaction header/lignes et les tarifs une politique de conflit multi-appareils.
- L'identité P2P reste dépendante du workspace Supabase actif pour l'Outbox cloud. L'indépendance totale P2P/Supabase n'est pas encore obtenue.
- Les repositories financiers pour factures/lignes et paiements ne sont pas complets.
- Les domaines Spa Full, Facility universel, événements, locations commerciales et contrôle d'accès générique ne sont pas encore matérialisés dans le schéma.
- Les données de démonstration ne sont pas importées dans Supabase. Les tables sont restées vides lors de l'audit.

## Historique local des migrations

Les trois migrations initiales sont présentes dans l'historique distant, mais leur SQL source n'était pas versionné dans le dépôt au moment de l'alignement. Les migrations incrémentales et celles du 26/11/2026 sont maintenant versionnées sous `supabase/migrations/` avec les mêmes versions que l'historique distant.

Avant toute installation vierge ou reconstruction d'environnement, il faut récupérer et versionner le baseline exact des trois migrations historiques. Ne pas prétendre que le dossier local permet encore de recréer seul l'intégralité du schéma de production.

## Règles d'exploitation

- IndexedDB reste la persistance locale prioritaire.
- Une mutation locale ne doit être considérée comme synchronisée qu'après ACK serveur, jamais sur la seule base de `navigator.onLine`.
- Ne jamais écraser une mutation locale en attente lors du pull initial.
- Ne pas appliquer Last Write Wins aux réservations et aux documents financiers.
- Les réservations concurrentes et multi-ressources devront être validées dans une transaction serveur.
- Ne jamais exposer une clé secrète dans le frontend.
