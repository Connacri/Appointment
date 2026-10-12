# Changelog

Toutes les modifications notables de **OmniBook / Planning Oran** sont documentées dans ce fichier.

Le format s'inspire de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le projet respecte le [Semantic Versioning](https://semver.org/lang/fr/).

## [Unreleased]

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

[Unreleased]: https://github.com/Connacri/Appointment/compare/v1.0.7...HEAD
[1.0.7]: https://github.com/Connacri/Appointment/compare/v1.0.6...v1.0.7
[1.0.6]: https://github.com/Connacri/Appointment/compare/v1.0.5...v1.0.6
[1.0.5]: https://github.com/Connacri/Appointment/compare/v1.0.4...v1.0.5
[1.0.4]: https://github.com/Connacri/Appointment/compare/v1.0.3...v1.0.4
[1.0.3]: https://github.com/Connacri/Appointment/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/Connacri/Appointment/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/Connacri/Appointment/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/Connacri/Appointment/releases/tag/v1.0.0