#!/bin/zsh
# Ricostruisce e reinstalla chatStorm.app senza Terminale.
# Lo lancia il server quando parte dall'app desktop e i file dell'app sono cambiati (server/desktop-app.js).
# Uso: aggiorna-app.sh <id-versione>
set -u
BUILD_ID="${1:-manuale}"
cd "$(dirname "$0")/.." || exit 1
PROJ="$(pwd)"
APPS="$HOME/Applications"
fail() {
  echo "ERRORE: $1"
  mkdir -p "$PROJ/data"; print -r -- "$BUILD_ID" > "$PROJ/data/app-build-failed.txt"
  osascript -e "display notification \"Aggiornamento non riuscito: dettagli in data/app-build.log\" with title \"chatStorm\"" >/dev/null 2>&1
  exit 1
}
echo "== $(date) — aggiorno chatStorm.app ($BUILD_ID) =="
osascript -e 'display notification "Aggiorno l’app: si riapre da sola tra un minuto." with title "chatStorm"' >/dev/null 2>&1

cd mac/electron || fail "cartella mac/electron mancante"
print -r -- "{\"project\": \"$PROJ\"}" > config.json
if [ ! -x node_modules/.bin/electron-packager ]; then
  npm install --no-audit --no-fund || fail "npm install non riuscito"
fi

ARCH=$(uname -m); [ "$ARCH" = "x86_64" ] && ARCH=x64
OUT="$PROJ/mac/dist"
rm -rf "$OUT"
npx --no-install electron-packager . chatStorm --platform=darwin --arch="$ARCH" --icon=../AppIcon.icns \
  --out="$OUT" --overwrite --app-bundle-id=com.riccardovitto.chatstorm --ignore='^/dist' || fail "costruzione non riuscita"
BUILT="$OUT/chatStorm-darwin-$ARCH/chatStorm.app"
[ -d "$BUILT" ] || fail "app costruita non trovata"
codesign --force --deep --sign - "$BUILT" || fail "firma locale non riuscita"

# chiudo la versione aperta (vecchio e nuovo nome): chiude anche il server, questo script continua
/usr/bin/pkill -f "ClaudioStorm.app/Contents/MacOS/" 2>/dev/null
/usr/bin/pkill -f "chatStorm.app/Contents/MacOS/" 2>/dev/null
sleep 2

mkdir -p "$APPS"
rm -rf "$APPS/chatStorm.app" "$APPS/ClaudioStorm.app"
ditto "$BUILT" "$APPS/chatStorm.app" || fail "copia in Applicazioni non riuscita"
xattr -dr com.apple.quarantine "$APPS/chatStorm.app" 2>/dev/null
rm -rf "$OUT" "$PROJ/mac/ClaudioStorm.app" "$PROJ/mac/_vecchia-app"

mkdir -p "$PROJ/data"
print -r -- "$BUILD_ID" > "$PROJ/data/app-build.txt"
rm -f "$PROJ/data/app-build-failed.txt"
echo "Fatto: $APPS/chatStorm.app"
open "$APPS/chatStorm.app"
