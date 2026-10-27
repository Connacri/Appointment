# OmniBook / Planning Oran — Planning de Réservation Hôtellerie, Clinique & Rendez-vous

[![CI / Release](https://img.shields.io/badge/CI%2FCD-Verified%20Green-emerald)](https://github.com/Connacri/Appointment/actions)
[![Release](https://img.shields.io/badge/release-v1.0.8-blue)](https://github.com/Connacri/Appointment/releases)
[![Package](https://img.shields.io/badge/Android%20Package-com.planning.oran-teal)](https://github.com/Connacri/Appointment)
[![Platforms](https://img.shields.io/badge/Platforms-Android%20%7C%20Windows%20EXE%20%7C%20Web-orange)](https://github.com/Connacri/Appointment)
[![Languages](https://img.shields.io/badge/languages-fr%20%7C%20en%20%7C%20ar%20(RTL)-purple)](https://github.com/Connacri/Appointment)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Système de réservation et de planning type Gantt / Front Desk pour l'hôtellerie, les résidences, les cabinets médicaux et les services sur rendez-vous, conçu selon le contrat opérationnel strict **AGENTS.md**.
> **Package ID Android** : `com.planning.oran`

🌐 [Live Web Application](https://connacri.github.io/Appointment/)  
📱 [Android APK & AAB Releases](https://github.com/Connacri/Appointment/releases)  
🪟 [Windows Executable (.exe)](https://github.com/Connacri/Appointment/releases)  
🔒 [Privacy Policy / Politique de Confidentialité](https://connacri.github.io/Appointment/privacy/)  
🗑️ [Delete Account & Personal Data / Suppression de Compte](https://connacri.github.io/Appointment/delete-account/)

### Artefacts de la dernière release (tous versionnés)

| Fichier | Description |
|---|---|
| `Planning-Oran-v1.0.8.apk` | Android — APK signé, installation directe |
| `Planning-Oran-v1.0.8.aab` | Android App Bundle — Google Play |
| `Planning-Oran-Setup-Inno-v1.0.8.exe` | Windows — installeur Inno Setup |
| `Planning-Oran-Setup-v1.0.8.exe` | Windows — launcher portable |
| `Planning-Oran-Windows-v1.0.8.zip` | Windows — paquet portable complet |
| `web-build-v1.0.8.zip` | Build web statique (GitHub Pages) |
| `mapping-v1.0.8.txt` | Symboles R8 pour l'analyse des rapports de crash |
| `SHA256SUMS.txt` | Sommes de contrôle SHA-256 |

---

## Fonctionnalités Clés

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

- **Système de Serrures proUSB (encodage de cartes & import du logiciel d'origine)** :
  - Connexion automatique de l'encodeur **proUSB-TEMIC** en USB (WebHID, PC et Android USB-C), sans passerelle ni pilote.
  - **Import du vrai `CardLock.mdb`** : l'app lit directement la base Access du logiciel d'origine (chambres, clients, cartes, journal des ouvertures) et réutilise le **code site réel** de l'installation.
  - **Format de carte extrait du code d'origine** (`proRFL.dll`, fonction `ResetCard`) et confirmé sur 62 enregistrements réels : site big-endian, complément `~site`, dates avec fenêtre glissante de 16 ans (plus de `2010` au lieu de `2026`).
  - **Lecture exacte** : chaque famille a son propre layout (client / master / système) ; une carte système n'affiche plus de fausse date d'expiration et une date invalide n'est plus remplacée par le 1er janvier.
  - Cartes système (`Reset`, `Hard Reset`) **réellement écrites** puis relues pour vérification — acceptées par `CardLock.exe` et par les serrures.
  - **Carte système universelle** (site `0000`, octets `00 00 FF FF`) : réinitialise une serrure même si elle appartient à un autre système — même convention wildcard que les cartes maîtresses du logiciel d'origine.
  - **ID & Operator Code** : ces deux champs du logiciel d'origine ne sont pas gravés sur la carte (16 octets seulement) mais vivent dans `CardInfo` (`ID` AutoNumber, `GongHao`). L'app calcule l'ID (`Mid(CardData,19,8)`), affiche le badge `MDB` / `à sync` et génère un script Windows autonome (**Synchroniser CardLock.mdb**) qui insère les cartes manquantes avec sauvegarde et restauration automatiques.
  - Cartes client / personnel / groupe générées depuis le planning Gantt, avec durée de validité et règles métier hôtelières.
  - Documentation : [`README_SYSTEM_CARD.md`](./README_SYSTEM_CARD.md) (carte système) et [`README_CARDS.md`](./README_CARDS.md) (différences entre tous les rôles).

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

## Démarrage Rapide

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

## Données Personnelles et Contact DPO

- **Entité responsable** : OmniBook Software Engineering Lab
- **Délégué à la Protection des Données (DPO)** : Ramzi Guedouar (`ramzi.guedouar@gmail.com`)
- **Droit à l'effacement** : accessible directement dans l'application ou sur [/delete-account/](https://connacri.github.io/Appointment/delete-account/).

---

## Licence

Ce projet est sous licence MIT.
