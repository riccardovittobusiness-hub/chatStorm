#!/bin/zsh
# Crea l'app desktop chatStorm e la installa nella cartella Applicazioni del tuo utente.
# Doppio clic su questo file dal Finder. Serve solo la prima volta (e dopo aggiornamenti dell'app desktop).
cd "$(dirname "$0")/.." || exit 1
PROJ="$(pwd)"
pause() { read -k1 "?$1"; echo; }
echo "== Creo l'app chatStorm =="
echo "Progetto: $PROJ"

case "$PROJ" in
  "$HOME/Downloads"*|"$HOME/Desktop"*|"$HOME/Documents"*)
    echo "\nLa cartella del progetto è in Download, Scrivania o Documenti: macOS impedisce all'app di leggerla."
    echo "Spostala nella cartella Inizio (Finder: Vai > Inizio) e riapri questo file da lì."
    pause "Premi un tasto per chiudere"; exit 1;;
esac

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js non trovato. Installalo da https://nodejs.org (versione 22 o più recente)."
  pause "Premi un tasto per chiudere"; exit 1
fi

if [ ! -d node_modules/@anthropic-ai/claude-agent-sdk ] || [ ! -f "$HOME/.cc-canvas-login-done" ]; then
  echo "\nPrima serve la configurazione iniziale (Claude Code, login, dipendenze): la faccio con avvia.command."
  echo "Quando l'app si apre nel browser, chiudi quella finestra del Terminale e riapri questo file."
  pause "Premi un tasto per continuare…"
  exec "$PROJ/avvia.command"
fi

cd mac/electron || exit 1
print -r -- "{\"project\": \"$PROJ\"}" > config.json

echo "\nScarico Electron (solo la prima volta, circa 100 MB)…"
npm install --no-audit --no-fund || { pause "Installazione non riuscita. Premi un tasto per chiudere"; exit 1; }

ARCH=$(uname -m); [ "$ARCH" = "x86_64" ] && ARCH=x64
echo "\nCostruisco l'app…"
npx --no-install electron-packager . chatStorm --platform=darwin --arch="$ARCH" --icon=../AppIcon.icns \
  --out=../dist --overwrite --app-bundle-id=com.riccardovitto.chatstorm --ignore='^/dist' \
  || { pause "Costruzione non riuscita. Premi un tasto per chiudere"; exit 1; }

BUILT="../dist/chatStorm-darwin-$ARCH/chatStorm.app"
codesign --force --deep --sign - "$BUILT" 2>/dev/null   # firma locale, necessaria sui Mac Apple Silicon

# chiudo un'eventuale versione aperta (anche col vecchio nome) e il vecchio server
osascript -e 'tell application "chatStorm" to quit' >/dev/null 2>&1
osascript -e 'tell application "ClaudioStorm" to quit' >/dev/null 2>&1
/usr/bin/pkill -f "server/index.js" 2>/dev/null

mkdir -p "$HOME/Applications"
rm -rf "$HOME/Applications/chatStorm.app" "$HOME/Applications/ClaudioStorm.app"   # anche la versione col vecchio nome
ditto "$BUILT" "$HOME/Applications/chatStorm.app"
xattr -dr com.apple.quarantine "$HOME/Applications/chatStorm.app" 2>/dev/null
rm -rf "$PROJ/mac/chatStorm.app" "$PROJ/mac/_vecchia-app" ../dist   # vecchia versione e file di costruzione

echo "\nFatto. L'app è in Applicazioni (del tuo utente): la trovi anche in Launchpad e con Spotlight."
echo "Trascinala nel Dock per averla sempre a portata di mano."
open "$HOME/Applications/chatStorm.app"
exit 0
