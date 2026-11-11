#!/bin/zsh
# Crea l'app desktop chatStorm e la installa nella cartella Applicazioni del tuo utente.
# Doppio clic su questo file dal Finder. Serve solo la prima volta: dopo, l'app si aggiorna da sola.
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

if [ ! -d node_modules/@openai/codex-sdk ] || [ ! -f "${CODEX_HOME:-$HOME/.codex}/auth.json" ]; then
  echo "\nPrima serve la configurazione iniziale (dipendenze e login a ChatGPT): la faccio con avvia.command."
  echo "Quando l'app si apre nel browser, chiudi quella finestra del Terminale e riapri questo file."
  pause "Premi un tasto per continuare…"
  exec "$PROJ/avvia.command"
fi

echo "\nCostruisco e installo l'app (la prima volta scarica Electron, circa 100 MB)…"
ID=$(node --input-type=module -e "import('$PROJ/server/desktop-app.js').then(m => console.log(m.buildId()))")
/bin/zsh "$PROJ/mac/aggiorna-app.sh" "$ID" || { pause "Non riuscito. Premi un tasto per chiudere"; exit 1; }
echo "\nFatto. chatStorm è in Applicazioni (del tuo utente): la trovi anche in Launchpad e con Spotlight."
echo "D'ora in poi l'app si aggiorna da sola: non serve più rieseguire questo file."
exit 0
