# OmniBook / Planning Oran â€” Planning de RÃ©servation HÃ´tellerie, Clinique & Rendez-vous

[![CI / Release](https://img.shields.io/badge/CI%2FCD-Verified%20Green-emerald)](https://github.com)
[![Release](https://img.shields.io/badge/release-v1.0.4-blue)](https://github.com)
[![Package](https://img.shields.io/badge/Android%20Package-com.planning.oran-teal)](https://github.com)
[![Platforms](https://img.shields.io/badge/Platforms-Android%20%7C%20Windows%20EXE%20%7C%20Web-orange)](https://github.com)
[![Languages](https://img.shields.io/badge/languages-fr%20%7C%20en%20%7C%20ar%20(RTL)-purple)](https://github.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> SystÃ¨me de rÃ©servation et de planning type Gantt / Front Desk pour l'hÃ´tellerie, les rÃ©sidences, les cabinets mÃ©dicaux et les services sur rendez-vous, conÃ§u selon le contrat opÃ©rationnel strict **AGENTS.md**.
> **Package ID Android** : `com.planning.oran`

ðŸŒ [Live Web Application](https://connacri.github.io/Appointment/)  
ðŸ“± [Android APK & AAB Releases](https://github.com/Connacri/Appointment/releases)  
ðŸªŸ [Windows Executable (.exe)](https://github.com/Connacri/Appointment/releases)  
ðŸ”’ [Privacy Policy / Politique de ConfidentialitÃ©](https://connacri.github.io/Appointment/privacy/)  
ðŸ—‘ï¸ [Delete Account & Personal Data / Suppression de Compte](https://connacri.github.io/Appointment/delete-account/)  

---

## ðŸŒŸ FonctionnalitÃ©s ClÃ©s

- **Planning Gantt Multi-Secteurs & Timeline Interactive Ultra-Responsive** :
  - **Adaptation Mobile & Tablettes** : Mode de largeur Colonne Ressources rÃ©glable (**Mini** pour gain maximal de timeline sur smartphone, **Compact**, **Complet**).
  - **Zoom dynamique de colonnes** (*Ã‰troit*, *Normal*, *Large*) et saut direct Ã  n'importe quelle date via sÃ©lecteur intÃ©grÃ©.
  - **Fiche Tactile Bas d'Ã‰cran (Mobile Touch Sheet)** au tap sur les barres de rÃ©servation.
  - **HÃ´tellerie & RÃ©sidences** : Chambres simples, doubles, suites de prestige, suivi du statut de mÃ©nage (*clean, cleaning, dirty, out of order*).
  - **Clinique & SantÃ©** : Cabinets mÃ©dicaux, praticiens, consultations prÃ©sentielles et tÃ©lÃ©consultations.
  - **Restauration & Spa** : Tables de salle, cabines de soins et bien-Ãªtre.

- **Channel Manager & Centre d'Alertes OTA IntÃ©grÃ©** :
  - Synchronisation 2-Way XML & flux iCal (.ics) avec Booking.com, Airbnb, Expedia, Agoda, Doctolib et TheFork.
  - **RÃ©solution GuidÃ©e des Conflits & SurrÃ©servations** (RÃ©assignation automatique, surclassement offert, ou annulation sans frais).
  - **Comparateur de ParitÃ© Tarifaire & Marges Nettes** : simulation en temps rÃ©el des commissions OTA vs Ventes Directes.
  - Connexion de nouveaux canaux et configuration du mappage unitÃ© par unitÃ©.
  - Journal temps rÃ©el des requÃªtes et webhooks XML/iCal entrants et sortants.

- **Pipeline CI/CD AutomatisÃ© Multi-Plateforme (`.github/workflows/release-and-deploy.yml`)** :
  - **Android** : GÃ©nÃ©ration et signature cryptographique de l'**APK** et de l'**AAB** pour le package `com.planning.oran`.
  - **Windows** : Compilation et signature Authenticode de l'exÃ©cutable desktop Windows (`Planning-Oran-Setup.exe`).
  - **Web** : DÃ©ploiement continu et automatique du site web de production sur **GitHub Pages**.
  - GÃ©nÃ©ration des sommes de contrÃ´le de sÃ©curitÃ© `SHA256SUMS.txt`.

- **ConformitÃ© Totale AGENTS.md & Play Store** :
  - Support trilingue complet (**FranÃ§ais**, **English**, **Ø§Ù„Ø¹Ø±Ø¨ÙŠØ©** avec disposition bidirectionnelle RTL native `dir="rtl"`).
  - Pages lÃ©gales obligatoires conformes (Â§19.3) sous `/privacy/` et `/delete-account/`.
  - Score de SantÃ© (Health Scorecard) Ã  **100/100 points** (`docs/HEALTH.md`).

---

## ðŸš€ DÃ©marrage Rapide

```bash
# Installation des dÃ©pendances
npm install

# Lancement du serveur de dÃ©veloppement (Port 3000)
npm run dev

# VÃ©rification TypeScript et Lint
npm run lint

# Compilation de production
npm run build
```

---

## ðŸ›¡ï¸ DonnÃ©es Personnelles et Contact DPO

- **EntitÃ© responsable** : OmniBook Software Engineering Lab
- **DÃ©lÃ©guÃ© Ã  la Protection des DonnÃ©es (DPO)** : Ramzi Guedouar (`ramzi.guedouar@gmail.com`)
- **Droit Ã  l'effacement** : accessible directement dans l'application ou sur [/delete-account/](https://connacri.github.io/Appointment/delete-account/).

---

## ðŸ“„ Licence

Ce projet est sous licence MIT.
