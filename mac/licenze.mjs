// Raccoglie le licenze delle librerie incluse nell'app (la cartella node_modules passata come argomento)
// in un unico testo, che finisce dentro l'app come LICENZE-TERZE-PARTI.txt.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2];
if (!root) { console.error('Uso: node mac/licenze.mjs <cartella dell\'app>'); process.exit(1); }
const found = new Map();
function scan(dir) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.')) continue;
    const p = join(dir, name);
    if (!statSync(p).isDirectory()) continue;
    if (name.startsWith('@')) { scan(p); continue; }
    const pj = join(p, 'package.json');
    if (existsSync(pj)) {
      try {
        const j = JSON.parse(readFileSync(pj, 'utf8'));
        const key = `${j.name}@${j.version}`;
        if (j.name && !found.has(key)) {
          const file = readdirSync(p).find(f => /^(licen[sc]e|copying)(\.|$)/i.test(f));
          const notice = readdirSync(p).find(f => /^notice(\.|$)/i.test(f));
          found.set(key, { name: j.name, version: j.version, license: typeof j.license === 'string' ? j.license : JSON.stringify(j.license || 'non indicata'),
            url: (typeof j.repository === 'string' ? j.repository : j.repository?.url) || j.homepage || '',
            text: [file, notice].filter(Boolean).map(f => readFileSync(join(p, f), 'utf8').trim()).join('\n\n') });
        }
      } catch {}
    }
    scan(join(p, 'node_modules'));
  }
}
scan(join(root, 'node_modules'));
const list = [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
const line = '-'.repeat(70);
let out = `chatStorm include i componenti di terze parti elencati qui sotto, ciascuno con la sua licenza.\n` +
  `Electron e Chromium: vedi LICENSE-electron.txt e LICENSES.chromium.html nella cartella Resources dell'app.\n` +
  `Il programma Codex di OpenAI (Apache-2.0) include a sua volta altri componenti: https://github.com/openai/codex\n\n`;
for (const p of list) out += `${line}\n${p.name} ${p.version}\nLicenza: ${p.license}${p.url ? `\n${p.url}` : ''}\n${line}\n${p.text || '(testo della licenza non incluso nel pacchetto)'}\n\n`;
process.stdout.write(out);
