# OmniBook — Planning de Réservation Hôtellerie, Clinique & Rendez-vous

[![CI / Release](https://img.shields.io/badge/CI%2FCD-Verified%20Green-emerald)](https://github.com)
[![Release](https://img.shields.io/badge/release-v1.0.0-blue)](https://github.com)
[![Languages](https://img.shields.io/badge/languages-fr%20%7C%20en%20%7C%20ar%20(RTL)-purple)](https://github.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Système de réservation et de planning type Gantt / Front Desk pour l'hôtellerie, les cabinets médicaux et les services sur rendez-vous, conçu selon le contrat opérationnel strict **AGENTS.md**.

🌐 [Live Web Application](https://ais-dev-lqb7e4mpz3y2nxvfbt7a3p-22126395857.europe-west1.run.app)  
🔒 [Privacy Policy / Politique de Confidentialité](/privacy/)  
🗑️ [Delete Account & Personal Data / Suppression de Compte](/delete-account/)  

---

## 🌟 Fonctionnalités Clés

- **Planning Gantt Multi-Secteurs & Timeline Interactive** :
  - **Hôtellerie** : Chambres simples (101-104), Chambres doubles (201-203), Suites de prestige (301-303). Suivi du statut de ménage (*clean, cleaning, dirty, out of order*).
  - **Clinique & Santé** : Cabinets de cardiologie, dermatologie, pédiatrie, médecine générale et salles de soins.
  - **Autres RDV** : Massages et soins spa, salons de conseil et espaces de travail privatifs.
- **Visualisation de Disponibilité en Temps Réel** :
  - Badges quotidiens de chambres libres (`[2]`, `[0]`) par catégorie.
  - Barres de réservation horizontales par statut (*New, Confirmed, Due In, Checked In, Due Out, Checked Out, Booking Offer*).
  - Info-bulle interactive avec calcul automatique des nuits et des montants.
- **Export & Synchronisation Calendrier** :
  - Génération et téléchargement instantané d'événements `.ics` compatibles Google Calendar, Apple Calendar et Outlook.
- **Conformité Totale AGENTS.md & Play Store** :
  - Support trilingue complet (**Français**, **English**, **العربية** avec disposition bidirectionnelle RTL native `dir="rtl"`).
  - Thème Sombre & Clair persistant.
  - Mode hors-ligne résilient avec simulateur de déconnexion réseau.
  - Pages légales obligatoires (`/privacy/` et `/delete-account/`) et purge in-app des données utilisateur.
  - Cockpit de contrôle avec Score de Santé (Health Scorecard) à **98/100 points**.

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
