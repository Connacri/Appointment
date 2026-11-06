# Release & déploiement — Appointment PMS

Ce document décrit le pipeline réel de `.github/workflows/release-and-deploy.yml`.
Il ne contient aucun secret : uniquement des **noms** de secrets et de variables.

## 1. Principe

- Aucune release ni signature de production n'est produite en local.
  Les APK/AAB/EXE signés et le site de production sont construits **uniquement** par GitHub Actions.
- La version applicative a une source unique : `package.json` → `version`.
- Un push sur `main` (ou `master`) déclenche : qualité → build Web/Android/Windows → déploiement GitHub Pages → release de snapshot.
- Un tag `vX.Y.Z` déclenche une release officielle ; le tag doit être **égal** à `package.json` (vérifié par le workflow).
- `workflow_dispatch` permet de relancer manuellement le pipeline (`release_track`, `update_website`).

## 2. Jobs

| Job | Rôle | Sorties |
|---|---|---|
| Build & Update Production Website | `npm ci`, build Vite, zip Web, upload de l'artefact Pages, `actions/deploy-pages` | Site GitHub Pages |
| Build & Sign Android (APK + AAB) | build Web base relative, `cap sync`, signature release, vérification `apksigner`, upload | `app-release.apk`, `app-release.aab`, `mapping.txt` |
| Build & Sign Windows EXE | build Web base relative, lanceur WebView, installateur Inno Setup, signature Authenticode | `Appointment-PMS-Setup*.exe`, zip Windows |
| Publish GitHub Release | récupère les artefacts, les renomme avec la version, calcule `SHA256SUMS.txt`, publie la release | Release GitHub |

`versionCode` Android = `github.run_number` ; il ne doit jamais régresser ni être réutilisé.

## 3. Nommage des artefacts

Toujours versionnés avec la version de `package.json` :

```text
Appointment-PMS-vX.Y.Z.apk
Appointment-PMS-vX.Y.Z.aab
Appointment-PMS-Setup-vX.Y.Z.exe
Appointment-PMS-Setup-Inno-vX.Y.Z.exe
Appointment-PMS-Windows-vX.Y.Z.zip
web-build-vX.Y.Z.zip
mapping-vX.Y.Z.txt
SHA256SUMS.txt
```

Les snapshots de `main` sont publiés sous le tag `vX.Y.Z-build.<run_number>`
(la version vient de `package.json`, le numéro de build du run). Le titre de la
release reprend la même version ; il est volontairement entre guillemets dans le
YAML car un `#` non échappé tronque la valeur.

## 4. Secrets et variables (noms uniquement)

Secrets GitHub :

```text
ANDROID_KEYSTORE_BASE64
ANDROID_KEYSTORE_PASSWORD
ANDROID_KEY_ALIAS
ANDROID_KEY_PASSWORD
PLAY_STORE_JSON_KEY          (optionnel : active l'upload Play)
WINDOWS_CERT_BASE64          (optionnel : sinon signature CI auto-signée)
```

Variables GitHub :

```text
ANDROID_PACKAGE_NAME
UPLOAD_CERT_SHA256
PLAY_STORE_JSON_KEY_PRESENT  (true pour activer l'upload Play)
PLAY_TRACK_RELEASE
PLAY_RELEASE_STATUS
```

Création : `bash scripts/bootstrap-secrets.sh` (voir `AGENTS.md`, annexes A et B).
Ne jamais committer de keystore, `.env`, JSON de service account ou mot de passe.

## 5. Vérification après un push

1. `gh run watch <run_id> --exit-status`
2. Vérifier que les quatre jobs sont verts et que la release contient les artefacts versionnés.
3. Le job Pages compare automatiquement l'asset `assets/index-*.js` servi par
   `https://connacri.github.io/Appointment/` avec celui du build (10 minutes de réessais pour la
   propagation CDN) : un site resté sur l'ancien build fait échouer le run.
4. Vérifier `/`, `/privacy/`, `/delete-account/` et leurs variantes `fr/`, `en/`, `ar/` en HTTP 200.
5. En cas d'échec : lire `gh run view <run_id> --log-failed`, corriger la cause racine, pousser un nouveau commit.

## 6. Dépannage Pages (leçon apprise)

- `deploy-pages` échoue avec `Timeout reached` / `updating_pages` : incident transitoire. Le délai
  demandé est plafonné à **10 minutes** par l'action (`timeout value is greater than the allowed
  maximum`), donc augmenter `timeout:` au-delà de `600000` ne change rien. Ne jamais masquer cet
  échec avec `continue-on-error` : c'est ainsi qu'un correctif a pu rester absent du site alors que
  le job était vert.
- Un déploiement Pages est identifié par le SHA du commit. Un déploiement bloqué peut être annulé :
  `gh api --method POST repos/<owner>/<repo>/pages/deployments/<sha>/cancel` (le `<sha>` est celui
  du commit, pas l'ID du deployment Actions). Vérifier ensuite son état avec
  `gh api repos/<owner>/<repo>/pages/deployments/<sha>` jusqu'à `deployment_cancelled`.
- Ne pas relancer **uniquement** le job Pages sans vérifier l'artefact : le re-run ré-upload
  `github-pages` dans le même run et le déploiement échoue avec
  `Multiple artifacts named "github-pages"`. Depuis l'ajout de `actions: write`, l'étape de nettoyage
  peut supprimer l'ancien artefact ; si la suppression échoue encore, pousser un **nouveau commit**.
- Solution la plus fiable : pousser un **nouveau commit** (ou lancer `workflow_dispatch` sur un
  commit différent) afin d'obtenir un nouveau SHA et un nouvel artefact Pages.
- Ne jamais supprimer ni déplacer un tag publié ; corriger en avant avec un nouveau build.
