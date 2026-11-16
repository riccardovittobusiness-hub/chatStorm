#!/bin/bash
# Prova di avvio dell'app costruita. Uso: bash mac/prova-app.sh dist/chatStorm-darwin-arm64/chatStorm.app [solo-motore]
# 1) il Node dentro l'app avvia il motore su un socket (SQLite, Codex incluso, versione)
# 2) l'app intera parte, accende il motore e risponde
set -uo pipefail
APP="$1"; ONLY="${2:-}"
BIN="$APP/Contents/MacOS/chatStorm"; RES="$APP/Contents/Resources/app"
fail() { echo "ERRORE: $1"; [ -f "${LOG:-}" ] && { echo "--- log ---"; tail -40 "$LOG"; }; exit 1; }
wait_sock() { for i in $(seq 1 80); do [ -S "$1" ] && return 0; sleep 0.5; done; return 1; }
check() {                       # $1 = socket
  ST=$(curl -sf --max-time 5 --unix-socket "$1" http://chatstorm/api/status) || fail "il motore non risponde"
  echo "stato: $(echo "$ST" | head -c 160)"
  echo "$ST" | grep -q '"version":"[0-9]' || fail "versione mancante nello stato"
  PR=$(curl -sf --max-time 5 --unix-socket "$1" http://chatstorm/api/providers) || fail "providers non risponde"
  echo "codex: $PR"
  echo "$PR" | grep -q '"installed":true' || fail "il programma Codex non risulta incluso"
  curl -sf --max-time 5 --unix-socket "$1" http://chatstorm/ | grep -q "chatStorm" || fail "l'interfaccia non viene servita"
  curl -sf --max-time 5 --unix-socket "$1" http://chatstorm/api/licenses | grep -q "PolyForm" || fail "licenze mancanti"
  curl -sf --max-time 5 --unix-socket "$1" http://chatstorm/api/boards | grep -q '"id"' || fail "l'archivio non funziona"
}
[ -x "$BIN" ] || fail "non trovo $BIN"
[ -f "$RES/server/index.js" ] || { ls -la "$APP/Contents/Resources"; fail "nell'app manca il motore"; }
CODEX=$(ls "$RES"/node_modules/@openai/codex-darwin-*/vendor/*/bin/codex 2>/dev/null | head -1)
[ -n "$CODEX" ] || fail "nell'app manca il programma Codex"
echo "== Codex incluso: $("$CODEX" --version 2>&1 | head -1)"

echo "== 1. motore con il Node dell'app"
TMP=$(mktemp -d); LOG="$TMP/motore.log"; SOCK="$TMP/m.sock"
ELECTRON_RUN_AS_NODE=1 CHATSTORM_SOCKET="$SOCK" CANVAS_DATA_DIR="$TMP/data" CHATSTORM_VERSION=0.0.1 "$BIN" "$RES/server/index.js" > "$LOG" 2>&1 &
PID=$!
wait_sock "$SOCK" || fail "il motore non ha aperto il socket"
check "$SOCK"
kill $PID 2>/dev/null; wait $PID 2>/dev/null
echo "ok"
[ "$ONLY" = "solo-motore" ] && exit 0

echo "== 2. app intera"
USER_DIR="$HOME/Library/Application Support/chatStorm"; SOCK="$USER_DIR/motore.sock"; LOG="$TMP/app.log"
"$BIN" > "$LOG" 2>&1 &
PID=$!
wait_sock "$SOCK" || fail "l'app non ha acceso il motore"
sleep 3
check "$SOCK"
kill -0 $PID 2>/dev/null || fail "l'app si è chiusa da sola"
LOG="$USER_DIR/data/server.log"; [ -f "$LOG" ] || fail "manca il registro del motore"
kill $PID 2>/dev/null; sleep 2
echo "ok: l'app parte e il motore risponde"
