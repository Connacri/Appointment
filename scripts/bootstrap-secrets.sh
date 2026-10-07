#!/usr/bin/env bash
# One-time owner bootstrap: upload keystore + GitHub secrets/variables/environments.
# Never prints secrets. Never writes inside the repo.
set -euo pipefail

for bin in gh keytool openssl base64; do
  command -v "$bin" >/dev/null || { echo "Missing tool: $bin"; exit 1; }
done
gh auth status >/dev/null || { echo "Run: gh auth login"; exit 1; }

REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
echo "Repository: $REPO"

read -rp "Android package name [com.planning.oran]: " APP_ID
APP_ID="${APP_ID:-com.planning.oran}"
read -rp "Site URL (e.g. https://samuel69tr00.github.io/Appointment): " SITE_URL
read -rp "Public support email [ramzi.guedouar@gmail.com]: " SUPPORT_EMAIL
SUPPORT_EMAIL="${SUPPORT_EMAIL:-ramzi.guedouar@gmail.com}"
read -rp "Developer / organization name (certificate O=) [Planning Oran]: " ORG
ORG="${ORG:-Planning Oran}"
read -rp "Country code (certificate C=) [DZ]: " CC
CC="${CC:-DZ}"

KS_DIR="$HOME/.keystores/$APP_ID"
KS="$KS_DIR/upload-keystore.jks"
CREDS="$KS_DIR/credentials.txt"
ALIAS="oran-release-key"
mkdir -p "$KS_DIR" && chmod 700 "$KS_DIR"

if [[ -f "$KS" ]]; then
  echo "Keystore already exists at $KS — reusing it."
  [[ -f "$CREDS" ]] || { echo "credentials.txt missing; cannot continue safely."; exit 1; }
  PASS="$(grep '^KEYSTORE_PASSWORD=' "$CREDS" | cut -d= -f2-)"
else
  PASS="$(openssl rand -base64 24 | tr -d '=+/' | cut -c1-24)"
  keytool -genkeypair -v -storetype PKCS12 \
    -keystore "$KS" -alias "$ALIAS" -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$PASS" -keypass "$PASS" \
    -dname "CN=$ORG, OU=Mobile, O=$ORG, C=$CC" >/dev/null
  chmod 600 "$KS"
  umask 177
  { echo "KEYSTORE_PASSWORD=$PASS"; echo "KEY_ALIAS=$ALIAS"; echo "KEY_PASSWORD=$PASS"; } > "$CREDS"
  echo "Keystore created: $KS"
fi

SHA256="$(keytool -list -v -keystore "$KS" -alias "$ALIAS" -storepass "$PASS" | grep -m1 'SHA256:' | awk '{print $2}')"
SHA1="$(keytool -list -v -keystore "$KS" -alias "$ALIAS" -storepass "$PASS" | grep -m1 'SHA1:' | awk '{print $2}')"

echo "Uploading secrets (values are never printed)…"
base64 < "$KS" | tr -d '\n' | gh secret set ANDROID_KEYSTORE_BASE64
printf '%s' "$PASS"  | gh secret set ANDROID_KEYSTORE_PASSWORD
printf '%s' "$ALIAS" | gh secret set ANDROID_KEY_ALIAS
printf '%s' "$PASS"  | gh secret set ANDROID_KEY_PASSWORD

read -rp "Path to google-services.json (Enter to skip): " GS
if [[ -n "${GS:-}" && -f "$GS" ]]; then
  base64 < "$GS" | tr -d '\n' | gh secret set GOOGLE_SERVICES_JSON_BASE64
fi
read -rp "Path to Play service-account JSON (Enter to skip): " SA
if [[ -n "${SA:-}" && -f "$SA" ]]; then
  gh secret set PLAY_STORE_JSON_KEY < "$SA"
  echo "Delete the local JSON now: shred -u \"$SA\""
fi

echo "Setting variables…"
gh variable set ANDROID_PACKAGE_NAME --body "$APP_ID"
gh variable set APPLICATION_ID       --body "$APP_ID"
gh variable set UPLOAD_CERT_SHA256   --body "$SHA256"
gh variable set SITE_URL             --body "$SITE_URL"
gh variable set SUPPORT_EMAIL        --body "$SUPPORT_EMAIL"
gh variable set PLAY_TRACK_RELEASE   --body "internal"
gh variable set VERSION_CODE_OFFSET  --body "0"
gh variable set PLAY_RELEASE_STATUS  --body "draft"

echo
echo "Done. Public fingerprints for com.planning.oran:"
echo "  SHA-1  : $SHA1"
echo "  SHA-256: $SHA256"
echo
echo "NEXT: back up $KS_DIR in two offline places, then delete $CREDS."
gh secret list
