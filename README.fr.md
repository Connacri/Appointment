# Appointment PMS

**Appointment** est un PMS pour hôtels, résidences et resorts : planning Gantt, réservations, réception, facturation, housekeeping, opérations et gestion des ressources.

- [Application Web](https://connacri.github.io/Appointment/)
- [Releases Windows et Android](https://github.com/Connacri/Appointment/releases)
- [Guide complet en français](./README.md)
- [Manuel hôtel et proUSB](./docs/PROUSB_HOTEL_OPERATIONS_MANUAL.md)

## Cibles

- **Web** : React 19, TypeScript et Vite.
- **Android** : Capacitor 8.
- **Windows Desktop** : Tauri 2, Rust et WebView2. Le programme Windows est un hôte natif ; il ne lance pas Edge. Il peut lire CardLock via le sélecteur natif et stocker les chaînes Neon dans Windows Credential Manager.

## Création d'un hôtel

À la première ouverture, renseignez l'identité de l'établissement, puis choisissez :
1. Importer une base proUSB `CardLock.mdb`, ou
2. Créer les bâtiments, les étages et les chambres manuellement.

La génération de chambres utilise un préfixe et une plage de suffixes. Exemple : préfixe `1`, suffixes `01–30`, exclusion `13` → chambres 101 à 130 sauf 113. L'exclusion 13 est une valeur par défaut modifiable.

Le lecteur CardLock inspecte toutes les tables et affiche leur inventaire. Seules les tables dont le mapping métier est validé alimentent automatiquement les bâtiments, chambres, séjours et cartes.

## Développement

Prérequis : Node.js 22, npm. Pour Windows natif : Rust stable, MSVC et WebView2.

```bash
npm install --legacy-peer-deps
npm run dev
npm run lint
npm run test
npm run tauri:dev
```

La synchronisation bidirectionnelle complète Supabase/Neon n'est pas encore livrée. Un test de connexion Neon réussi confirme uniquement la connectivité PostgreSQL ; il ne confirme pas une synchronisation. Consultez [Architecture](./docs/ARCHITECTURE.md) et [Release Windows](./docs/RELEASE.md).
