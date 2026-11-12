# Changelog

Toutes les modifications notables de **Appointment PMS** sont documentées dans ce fichier.

Le format s'inspire de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le projet respecte le [Semantic Versioning](https://semver.org/lang/fr/).

## [Unreleased]

### Added

- **Parité des traductions en CI (`npm run i18n:check`)** : nouveau script `scripts/check-i18n.ts` qui vérifie que chaque clé de `src/i18n/translations.ts` possède une valeur `fr`, `en` et `ar` non vide, qu'aucune langue non supportée n'est déclarée et que les placeholders d'interpolation sont identiques dans les trois langues. Le contrôle est exécuté dans le workflow de qualité (job *Regression tests*), donc une traduction manquante bloque la merge. 111 clés × 3 langues vérifiées.
- **Documentation d'architecture et d'i18n** : `docs/ARCHITECTURE.md` (coque applicative, carte des sources, découpage en chunks, flux de données locales/distantes, carte matérielle WebHID) et `docs/I18N.md` (contrat des clés, placeholders, règles RTL, procédure d'ajout) complètent `docs/RELEASE.md`.

- **Identification réelle de l'encodeur USB (`IniCard` mode 2)** : l'application interroge l'encodeur (`AA 01 56 FD`, complété par des `0xCC`), analyse le bloc d'identification renvoyé par le matériel et affiche le numéro d'encodeur (`Reader_000016`, format `%.6d` de CardLock) ainsi que le **machine code** du lecteur (« Current Reader No. » : octets 5..8 du rapport, par exemple `5012 14D2`). Le préfixe `50 12` est constant pour toutes les familles proUSB/M9/proEM ; les octets suivants identifient le lecteur et changent avec lui. La valeur est visible dans le bandeau USB, la fiche encodeur et le journal HID.
- **Bâtiments et étages réels dans les cartes Étage / Bâtiment** : les sélecteurs ne proposent plus de valeurs inventées (`Bâtiment Principal`, `Étage 1` à `6` en dur). Ils listent les vrais bâtiments et étages de la base `CardLock.mdb` importée (`RoomInfo.BldNo` / `RoomInfo.FlrNo` + noms `BuildingInfo`), avec repli sur les chambres du planning quand aucune base n'est chargée. Une sélection devenue invalide après un import est réalignée automatiquement sur la première valeur existante. Les mêmes sélecteurs alimentent l'Étape 2 du mise en service (Room Set).
- **Bouton « Créer la carte client » dans la fiche de réservation** : directement depuis le dialog d'une réservation hôtelière, un bouton encode la carte proUSB pour la chambre et le séjour de la réservation (arrivée 14 h / départ 12 h par défaut). Le bouton indique l'état de l'encodeur USB (connecté / non connecté) et affiche un dialogue système de succès ou une alerte d'échec après chaque tentative.
- **Dialogue système après chaque écriture de carte** : chaque écriture (Invité, fonction, mise en service) affiche désormais un dialogue modal — vert avec la trame, la chambre et la validité en cas de succès ; rouge avec la cause réelle en cas d'échec — au lieu d'un simple toast.
- **Compteur de cartes importé de l'ancienne base** : les colonnes `RoomInfo.CardCount` et `RoomInfo.MaxCards` (compteur de cartes en circulation par chambre du logiciel d'origine) sont maintenant importées avec la base et transportées dans les métadonnées des réservations du planning.
- **Lecture totale de n'importe quelle carte** : le décodeur ne rejette plus rien. Une carte d'un autre système (en-tête `C9 12` absent) est affichée avec ses octets bruts, sans qu'aucun champ ne soit inventé ; une trame courte est complétée et signalée ; les octets `[4..5]`, `[6..8]` et `[13..15]` sont désormais exposés. L'interface affiche un bandeau « autre système », le site, le contrôle `~site`, la liste des anomalies et une table octet par octet.
- **Distinction clé de recherche / ID `CardInfo`** : l'application affichait `Mid(CardData,19,8)` sous l'étiquette « ID », alors que l'ID du logiciel d'origine est l'AutoNumber de `CardInfo`. Les deux valeurs sont maintenant affichées séparément (`Clé de recherche` et `ID dans CardInfo` / `Operator Code`), avec « absent » si la ligne n'existe pas encore.

### Changed

- **Pages légales réécrites à partir d'un audit du code** : `/privacy/` et `/delete-account/` (fr / en / ar) décrivaient un autre produit (« AgentOps », Firebase/FCM, Google Sign-In, données patients, Play Integrity, télémétrie) qui n'existe pas dans ce dépôt, et le formulaire de suppression affichait un faux message « lien de vérification envoyé » sans rien envoyer. Les textes sont désormais alignés sur le code réel : données locales IndexedDB `OmniBook_ObjectBox_Store`, compte Supabase optionnel, WebHID et caméra, Google Fonts et GitHub Pages comme seuls tiers, liste explicite « ce que nous ne collectons pas ». La page de suppression donne les étapes exactes de la purge intégrée et ouvre un `mailto:` pré-rempli réellement envoyable, avec délai de 72 h ouvrées. Titres racine corrigés (`Appointment AGENTS.md` → `Appointment PMS`).
- **CI légale durcie** : l'étape « Verify Legal Pages » échoue maintenant si un fichier manque, si les pages arabes ne déclarent pas `dir="rtl"`, si un placeholder ou une marque obsolète reste (`TODO`, `example.com`, `AgentOps`, …), ou si le README ne lie plus la politique de confidentialité et la page de suppression.

- **Design system et interface responsive** : refonte transversale de l'interface, appliquée à tous les écrans. `src/index.css` centralise les jetons (couleurs sémantiques, rayons, ombres, espacements, durées, courbes `--ease-*`, échelle de `z-index`) au lieu de valeurs dispersées. Ajout de primitives d'interaction : retour immédiat au press via la propriété `scale` (compatible avec les utilitaires `translate`), focus visible accessible, suppression du surlignage tactile et du délai de 300 ms, champs à 16 px sur mobile pour empêcher le zoom iOS. Les menus, modales, tiroirs, feuilles mobiles, toasts et listes utilisent des animations de montage qui restent sur le compositeur (`scale` / `translate` / `opacity`), avec un repli statique sous `prefers-reduced-motion`. La barre supérieure et la navigation passent en matériaux translucides (`backdrop-filter`), désactivés sous `prefers-reduced-transparency` et renforcés sous `prefers-contrast`. Typographie à approche par taille (titres resserrés, texte courant neutre), chiffres tabulaires dans les tableaux et retour à la ligne des valeurs longues. `viewport-fit=cover`, encoches et barres de gestes respectées, `theme-color` clair et sombre. Les classes `animate-in` / `fade-in` / `zoom-in-95` (plugin `tailwindcss-animate` absent, donc inopérantes) ont été retirées.

### Changed

- **Code splitting des écrans et des modales** : `src/App.tsx` ne charge plus en amont que la coque d'accueil (`TopBar`, `Sidebar`, `OfflineBanner`, planning, légende, fiche de réservation). Les 12 autres vues et les 7 autres modales sont chargées à la demande via `React.lazy` + `Suspense`, avec un squelette `pms-view-loading` pendant le téléchargement ; une modale n'est montée que lorsqu'elle est ouverte. Les dépendances lourdes (`jspdf`, `html2canvas`, génération de QR) ne sont donc téléchargées qu'au premier usage.
- **Poids du bundle initial divisé par 2,4** : mesure `npm run build` (Vite 8), de ≈ 494 kB à ≈ 208 kB gzip (chunk principal 418 kB / 122 kB gzip). Chaque vue et modale possède son propre chunk différé.
- **Fond des écrans hérité du jeton `pms-canvas`** : les 10 écrans qui redéclaraient `bg-slate-50 dark:bg-slate-950` sur leur conteneur racine utilisent désormais le fond du shell applicatif ; la couleur du jeton devient alors la seule source de vérité pour le fond de page.
- **Contrôle de parité i18n ajouté à la vérification locale** : `npm run i18n:check` est documenté dans le README et branché sur la CI.
- **Motion unifiée sur tous les écrans, dialogues et menus** : les 21 voiles de modale et leurs panneaux utilisaient les classes `animate-in` / `fade-in` / `zoom-in-95` du plugin `tailwindcss-animate`, absent du projet — elles n'animaient donc rien. Chaque voile porte désormais `pms-modal-backdrop`, chaque panneau `pms-modal` (ou `pms-drawer` pour le menu latéral mobile, `pms-sheet` pour les feuilles basses), chaque pop-up d'en-tête `pms-dropdown` avec son `transform-origin` ancré sur le déclencheur (miroir RTL inclus). Trois nouvelles primitives complètent la famille : `pms-fade` (étapes et changement d'écran), `pms-pop` (résultats, aperçus flottants, icône de confirmation) et `pms-slide-up` (toasts et barre de légende mobile). Le changement de vue déclenche un fondu de 160 ms sur `<main>`.
- **`transition-all` réservé aux tailles réelles** : 51 occurrences remplacées par `transition` (couleurs, ombres, transformations seules) ; seules les barres de progression et le redimensionnement de la colonne du Gantt, qui animent réellement `width`/`height`, gardent `transition-all`. Survol des cartes neutralisé sur les pointeurs tactiles (`hover: hover and pointer: fine`).
- **CSS mort retiré** : `pms-page-header`, `pms-toolbar` et `pms-table-wrap` n'étaient référencés nulle part (doublons de utilitaires Tailwind flex / `overflow-x-auto`) — 40 lignes supprimées.

### Fixed
- **Cartes Étage (0xD0) refusées par les serrures** : l'encodeur écrivait le numéro d'étage dans l'octet `[4]`, un nonce aléatoire dans `[6]` et `0x80 | BldNo` dans `[7]`. Or les huit cartes Étage d'origine de la base vivante (`CardInfo` IDs 1384-1393, émises le 2026-11-04) montrent le layout réel `[4]=0x7F`, `[5]=0x00`, `[6]=numéro d'étage`, `[7]=BldNo brut`, `[8]=0x00`, `[9]=0xD0 | index`. La serrure lisait donc le nonce comme numéro d'étage : c'est la cause du non-fonctionnement constaté sur matériel. L'encodeur et le décodeur suivent désormais ce layout, et un test de régression décode puis ré-encode la carte authentique `C9 12 03 3B 7F 00 02 01 00 D6 1B 24 F5 1C 25 FB` à l'octet près. La carte Bâtiment (`0xC0`) reste inchangée faute de carte authentique dans la base.
- **Réimport du même hôtel bloqué après un effacement de données** : après « Effacer toutes les données » (ou « Effacer les données persistantes »), l’application conservait `previous_site` et `recommissioning_required` tout en supprimant la base chargée. Le réimport de la **même** base `CardLock.mdb` était alors refusé (« même code système que l’ancien hôtel ») et toutes les cartes échouaient (« Importez la nouvelle base… », « Émission bloquée… »), sans possibilité de confirmer la migration (`canConfirmHotelRecommissioning()` restait faux puisque l’ancien et le nouveau site étaient identiques). Le réimport d’un code système identique **sans base actuellement chargée** est désormais reconnu comme un simple réimport et efface les marqueurs obsolètes ; le refus est conservé lorsqu’une base est encore chargée, c’est-à-dire lors d’un véritable retour à l’hôtel quitté. Logique isolée dans `src/locks/cardLockMigration.ts` et couverte par 8 tests.
- **Déploiement GitHub Pages silencieusement ignoré** : l’étape `deploy-pages` était enveloppée de `continue-on-error`, donc un dépassement de délai du backend Pages (déploiement resté `queued` plus de 10 minutes) laissait le **build précédent** en ligne tout en affichant un job vert — c’est ainsi que le correctif d’import n’a pas atteint le site. La limite de 10 minutes de `deploy-pages` ne peut pas être augmentée, mais l’échec n’est plus masqué et une vérification compare désormais l’asset `index-*.js` réellement servi à celui produit par le build (avec 10 minutes de réessais pour la propagation CDN) avant de valider les pages légales. La suppression de l’artefact `github-pages` d’une exécution précédente exigeait `actions: write`, absent du workflow : elle échouait silencieusement et le redéploiement s’arrêtait sur « Multiple artifacts named github-pages ».
- **Échec de l’import `CardLock.mdb` (« Cannot read properties of undefined (reading 'from') »)** : le build navigateur de `mdb-reader` s’appuie sur le `Buffer` global pour parcourir les pages, décompresser et déchiffrer la base, mais le paquet `buffer` n’était plus installé — le polyfill chargé dynamiquement était donc indéfini. `buffer` redevient une dépendance directe, son constructeur est exposé sur `globalThis` avant le chargement du lecteur, et une erreur explicite remplace le message opaque si le module ne se charge pas. Le résumé d’import affiche aussi la date de modification du fichier pour distinguer la copie figée de `Program Files` de la base vivante du VirtualStore.
- **Libellé trompeur de suppression de compte** : la clé i18n `deleteAccountInAppBtn` annonçait « Supprimer mon compte & purger mes données (In-App §19.3) » alors que le bouton réel n'efface que les données locales de l'appareil et que la suppression de compte in-app n'existe pas encore côté serveur. La clé est renommée `purgeLocalDataBtn` (« Effacer les données de cet appareil » / « Clear data on this device » / « مسح بيانات هذا الجهاز ») pour que l'interface ne promette jamais une suppression de compte inexistante. `docs/COMPLIANCE.md` documente désormais le contrat exact de la future Edge Function `delete-account` (entrée, ré-authentification, ordre de purge, workspaces partagés, codes de retour) et précise, dans la réponse Play *Data safety*, que la purge locale n'est pas une suppression de compte.
- **Import CardLock** : conservation de `BldNo = 0` et `FlrNo = 0`, repli sur `RomID2` puis `RomID` lorsque `RoomNo` est vide, inventaire de toutes les tables Access et refus de créer des chambres depuis les séjours orphelins. Les statuts inconnus restent non renseignés ; les séjours CardLock précédents sont remplacés lors d'un nouvel import.
- **Inventaire proUSB** : affichage du nombre de lignes, des colonnes et de la nature système/métier de chaque table, y compris quand `mdb-reader` n'expose les colonnes que par les lignes retournées.
- **Traçabilité des releases** : le tag et le titre des releases créées sur `main` dérivent désormais de la version de `package.json` au lieu du `v2.4.0-build.*` codé en dur ; tag, titre et noms d'artefacts sont alignés.
- **Machine code affiché décalé d'un octet (`3950 1214` au lieu de `5012 14D2`)** : WebHID livre chaque rapport d'entrée précédé de son report ID, que `WebHidTransport` conserve en tête du tampon, alors que CardLock passe le tampon de la DLL directement à son parser. L'offset fixe `Copy(rapportHex, 11, 8)` lisait donc les octets 4..7 du bloc d'identification. Le machine code est désormais ancré sur la signature du bloc (`55 21 01` + `52|55|56 39` + `50 12`), avec repli sur l'offset d'origine ; un rapport avec ou sans report ID donne la même valeur. Régression couverte par deux tests (report ID `0x00` et `0x40`).
- **Validation des réservations** : validation stricte des dates calendaires `YYYY-MM-DD` pour tous les secteurs avant toute modification d'état ; les dates impossibles comme le 31 février sont refusées.
- **Confirmation des paiements cash** : l'absence de confirmation d'encaissement ne règle plus une réservation en attente ; l'encaissement exige un montant reçu au moins égal au montant dû, et le calcul du check-in est déterministe.
- **Purge locale et conformité** : la purge réinitialise les collections utilisateur, retire toutes les clés locales préfixées par l'application, vide les données proUSB et attend la fin de la transaction IndexedDB. Une erreur de stockage empêche désormais l'écran d'annoncer un succès. Le texte légal précise que cette purge locale ne supprime pas les données distantes.
- **Cohérence IndexedDB/IndexedDB** : les réservations et ressources sont persistées comme instantanés atomiques ; les enregistrements supprimés de l'état React ne restent plus dans les object stores. Les erreurs d'ouverture ou de transaction IndexedDB remontent au lieu d'être masquées.
- **Cartes de fonction (Passe Générale, Étage, Bâtiment, Urgence, Groupe) non fonctionnelles** : `encodeCommissioningCard` ne comportait aucun cas pour ces familles — les boutons du onglet « Mise en service » écrivaient une trame quasi vide dont l'octet `[9]=0x00`, c'est-à-dire une fausse carte *reset*. Ces familles déléguent désormais à l'encodeur Master vérifié (`0xB0`/`0xD0`/`0xC0`/`0xA0`), et la famille Groupe (`0x80`) a été ajoutée. Vérifié sur matériel réel.
- **Périmètre erroné des cartes Étage et Bâtiment** : l'encodeur ne plaçait pas le bâtiment dans l'octet `[7]` (nibble bas, `0x80 | BldNo`), donc une carte Étage ouvrait le même étage dans **tous** les bâtiments et la carte Bâtiment n'était pas bornée à son bâtiment. Les deux familles portent maintenant le `BldNo` réel de la base importée. Un numéro de bâtiment manquant, négatif ou supérieur à 15 (et un étage hors `0-127`) est refusé au lieu d'être masqué par `& 0x0f` — un masquage transformait `16` en `0`, c'est-à-dire en « tous les bâtiments ». La carte client utilise le même contrôle. Tests unitaires ajoutés pour verrouiller les octets `[4]`, `[5]`, `[7]` et `[9]` sans matériel.
- **Site codé en dur `24B6` sur les cartes de fonction** : `encodeCommissioningCard` utilisait `DEFAULT_SITE_LOW` (24B6) pour les cartes groupe/checkout/limite alors que votre système est `033B` — la serrure rejette ces cartes (« pas une carte de ce système »). Le site provient désormais du template importé (`CardLock.mdb`), avec repli sur le site intégré.
- **Master / Urgence : site réel par défaut** : une serrure commissionnée `033B` refuse une carte de fonction à site `0000` (wildcard acceptée uniquement après un hard reset, avant commissionnement). Les cartes Master et Urgence portent désormais le vrai site d'installation par défaut ; le site `0000` n'est écrit que si l'option « universelle » est demandée explicitement. `issueMasterCard` prend le site dans le template importé au lieu de retomber sur `24B6` quand aucune base n'est chargée.
- **Réservations du Gantt décorrélées des chambres** : `GuestInfo.BldRoomNo` est au format « bâtiment-chambre » (`1-103`) alors que `RoomInfo.RoomNo` est nu (`103`), et les dates `ComeTime`/`GoTime` sont des textes `jj/mm/aaaa hh:mm:ss` non parsables par `new Date()`. La conversion normalise désormais la clé de chambre et parse les dates Access ; les lignes « Copy » d'un même séjour sont fusionnées (durée étendue si besoin) au lieu de dupliquer le même séjour.
- **Lignes mortes dans `CardInfo`** : le script de synchronisation n'insère plus les enregistrements fabriqués par les anciennes versions (`C9 00 … AD DE AD`, tout à zéro) qui ne correspondent à aucune carte physique. Seules les trames réelles (`C9 12 …`) sont écrites. Deux lignes de ce type existaient dans la base vivante (ID 1363 et 1364).
- **Carte système affichée avec une expiration** : l'inspecteur affichait la date de fin (= date d'émission) sur une carte système, alors que ces cartes n'expirent pas. Il affiche maintenant « Émise le » et « Expiration : aucune (carte système) ».
- **ID / Operator Code « absent » alors que la carte existe** : l'instantané `CardLock.mdb` est une photo prise à l'import ; une carte créée ensuite est forcément introuvable. L'inspecteur indique désormais la date de l'instantané et invite à réimporter la base vivante, au lieu d'un « absent » ambigu.
- **Écriture qui ne fonctionnait qu'une seule fois jusqu'au rafraîchissement de la page** : les accusés de réception HID restaient dans la file d'entrée et la lecture de vérification consommait celui de l'écriture précédente. Le transport expose maintenant `drain()`, appelé avant chaque écriture et chaque lecture, et `transact()` ignore les trames plus courtes que 16 octets au lieu de les prendre pour la carte.
- **Message d'écriture inexploitable** : l'erreur « L'écriture n'a pas pu être vérifiée en relecture » indique désormais la trame écrite, la trame relue et la cause réelle (timeout, erreur transport, contenu différent) avec la vérification à effectuer.
- **Import de l'ancienne base vers le planning/Gantt** : l'import de `CardLock.mdb` propose maintenant d'importer aussi les chambres (bâtiments → groupes, chambres → ressources) et les séjours clients (comeTime/goTime → réservations) dans le planning/Gantt, afin de ne pas repartir d'une base vide. Les cartes restent disponibles pour l'ID/Operator Code.
- **ID et Operator Code absents dans `CardLock.exe`** : la base réellement utilisée par le logiciel d'origine est celle du **VirtualStore** (`%LOCALAPPDATA%\VirtualStore\Program Files (x86)\…\CardLock.mdb`), car Windows virtualise les écritures des applications 32 bits installées sous `Program Files (x86)`. La copie de `Program Files` était figée depuis 2023 (62 cartes) alors que la copie vivante en contenait 88. Le script **Synchroniser CardLock.mdb** détecte maintenant la base vivante à l'exécution (copie la plus récente, option `--mdb` pour forcer), ne demande plus d'élévation pour le VirtualStore, avertit si `CardLock.exe` est encore ouvert, **relit chaque ligne** et affiche l'`ID` et l'`Operator Code` obtenus. L'écran d'import et la documentation pointent vers la base vivante.

### Removed

- **Dépendances et code inutilisés** : suppression de `d3`, `@types/d3`, `motion`, `@google/genai`, `express`, `@types/express`, `dotenv`, `autoprefixer` et `esbuild` (aucun import dans le projet, vérifié par recherche) : 192 paquets en moins à installer. Le composant `DomainRoleSelector.tsx`, remplacé par le sélecteur de secteur/rôle de la barre supérieure et importé nulle part, a été retiré.

### Documentation
- **`docs/COMPLIANCE.md`** : inventaire réel des données (IndexedDB, localStorage proUSB, Supabase 16 tables RLS, WebHID, caméra), permissions, tiers, flux de suppression et mapping du formulaire **Data safety** de Google Play, avec les points ouverts pour le propriétaire.
- Analyse du schéma CardLock, de ses relations métier et procédure novice d'import ajoutées au README et au Centre d'aide.
- [Release, signature et déploiement](./docs/RELEASE.md) : jobs du pipeline, nommage versionné, secrets (noms uniquement), vérification et dépannage GitHub Pages.

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