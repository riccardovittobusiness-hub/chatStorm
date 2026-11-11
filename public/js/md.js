// Markdown minimo e sicuro (escape prima di tutto).
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function inline(s) {
  return s
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/(^|\W)_([^_\s][^_]*)_(?=\W|$)/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

export function md(src = '') {
  const out = [];
  const parts = esc(src).split(/```/);
  parts.forEach((part, idx) => {
    if (idx % 2 === 1) {
      out.push(`<pre><code>${part.replace(/^[\w-]*\n/, '')}</code></pre>`);
      return;
    }
    let list = null;
    const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
    let para = [];
    const flush = () => { if (para.length) { out.push(`<p>${inline(para.join('<br>'))}</p>`); para = []; } };
    for (const raw of part.split('\n')) {
      const line = raw.trimEnd();
      let m;
      if (!line.trim()) { flush(); close(); continue; }
      if ((m = line.match(/^(#{1,4})\s+(.*)/))) { flush(); close(); out.push(`<h${Math.min(m[1].length + 1, 4)}>${inline(m[2])}</h${Math.min(m[1].length + 1, 4)}>`); continue; }
      if ((m = line.match(/^\s*[-*•]\s+(.*)/))) { flush(); if (list !== 'ul') { close(); out.push('<ul>'); list = 'ul'; } out.push(`<li>${inline(m[1])}</li>`); continue; }
      if ((m = line.match(/^\s*\d+[.)]\s+(.*)/))) { flush(); if (list !== 'ol') { close(); out.push('<ol>'); list = 'ol'; } out.push(`<li>${inline(m[1])}</li>`); continue; }
      close();
      para.push(line);
    }
    flush(); close();
  });
  return out.join('');
}

export const plain = (src = '') => src.replace(/[*_`#>]/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
