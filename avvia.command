#!/bin/zsh
# Avvio di chatStorm: doppio clic su questo file dal Finder.
cd "$(dirname "$0")"
echo "== chatStorm =="

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js non trovato. Installalo da https://nodejs.org (versione 22 o più recente) e riapri questo file."
  read -k1 "?Premi un tasto per chiudere"; exit 1
fi
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
NODE_MINOR=$(node -p 'process.versions.node.split(".")[1]')
if [ "$NODE_MAJOR" -lt 22 ] || { [ "$NODE_MAJOR" -eq 22 ] && [ "$NODE_MINOR" -lt 13 ]; }; then
  echo "Serve Node.js 22.13 o più recente (hai $(node -v)). Aggiornalo da https://nodejs.org"
  read -k1 "?Premi un tasto per chiudere"; exit 1
fi

if [ ! -d node_modules/@openai/codex-sdk ]; then
  echo "Installo le dipendenze (solo la prima volta)…"
  npm install || { read -k1 "?Installazione non riuscita. Premi un tasto per chiudere"; exit 1; }
fi

# Accesso a ChatGPT tramite Codex: usa il tuo abbonamento ChatGPT (Plus o Pro), non una API key a consumo
unset OPENAI_API_KEY CODEX_API_KEY
if [ ! -f "${CODEX_HOME:-$HOME/.codex}/auth.json" ]; then
  echo ""
  echo "=== LOGIN (una volta sola) ==="
  echo "Si apre il browser: accedi con il tuo account ChatGPT (scegli \"Sign in with ChatGPT\")."
  echo ""
  read -k1 "?Premi un tasto per iniziare il login…"
  echo ""
  npx --no-install codex login || { read -k1 "?Login non riuscito. Premi un tasto per chiudere"; exit 1; }
fi

( sleep 2; open "http://localhost:4317" ) &
echo "Per fermare l'app: chiudi questa finestra o premi Ctrl+C."
npm start
