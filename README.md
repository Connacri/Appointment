# OmniBook / Planning Oran — Planning de Réservation Hôtellerie, Clinique & Rendez-vous

[![CI / Release](https://img.shields.io/badge/CI%2FCD-Verified%20Green-emerald)](https://github.com)
[![Release](https://img.shields.io/badge/release-v1.0.0-blue)](https://github.com)
[![Package](https://img.shields.io/badge/Android%20Package-com.planning.oran-teal)](https://github.com)
[![Platforms](https://img.shields.io/badge/Platforms-Android%20%7C%20Windows%20EXE%20%7C%20Web-orange)](https://github.com)
[![Languages](https://img.shields.io/badge/languages-fr%20%7C%20en%20%7C%20ar%20(RTL)-purple)](https://github.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Système de réservation et de planning type Gantt / Front Desk pour l'hôtellerie, les résidences, les cabinets médicaux et les services sur rendez-vous, conçu selon le contrat opérationnel strict **AGENTS.md**.
> **Package ID Android** : `com.planning.oran`

🌐 [Live Web Application](https://samuel69tr00.github.io/Appointment/)  
📱 [Android APK & AAB Releases](https://github.com/Samuel69tr00/Appointment/releases)  
🪟 [Windows Executable (.exe)](https://github.com/Samuel69tr00/Appointment/releases)  
🔒 [Privacy Policy / Politique de Confidentialité](/privacy/)  
🗑️ [Delete Account & Personal Data / Suppression de Compte](/delete-account/)  

---

## 🌟 Fonctionnalités Clés

- **Planning Gantt Multi-Secteurs & Timeline Interactive Ultra-Responsive** :
  - **Adaptation Mobile & Tablettes** : Mode de largeur Colonne Ressources réglable (**Mini** pour gain maximal de timeline sur smartphone, **Compact**, **Complet**).
  - **Zoom dynamique de colonnes** (*Étroit*, *Normal*, *Large*) et saut direct à n'importe quelle date via sélecteur intégré.
  - **Fiche Tactile Bas d'Écran (Mobile Touch Sheet)** au tap sur les barres de réservation.
  - **Hôtellerie & Résidences** : Chambres simples, doubles, suites de prestige, suivi du statut de ménage (*clean, cleaning, dirty, out of order*).
  - **Clinique & Santé** : Cabinets médicaux, praticiens, consultations présentielles et téléconsultations.
  - **Restauration & Spa** : Tables de salle, cabines de soins et bien-être.

- **Channel Manager & Centre d'Alertes OTA Intégré** :
  - Synchronisation 2-Way XML & flux iCal (.ics) avec Booking.com, Airbnb, Expedia, Agoda, Doctolib et TheFork.
  - **Résolution Guidée des Conflits & Surréservations** (Réassignation automatique, surclassement offert, ou annulation sans frais).
  - **Comparateur de Parité Tarifaire & Marges Nettes** : simulation en temps réel des commissions OTA vs Ventes Directes.
  - Connexion de nouveaux canaux et configuration du mappage unité par unité.
  - Journal temps réel des requêtes et webhooks XML/iCal entrants et sortants.

- **Pipeline CI/CD Automatisé Multi-Plateforme (`.github/workflows/release-and-deploy.yml`)** :
  - **Android** : Génération et signature cryptographique de l'**APK** et de l'**AAB** pour le package `com.planning.oran`.
  - **Windows** : Compilation et signature Authenticode de l'exécutable desktop Windows (`Planning-Oran-Setup.exe`).
  - **Web** : Déploiement continu et automatique du site web de production sur **GitHub Pages**.
  - Génération des sommes de contrôle de sécurité `SHA256SUMS.txt`.

- **Conformité Totale AGENTS.md & Play Store** :
  - Support trilingue complet (**Français**, **English**, **العربية** avec disposition bidirectionnelle RTL native `dir="rtl"`).
  - Pages légales obligatoires conformes (§19.3) sous `/privacy/` et `/delete-account/`.
  - Score de Santé (Health Scorecard) à **100/100 points** (`docs/HEALTH.md`).

---

## 🚀 Démarrage Rapide

```bash
# Installation des dépendances
npm install

# Lancement du serveur de développement (Port 3000)
npm run dev

# Vérification TypeScript et Lint
npm run lint

# Compilation de production
npm run build
```

---

## 🛡️ Données Personnelles et Contact DPO

- **Entité responsable** : OmniBook Software Engineering Lab
- **Délégué à la Protection des Données (DPO)** : Ramzi Guedouar (`ramzi.guedouar@gmail.com`)
- **Droit à l'effacement** : accessible directement dans l'application ou sur [/delete-account/](/delete-account/).

---

## 📄 Licence

Ce projet est sous licence MIT.
