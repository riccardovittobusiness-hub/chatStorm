#!/bin/bash
# Costruisce l'app per Mac e il file da scaricare: dist/chatStorm-<arch>.dmg
# Uso (su un Mac):  bash mac/build-dmg.sh [arm64|x64]      oppure: npm run dist
# Dentro l'app finiscono l'interfaccia, il motore, Codex e Electron: chi la scarica non installa nient'altro.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
ARCH="${1:-$(uname -m)}"; [ "$ARCH" = "x86_64" ] && ARCH=x64
case "$ARCH" in arm64|x64) ;; *) echo "Architettura non valida: $ARCH (arm64 o x64)"; exit 1;; esac
[ "$(uname -s)" = "Darwin" ] || { echo "Il .dmg si costruisce su un Mac."; exit 1; }
VERSION=$(node -p "require('./package.json').version")
OUT="$ROOT/dist"; STAGE="$OUT/stage-$ARCH"; BUILT="$OUT/chatStorm-darwin-$ARCH"; APP="$BUILT/chatStorm.app"
echo "== chatStorm $VERSION per Mac $ARCH =="

[ -x node_modules/.bin/electron-packager ] || npm install --no-audit --no-fund
ELECTRON_VERSION=$(node -p "require('electron/package.json').version")

echo "-- 1/4  contenuto dell'app"
rm -rf "$STAGE" "$BUILT"; mkdir -p "$STAGE/mac/electron"
cp -R server public LICENSE.md "$STAGE/"
cp mac/electron/main.cjs mac/electron/icon.png "$STAGE/mac/electron/"
node -e "
const p = require('./package.json');
const keep = (({ name, productName, version, description, type, main, dependencies, license, author }) => ({ name, productName, version, description, type, main, private: true, dependencies, license, author }))(p);
require('fs').writeFileSync('$STAGE/package.json', JSON.stringify(keep, null, 2));"
# solo le librerie che servono all'app, con il programma Codex per questa architettura
(cd "$STAGE" && npm install --omit=dev --no-audit --no-fund --os=darwin --cpu="$ARCH")
CODEX=$(ls "$STAGE"/node_modules/@openai/codex-darwin-"$ARCH"/vendor/*/bin/codex 2>/dev/null | head -1 || true)
[ -n "$CODEX" ] && [ -x "$CODEX" ] || { echo "Manca il programma Codex per $ARCH"; exit 1; }
node mac/licenze.mjs "$STAGE" > "$STAGE/LICENZE-TERZE-PARTI.txt"

echo "-- 2/4  app (Electron $ELECTRON_VERSION)"
npx --no-install electron-packager "$STAGE" chatStorm --platform=darwin --arch="$ARCH" \
  --electron-version="$ELECTRON_VERSION" --icon="$ROOT/mac/AppIcon.icns" --out="$OUT" --overwrite --no-prune \
  --app-bundle-id=com.riccardovitto.chatstorm --app-version="$VERSION" \
  --app-category-type=public.app-category.productivity --app-copyright="© 2026 Riccardo Vitto, Ci siamo"
cp "$BUILT/LICENSE" "$APP/Contents/Resources/LICENSE-electron.txt"
cp "$BUILT/LICENSES.chromium.html" "$APP/Contents/Resources/"

echo "-- 3/4  firma"
# Firma locale ("ad hoc"): basta per avviare l'app, ma macOS chiede "Apri comunque" a chi la scarica.
# Qui andranno la firma Developer ID e la notarizzazione di Apple, quando ci sarà l'iscrizione al programma sviluppatori.
codesign --force --deep --sign - "$APP"
codesign --verify --deep --strict "$APP"

echo "-- 4/4  immagine disco"
DMG_DIR="$OUT/dmg-$ARCH"; DMG="$OUT/chatStorm-$ARCH.dmg"
rm -rf "$DMG_DIR" "$DMG"; mkdir -p "$DMG_DIR"
ditto "$APP" "$DMG_DIR/chatStorm.app"
ln -s /Applications "$DMG_DIR/Applications"
for try in 1 2 3; do                                  # hdiutil a volte trova il volume occupato: riprovo
  hdiutil create -volname "chatStorm" -srcfolder "$DMG_DIR" -ov -format UDZO "$DMG" && break
  [ "$try" = 3 ] && exit 1; sleep 5
done
rm -rf "$DMG_DIR" "$STAGE"
echo "Fatto: $DMG ($(du -h "$DMG" | cut -f1))"
