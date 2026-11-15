# Handoff IA — Encodeur proUSB multi-navigateur et natif

> **Statut : spécification et plan de travail.** Ce document ne signifie pas que les bridges natifs sont implémentés. L'IA qui reprend doit vérifier le dépôt et les critères ci-dessous avant de déclarer une étape terminée.
>
> Branche de préparation : `feat/usb-native-bridge-handoff`

## 1. Objectif produit

Rendre l'encodeur de cartes hôtelières proUSB utilisable depuis Appointment avec une expérience cohérente :

- Windows : Chrome, Microsoft Edge et Firefox, sans dépendre de WebHID/WebUSB.
- Android : depuis l'application Appointment Android installée (Capacitor), avec accès USB Host/OTG natif.
- Le navigateur ne doit plus être responsable de l'accès direct au matériel.
- Conserver le protocole proUSB, les commandes, le codec des cartes, les règles métier et la vérification physique après écriture.
- Fournir un diagnostic précis : agent absent, permission refusée, encodeur absent, encodeur occupé, protocole en erreur, timeout, déconnexion, firmware/transport incompatible.

**Important sur Android :** une page web ouverte dans Chrome/Firefox Android ne peut pas appeler directement un plugin Capacitor d'une autre application. Le périmètre Android garanti ici est l'application Appointment native/Capacitor. Si l'exigence devient « navigateur Android arbitraire, hors application Appointment », il faudra une application compagnon Android distincte avec un canal IPC local sécurisé ; ne pas prétendre que le plugin Capacitor rend automatiquement cela possible.

## 2. État vérifié dans le dépôt au moment de la rédaction

Références lues sur `main` :

- `AGENTS.md` : règles de sécurité, offline-first, tests, branches et skill UI obligatoire.
- `docs/ARCHITECTURE.md` : React 19 + TypeScript + Vite 8, Capacitor 8, IndexedDB prioritaire ; couche matérielle dans `src/locks/protocol/` et orchestration dans `src/locks/lockManager.ts`.
- `src/locks/protocol/transport.ts` : interface `LockTransport`, `WebHidTransport`, VID `0x9915`, PID `0x1116`, transaction série via `withDeviceLock`.
- `src/locks/lockManager.ts` : le gestionnaire instancie actuellement `WebHidTransport`.
- `scripts/package-windows.ps1` : le lanceur Windows actuel démarre explicitement `msedge.exe`. Ce packaging n'est donc pas encore un agent USB natif et ne satisfait pas la neutralité navigateur.
- `package.json` : dépendances Capacitor Android présentes ; aucune dépendance/implémentation de bridge USB natif n'a été confirmée dans les fichiers examinés.

Le code actuel appelle `navigator.hid`. Le message de compatibilité dans `WebHidTransport.open()` recommande Chrome/Edge. Le comportement observé (Edge seulement) est donc cohérent avec l'architecture actuelle. Ne pas ajouter des polyfills navigateur pour simuler un accès matériel absent.

Le protocole USB exact doit encore être confirmé à partir des descripteurs réels de l'encodeur et de la documentation proUSB du dépôt. Le VID/PID déclarés par le code ne suffisent pas à conclure que toutes les interfaces USB sont HID ni à choisir arbitrairement HID, WinUSB ou USB bulk.

## 3. Architecture cible

### 3.1 Vue d'ensemble

```text
Appointment React UI
  |
  +-- LockManager (métier / cartes / séquencement)
        |
        +-- LockTransport (contrat existant)
              |
              +-- WindowsLocalAgentTransport
              |      HTTPS/HTTP loopback + API versionnée
              |            |
              |            +-- Appointment USB Agent (Windows, natif)
              |                    |
              |                    +-- Windows HID / API USB appropriée
              |                            |
              |                            +-- Encodeur proUSB
              |
              +-- CapacitorProUsbTransport (Android)
                     |
                     +-- Plugin natif Kotlin / UsbManager
                             |
                             +-- USB Host / OTG
                                     |
                                     +-- Encodeur proUSB
```

Le transport WebHID existant peut rester comme adaptateur de compatibilité facultatif pendant la migration, mais ne doit pas être le chemin par défaut ni une dépendance du produit multi-navigateur.

### 3.2 Contrat commun

Garder `LockTransport` comme abstraction consommée par le protocole. Le transport natif doit fournir les mêmes garanties :

- `open()`, `close()`, `isOpen()`, `send(frame)`, `receive(timeoutMs)`, `drain()`.
- Sérialiser les transactions : le protocole HID ne doit pas laisser deux commandes consommer la réponse l'une de l'autre.
- Conserver les octets/report IDs et les tailles exactes attendues par le firmware.
- Préserver les timeouts, tentatives, logs TX/RX et erreurs typées.
- Après `writeCard`, relire la carte et comparer le contenu attendu ; ne jamais afficher un succès sur le seul ACK d'écriture.
- Gérer débranchement, reconnexion, périphérique occupé et annulation proprement.
- Ne pas dupliquer le codec ni le protocole métier en C#, Kotlin et TypeScript. Le natif doit être un adaptateur I/O, pas une seconde implémentation métier.

Le protocole doit déterminer précisément si la trame inclut un octet report ID, la taille des rapports, les endpoints, la convention d'ACK et la manière de vider les réponses obsolètes. Réutiliser les tests et captures existants.

### 3.3 Agent Windows natif

Créer un composant Windows indépendant du navigateur, installé sur le poste de réceptionniste.

Recommandation d'architecture à valider après inspection USB : agent .NET/C# (ou Rust si le dépôt justifie mieux ce choix), exécuté dans la session utilisateur sous forme de processus/agent de zone de notification ou service utilisateur. Éviter un service Windows SYSTEM comme premier choix : les périphériques USB et les permissions de session interactive doivent être accessibles sans élévation permanente.

Fonctions attendues :

1. Détecter le périphérique ciblé par VID/PID et valider ses descripteurs/interfaces.
2. Ouvrir le bon chemin/interface selon le vrai mode du périphérique (HID, WinUSB/bulk, série USB si c'est réellement le cas).
3. Exposer une API locale versionnée sur loopback uniquement, par exemple `http://127.0.0.1:<port>/api/v1`.
4. Publier `GET /health`, `GET /devices`, `POST /sessions`, `POST /sessions/{id}/exchange`, `DELETE /sessions/{id}` et les capacités/version.
5. Une session exclusive par encodeur ; les échanges sont atomiques (envoi + réception attendue), pas deux requêtes HTTP concurrentes indépendantes.
6. Fournir des logs techniques horodatés, sans données personnelles inutiles.
7. Démarrer/arrêter proprement, récupérer après crash et notifier la perte de périphérique.
8. Fournir un installateur signé et une procédure de mise à jour/désinstallation.

#### Sécurité obligatoire du serveur local

- Écouter uniquement sur `127.0.0.1` et éventuellement `[::1]`, jamais sur `0.0.0.0`.
- Refuser les requêtes Host non attendues et protéger contre DNS rebinding.
- CORS : autoriser uniquement les origines Appointment configurées (production et origines de développement explicites). Ne jamais utiliser `*` avec des credentials.
- Authentifier le client via un appairage explicite : secret aléatoire à forte entropie, conservé dans le stockage sécurisé Windows (Credential Manager/DPAPI), rotation/révocation et validation côté agent.
- Protéger les opérations mutantes contre CSRF ; ne pas se reposer uniquement sur CORS.
- Valider strictement taille et format des trames, méthodes, sessions et fréquences d'appel.
- Ne jamais exposer l'agent sur le réseau local ; pas d'API sans authentification.
- Ne pas journaliser token, numéro de carte complet, données d'identité client ou secrets.
- Ne pas désactiver les contrôles TLS/CORS du navigateur. Si HTTPS local est retenu, documenter installation, confiance et renouvellement du certificat ; ne pas créer de certificat non fiable silencieusement.

Un port dynamique peut être découvert via un mécanisme local contrôlé (fichier/pipe nommé ACLé ou port fixe réservé). Éviter un scan aveugle de ports. Le mécanisme de découverte doit être documenté et testé.

### 3.4 Android natif

Intégrer un plugin Capacitor Android en Kotlin dans l'application Appointment.

- Utiliser `UsbManager`, `UsbDevice`, `UsbInterface`, `UsbEndpoint`, `UsbDeviceConnection` selon les descripteurs réels.
- Déclarer/filtrer le périphérique cible ; demander la permission USB à l'utilisateur via le flux Android officiel.
- Gérer OTG, périphérique absent, permission refusée, interface occupée, déconnexion, reprise d'activité et cycle de vie.
- Exécuter les opérations I/O hors du thread UI.
- Conserver les règles de timeout, taille de rapport, sérialisation et vérification de carte du protocole commun.
- Exposer un plugin Capacitor typé avec événements de connexion/déconnexion et méthodes open/close/exchange/health.
- Ne pas stocker une permission USB comme si elle était permanente : Android peut la révoquer après déconnexion/redémarrage.
- Documenter les exigences matérielles (USB OTG, câble/adaptateur, alimentation éventuelle) et les versions Android réellement testées.

Ne pas introduire de serveur HTTP Android par défaut. Le plugin natif est plus simple et plus sûr pour l'application Appointment installée. Une app compagnon destinée à des navigateurs Android externes est un chantier distinct.

## 4. Sélection du transport dans Appointment

Créer une factory unique, par exemple `createProUsbTransport()`, sans coupler les composants React à la plateforme :

- Capacitor Android natif disponible → `CapacitorProUsbTransport`.
- Windows desktop avec agent détecté et appairé → `WindowsLocalAgentTransport`.
- Web pur sans agent → état explicite « Agent USB Windows requis ».
- WebHID peut être proposé comme fallback temporaire uniquement si l'équipe le décide ; il ne doit pas masquer l'absence de l'agent.
- Firefox Windows doit fonctionner via l'agent local, pas via une API navigateur propriétaire.

Le statut UI doit différencier au minimum : `unsupported`, `agent_missing`, `permission_required`, `disconnected`, `connecting`, `connected`, `busy`, `error`. Ne pas mapper tous ces états à « déconnecté ».

Ne pas modifier les règles de cartes, le scope bâtiment/établissement, CardLock.mdb ou les données IndexedDB dans le cadre de ce chantier, sauf nécessité démontrée.

## 5. Autre anomalie à traiter séparément : fiche de réservation / impression Edge

L'utilisateur signale que la confirmation « Réservation enregistrée » et/ou le document « Confirmation du séjour » / « Fiche de Réservation Hôtelière » s'affiche correctement dans Chrome, mais pas dans Edge.

Le code de `BookingModal.tsx` contient une fiche de police avec un appel direct à `window.print()`. Cela ne prouve pas à lui seul que cette vue est la cause de l'anomalie. L'IA doit :

1. Reproduire le problème dans Edge et Chrome sur la même version de build.
2. Identifier précisément si le défaut concerne le toast/modal de confirmation, l'aperçu du document, ou le rendu print.
3. Examiner `@media print`, les styles de modale, `position: fixed`, `overflow`, couleurs, polices, dimensions A4, sauts de page et RTL.
4. Isoler l'impression dans une route/fenêtre/document dédié ou une stratégie équivalente robuste, sans imprimer le shell de l'application.
5. Tester aperçu et impression A4 dans Edge et Chrome, plus Firefox si possible.
6. Ne pas modifier la confirmation de réservation ni son état de persistance pour corriger un défaut purement visuel.

Ce chantier est lié au même lot de qualité multi-navigateur, mais doit rester une tâche/test séparé du transport USB.

## 6. Plan de réalisation recommandé

### Phase 0 — Audit matériel et protocole (bloquant)

- [ ] Lire les documents proUSB/encodeur présents dans le dépôt.
- [ ] Collecter descripteurs USB réels (VID/PID, interfaces, usages HID, endpoints, report IDs, tailles).
- [ ] Vérifier sur Windows Gestionnaire de périphériques et sur Android OTG.
- [ ] Confirmer si l'encodeur est HID standard, HID propriétaire, WinUSB, CDC/serial ou autre.
- [ ] Capturer des échanges valides : identification, lecture carte, écriture, ACK, relecture.
- [ ] Établir les exigences driver Windows et permissions Android.
- [ ] Ne pas choisir une bibliothèque ou réécrire le protocole avant cet audit.

### Phase 1 — Contrat de transport et tests

- [ ] Documenter les invariants binaires du protocole.
- [ ] Ajouter tests unitaires du transport avec faux backend I/O.
- [ ] Tester les rapports sans report ID et avec report ID si les deux variantes sont confirmées.
- [ ] Tester sérialisation, réponses obsolètes, timeout, retry, disconnect et write/read-back.
- [ ] Définir un contrat JSON/erreurs versionné pour le bridge Windows.

### Phase 2 — Agent Windows

- [ ] Créer le projet natif isolé (ex. `native/windows-usb-agent/`).
- [ ] Implémenter découverte et accès matériel avec la bonne API/driver.
- [ ] Implémenter serveur loopback sécurisé et sessions exclusives.
- [ ] Implémenter appairage et stockage Credential Manager/DPAPI.
- [ ] Implémenter logs/diagnostics et gestion du cycle de vie.
- [ ] Créer installateur et documentation opérateur.
- [ ] Tester Chrome, Edge et Firefox sur Windows 10/11.
- [ ] Remplacer le packaging Windows qui lance actuellement Edge seul ; l'application web doit rester utilisable dans le navigateur choisi.

### Phase 3 — Transport web et intégration Appointment

- [ ] Implémenter `WindowsLocalAgentTransport implements LockTransport`.
- [ ] Implémenter la factory plateforme et le diagnostic UI.
- [ ] Conserver une seule orchestration métier dans `lockManager`.
- [ ] Tester connexion, lecture, écriture, relecture, déconnexion et reprise.
- [ ] Vérifier qu'aucun token ne fuit dans localStorage, URL ou logs.
- [ ] Mettre à jour traductions FR/EN/AR avec parité et RTL.

### Phase 4 — Android

- [ ] Implémenter plugin Kotlin Capacitor.
- [ ] Implémenter permission USB, sélection du device et cycle de vie.
- [ ] Implémenter `CapacitorProUsbTransport`.
- [ ] Tester au minimum deux appareils Android physiques avec OTG si disponibles.
- [ ] Tester permission refusée, déconnexion pendant I/O, reconnexion et app en arrière-plan.
- [ ] Documenter clairement que l'accès depuis un navigateur Android externe n'est pas inclus sans app compagnon.

### Phase 5 — Fiche de réservation Edge

- [ ] Reproduire et qualifier le défaut exact.
- [ ] Corriger CSS/rendu/print de façon isolée.
- [ ] Tests visuels et impression Chrome/Edge/Firefox.
- [ ] Vérifier français, anglais, arabe RTL et contenu long.

### Phase 6 — Livraison

- [ ] Mettre à jour `docs/ARCHITECTURE.md` après les changements structurels.
- [ ] Ajouter README d'installation et dépannage Windows/Android.
- [ ] Ajouter tests de contrat et tests d'intégration matériels (tests matériels séparés des tests CI sans périphérique).
- [ ] Exécuter `npm run lint`, `npm run test`, `npm run i18n:check`, `npm run build`.
- [ ] Ajouter build/test natif Windows et Android dans CI sans secrets ni matériel requis.
- [ ] Faire une validation hardware manuelle avec encodeur réel.
- [ ] Ouvrir une PR ; ne jamais merger ni publier sans vérification explicite des résultats.

## 7. Critères d'acceptation (Definition of Done)

### Windows

- [ ] L'encodeur est détecté et utilisable depuis Chrome, Edge et Firefox à jour.
- [ ] Aucun accès matériel WebHID/WebUSB n'est requis dans le navigateur.
- [ ] Si l'agent est absent, Appointment explique comment l'installer ; il ne présente pas un faux état USB.
- [ ] Un seul processus contrôle l'encodeur à la fois.
- [ ] Une carte n'est déclarée encodée qu'après la vérification physique par relecture.
- [ ] L'agent n'écoute pas sur le réseau local et refuse les origines non autorisées.

### Android

- [ ] L'application Appointment Capacitor détecte l'encodeur via USB OTG.
- [ ] La permission USB est demandée et les refus sont correctement présentés.
- [ ] Lecture/écriture/relecture réelles passent sur matériel physique.
- [ ] Déconnexion et reconnexion ne laissent pas une session bloquée.
- [ ] Les navigateurs Android externes sont explicitement hors périmètre, sauf réalisation d'une app compagnon sécurisée.

### Fiche de réservation

- [ ] La confirmation enregistrée reste correcte et indépendante du document imprimable.
- [ ] La fiche est lisible dans l'aperçu et imprimable en A4 sous Edge et Chrome.
- [ ] Le contenu ne déborde pas, n'est pas masqué par la modale et respecte RTL.

### Qualité

- [ ] Aucun test existant n'est supprimé ou affaibli.
- [ ] Tous les contrôles annoncés sont réellement exécutés.
- [ ] Les limites de tests matériels non exécutés sont clairement rapportées.

## 8. Règles impératives pour l'IA qui reprend

1. Lire `AGENTS.md`, `docs/ARCHITECTURE.md` et ce document intégralement.
2. Inspecter la branche et le code réel avant de modifier ; ce document est un plan, pas une preuve d'implémentation.
3. Lire le skill UI complet `.agents/skills/ui-ux-design-master/SKILL.md` avant toute modification d'interface. Le fichier n'était pas présent à l'emplacement attendu lors de la préparation de cette note ; vérifier s'il a été déplacé ou restauré.
4. Ne pas inventer les caractéristiques USB ni les échanges firmware. Mesurer/inspecter le matériel réel.
5. Ne pas forcer l'utilisation d'Edge : l'actuel `scripts/package-windows.ps1` lance `msedge.exe` et doit être remplacé par un vrai packaging de l'agent et une stratégie navigateur neutre.
6. Ne pas déclarer Firefox/Android compatibles avant tests réels.
7. Ne pas toucher aux données hôtel, CardLock.mdb, établissements/bâtiments, workspace ou sync sans nécessité et tests dédiés.
8. Garder les secrets hors Git. Ne jamais enregistrer token d'appairage ou données sensibles en clair.
9. Travailler sur une branche dédiée et livrer une PR reviewable.
10. Rapport final obligatoire : changements, tests exécutés/résultats, CI vérifiée ou non, matériel testé ou non, limites et prochaines étapes.

## 9. Première action demandée à l'IA

Commencer par la **Phase 0** : faire l'inventaire du protocole et du matériel à partir des sources du dépôt et demander les descripteurs USB/captures nécessaires si le code ne suffit pas. Ensuite seulement, proposer le choix final de la bibliothèque native Windows et de l'implémentation Android. Ne pas commencer par coder un serveur HTTP ou un plugin Kotlin sur la base d'une hypothèse HID non vérifiée.
