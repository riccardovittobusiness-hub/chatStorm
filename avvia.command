#!/bin/zsh
# Avvio di ClaudioStorm: doppio clic su questo file dal Finder.
cd "$(dirname "$0")"
echo "== ClaudioStorm =="

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

# Usa l'abbonamento, non una API key a consumo
unset ANTHROPIC_API_KEY

export PATH="$HOME/.local/bin:$PATH"
if ! command -v claude >/dev/null 2>&1; then
  echo ""
  echo "Claude Code non è installato: lo installo con l'installatore ufficiale…"
  curl -fsSL https://claude.ai/install.sh | bash || { read -k1 "?Installazione di Claude Code non riuscita. Premi un tasto per chiudere"; exit 1; }
  export PATH="$HOME/.local/bin:$PATH"
fi

if ! claude auth status >/dev/null 2>&1 && [ ! -f "$HOME/.cc-canvas-login-done" ]; then
  echo ""
  echo "=== LOGIN (una volta sola) ==="
  echo "Si apre Claude Code: segui le istruzioni nel browser e scegli l'accesso con il tuo"
  echo "ACCOUNT CLAUDE (abbonamento), NON la Console/API."
  echo "Quando vedi Claude Code pronto, scrivi /exit e premi Invio: l'app partirà da sola."
  echo ""
  read -k1 "?Premi un tasto per iniziare il login…"
  echo ""
  claude
  touch "$HOME/.cc-canvas-login-done"
fi

if [ ! -d node_modules/@anthropic-ai/claude-agent-sdk ] || [ ! -d node_modules/@openai/codex-sdk ]; then
  echo "Installo le dipendenze (solo la prima volta)…"
  npm install || { read -k1 "?Installazione non riuscita. Premi un tasto per chiudere"; exit 1; }
fi

( sleep 2; open "http://localhost:4317" ) &
echo "Per fermare l'app: chiudi questa finestra o premi Ctrl+C."
npm start
