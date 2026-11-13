// Token condiviso tra l'app per Mac e il server: sta in data/.app-token, leggibile solo dal tuo utente.
// L'app lo aggiunge a ogni richiesta; un browser non lo conosce, quindi non può usare chatStorm.
// (mac/electron/main.js legge e crea lo stesso file con la stessa regola.)
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const DATA = fileURLToPath(new URL('../data/', import.meta.url));
const FILE = join(DATA, '.app-token');

export function appToken() {
  try { const t = readFileSync(FILE, 'utf8').trim(); if (/^[0-9a-f]{64}$/.test(t)) return t; } catch {}
  const t = randomBytes(32).toString('hex');
  mkdirSync(DATA, { recursive: true });
  writeFileSync(FILE, t + '\n', { mode: 0o600 });
  return t;
}

export function tokenMatches(token, given) {
  if (typeof given !== 'string' || given.length !== token.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(token));
}
