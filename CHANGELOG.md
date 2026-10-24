# Changelog

Toutes les modifications notables de **OmniBook / Planning Oran** sont documentées dans ce fichier.

Le format s'inspire de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le projet respecte le [Semantic Versioning](https://semver.org/lang/fr/).

## [Unreleased]

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