# Centre de gestion des bases de données

## Sources locales

IndexedDB reste la source locale prioritaire. La dialog expose l'exploration des stores, l'import proUSB CardLock et l'export JSON complet. L'export inclut les stores IndexedDB disponibles (dont Outbox et tombstones) et l'instantané CardLock ; il ne constitue pas une sauvegarde binaire de la base MDB originale.

## Import CardLock

- Runtime navigateur : sélection explicite du fichier MDB.
- Runtime Windows natif : détection des chemins proUSB usuels et VirtualStore, comparaison de date, lecture via commande Rust native.
- Toutes les tables MDB sont inspectées. L'inventaire conserve nom, nombre de lignes et noms de colonnes ; les lignes brutes des tables techniques ne sont pas archivées automatiquement.
- Le parseur distingue analyse et application. L'analyse ne modifie pas le modèle métier. L'application n'a lieu qu'après confirmation explicite.
- `BuildingInfo`, `RoomInfo`, `GuestInfo`, `CardInfo` et `RecordOpen` sont les mappings métier validés actuellement.

## Supabase

Project URL et clés clientes Publishable/Anon sont stockées comme configuration cliente locale. Ces clés ne sont pas des secrets privilégiés ; RLS et les policies restent obligatoires. Aucune clé `service_role` ne doit être fournie au frontend.

Le test de connectivité vérifie l'API et l'accès à `workspaces`. Cela ne prouve pas que toutes les tables métier sont synchronisées.

## Neon

La chaîne PostgreSQL est saisie temporairement dans l'interface native, testée dans le processus Rust via TLS (`SELECT 1`, `SHOW server_version`), puis stockée dans Windows Credential Manager. Le frontend ne possède pas de commande permettant de relire le secret.

La réussite du test prouve uniquement que l'hôte PostgreSQL accepte la connexion et les requêtes de diagnostic. Elle ne prouve ni le mapping de schéma ni la réplication. Utiliser un rôle PostgreSQL dédié avec les permissions minimales ; ne jamais distribuer un compte owner/superuser dans le client.

## Statuts de synchronisation

- Push : nombre d'événements Outbox locaux prêts à être envoyés, actualisé après mutations locales et par polling de secours.
- Pull : indisponible tant qu'un worker distant avec curseur durable n'est pas déployé.
- Aucune mention « synchronisé » ne doit être affichée sans accusé de réception distant et progression du curseur Pull.

## Sauvegarde et partage

Le JSON exporté peut être joint manuellement à Gmail ou déposé dans Google Drive. Les connecteurs OAuth Gmail/Drive et les autorisations de partage ne sont pas inclus dans cette livraison.
