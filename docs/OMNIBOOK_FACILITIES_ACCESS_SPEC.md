# OmniBook — Spécification technique des installations, réservations spécialisées et contrôle d'accès

**Statut :** spécification cible validée — décisions de périmètre du 4 novembre 2026  
**Dépôt :** Connacri/Appointment — branche main  
**Backend :** Supabase PostgreSQL 17, projet `vkmgakmujipnpjlawjqm`  
**Architecture :** React/Vite, IndexedDB offline-first, Supabase PostgreSQL/RLS

## 1. Décisions produit actées

| Domaine | Valeur | Portée |
|---|---|---|
| Contrôle d'accès | Hardware | QR + RFID/NFC + lecteurs + contrôleurs de portes + intégrations fabricants |
| Matériel | Both | Adaptateurs génériques et connecteurs spécifiques aux fabricants |
| Spa | Full | Catalogue, praticiens, cabines, rendez-vous, forfaits, abonnements, packages |
| Installations | All | Exploitation interne et espaces commerciaux loués à des tiers |

Le contrôle d'accès est un sous-système physique. QR/RFID/NFC sont des supports d'identification ; les décisions d'accès sont prises par une politique d'autorisation et exécutées/observées par des équipements. Une simple validation de QR dans le navigateur ne constitue pas un contrôle de porte.

## 2. État initial constaté — ne pas confondre cible et existant

Le projet Supabase contient 16 tables publiques avec RLS activée : `profiles`, `workspaces`, `workspace_members`, `establishments`, `resource_groups`, `resources`, `guests`, `bookings`, `booking_payments`, `invoices`, `invoice_items`, `pms_tasks`, `stock_items`, `stock_movements`, `dynamic_rates`, `audit_events`. Trois migrations sont enregistrées. Les tables étaient vides lors de l'audit.

Le modèle actuel `resources`/`bookings` est orienté hébergement : `domain` est limité à `hotel|resort`, et les réservations sont des séjours à dates. Il ne faut donc ni étendre arbitrairement ce champ ni réutiliser `bookings` pour les créneaux de spa, les locations horaires ou les événements.

IndexedDB actuelle : base `OmniBook_ObjectBox_Store`, version 2, stores `bookings`, `invoices`, `resources`, avec fallback `localStorage` utilisant les clés `ob_*`. Ces identifiants sont des contrats de compatibilité : ne pas les renommer ni supprimer. Le repository Supabase actuel couvre une partie des établissements, ressources, réservations, tâches et stocks ; il ne constitue pas encore un moteur de synchronisation transactionnel complet. L'outbox durable, les reprises, la résolution des conflits et le raccordement de toutes les mutations restent à réaliser.

## 3. Principes de conception

### 3.1 Identité, tenant et établissement
- UUID généré côté client pour chaque nouvel objet métier, conservé lors du push cloud.
- `workspace_id` obligatoire sur toute table métier ; `establishment_id` obligatoire sauf entités réellement transverses.
- Clés étrangères composites lorsque nécessaire : (id, workspace_id), et (id, establishment_id, workspace_id) pour éviter les références croisées.
- Toutes les tables du schéma exposé `public` ont RLS. Chaque opération doit vérifier l'appartenance active du membre au workspace et son rôle ; `TO authenticated` seul n'est pas une autorisation.
- Les rôles métier et permissions par module sont séparés des métadonnées utilisateur modifiables.

### 3.2 Temps et disponibilité
- Les instants sont stockés en `timestamptz` UTC ; les horaires d'ouverture récurrents sont des heures locales associées au fuseau IANA de l'établissement.
- Les séjours utilisent `date` avec intervalle [arrivée, départ) ; les créneaux utilisent `timestamptz` avec intervalle [début, fin).
- Toute réservation est vérifiée contre les allocations effectives, les fermetures, la maintenance, les temps de préparation/nettoyage et la capacité opérationnelle.
- La disponibilité ne doit pas être calculée uniquement dans le client. Une commande serveur transactionnelle revalide et crée les allocations atomiquement pour éviter les doubles réservations.
- Utiliser contraintes d'exclusion PostgreSQL sur les ressources unitaires lorsque le modèle le permet ; pour les capacités partagées, verrouiller la ligne de capacité/jour ou utiliser une fonction transactionnelle contrôlée.

### 3.3 Argent
- PostgreSQL : `numeric(18,4)` pour montants/taux/quantités financières ; devise ISO 4217 explicite par ligne de charge/paiement.
- TypeScript : décimales exactes (bibliothèque decimal ou entiers en unités mineures selon devise), jamais d'addition directe de DZD, EUR, USD.
- Les charges validées sont immuables ; correction par contre-écriture/annulation auditée.
- Les factures émises conservent un snapshot légal immuable des libellés, montants, taxes, coordonnées et devise.
- Ne pas dupliquer la facturation actuelle : intégrer les nouveaux services au ledger/folios centralisé. `booking_payments` reste compatible pour les paiements d'hébergement existants durant la migration.

### 3.4 Suppression et audit
- Soft delete pour les référentiels modifiables ; tombstone synchronisé pour les suppressions.
- Les événements d'accès, mouvements d'équipements, paiements, allocations de paiement, écritures financières et événements d'audit sont append-only.
- Pas de suppression physique d'une charge, d'un paiement ou d'un événement d'accès depuis l'interface métier.

## 4. Modèle métier cible — Supabase

Toutes les tables ci-dessous portent `id uuid primary key`, `workspace_id uuid not null`, `establishment_id text not null` lorsque applicable, `created_at timestamptz`, `updated_at timestamptz`, `version bigint not null default 1`. Les colonnes communes sont omises dans les listes de champs. Les IDs d'établissements restent de type text pour correspondre au schéma existant ; les nouvelles entités métier utilisent UUID.

### 4.1 Catalogue universel d'installations

| Table | Champs métier principaux | Rôle |
|---|---|---|
| `facility_categories` | `code`, `name jsonb`, `parent_id`, `sort_order`, `is_active` | Arborescence : spa, salles, sport, parking, commerces, espaces extérieurs, coworking, etc. |
| `facilities` | `category_id`, `code`, `name jsonb`, `description jsonb`, `facility_type`, `ownership_model`, `operator_party_id`, `timezone`, `status`, `is_bookable` | Installation/zone logique ; `ownership_model`: operated_by_establishment, leased_to_third_party, third_party_operated |
| `facility_units` | `facility_id`, `code`, `name`, `unit_type`, `capacity_nominal`, `capacity_operational`, `area_m2`, `attributes jsonb`, `status` | Unité réservable : cabine, salle, court, place, équipement ou espace |
| `facility_capacity_rules` | `facility_id`, `unit_id`, `valid_from`, `valid_to`, `capacity`, `capacity_mode` | Capacité selon plage/date |
| `facility_schedules` | `facility_id`, `unit_id`, `weekday`, `opens_at`, `closes_at`, `valid_from`, `valid_to` | Horaires récurrents locaux |
| `facility_closures` | `facility_id`, `unit_id`, `starts_at`, `ends_at`, `reason`, `closure_type` | Fermeture exceptionnelle, maintenance ou privatisation |
| `facility_pricing_rules` | `facility_id`, `unit_id`, `service_id`, `currency`, `price`, `pricing_mode`, `valid_from`, `valid_to`, `conditions jsonb` | Prix horaire, journalier, par personne, forfait ou saison |
| `facility_maintenance` | `facility_id`, `unit_id`, `starts_at`, `ends_at`, `status`, `work_order_id` | Immobilisation technique |

Le périmètre « all » couvre les installations internes et les surfaces commerciales louées : boutiques, restaurants indépendants, kiosques, locaux, bureaux, stands, concessions, parkings et espaces événementiels. La propriété/exploitation, la facturation locative et les droits d'accès doivent rester distincts.

### 4.2 Services et réservation multi-ressources

| Table | Champs métier principaux | Rôle |
|---|---|---|
| `service_catalog` | `category_id`, `code`, `name jsonb`, `description jsonb`, `duration_minutes`, `prep_minutes`, `cleanup_minutes`, `price`, `currency`, `tax_code`, `is_active` | Prestations vendues : massage, soin, location salle, prestation audiovisuelle, etc. |
| `service_resource_requirements` | `service_id`, `resource_type`, `required_count`, `required_capability jsonb` | Ressources requises simultanément |
| `facility_bookings` | `guest_id`, `group_reference`, `booking_number`, `source_channel`, `starts_at`, `ends_at`, `timezone`, `party_size`, `status`, `currency`, `quoted_total`, `notes`, `version` | Dossier de réservation non-hébergement |
| `facility_booking_items` | `booking_id`, `service_id`, `facility_id`, `unit_id`, `description_snapshot`, `quantity`, `starts_at`, `ends_at`, `unit_price`, `tax_rate`, `status` | Lignes réservées et snapshot tarifaire |
| `facility_allocations` | `booking_item_id`, `unit_id`, `staff_id`, `starts_at`, `ends_at`, `allocation_kind`, `status` | Verrouillage des ressources, unités et employés |
| `facility_booking_guests` | `booking_id`, `guest_id`, `role`, `attendance_status` | Participants, accompagnants, organisateurs |
| `facility_booking_events` | `booking_id`, `event_type`, `payload jsonb`, `actor_id`, `occurred_at` | Historique métier append-only |

Les réservations horaires et journalières utilisent le même agrégat mais des politiques de disponibilité distinctes. Une réservation peut contenir plusieurs lignes ; chaque ligne peut exiger plusieurs allocations. La validation et les allocations doivent être atomiques côté serveur.

### 4.3 Spa complet

Le spa est un domaine fonctionnel construit sur le catalogue et les réservations multi-ressources, pas une base de rendez-vous parallèle.

| Table | Champs métier principaux | Rôle |
|---|---|---|
| `spa_treatments` | `service_id`, `category`, `benefits jsonb`, `contraindications jsonb`, `recommended_for jsonb` | Fiche de soin liée au catalogue |
| `spa_staff_profiles` | `staff_id`, `specialties jsonb`, `certifications jsonb`, `active` | Praticiens et compétences |
| `spa_staff_schedules` | `staff_id`, `weekday`, `starts_at`, `ends_at`, `valid_from`, `valid_to` | Planning des praticiens |
| `spa_packages` | `code`, `name jsonb`, `price`, `currency`, `validity_days`, `terms jsonb` | Forfaits composés |
| `spa_package_items` | `package_id`, `treatment_id`, `included_quantity` | Prestations incluses |
| `spa_memberships` | `guest_id`, `package_id`, `starts_on`, `expires_on`, `status`, `remaining_credits` | Abonnements et droits restants |
| `spa_membership_ledger` | `membership_id`, `booking_item_id`, `delta`, `reason`, `occurred_at` | Consommation/restauration de crédits auditée |

Un rendez-vous spa est un `facility_booking` dont la ligne référence un soin et les allocations exigent cabine + praticien + éventuels équipements. Les temps de préparation et de désinfection sont inclus dans le blocage, pas dans la durée facturée. Un client externe et un client hébergé suivent le même flux ; seul le routage financier diffère.

### 4.4 Événements et conférences

| Table | Champs métier principaux | Rôle |
|---|---|---|
| `events` | `organizer_guest_id`, `title`, `event_type`, `starts_at`, `ends_at`, `status`, `contract_reference`, `expected_attendees` | Dossier événement |
| `event_sessions` | `event_id`, `title`, `starts_at`, `ends_at`, `room_unit_id`, `setup_style`, `capacity` | Sessions et configuration de salle |
| `event_participants` | `event_id`, `guest_id`, `registration_status`, `checkin_status` | Participants |
| `event_resources` | `event_id`, `session_id`, `unit_id`, `quantity`, `starts_at`, `ends_at` | Salles et équipements |
| `event_packages` | `event_id`, `service_id`, `quantity`, `price_snapshot` | Packages restauration, AV, interprétation, sécurité, décoration |

Les configurations de salle supportent théâtre, classe, U, boardroom, banquet et cocktail. Une session réserve la salle et les ressources complémentaires via le même moteur d'allocations.

### 4.5 Locations d'équipements et espaces commerciaux

| Table | Champs métier principaux | Rôle |
|---|---|---|
| `rental_assets` | `facility_unit_id`, `asset_tag`, `serial_number`, `condition_status`, `tracking_mode` | Matériel louable et inventaire |
| `rental_contracts` | `customer_party_id`, `facility_id`, `asset_id`, `contract_number`, `starts_at`, `ends_at`, `rate`, `currency`, `deposit_amount`, `status` | Contrat de location client ou concession |
| `rental_movements` | `contract_id`, `asset_id`, `movement_type`, `occurred_at`, `condition_snapshot jsonb`, `actor_id` | Remise, transfert, retour |
| `rental_inspections` | `contract_id`, `asset_id`, `inspection_type`, `condition`, `damage_notes`, `attachments jsonb` | État départ/retour |
| `commercial_lease_terms` | `facility_id`, `tenant_party_id`, `lease_starts_on`, `lease_ends_on`, `rent_amount`, `currency`, `billing_frequency`, `deposit_amount`, `terms jsonb` | Bail/concession d'espace commercial |

Les contrats de location longue durée d'un local ne sont pas des réservations de créneau. Ils ont leur cycle contractuel, échéances, dépôt de garantie, renouvellement et contrôle d'accès propre.

### 4.6 Contrôle d'accès matériel

| Table | Champs métier principaux | Rôle |
|---|---|---|
| `access_zones` | `parent_id`, `code`, `name`, `zone_type`, `security_level` | Zones physiques hiérarchisées |
| `access_points` | `zone_id`, `code`, `name`, `direction_mode`, `is_emergency_exit` | Porte, tourniquet, barrière, entrée |
| `access_devices` | `access_point_id`, `vendor`, `model`, `protocol`, `connection_type`, `external_device_id`, `firmware_version`, `status`, `last_seen_at`, `secret_ref` | Lecteurs, contrôleurs, passerelles |
| `access_device_capabilities` | `device_id`, `capability_code`, `config jsonb` | Capacités et options du matériel |
| `access_policies` | `zone_id`, `subject_type`, `schedule jsonb`, `conditions jsonb`, `decision`, `priority` | Politique d'autorisation |
| `access_badges` | `holder_guest_id`, `holder_user_id`, `badge_type`, `badge_number`, `valid_from`, `valid_until`, `status`, `template_id` | Badge physique/virtuel |
| `access_credentials` | `badge_id`, `credential_type`, `token_hash`, `credential_ref`, `issued_at`, `expires_at`, `revoked_at`, `key_version` | QR opaque signé, UID RFID/NFC tokenisé |
| `access_grants` | `badge_id`, `zone_id`, `starts_at`, `ends_at`, `allowed_days jsonb`, `usage_limit`, `revoked_at`, `source_type`, `source_id` | Droits temporaires et traçables |
| `access_events` | `device_id`, `access_point_id`, `badge_id`, `occurred_at`, `decision`, `reason_code`, `direction`, `online_mode`, `event_id` | Journal append-only des scans/accès |
| `access_device_commands` | `device_id`, `command_id`, `command_type`, `payload`, `issued_at`, `acknowledged_at`, `status` | Commandes contrôleur idempotentes |
| `badge_templates` | `name`, `layout jsonb`, `supported_media`, `version` | Modèles badge QR/PVC/A4 |
| `badge_print_jobs` | `badge_id`, `template_id`, `printer_profile`, `copies`, `status`, `printed_at`, `actor_id` | Impression et réimpression auditée |

#### Sécurité du contrôle d'accès
- Le QR ne contient aucune donnée personnelle : uniquement un identifiant aléatoire opaque ou un jeton signé à durée courte.
- En base, conserver le hash du jeton et sa version de clé ; ne pas stocker de secrets d'équipement en clair. `secret_ref` pointe vers un gestionnaire de secrets ou un coffre chiffré côté passerelle.
- Les autorisations sont calculées par sujet + zone + plage horaire + état du badge + politique. Le badge ne confère aucun droit implicite.
- Anti-rejeu, expiration, révocation, limitation d'usage, horloge tolérante et audit des refus sont obligatoires.
- Les commandes matérielles sont signées, idempotentes, horodatées et acquittées. Ne pas envoyer de commande de porte depuis un composant UI.
- Les adaptateurs fabricants sont isolés derrière une interface `AccessDeviceAdapter` : discover, health, issueCredential, revokeCredential, pushPolicy, readEvents, executeCommand.
- Connectivité générique via passerelle locale/API/SDK documenté ; connecteurs spécifiques (fabricants) derrière packages/adapters versionnés. Ne jamais supposer qu'un navigateur peut piloter directement un contrôleur.
- En mode offline, un contrôleur/scanner conserve un cache signé des droits avec expiration et une file d'événements. Une révocation effectuée sur un autre appareil n'est pas instantanément connue d'un terminal isolé : pour zones sensibles, imposer connexion ou cache de très courte durée et procédure de secours.
- Les sorties de secours restent gouvernées par les normes et systèmes incendie locaux ; OmniBook ne doit pas inhiber une sortie réglementaire.

### 4.7 Finance et intégration aux folios

Les nouvelles réservations, événements, locations et accès payants produisent des charges vers un ledger unique :

| Table cible | Champs principaux | Rôle |
|---|---|---|
| `folios` | `owner_type`, `owner_id`, `booking_id`, `currency`, `status` | Compte principal ou individuel |
| `folio_charges` | `folio_id`, `source_type`, `source_id`, `description_snapshot`, `quantity`, `unit_price`, `tax_snapshot`, `currency`, `status` | Charge métier immuable |
| `payments` | `payer_id`, `amount`, `currency`, `method`, `reference`, `status`, `paid_at` | Encaissement |
| `payment_allocations` | `payment_id`, `folio_id`, `charge_id`, `amount`, `currency` | Affectation traçable |
| `invoice_charge_links` | `invoice_id`, `folio_charge_id`, `invoice_item_id` | Lien de facturation sans polymorphisme non contraint |

Les factures existantes `invoices`/`invoice_items` restent le document de sortie. Les charges d'un événement ou d'un spa ne doivent pas être dupliquées dans une table de facturation dédiée. Les règles de routage groupe/organisme/participant seront ajoutées via le module Groupes & Délégations validé séparément.

## 5. Modèle IndexedDB local

Conserver `OmniBook_ObjectBox_Store`, stores actuels et clés `ob_*`. Faire évoluer par migrations versionnées et non destructives. Cible des stores :

| Store IndexedDB | Contenu | Index recommandés |
|---|---|---|
| `bookings` | Séjours existants | resourceId, startDate, endDate, status, workspaceId, establishmentId |
| `invoices` | Factures existantes | docNumber unique, bookingId, status, updatedAt |
| `resources` | Chambres et ressources historiques | sector, groupId, establishmentId |
| `facilityCategories` | Catégories installations | parentId, code |
| `facilities` | Installations | establishmentId, categoryId, status, ownershipModel |
| `facilityUnits` | Unités réservable | facilityId, status, code |
| `facilitySchedules` | Horaires | facilityId, unitId, weekday |
| `facilityClosures` | Fermetures | facilityId, startsAt, endsAt |
| `serviceCatalog` | Services/soins | categoryId, isActive |
| `facilityBookings` | Réservations hors hébergement | startsAt, endsAt, status, guestId |
| `facilityBookingItems` | Lignes | bookingId, serviceId, unitId |
| `facilityAllocations` | Ressources réservées | unitId, staffId, startsAt, endsAt |
| `spaStaffProfiles`, `spaPackages`, `spaMemberships` | Données spa | staffId, guestId, status, expiresOn |
| `events`, `eventSessions`, `eventParticipants` | Événementiel | startsAt, eventId, guestId |
| `rentalAssets`, `rentalContracts`, `rentalMovements` | Locations | assetId, contractId, startsAt, status |
| `accessZones`, `accessPoints`, `accessDevices` | Topologie matérielle | zoneId, accessPointId, status |
| `accessBadges`, `accessCredentials`, `accessGrants` | Droits et badges | holderId, badgeId, expiresAt, revokedAt |
| `accessEvents`, `deviceCommands`, `badgePrintJobs` | File locale matériel | eventId, deviceId, status, occurredAt |
| `outbox` | Opérations à pousser | opId unique, entityType+entityId, status, nextAttemptAt |
| `syncCursors` | Curseurs pull par workspace/collection | workspaceId+collection unique |
| `syncConflicts` | Conflits non résolus | entityType+entityId, detectedAt, status |
| `schemaMeta` | Version schéma local | key unique |

### Métadonnées locales de synchronisation
Chaque record synchronisable porte un envelope local :
`_sync: { state: 'pending'|'synced'|'conflict', localVersion, serverVersion?, lastSyncedAt?, deletedAt? }`.
Cet envelope n'est pas envoyé au serveur. Les colonnes métier distantes utilisent `version bigint`, `updated_at`, `deleted_at` (ou tombstone dédiée lorsque la suppression doit rester auditée).

Une mutation et son événement outbox sont écrits dans **la même transaction IndexedDB**. Une opération outbox contient : `op_id uuid`, `workspace_id`, `establishment_id`, `entity_type`, `entity_id`, `operation`, `base_version`, `payload_version`, `payload`, `created_at`, `attempt_count`, `next_attempt_at`, `status`, `last_error`. Idempotence serveur par `op_id). Le payload est validé par schéma et limité aux champs autorisés.

### Compatibilité et migration
- La prochaine version IndexedDB incrémente `dbVersion` et crée les nouveaux stores sans supprimer/renommer les anciens.
- Migrer progressivement les données legacy avec migration idempotente, journal de migration et sauvegarde logique avant transformation.
- Ne pas transformer automatiquement les anciennes réservations d'hébergement en réservations `facilityBookings`.
- Ne pas basculer localStorage vers IndexedDB en une opération destructive. Lire legacy, valider, écrire, vérifier les counts puis marquer migration terminée.
- Les stores spécialisés ne doivent pas être chargés entièrement en mémoire ; pagination par index/cursor.

## 6. Synchronisation offline-first

Flux d'écriture :
1. Valider la commande métier côté domaine.
2. Ouvrir une transaction IndexedDB incluant l'entité et `outbox`.
3. Persister la mutation locale, augmenter `localVersion`, créer un `op_id` unique.
4. Mettre à jour l'interface immédiatement.
5. Le Sync Engine envoie par lots, avec clé idempotente et contrôle de `base_version`.
6. Le serveur applique transactionnellement l'opération et renvoie version/horodatage canoniques.
7. Marquer l'outbox acquittée et le record local synchronisé.

Flux de lecture : authentifier, charger le cache local, récupérer les deltas cloud par curseur, fusionner sans écraser les records pending/conflict, appliquer les tombstones, puis pousser l'outbox. Utiliser backoff exponentiel avec jitter, verrou inter-onglets, limites de lot, retry des erreurs réseau/5xx et dead-letter des erreurs métier permanentes.

Conflit de version : si la version distante diffère de `base_version`, ne pas appliquer un last-write-wins aveugle. Produire un conflit explicite. Pour une réservation, relancer la vérification de disponibilité côté serveur ; un conflit de capacité ne se résout pas par fusion automatique.

## 7. RLS, contraintes, index et transactions

- RLS activée pour chaque table du nouveau domaine ; SELECT/INSERT/UPDATE/DELETE contrôlés par appartenance workspace et permissions module.
- Pour UPDATE : policy `USING` et `WITH CHECK` ; indexer les colonnes de tenant utilisées par les policies.
- Index composites courants : `(workspace_id, establishment_id, updated_at)`, `(workspace_id, status, starts_at)`, `(workspace_id, facility_id, starts_at)`, FK de tous les liens.
- Contraintes CHECK : durées positives, capacités >= 0, validité badge, quantités, devises, statuts, durée de contrat.
- Unicité : code par établissement, badge number par établissement, external_device_id par fournisseur/établissement, numéro de contrat par workspace.
- Allocation d'une ressource unitaire : exclusion des intervalles qui se chevauchent pour états bloquants ; capacité partagée gérée transactionnellement.
- Les fonctions RPC de réservation et d'accès exposées doivent vérifier auth/tenant, valider les arguments, limiter les privilèges et ne pas utiliser `SECURITY DEFINER` comme contournement RLS. Toute fonction réellement privilégiée doit être isolée dans un schéma non exposé, contrôlée et auditée.
- Les vues exposées utilisent `security_invoker = true` sur PostgreSQL 15+.
- Aucun `service_role`/secret key dans React, Android ou Windows. Les secrets des contrôleurs sont gérés par une passerelle/Edge Function avec authentification forte.

## 8. API et contrats TypeScript

Créer des contrats de domaine indépendants des DTO Supabase :
- `Facility`, `FacilityUnit`, `FacilitySchedule`, `FacilityClosure`
- `ServiceDefinition`, `FacilityBooking`, `FacilityBookingItem`, `ResourceAllocation`
- `SpaTreatment`, `SpaStaffProfile`, `SpaPackage`, `SpaMembership`
- `Event`, `EventSession`, `EventParticipant`
- `RentalAsset`, `RentalContract`, `RentalMovement`
- `AccessZone`, `AccessPoint`, `AccessDevice`, `AccessBadge`, `AccessCredential`, `AccessGrant`, `AccessEvent`
- `Folio`, `FolioCharge`, `Payment`, `PaymentAllocation`

Les repositories exposent des commandes explicites (`createFacilityBooking`, `rescheduleFacilityBooking`, `cancelFacilityBooking`, `allocateResources`, `issueBadge`, `revokeBadge`) plutôt que des `upsert` génériques pour les transitions métier. Séparer `domain model`, `IndexedDB mapper` et `Supabase DTO mapper`. Les nombres Postgres `numeric` doivent être convertis sans perte.

## 9. Centre d'aide et tutoriels intégrés

Chaque module doit avoir un parcours guidé contextuel : objectif, prérequis, étapes, résultat attendu, erreurs fréquentes, droits requis, annulation/retour arrière, captures/illustrations maintenues à jour et scénario de démonstration. Les tutoriels couvriront séjour, groupes, spa, salles, locations, événements, folios, paiements, badges/QR/RFID, matériel, maintenance, housekeeping, stock, rapports et administration. Les contenus seront versionnés et liés aux versions UI ; ne pas documenter une fonctionnalité avant sa disponibilité réelle.

## 10. Critères d'acceptation

- Une unité ne peut pas être réservée deux fois sur des intervalles bloquants.
- Un soin exige cabine + praticien compatibles sur toute la durée avec buffers.
- Une session de conférence réserve salle et équipements sans dépassement de capacité.
- Une fermeture/maintenance bloque toute nouvelle allocation concernée.
- Un bail commercial et un rendez-vous client ont des cycles distincts.
- Un badge expiré/révoqué ou hors zone/horaire est refusé ; chaque décision est auditée.
- Une réémission/révocation de credential est idempotente et propagée aux terminaux connectés.
- En mode offline, les règles de cache et limites de révocation sont affichées aux opérateurs.
- Les charges sont créées une seule fois et rapprochées au folio/facture sans doublon.
- Les données d'un workspace/établissement ne sont jamais visibles depuis un autre.
- Mutation locale + outbox sont atomiques ; crash/relaunch ne perd pas l'opération.
- Les migrations IndexedDB conservent les données existantes et les anciens stores.
- Les tests couvrent la concurrence, RLS, multi-tenant, offline/online, tombstones, conflits, monnaie et adaptateurs hardware simulés.

## 11. Décisions différées qui ne bloquent pas le modèle

Le choix exact des fabricants, modèles de lecteurs/contrôleurs, protocoles et imprimantes est fait au moment des connecteurs, après inventaire du matériel réel et validation des API/SDK disponibles. Les contrats de données restent neutres vis-à-vis des marques. Les normes locales de sécurité incendie, protection des données et facturation doivent être vérifiées avant déploiement opérationnel.
