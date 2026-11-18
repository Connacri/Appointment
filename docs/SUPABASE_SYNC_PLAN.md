# Synchronisation offline-first — Appointment

## État actuel vérifié

Le projet Supabase dédié est `Appointment` (`vkmgakmujipnpjlawjqm`), PostgreSQL 17, en région `eu-central-1`. Il ne faut pas utiliser le projet `CyberScrape`.

Le schéma public possède 16 tables avec RLS activée. Les entités mutables principales disposent maintenant d'une version serveur et d'un tombstone `deleted_at`, ainsi que d'index de lecture incrémentale par workspace/date/ID. Les types TypeScript sont générés depuis le schéma distant.

**Ce socle n'est pas un moteur de synchronisation.** Dans `AppContext`, les mutations métier restent principalement locales. La présence d'un client Supabase, d'un repository et d'un état réseau ne prouve pas que les données ont été synchronisées.

## Architecture cible

- IndexedDB reste la source de vérité locale.
- Chaque mutation locale est enregistrée dans une transaction IndexedDB avec son événement Outbox.
- L'Outbox utilise un UUID d'opération stable, un ID d'entité stable, un type d'opération, un payload versionné, un compteur de tentatives et un état.
- Le push est idempotent ; un ACK serveur seul permet de retirer une opération de l'Outbox.
- Le pull est paginé et scoped par workspace et établissement.
- Les tombstones sont conservés jusqu'à confirmation de réplication et respect des règles de rétention.
- Les conflits sont explicites et résolus selon le domaine ; pas de Last Write Wins sur réservations ou finances.

## Ordre de livraison

1. Sélecteur et onboarding workspace/établissement, sans sélectionner arbitrairement le premier workspace.
2. Étendre l'Outbox transactionnelle actuellement activée sur le CRUD des réservations à toutes les entités métier.
3. Sync Engine : bootstrap, pull incrémental, push, retry/backoff, verrou multi-onglet, curseurs.
4. Contrats et repositories complets pour guests, bookings, ressources, tâches, stocks, tarifs et audit.
5. Repository financier pour factures, lignes et paiements, avec immutabilité et idempotence.
6. Tests multi-workspace RLS, retry, offline/online, suppression, conflit et concurrence.
7. Extension Facility/Spa/Events/Rentals/Access Control selon les décisions métier validées.

## Implémentation Outbox livrée — worker push/pull Supabase (bookings + housekeeping resources)

La base IndexedDB est passée en version 5 (`outbox`, `tombstones`, `workspaceEntities`, `issuedCards`, `resourceGroups`). La mise à niveau crée les stores Outbox vides : aucune donnée de démonstration n'est mise en file.

- `putWithOutbox` et `deleteWithOutbox` englobent l'instantané local workspace-scoped, l'événement Outbox et le tombstone dans une seule transaction IndexedDB.
- Le moteur bidirectionnel (`src/services/supabase/supabaseSync.ts`) exécute automatiquement (démarrage, reconnexion `online`, focus/visibilité, intervalle périodique, debounce post-mutation) ou sur clic **« Forcer sync »** :
  1. Le push séquentiel des événements Outbox en attente (`resource` avant `booking`) vers `pmsRepository` (`saveBooking`, `deleteBooking`, `saveResource`, `deleteResource`), en n'appelant `markOutboxSynced` qu'après ACK serveur vérifié et en appliquant un backoff exponentiel (`markOutboxFailed`) sur erreur.
  2. Le pull du snapshot workspace Supabase suivi d'un merge protégé contre la résurrection de tombstones et l'écrasement d'upserts Outbox encore en attente (y compris ceux en backoff).
  3. Un statut strictement fondé sur les preuves (`cloudSyncStatus` dans `TopBar` et `CloudConfigPanel`) : jamais `Synchronisé` tant qu'un événement Outbox reste `pending` ou en erreur.

**Limites restantes :** les créations/éditions complètes de tâches, articles de stock, tarifs dynamiques, factures et nouveaux groupes/chambres hors CardLock/housekeeping ne sont pas encore toutes raccordées à `putWithOutbox` ; la hiérarchie relationnelle distante `Hotel → Establishment → Floor → Resource` reste documentée comme écart non résolu dans `docs/DATA_CONTRACT.md` §7.
## Contraintes de sécurité et de cohérence

- Toutes les requêtes distantes doivent inclure le workspace ciblé ; RLS demeure la frontière de sécurité.
- Le workspace courant doit être membre du compte authentifié ; ne jamais utiliser un workspace par défaut arbitraire.
- Les droits sont attribués via `workspace_members.role`, pas via `user_metadata`.
- Les clés secrètes Supabase restent côté serveur.
- Les suppressions des entités synchronisables deviennent des tombstones.
- Les paiements et mouvements de stock sont append-only au niveau métier.
- La création/réservation de plusieurs ressources doit être atomique côté serveur.

## Validation attendue

- Pull initial ne détruit aucune modification locale en attente.
- Chaque CRUD génère exactement un événement Outbox.
- Répéter un push ne crée aucun doublon.
- Offline puis online finit par converger.
- Une suppression ne ressuscite pas après pull.
- Un conflit est signalé et traité selon la règle métier.
- Deux workspaces ne peuvent ni lire ni référencer les lignes l'un de l'autre.
- Tests SQL/RLS et tests applicatifs exécutés sur environnement de développement avant production.
