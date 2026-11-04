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
2. Outbox IndexedDB durable, transactionnelle avec chaque CRUD local.
3. Sync Engine : bootstrap, pull incrémental, push, retry/backoff, verrou multi-onglet, curseurs.
4. Contrats et repositories complets pour guests, bookings, ressources, tâches, stocks, tarifs et audit.
5. Repository financier pour factures, lignes et paiements, avec immutabilité et idempotence.
6. Tests multi-workspace RLS, retry, offline/online, suppression, conflit et concurrence.
7. Extension Facility/Spa/Events/Rentals/Access Control selon les décisions métier validées.

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
