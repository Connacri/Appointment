<div align="center">

<img src="./docs/assets/appointment-pms-banner.svg" width="100%" alt="Appointment PMS — Hotel and Resort Management" />

<a href="https://github.com/Connacri/Appointment">
  <img src="https://readme-typing-svg.demolab.com?font=Plus+Jakarta+Sans&weight=600&size=20&duration=2800&pause=900&color=2563EB&center=true&vCenter=true&width=760&lines=Planifier+les+s%C3%A9jours+avec+une+timeline+Gantt;Piloter+les+op%C3%A9rations+h%C3%B4teli%C3%A8res+au+m%C3%AAme+endroit;G%C3%A9rer+les+r%C3%A9servations%2C+les+%C3%A9quipes+et+les+revenus;Connecter+les+serrures+proUSB+et+les+cartes+clients" alt="Animated Appointment PMS feature highlights" />
</a>

<br />

[![Build & Deploy](https://img.shields.io/github/actions/workflow/status/Connacri/Appointment/release-and-deploy.yml?branch=main&label=build%20%26%20deploy&logo=githubactions)](https://github.com/Connacri/Appointment/actions/workflows/release-and-deploy.yml)
[![Version](https://img.shields.io/badge/version-1.2.0-2563EB?logo=semver)](https://github.com/Connacri/Appointment/releases)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=111827)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![Capacitor](https://img.shields.io/badge/Capacitor-8-119EFF?logo=capacitor&logoColor=white)](https://capacitorjs.com/)
[![Languages](https://img.shields.io/badge/Languages-FR%20%7C%20EN%20%7C%20AR-0F766E)](https://github.com/Connacri/Appointment)

**Un PMS hôtelier et resort conçu pour centraliser les réservations et les opérations quotidiennes.**

[Application Web](https://connacri.github.io/Appointment/) · [Téléchargements](https://github.com/Connacri/Appointment/releases) · [Signaler un problème](https://github.com/Connacri/Appointment/issues)

</div>

---

## Présentation

**Appointment PMS** est une application de gestion hôtelière (Property Management System) orientée **hôtels, résidences et resorts**. Elle rassemble dans une interface unique le planning des chambres et unités, le suivi des séjours, les opérations de réception, la facturation et les tâches d'exploitation.

L'interface est construite avec React 19 et TypeScript. Elle fonctionne comme application web et s'appuie sur Capacitor pour la cible Android. Une chaîne GitHub Actions est également configurée pour construire et publier les artefacts Web, Android et Windows.

> **Périmètre actuel :** les domaines métier actifs dans le code sont Hôtel et Resort. Les modules de canaux OTA et de serrures proUSB disposent d'interfaces et de fonctionnalités dédiées ; la présence d'un module ne signifie pas qu'un fournisseur externe ou un service cloud est automatiquement connecté.

## Aperçu des modules

| Module | Ce qu'il permet de faire |
|---|---|
| **Planning Gantt** | Visualiser les réservations sur une timeline, naviguer par date, ajuster le zoom et consulter les unités disponibles. |
| **Réservations & séjours** | Créer, modifier et suivre les dossiers clients, les dates, les occupants, les statuts et les paiements. |
| **Établissements & ressources** | Organiser les chambres et unités par établissement, domaine et catégorie. |
| **Housekeeping** | Suivre les états des chambres : propre, en nettoyage, sale ou hors service. |
| **Facturation & devis** | Préparer les documents commerciaux et suivre les montants, acomptes, soldes et moyens de paiement. |
| **Analytics & rapports** | Consulter les indicateurs de réservation et les vues de reporting disponibles dans l'application. |
| **Tâches opérationnelles** | Organiser les tâches des équipes, les statuts et les sous-tâches de service. |
| **Stock & équipements** | Gérer les articles, les quantités et les mouvements de stock. |
| **Tarification dynamique** | Définir et appliquer des tarifs par type de ressource et par date. |
| **Channel Manager** | Accéder à l'espace de gestion des canaux et aux outils de configuration/visualisation des échanges OTA et iCal. Les connexions réelles dépendent des intégrations effectivement configurées. |
| **Serrures proUSB** | Utiliser les fonctions dédiées aux encodeurs compatibles, aux cartes et à l'import/analyse de données CardLock MDB. |

## Fonctionnalités transversales

- **Multi-établissements** : sélection et gestion du contexte de l'établissement.
- **Rôles applicatifs** : manager, réceptionniste, personnel et client, avec navigation adaptée au rôle et au domaine.
- **Multilingue** : français, anglais et arabe, avec prise en charge RTL pour l'arabe.
- **Thème clair et sombre**.
- **Expérience mobile** : navigation adaptée aux petits écrans et fiche de réservation tactile.
- **QR** : génération/affichage de pass et lecture via les vues dédiées.
- **Mode hors ligne** : indicateur de connectivité et persistance locale via ObjectBox/IndexedDB avec mécanisme de repli local.
- **Retour audio et haptique** pour certaines interactions.
- **Exports** : génération de documents PDF et export iCalendar (.ics) selon les modules.

## Architecture technique

| Couche | Technologies |
|---|---|
| Interface | React 19, TypeScript, Tailwind CSS 4 |
| Build & développement | Vite 8 |
| Visualisation | D3 |
| Animations UI | Motion |
| Icônes | Lucide React |
| Stockage local | IndexedDB via le module ObjectBox, avec fallback local |
| Mobile Android | Capacitor 8 |
| Serrures & données cartes | WebHID / USB, `mdb-reader`, QR Code |
| Qualité | TypeScript, tests Node.js |
| Livraison | GitHub Actions, GitHub Pages, artefacts Android et Windows |

### État des données et synchronisation

La version actuelle utilise principalement un stockage local dans le navigateur/appareil. **La synchronisation Supabase distante n'est pas encore implémentée dans cette branche** : aucun client Supabase, schéma distant ni moteur de synchronisation n'est livré actuellement. Le document [SUPABASE_SYNC_PLAN.md](./docs/SUPABASE_SYNC_PLAN.md) décrit les prérequis et l'architecture envisagée.

## Démarrage rapide

### Prérequis

- Node.js 22 recommandé
- npm
- Android Studio + Android SDK uniquement pour compiler la cible Android

### Installation

```bash
git clone https://github.com/Connacri/Appointment.git
cd Appointment
npm install
```

### Développement

```bash
npm run dev
```

Vite démarre le serveur sur le port **3000**.

### Vérification et build

```bash
# Vérification TypeScript
npm run lint

# Tests automatisés
npm test

# Build de production
npm run build

# Prévisualisation du build
npm run preview
```

### Android

Le projet utilise Capacitor. Après le build Web, synchronisez les ressources puis ouvrez le projet Android :

```bash
npm run build
npx cap sync android
npx cap open android
```

La signature de production dépend des secrets et variables configurés dans GitHub Actions. Ne placez jamais de clés privées ou de mots de passe de signature dans le dépôt.

## Déploiement et téléchargements

- **Web** : [ouvrir Appointment PMS](https://connacri.github.io/Appointment/)
- **Android / Windows** : consulter la [page des Releases](https://github.com/Connacri/Appointment/releases).
- **CI/CD** : suivre les [workflows GitHub Actions](https://github.com/Connacri/Appointment/actions).

Les fichiers téléchargeables et leurs versions sont ceux réellement publiés dans les Releases. Le README ne fixe volontairement pas de noms d'artefacts ou de numéros de version historiques.

## Confidentialité et sécurité

- Les données de réservation et les informations personnelles doivent être traitées comme des données sensibles.
- Ne commitez jamais de secrets, clés privées, mots de passe ou fichiers de données clients.
- Les clés privilégiées ne doivent jamais être intégrées dans le bundle Web ou l'application mobile.
- Consultez la [politique de confidentialité](https://connacri.github.io/Appointment/privacy/) et la [procédure de suppression de compte](https://connacri.github.io/Appointment/delete-account/).

## Documentation du dépôt

- [Contrat et consignes de développement](./AGENTS.md)
- [Plan de synchronisation Supabase](./docs/SUPABASE_SYNC_PLAN.md)
- [Spécification du système proUSB](./docs/PROUSB_SPECIFICATION.md)
- [Guide des cartes](./README_CARDS.md)
- [Cartes système](./README_SYSTEM_CARD.md)
- [Journal des modifications](./CHANGELOG.md)

## Contribution

Les contributions et retours sont les bienvenus. Pour signaler un bug ou proposer une amélioration, ouvrez une [issue](https://github.com/Connacri/Appointment/issues) en précisant les étapes pour reproduire le problème, le résultat attendu et le résultat obtenu.

---

<div align="center">

**Appointment PMS — Simplifier la gestion, fluidifier les séjours.**

<a href="https://github.com/Connacri/Appointment">GitHub Repository</a> · <a href="https://github.com/Connacri/Appointment/releases">Releases</a>

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:06B6D4,55:1D4ED8,100:0F172A&height=100&section=footer" width="100%" alt="" />

</div>
