# Synchronisation Supabase — conception et prérequis Appointment

## État constaté au 2 novembre 2026

Le dépôt Appointment ne contient pas de client Supabase, de configuration `VITE_SUPABASE_URL`, de clé publishable, de schéma SQL ni de mapping des données PMS vers des tables distantes. Le fichier `.env.example` ne contient que `VITE_API_URL`, `VITE_APP_TITLE` et `VITE_BASE`.

Le compte Supabase actuellement connecté expose un projet nommé `CyberScrape` (ref `uzouxpnsgloselhhltyw`). Ce projet ne doit pas recevoir les réservations, coordonnées clients, données d'établissement ou données proUSB d'Appointment sans confirmation explicite du propriétaire. Aucun accès ni aucune écriture n'ont été effectués sur ce projet.

**Bloquant :** identifier le projet Supabase dédié à Appointment ou confirmer la création d'un projet séparé, puis confirmer le périmètre de données et les règles de conservation.

## Comportement cible demandé

1. À l'ouverture, authentifier l'utilisateur puis récupérer le snapshot cloud autorisé avant de déclarer la synchronisation initiale terminée.
2. Réconcilier le snapshot avec les modifications locales en attente ; ne jamais écraser silencieusement une modification locale non synchronisée.
3. À chaque création, modification ou suppression d'une réservation, ressource, tâche, élément de stock, mouvement, tarif, profil ou donnée proUSB, enregistrer une opération idempotente dans une outbox locale durable et lancer immédiatement sa synchronisation.
4. En cas d'absence de réseau, conserver l'outbox et réessayer au retour en ligne avec backoff.
5. À la fermeture ou au passage en arrière-plan, lancer un dernier flush best-effort de l'outbox et utiliser `visibilitychange` / `pagehide` comme signaux de dernier recours.

## Limite importante du navigateur

Un événement `beforeunload` ne permet pas de garantir qu'une requête asynchrone se termine avant que le navigateur, Android ou Windows ferme le processus. La garantie ne doit donc pas reposer sur « sync uniquement à la fermeture ». La vraie garantie est : chaque mutation est mise en file durablement, envoyée immédiatement, puis retentée jusqu'à confirmation serveur. Le flush de fermeture n'est qu'une optimisation.

## Architecture de synchronisation proposée

- `src/services/sync/supabaseClient.ts` : client Supabase avec URL et clé publishable uniquement ; aucune clé `service_role` côté client.
- `src/services/sync/syncSchema.ts` : mapping versionné et whitelist des collections réellement synchronisées.
- `src/services/sync/syncOutbox.ts` : opérations locales idempotentes (UUID d'opération, entité, ID stable, action upsert/delete, payload versionné, date, tentative, état).
- `src/services/sync/syncEngine.ts` : pull initial, push incrémental, tombstones, retries, backoff, verrou de synchronisation et résolution de conflits.
- `src/services/sync/syncLifecycle.ts` : bootstrap à l'ouverture, événement online, visibilité, pagehide et flush contrôlé.
- `src/services/sync/syncRepository.ts` : points d'entrée communs appelés par les mutations CRUD ; aucune synchronisation cachée dispersée dans les composants.
- `src/db/objectbox.ts` : persistance locale de l'outbox et curseurs de synchronisation, avec transactions IndexedDB.

### Flux d'ouverture

```text
App start
  -> restore auth/session
  -> open local stores
  -> load pending outbox
  -> pull cloud changes scoped to authenticated tenant
  -> merge by stable ID + server version
  -> apply remote snapshot locally
  -> push pending local operations
  -> mark initial sync ready
```

### Flux CRUD

```text
CRUD command
  -> validate domain operation
  -> persist local entity + outbox event atomically
  -> update UI
  -> push event immediately
  -> server acknowledgement
  -> mark event synced / advance cursor
```

### Flux de fermeture

```text
visibilitychange(hidden) / pagehide
  -> best-effort flush pending outbox
  -> keep unacknowledged events durable for next launch
```

## Sécurité et intégrité obligatoires

- RLS activée sur toutes les tables exposées.
- Chaque ligne est liée à un identifiant de tenant/établissement et à l'utilisateur authentifié ; une simple condition `authenticated` n'est pas une règle d'autorisation suffisante.
- Clés publishable/anon uniquement dans l'application ; jamais de secret ou de `service_role` dans le bundle, l'APK ou l'EXE.
- Les opérations de suppression sont représentées par des tombstones pour qu'une synchronisation ultérieure ne ressuscite pas une ligne supprimée.
- Les écritures serveur sont idempotentes et protégées contre les doubles envois.
- Les conflits sont détectés par version serveur / `updated_at` ; pas de stratégie « dernier écrivain gagne » sans règle métier validée.
- Le backup ne doit pas exposer les données d'un établissement à un autre établissement.
- La purge de compte devra supprimer les lignes distantes et fichiers distants via un flux serveur authentifié, avant de déclarer l'effacement complet. La purge locale actuelle ne peut annoncer que la suppression des données locales.

## Tables et politiques à définir après identification du projet

Ne pas inventer de tables ni appliquer de migration avant audit du projet et de ses données. Le mapping attendu est au minimum à examiner pour :

- réservations ;
- groupes et ressources ;
- tâches et sous-tâches ;
- articles et mouvements de stock ;
- tarifs dynamiques ;
- profils d'établissement et de client ;
- cartes proUSB émises, journaux et paramètres, si le propriétaire confirme que ces données doivent être synchronisées.

Pour chaque collection, définir clé primaire stable, tenant, colonnes, politique RLS SELECT/INSERT/UPDATE/DELETE, index, contraintes, version, tombstone et rétention.

## Conditions de validation

- Pull initial sans écraser les mutations locales.
- Chaque CRUD crée une seule opération outbox.
- Répétition d'une opération ne crée pas de doublon.
- Offline puis online : toutes les opérations finissent synchronisées.
- Suppression : la ligne ne réapparaît pas au prochain pull.
- Conflits : comportement explicite et testé.
- Fermeture brutale : outbox restaurée à l'ouverture suivante.
- Deux établissements/utilisateurs : aucune fuite inter-tenant.
- Purge : suppression locale et distante vérifiée séparément.

## Décision propriétaire requise

Fournir la référence du projet Supabase Appointment. Si aucun projet n'existe, confirmer qu'un nouveau projet séparé doit être créé et indiquer l'organisation Supabase cible. Ne pas réutiliser `CyberScrape` par défaut.
