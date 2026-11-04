# OmniBook — Plan d'implémentation des installations, spa, événements et accès hardware

**Statut :** plan de livraison proposé sur la base de la spécification `OMNIBOOK_FACILITIES_ACCESS_SPEC.md`.  
**Règle :** ne pas ouvrir plusieurs fronts fonctionnels avant que les fondations offline-first et la disponibilité transactionnelle soient fiables.

## État de départ et risque principal

Le projet possède déjà les stores IndexedDB historiques `bookings`, `invoices`, `resources` (DB `OmniBook_ObjectBox_Store`, version 2) et un schéma Supabase multi-tenant de 16 tables avec RLS. Les repositories Supabase ne sont pas encore raccordés à toutes les mutations locales par une outbox transactionnelle complète. Les migrations locales ne sont pas encore réconciliées avec l'historique distant dans le dépôt.

**Décision d'ingénierie :** aucune nouvelle fonctionnalité ne doit écrire directement dans Supabase depuis un composant UI. Les commandes domaine écrivent d'abord dans IndexedDB et outbox, puis le moteur synchronise. Pour les opérations qui exigent une garantie globale (réservation simultanée, attribution de droits, mouvement d'équipement), la validation finale est transactionnelle côté serveur.

## Lot 0 — Audit et gel des contrats (P0)

- Inventorier toutes les mutations de `AppContext`, localStorage et IndexedDB.
- Cartographier chaque type métier vers son store local et sa table distante.
- Identifier les usages réels des clés `ob_*` et les données legacy.
- Récupérer l'historique de migrations distant avec Supabase CLI et le versionner dans le dépôt ; vérifier une reproduction sur un projet/branch de développement.
- Définir les contrats TypeScript, schémas de validation et conventions UUID/tenant/version.
- Ajouter ADR : réservation hébergement vs réservation d'installation, ledger financier unique, hardware gateway.
- Livrables : matrice de mapping, tests de compatibilité, ADR et migration plan.
- Exit : aucune source de vérité ambiguë, aucune migration destructive, CI verte.

## Lot 1 — Sync Engine et intégrité multi-tenant (P0, bloquant)

- Ajouter stores `outbox`, `syncCursors`, `syncConflicts`, `schemaMeta` dans IndexedDB.
- Créer un repository transactionnel commun : entity + outbox dans la même transaction.
- Implémenter pull paginé, push batch, idempotence par `op_id`, tombstones, backoff+jitter, retry, dead-letter, verrou multi-onglets et reprise au démarrage.
- Implémenter contrôle `base_version` et conflits explicites.
- Compléter RLS et tests multi-workspace/établissement ; tester les politiques UPDATE USING + WITH CHECK.
- Corriger les mutations existantes pour passer par les commandes/repositories ; supprimer les synchronisations ponctuelles non contrôlées.
- Exit : offline → online sans perte, crash recovery, aucun doublon, aucune fuite cross-tenant, conflit détecté.

## Lot 2 — Catalogue universel des installations (P0)

- Ajouter contrats `FacilityCategory`, `Facility`, `FacilityUnit`, horaires, capacités, fermetures, tarifs et maintenance.
- Ajouter migrations IndexedDB non destructives et SQL Supabase avec RLS, contraintes, FK et index.
- Construire écrans catalogue, détail installation, unités, calendrier, horaires, capacité, fermeture et maintenance.
- Gérer `ownership_model` : exploitation établissement, concession à tiers, tiers opérateur.
- Exit : catégories et unités configurables, capacité nominale/opérationnelle, périodes d'indisponibilité et isolation tenant testées.

## Lot 3 — Moteur de réservation multi-ressources (P0)

- Ajouter `service_catalog`, `facility_bookings`, items, participants, allocations et événements d'audit.
- Construire API/commande serveur transactionnelle de vérification et allocation.
- Supporter créneaux, journée, capacité partagée, buffers, récurrence et annulation.
- Détecter chevauchements et concurrence (deux utilisateurs réservent le dernier créneau).
- Ajouter calendrier unifié des installations sans fusionner les séjours hôteliers existants.
- Exit : test de concurrence prouvant qu'une seule réservation obtient la ressource.

## Lot 4 — Spa complet (P1)

- Catalogue soins, durée, buffers, prix, contre-indications et catégories.
- Profils praticiens, compétences, disponibilités, congés et affectations.
- Cabines et équipements, réservation simultanée cabine/praticien.
- Packages, forfaits, abonnements et ledger de crédits.
- Routage des charges vers folio hébergement ou compte client externe.
- Exit : réservation, report, annulation, consommation forfait et charge testés bout en bout.

## Lot 5 — Salles, conférences et événements (P1)

- Configurations théâtre/classe/U/boardroom/banquet/cocktail et capacité opérationnelle.
- Dossier événement, sessions, participants, salle, matériel AV, staff, packages et planning.
- Check-in participants et lien avec badges temporaires.
- Contrat, acompte et charges au folio/ledger.
- Exit : un événement multi-session réserve toutes ses ressources sans conflit.

## Lot 6 — Locations et concessions commerciales (P1)

- Inventaire d'équipements louables, états, mouvements, inspection et dépôt.
- Contrats courte durée et locations de salles/espaces.
- Baux commerciaux/concessions avec échéancier et renouvellement.
- Droits d'accès des opérateurs et prestataires limités dans le temps et les zones.
- Exit : remise/retour traçables, dommages et contrat de concession auditables.

## Lot 7 — Accès hardware et badges (P1, intégration progressive)

- Modèle zones/points/appareils, politiques, badges, credentials, grants, événements.
- Définir interface `AccessDeviceAdapter` et passerelle locale.
- Implémenter d'abord simulateur matériel et tests de contrat.
- QR signé/opaque, RFID/NFC tokenisé, expiration, révocation, anti-rejeu, droits de zone/horaire.
- Implémenter un connecteur fabricant après réception du matériel exact et de sa documentation/API/SDK.
- Offline terminal : cache signé, durée de validité limitée, file d'événements, resynchronisation et alerte de fraîcheur.
- Exit : tests de badge valide/expiré/révoqué/hors-zone, coupure réseau, duplication/rejeu, perte contrôleur et audit complet.
- Interdiction de déployer des commandes de porte réelles avant essais en environnement isolé et validation sécurité.

## Lot 8 — Impression, exploitation et maintenance (P2)

- Templates QR/PVC/A4, lots, aperçu, réimpression avec audit.
- Profils imprimantes abstraits et connecteurs validés sur les modèles réellement disponibles.
- Work orders, maintenance préventive, affectations staff et journal d'intervention.
- Exit : impression vérifiée sur matériel cible, aucune donnée sensible imprimée par défaut.

## Lot 9 — Finance consolidée et reporting (P1/P2 transversal)

- Introduire folios, charges, paiements et allocations sans dupliquer invoices existantes.
- Migrer progressivement les charges spa, location, événements vers ledger.
- Gérer Master Folio/folios individuels et règles groupe déjà validées (mixed/full/both) dans le lot Groupe.
- Réconciliation et audit, multi-devises exact.
- Exit : chaque charge est imputée une fois, paiement alloué une fois, facture snapshot stable.

## Lot 10 — Centre d'aide et tutoriels (transversal, par module livré)

- Créer un Help Center searchable, catégories, guides pas-à-pas, prérequis, droits, erreurs, FAQ.
- Ajouter points d'aide contextuelle dans les écrans.
- Tutoriels : créer/modifier/annuler séjour, check-in/out, groupes, spa, salle, événement, location, folio, paiement, badge, terminal, impression, maintenance, stock, housekeeping, rapports, administration.
- Ajouter tutoriels interactifs uniquement lorsque le parcours UI est stable ; ne pas inventer de captures ni documenter des boutons inexistants.
- Versionner les guides et suivre la progression par utilisateur/role.

## Stratégie de livraison et contrôle qualité

Chaque lot est livré par petits commits cohérents :
1. contrat/types + tests ;
2. migration IndexedDB + tests de migration ;
3. migration SQL + RLS/contraintes/index ;
4. repository/mappers ;
5. logique métier et commandes transactionnelles ;
6. UI responsive/RTL ;
7. tests de bout en bout et tutoriel correspondant.

Tests obligatoires : unitaires de validation, migration ancienne base, repository local, mapping SQL, RLS multi-tenant, concurrence, offline/online, idempotence, tombstones, conflits, monnaie, permissions et adaptateurs simulés. Vérifier les workflows GitHub Actions après chaque lot ; un statut absent n'est pas une CI réussie.

## Ordre de priorité

| Priorité | Lots | Pourquoi |
|---|---|---|
| P0 | 0, 1, 2, 3 | Fiabilité des données, tenant, catalogue et moteur de réservation |
| P1 | 4, 5, 6, 7, 9 | Spa, événements, locations, contrôle d'accès, finance |
| P2 | 8, 10 | Impression avancée, maintenance enrichie et tutoriels finalisés |

## Conditions de passage en production

- Aucun schéma divergent entre IndexedDB, TypeScript et PostgreSQL.
- Migrations reproductibles et non destructives.
- RLS auditée ; aucun accès inter-workspace.
- Tests de réservation concurrente réussis.
- Outbox et reprise après crash prouvées.
- Matériel testé en environnement isolé, fail-safe documenté.
- Plan de sauvegarde/restauration et procédure de révocation des credentials validés.
- Tutoriels alignés sur les versions réellement livrées.
