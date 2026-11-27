# Synchronisation offline-first — Appointment PMS

Dernière revue documentaire : 2026-11-27. Référence de code : branche `main`.
Ce document décrit l'état du code et les limites observées ; il ne constitue pas une certification de réplication en production.

## Migration history — blocking prerequisite (2026-11-27)

The live Supabase project reports 17 applied migrations, while the repository tracks 13 SQL migration files. Four applied remote migrations are absent locally, and the repository's `allow_same_day_bookings` migration filename has a different version timestamp from the remote history. This drift prevents a reproducible local reset and makes a new production migration unsafe until reconciled.

Before adding invoice header/items RPCs, atomic purchase-order receipt, or foreign-key indexes:
1. Reconcile every remote migration with its exact tracked SQL and version.
2. Establish a reproducible local baseline using the supported Supabase CLI workflow.
3. Run the migration set on a disposable local/test database and verify schema parity.
4. Run Security and Performance Advisors after the eventual schema change.
5. Only then deploy the tracked migration to production.

No schema changes were made as part of this audit.

## Architecture et responsabilités

- **IndexedDB** conserve les projections métier locales dans les builds Web/Android.
- **SQLite natif Windows** possède des primitives locales P2P, mais la parité opérationnelle complète avec IndexedDB n'est pas démontrée.
- **Supabase** est un service distant de réplication/sauvegarde et de signalisation Realtime. Il ne doit pas être considéré comme un coordinateur transactionnel des réservations multi-appareils.
- **LAN Discovery v1** annonce la présence des applications natives par UDP multicast IPv4. Il ne transporte aucun événement métier et n'authentifie pas les pairs.
- **Realtime** est abonné aux tables métier du workspace. Les notifications sont des signaux d'invalidation : le client relit les lignes via les repositories normaux et sous RLS. Une notification Realtime n'est ni un ACK de réplication ni une autorité de coordination.

## Capacités déjà présentes dans le code

### Supabase Outbox / Sync Engine

Le code contient un moteur de push/pull (`src/services/supabase/supabaseSync.ts`) et un adaptateur de repositories (`src/services/supabase/pmsRepository.ts`).

Le moteur :
1. vérifie la configuration, la session, le workspace et la connectivité ;
2. traite les opérations Outbox séquentiellement selon la priorité des entités ;
3. marque une opération synchronisée uniquement après l'ACK de l'écriture distante ;
4. conserve les échecs avec retry/backoff ;
5. récupère un snapshot distant et protège les modifications locales encore en attente ;
6. utilise les tombstones pour éviter de ressusciter les lignes supprimées ;
7. expose un statut qui ne doit pas annoncer « synchronisé » avec des opérations en attente/en échec.

Les dispatchers déclarés couvrent les établissements, groupes, ressources, réservations, tâches, articles de stock, mouvements de stock, fournisseurs, commandes fournisseurs, personnel et profils d'établissement. La présence d'un dispatcher ne prouve pas que chaque écran/commande métier l'utilise correctement : la couverture CRUD doit être vérifiée mutation par mutation.

Les mouvements de stock disposent d'un chemin serveur atomique dédié. La réception d'une commande fournisseur et la transition de commande ne sont pas encore garanties comme une seule transaction distante.

### Realtime

`src/services/supabase/supabaseRealtime.ts` s'abonne aux changements des tables workspace : bookings, establishments, resource_groups, resources, pms_tasks, stock_items, dynamic_rates, stock_suppliers, purchase_orders et staff_members. Les payloads ne sont pas appliqués directement ; ils déclenchent une relecture via le moteur de synchronisation.

### P2P natif

Les primitives de protocole, validation d'événements, horloges vectorielles, détection de conflits causaux et persistance locale existent en TypeScript et Rust. Les transports natifs Windows/Android actuellement livrés ne font que découvrir la présence par multicast.

Le protocole LAN v1 ne fournit pas :
- d'appairage cryptographique ;
- d'authentification mutuelle des appareils ;
- de canal chiffré d'échange de données ;
- de transfert d'événements métier ;
- d'ACK durable de transport ;
- de boucle anti-entropy ou de reprise de session.

Les navigateurs Edge/Chrome ne peuvent pas participer au multicast UDP brut. La combinaison Edge Web + Chrome Canary Web ne peut donc pas se découvrir avec ce protocole.

## Registre des appareils et mode de déploiement

Le modèle de politique distingue `SINGLE_DEVICE` et `MULTI_DEVICE`. Un registre local IndexedDB et une première intégration AppContext existent.

Limites :
- le registre est local et modifiable ; il n'est pas une autorité partagée ni une preuve cryptographique d'identité ;
- l'initialisation SINGLE_DEVICE nécessite actuellement une session Supabase et un workspace propriétaire ;
- aucune autorité de coordination multi-appareils n'est encore livrée ;
- les mutations de réservation sont partiellement protégées ; le verrouillage global de tous les modules n'est pas achevé ;
- la parité SQLite Windows n'est pas démontrée.

En conséquence, **MULTI_DEVICE ne doit pas être utilisé en production pour autoriser plusieurs terminaux à écrire simultanément**. La découverte d'un pair ou une session Realtime ne change pas cette règle.

## Couverture métier : écarts à fermer

| Domaine | État connu | Travail restant |
|---|---|---|
| Réservations / paiements | CRUD local et Outbox plus avancés que les autres domaines | Autorité transactionnelle serveur, conflits inter-réservations, paiements imbriqués et tests multi-terminal |
| Établissements / bâtiments / chambres | Repositories et dispatchers partiels | Vérifier tous les éditeurs, suppressions et intégrité hiérarchique |
| Tâches / housekeeping | Projections locales génériques et dispatcher distant | Enqueue awaited/fail-closed, tests CRUD et assignations |
| Stock articles | Projection locale générique et dispatcher | Garantir que chaque commande passe par les transactions métier |
| Mouvements de stock | Journal append-only et RPC serveur atomique | Idempotence, rapprochement des soldes et tests de concurrence |
| Fournisseurs | Repository, RLS, soft-delete et sync | Vérifier tous les chemins UI et références inter-établissements |
| Commandes fournisseurs | Repository et sync | Rendre réception + mouvement + statut atomiques côté serveur |
| Factures / devis / proformas | Persistance locale historique ; store IndexedDB présent | Sortir du localStorage, repository typé, Outbox, RLS et transactions factures/lignes/paiements |
| Tarifs dynamiques | Table/repository de lecture existants | CRUD complet, Outbox, pull/merge et conflits |
| Personnel / RH | Repository et sync des membres | Contrat partagé des rôles/permissions et validation des mutations |
| Rôles / permissions | Configuration applicative locale | Décider du périmètre partagé et mettre en œuvre le modèle d'autorisation |
| Channel Manager | Plusieurs écrans utilisent encore un état local de composant | Persistance, connecteurs réels, secrets côté serveur et idempotence OTA |
| Spa / événements | État local de composants | Modèle de données, repositories, règles métier et synchronisation |
| Audit | Journal local partiel | Contrat cloud, intégrité, rétention et tests |

Cette matrice est un résumé de l'audit statique ; chaque module doit encore être testé en CRUD réel, après redémarrage et avec plusieurs appareils.

## Politique de cohérence retenue

La stratégie est offline-first avec protection des opérations critiques et règles métier strictes.

- Une mutation locale doit écrire dans une transaction durable la projection, la version, l'Outbox et l'événement P2P.
- Une commande ne doit pas afficher un succès durable si l'écriture locale transactionnelle échoue.
- Les réservations concurrentes sur une même chambre/période ne peuvent pas être rendues globalement exclusives par une simple fusion d'horloges vectorielles.
- Les opérations critiques en mode multi-appareils doivent être refusées ou rester provisoires tant qu'une autorité de coordination fiable ne peut pas valider la transaction.
- Pas de Last Write Wins pour réservations, mouvements de stock, factures ou paiements.
- Le client doit vérifier workspace, établissement, epoch et appartenance de l'appareil au moment de la mutation, pas seulement à l'ouverture de l'écran.

## Plan de livraison restant

1. Auditer et convertir chaque commande UI en commande métier/repository transactionnelle ; supprimer les écritures métier directes dans localStorage.
2. Fermer les trous CRUD pour factures, lignes, paiements, tarifs, Channel Manager, Spa et événements.
3. Implémenter une autorité de registre partagée avec RLS et epoch monotone ; vérifier les docs Supabase actuelles avant toute modification de schéma.
4. Ajouter une API transactionnelle pour les opérations critiques : vérifier autorisation/appareil/epoch, contraintes métier et écrire l'opération + événement de manière atomique.
5. Développer le transport Web : signalisation workspace-scoped authentifiée, WebRTC DataChannels, STUN/TURN, appairage et rotation/révocation de clés. Realtime seul ne remplace pas ce transport.
6. Ajouter le transport authentifié Windows/Android, ACK durable, anti-entropy, reprise après crash et révocation.
7. Appliquer la politique READ_ONLY à tous les domaines et à toutes les voies d'entrée (UI, raccourcis, actions admin, imports, opérations groupées et repositories).
8. Atteindre la parité IndexedDB/SQLite avec fixtures partagées et tests contractuels inter-langages.
9. Exécuter les tests multi-workspace/RLS, duplication, retry, offline/reconnect, partition réseau, conflit, suppression, restauration et tests matériels réels.

## Release gate — critères de sortie

Aucune déclaration « P2P prêt », « multi-device prêt » ou « synchronisation complète » tant que les éléments suivants ne sont pas tous vérifiés :
- CRUD complet et idempotent par domaine ;
- transactions locales atomiques avec rollback ;
- autorisation workspace/établissement/appareil vérifiée côté serveur ;
- validation transactionnelle des contraintes inter-enregistrements ;
- aucun contournement par localStorage, raccourci, import ou action admin ;
- convergence après offline/restart/reconnect sur Windows, Android et Web ;
- tests de partition réseau prouvant qu'il n'existe pas deux autorités concurrentes ;
- révocation et rotation des identités ;
- RLS/advisors et tests d'isolation ;
- workflows CI/CD verts et validation de packages signés ;
- essais sur matériel et réseaux réels.

**État de sortie actuel : NOT READY pour la réplication P2P multi-appareils et la distribution comme PMS multi-postes de production.** L'application peut être évaluée en mono-appareil avec les limites documentées, mais le mode SINGLE_DEVICE actuel ne remplace pas un audit complet de tous les chemins de mutation.
