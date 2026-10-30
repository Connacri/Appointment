# Changelog

Toutes les modifications notables de **OmniBook / Planning Oran** sont documentées dans ce fichier.

Le format s'inspire de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le projet respecte le [Semantic Versioning](https://semver.org/lang/fr/).

## [Unreleased]

### Added

- **Bouton « Créer la carte client » dans la fiche de réservation** : directement depuis le dialog d'une réservation hôtelière, un bouton encode la carte proUSB pour la chambre et le séjour de la réservation (arrivée 14 h / départ 12 h par défaut). Le bouton indique l'état de l'encodeur USB (connecté / non connecté) et affiche un dialogue système de succès ou une alerte d'échec après chaque tentative.
- **Dialogue système après chaque écriture de carte** : chaque écriture (Invité, fonction, mise en service) affiche désormais un dialogue modal — vert avec la trame, la chambre et la validité en cas de succès ; rouge avec la cause réelle en cas d'échec — au lieu d'un simple toast.
- **Compteur de cartes importé de l'ancienne base** : les colonnes `RoomInfo.CardCount` et `RoomInfo.MaxCards` (compteur de cartes en circulation par chambre du logiciel d'origine) sont maintenant importées avec la base et transportées dans les métadonnées des réservations du planning.
- **Lecture totale de n'importe quelle carte** : le décodeur ne rejette plus rien. Une carte d'un autre système (en-tête `C9 12` absent) est affichée avec ses octets bruts, sans qu'aucun champ ne soit inventé ; une trame courte est complétée et signalée ; les octets `[4..5]`, `[6..8]` et `[13..15]` sont désormais exposés. L'interface affiche un bandeau « autre système », le site, le contrôle `~site`, la liste des anomalies et une table octet par octet.
- **Distinction clé de recherche / ID `CardInfo`** : l'application affichait `Mid(CardData,19,8)` sous l'étiquette « ID », alors que l'ID du logiciel d'origine est l'AutoNumber de `CardInfo`. Les deux valeurs sont maintenant affichées séparément (`Clé de recherche` et `ID dans CardInfo` / `Operator Code`), avec « absent » si la ligne n'existe pas encore.

### Fixed

- **Réservations du Gantt décorrélées des chambres** : `GuestInfo.BldRoomNo` est au format « bâtiment-chambre » (`1-103`) alors que `RoomInfo.RoomNo` est nu (`103`), et les dates `ComeTime`/`GoTime` sont des textes `jj/mm/aaaa hh:mm:ss` non parsables par `new Date()`. La conversion normalise désormais la clé de chambre et parse les dates Access ; les lignes « Copy » d'un même séjour sont fusionnées (durée étendue si besoin) au lieu de dupliquer le même séjour.
- **Lignes mortes dans `CardInfo`** : le script de synchronisation n'insère plus les enregistrements fabriqués par les anciennes versions (`C9 00 … AD DE AD`, tout à zéro) qui ne correspondent à aucune carte physique. Seules les trames réelles (`C9 12 …`) sont écrites. Deux lignes de ce type existaient dans la base vivante (ID 1363 et 1364).
- **Carte système affichée avec une expiration** : l'inspecteur affichait la date de fin (= date d'émission) sur une carte système, alors que ces cartes n'expirent pas. Il affiche maintenant « Émise le » et « Expiration : aucune (carte système) ».
- **ID / Operator Code « absent » alors que la carte existe** : l'instantané `CardLock.mdb` est une photo prise à l'import ; une carte créée ensuite est forcément introuvable. L'inspecteur indique désormais la date de l'instantané et invite à réimporter la base vivante, au lieu d'un « absent » ambigu.
- **Écriture qui ne fonctionnait qu'une seule fois jusqu'au rafraîchissement de la page** : les accusés de réception HID restaient dans la file d'entrée et la lecture de vérification consommait celui de l'écriture précédente. Le transport expose maintenant `drain()`, appelé avant chaque écriture et chaque lecture, et `transact()` ignore les trames plus courtes que 16 octets au lieu de les prendre pour la carte.
- **Message d'écriture inexploitable** : l'erreur « L'écriture n'a pas pu être vérifiée en relecture » indique désormais la trame écrite, la trame relue et la cause réelle (timeout, erreur transport, contenu différent) avec la vérification à effectuer.
- **Import de l'ancienne base vers le planning/Gantt** : l'import de `CardLock.mdb` propose maintenant d'importer aussi les chambres (bâtiments → groupes, chambres → ressources) et les séjours clients (comeTime/goTime → réservations) dans le planning/Gantt, afin de ne pas repartir d'une base vide. Les cartes restent disponibles pour l'ID/Operator Code.

- **ID et Operator Code absents dans `CardLock.exe`** : la base réellement utilisée par le logiciel d'origine est celle du **VirtualStore** (`%LOCALAPPDATA%\VirtualStore\Program Files (x86)\…\CardLock.mdb`), car Windows virtualise les écritures des applications 32 bits installées sous `Program Files (x86)`. La copie de `Program Files` était figée depuis 2023 (62 cartes) alors que la copie vivante en contenait 88. Le script **Synchroniser CardLock.mdb** détecte maintenant la base vivante à l'exécution (copie la plus récente, option `--mdb` pour forcer), ne demande plus d'élévation pour le VirtualStore, avertit si `CardLock.exe` est encore ouvert, **relit chaque ligne** et affiche l'`ID` et l'`Operator Code` obtenus. L'écran d'import et la documentation pointent vers la base vivante.

## [1.2.0] - 2026-10-24

### Added

- **Hard Reset Persistant** : Nouvelle carte de sécurité admin (double round, marqueurs 0xAD/0xDE, double confirmation)
- **Panneau de sécurité** : Onglet dédié dans l'interface proUSB avec stats et gestion des données
- **Création automatique de cartes** : Émission automatique lors de la création d'une réservation hôtel
- **Persistance localStorage** : Cartes émises, audit, paramètres survivent au rechargement
- **Amélioration WebHID** : Re-enumeration, timeout 5s, retry automatique, gestion déconnexion

### Changed

- **Transport** : Timeout par défaut augmenté à 5s, délai de 50ms après envoi
- **LockManager** : Utilisation de transact() pour readCurrentCard et writeAndVerifyCard
- **UI** : 7 onglets au lieu de 6 (ajout Sécurité)

## [1.1.0] - 2026-10-24

### Added

- **proUSB Database Integration** : Module `MdbReader` pour lire la base de données `CardLock.mdb` (Access/Jet) avec types complets et données mock correspondant aux résultats du reverse engineering.
- **proUSB Technical Specification** : Document complet `docs/PROUSB_SPECIFICATION.md` couvrant les 13 familles de cartes, le protocole HID, le schéma MDB, les limites et contraintes.
- **Card Limits Documentation** : Tableau détaillé des limites de chaque type de carte, des contraintes temporelles, de la mémoire d'audit, de l'encodeur USB, et des rôles opérateurs.

### Changed

- **LockManager** : Chargement automatique des données MDB au démarrage (cartes émises, journal d'audit, paramètres système).
- **ProUsbLockSystemView** : Correction des erreurs TypeScript (`unitName` → `resourceName`, imports `fromHex`).
- **Codec** : Ajout du type `'reset'` dans `EncodeCommissioningCardParams`.

### Fixed

- **TypeScript** : Résolution de toutes les erreurs de compilation (`tsc --noEmit` passe sans erreur).
- **CI/CD** : Vérification que le workflow construit et publie correctement les artefacts signés (APK, AAB, EXE, ZIP).

## [1.0.8] - 2026-10-12

### Fixed

- **Artefacts de release désormais versionnés** (`Planning-Oran-vX.Y.Z.apk`, `-vX.Y.Z.aab`, launcher Windows, installeur Inno Setup, archive web). Les anciens noms codés en dur (`Planning-Oran-release.apk`, `Planning-Oran-v1.0.0.exe`, `Planning-Oran-Windows-v1.0.0.zip`) laissaient croire que la dernière version n'était pas publiée.
- Version réellement injectée dans le launcher Windows (`AssemblyVersion` / `FileVersion`), dans l'installeur Inno Setup (`/DAppVersion`) et dans le manifeste Android (`versionName` / `versionCode`).
- Titre de la GitHub Release aligné sur le tag (`vX.Y.Z`) et notes de version générées depuis la section correspondante de `CHANGELOG.md`.
- `fail_on_unmatched_files` activé : la publication échoue désormais explicitement si un artefact attendu est absent (fini les copies silencieuses `|| true`).
- Vérification cryptographique de la signature Android rendue bloquante (`apksigner` pour l'APK, `jarsigner` pour l'AAB) avec contrôle de l'empreinte `UPLOAD_CERT_SHA256`.

### Added

- Archive web versionnée `web-build-vX.Y.Z.zip` publiée dans la release.
- Fichier de mapping R8 `mapping-vX.Y.Z.txt` publié dans la release (analyse des rapports de crash).

## [1.0.7] - 2026-10-12

### Changed

- Icône de l'application et écran de démarrage natif (splash) Android régénérés à partir de la nouvelle image fournie (`assets/icon.png`, mode Easy Mode `@capacitor/assets`) : icône adaptative, icône ronde et déclinaisons mipmap, splash portrait/paysage clair + sombre (`night`).

## [1.0.6] - 2026-10-08

### Fixed

- Chemin de base relatif des assets pour le paquet desktop Windows (WebView).
- URL de secours (fallback) corrigée dans le lanceur Windows.

## [1.0.5] - 2026-10-08

### Added

- Renommage de l'application en **OmniBook** (`strings.xml`, config Capacitor, titre HTML).
- Génération des assets Capacitor (icônes / splash) et upload Play Store optionnel.
- Génération des icônes et de l'écran de démarrage natifs via `@capacitor/assets`.

### Fixed

- Chemin de base Vite pour le sous-répertoire GitHub Pages + mise à jour des liens du README.
- Corrections de texte (mojibake) dans le README.

## [1.0.4] - 2026-10-07

### Fixed

- Chemins de copie des artefacts de release corrigés et workflow assaini.

## [1.0.3] - 2026-10-07

### Changed

- Passage à JDK 21 pour les builds Capacitor 8 (CI).

## [1.0.2] - 2026-10-07

### Added

- Projet Android Capacitor pour de véritables builds signés APK / AAB (`android/`).

### Fixed

- Parsing robuste de `versionCode` / `versionName` dans `app/build.gradle`.
- Chemins Gradle Android réels et signature de release explicite basée sur les variables d'environnement.

## [1.0.1] - 2026-10-07

### Fixed

- Chemin de copie des artefacts Android corrigé dans le job de release (CI).

## [1.0.0] - 2026-10-07

### Added

- Version initiale : planning Gantt multi-secteurs (hôtellerie, clinique, restauration, spa), channel manager OTA (XML / iCal), pipeline CI/CD multicouche (Android APK/AAB signés, Windows EXE, Web sur GitHub Pages), trilingue fr/en/ar avec RTL, pages légales `/privacy/` et `/delete-account/`.

[Unreleased]: https://github.com/Connacri/Appointment/compare/v1.0.8...HEAD
[1.0.8]: https://github.com/Connacri/Appointment/compare/v1.0.7...v1.0.8
[1.0.7]: https://github.com/Connacri/Appointment/compare/v1.0.6...v1.0.7
[1.0.6]: https://github.com/Connacri/Appointment/compare/v1.0.5...v1.0.6
[1.0.5]: https://github.com/Connacri/Appointment/compare/v1.0.4...v1.0.5
[1.0.4]: https://github.com/Connacri/Appointment/compare/v1.0.3...v1.0.4
[1.0.3]: https://github.com/Connacri/Appointment/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/Connacri/Appointment/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/Connacri/Appointment/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/Connacri/Appointment/releases/tag/v1.0.0