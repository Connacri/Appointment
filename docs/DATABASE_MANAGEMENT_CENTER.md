# Centre de gestion des bases de données

## Périmètre livré dans `feat/database-management-center`

- La dialog « Base de données locale » expose des panneaux Local/CardLock, Supabase, Neon et Sauvegarde.
- Les deux points d'entrée d'import CardLock utilisent `lockManager.importMdb` et `mdbSnapshotToPlanning`. Le fichier est lu en lecture seule ; le rapport donne les tables et leurs nombres de lignes, puis le nombre de chambres par bâtiment.
- `BuildingInfo` est conservé, y compris un bâtiment sans chambre ; `RoomInfo` est l'unique source de création des ressources. Les groupes de démonstration sont retirés, les groupes créés manuellement sont conservés et le précédent snapshot CardLock est remplacé.
- Les séjours `GuestInfo` ne sont importés que s'ils correspondent sans ambiguïté à une chambre `RoomInfo` et ont des dates valides. Les séjours orphelins sont signalés ; aucune chambre, aucun étage, aucun tarif et aucune réservation synthétiques ne sont créés.
- Le panneau du Centre de données demande confirmation avant d'appliquer les changements ; la configuration de l'établissement applique l'import après sélection du fichier et affiche le rapport.
- L'URL Supabase et les clés publiques Publishable/Anon sont enregistrées dans le stockage local du navigateur. Le client Supabase principal les relit au démarrage et utilise la clé correspondant à l'URL configurée. Le test vérifie l'accès à la table `workspaces`.
- Les clés Publishable/Anon sont des clés clientes publiques, pas des secrets. La clé `service_role` ne doit jamais être saisie ici.
- La chaîne Neon est un champ temporaire en mémoire, effacé à la fermeture de la dialog. Elle n'est ni sauvegardée, ni testée depuis le navigateur.
- L'export de sauvegarde télécharge un JSON contenant les collections IndexedDB et l'instantané CardLock. L'envoi Gmail et l'upload Drive restent manuels.
- Le header affiche le nombre d'événements Outbox locaux prêts à être poussés, rafraîchi périodiquement. Il s'agit d'une file locale, pas d'un ACK serveur.

## Limites fonctionnelles explicites

Cette livraison ne doit pas être interprétée comme une synchronisation bidirectionnelle opérationnelle :

1. L'Outbox actuelle est consommée par aucune tâche réseau. Le compteur Push indique uniquement les événements locaux prêts à être traités.
2. Le Pull distant n'est pas implémenté ; le header affiche donc `Pull —` plutôt qu'un faux état synchronisé.
3. Le raccordement des ressources, factures, tâches, stocks et autres entités à une synchronisation durable reste incomplet.
4. Neon requiert un service backend (ou une fonction server-side) avec stockage des secrets, TLS et validation des certificats. Le navigateur et le lanceur Windows Edge ne doivent jamais recevoir la chaîne PostgreSQL.
5. Gmail/Drive nécessitent un client OAuth Google, des scopes limités et un flux de consentement. Aucun jeton OAuth n'est stocké par cette dialog.
6. L'EXE Windows actuel lance Edge en mode application. Il ne s'agit pas d'un hôte natif capable de lire arbitrairement `C:\Program Files...`. Le sélecteur de fichier reste obligatoire. Pour l'accès automatique, il faudra un hôte natif signé et une API locale sécurisée.

## Architecture requise pour terminer le bidirectionnel

- IndexedDB reste la source locale prioritaire et chaque mutation métier produit une Outbox transactionnelle.
- Supabase doit être la première destination distante avec workspace explicite, RLS, idempotence serveur, curseurs de pull, tombstones et résolution de conflits métier.
- Neon doit être raccordé par le backend comme second endpoint PostgreSQL. Les écritures provenant de Neon doivent être capturées via une stratégie de journalisation/CDC et réconciliées ; deux bases distantes ne doivent pas être déclarées maîtresses sans arbitrage.
- Les réservations, paiements et mouvements de stock nécessitent des règles de conflit propres au domaine ; Last Write Wins global est interdit.
- Le service de synchronisation doit publier des états Push/Pull (queued, running, success, error, offline) et horodatages vérifiables pour le header.

## Accès au fichier CardLock

Chemin habituel : `C:\Program Files (x86)\proUSB SOFTWARE\proUSBHotelLockSystem\CardLock.mdb`.

Sur les installations Windows virtualisées, la copie active peut se trouver sous `%LOCALAPPDATA%\VirtualStore\Program Files (x86)\proUSB SOFTWARE\proUSBHotelLockSystem\CardLock.mdb`. Comparer la date de modification avant import.
