#!/bin/zsh
# Installa chatStorm: doppio clic su questo file dal Finder, una volta sola.
# Installa le dipendenze, fa il login a ChatGPT, costruisce chatStorm.app e la mette in Applicazioni.
# Dopo si usa solo l'app: si aggiorna da sola e non si apre nel browser.
cd "$(dirname "$0")" || exit 1
PROJ="$(pwd)"
pause() { read -k1 "?$1"; echo; }
echo "== Installo chatStorm =="
echo "Progetto: $PROJ"

case "$PROJ" in
  "$HOME/Downloads"*|"$HOME/Desktop"*|"$HOME/Documents"*)
    echo "\nLa cartella è in Download, Scrivania o Documenti: macOS impedisce all'app di leggerla."
    echo "Spostala nella tua cartella Inizio (Finder: Vai > Inizio) e riapri questo file da lì."
    pause "Premi un tasto per chiudere"; exit 1;;
esac

if ! command -v node >/dev/null 2>&1; then
  echo "\nNode.js non trovato. Installalo da https://nodejs.org (versione 22.13 o più recente) e riapri questo file."
  pause "Premi un tasto per chiudere"; exit 1
fi
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
NODE_MINOR=$(node -p 'process.versions.node.split(".")[1]')
if [ "$NODE_MAJOR" -lt 22 ] || { [ "$NODE_MAJOR" -eq 22 ] && [ "$NODE_MINOR" -lt 13 ]; }; then
  echo "\nServe Node.js 22.13 o più recente (hai $(node -v)). Aggiornalo da https://nodejs.org"
  pause "Premi un tasto per chiudere"; exit 1
fi

echo "\n1/3  Dipendenze…"
if [ ! -d node_modules/@openai/codex-sdk ]; then
  npm install --no-audit --no-fund || { pause "Installazione non riuscita. Premi un tasto per chiudere"; exit 1; }
fi

# Accesso a ChatGPT tramite Codex: usa il tuo abbonamento ChatGPT (Plus o Pro), non una API key a consumo
unset OPENAI_API_KEY CODEX_API_KEY
echo "\n2/3  Login a ChatGPT…"
if [ ! -f "${CODEX_HOME:-$HOME/.codex}/auth.json" ]; then
  echo "Si apre il browser: accedi con il tuo account ChatGPT (\"Sign in with ChatGPT\"). Serve solo questa volta."
  pause "Premi un tasto per iniziare il login…"
  npx --no-install codex login || { pause "Login non riuscito. Premi un tasto per chiudere"; exit 1; }
else
  echo "Già collegato."
fi

echo "\n3/3  Costruisco l'app (la prima volta scarica Electron, circa 100 MB)…"
ID=$(node --input-type=module -e "import('$PROJ/server/desktop-app.js').then(m => console.log(m.buildId()))")
/bin/zsh "$PROJ/mac/aggiorna-app.sh" "$ID" || { pause "Non riuscito: i dettagli sono sopra. Premi un tasto per chiudere"; exit 1; }

# icona sulla Scrivania: un alias del Finder (funziona anche con la Scrivania su iCloud).
# macOS può chiedere il permesso al Terminale di controllare il Finder: rispondi OK.
APPDIR="$HOME/Applications/chatStorm.app"
DESK="$HOME/Desktop"
if [ -L "$DESK/chatStorm.app" ]; then rm -f "$DESK/chatStorm.app"; fi     # collegamento delle versioni precedenti
if [ ! -e "$DESK/chatStorm" ]; then
  if osascript >/dev/null 2>&1 <<OSA
tell application "Finder"
  set a to make alias file to (POSIX file "$APPDIR" as alias) at (path to desktop folder)
  try
    set name of a to "chatStorm"
  end try
end tell
OSA
  then
    echo "\nHo messo l'icona di chatStorm sulla Scrivania."
  else
    echo "\nNon ho potuto mettere l'icona sulla Scrivania: in Applicazioni trascina chatStorm sulla Scrivania tenendo premuti Cmd e Option."
  fi
fi

echo "\nFatto. Apri chatStorm dall'icona sulla Scrivania (o da Applicazioni, Launchpad, Spotlight)."
echo "Da ora in poi apri sempre l'app: si aggiorna da sola."
exit 0
