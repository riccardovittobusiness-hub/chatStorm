// Pulizia degli SVG scritti dal modello: solo grafica, niente script né risorse esterne.
const FORBIDDEN_TAGS = ['script', 'foreignObject', 'iframe', 'image', 'use', 'a', 'style', 'animate', 'animateTransform', 'animateMotion', 'set', 'audio', 'video'];

export function sanitizeSvg(raw) {
  const m = String(raw).match(/<svg[\s\S]*?<\/svg>/i);
  if (!m) throw new Error('Il modello non ha restituito un SVG');
  let s = m[0];
  for (const t of FORBIDDEN_TAGS) {
    s = s.replace(new RegExp(`<${t}\\b[\\s\\S]*?<\\/${t}>`, 'gi'), '');
    s = s.replace(new RegExp(`<${t}\\b[^>]*\\/?>`, 'gi'), '');
  }
  s = s.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');                 // gestori di eventi
  s = s.replace(/\s(?:xlink:)?href\s*=\s*("(?!#)[^"]*"|'(?!#)[^']*')/gi, '');          // solo riferimenti interni
  s = s.replace(/url\(\s*['"]?(?!#)[^)]*\)/gi, 'none');                                 // niente url() esterni
  s = s.replace(/<!DOCTYPE[^>]*>|<\?xml[^>]*\?>|<!ENTITY[^>]*>/gi, '');
  // radice: viewBox 0 0 100 100 se manca, dimensioni esplicite per <img>
  s = s.replace(/<svg\b([^>]*)>/i, (_, attrs) => {
    let a = attrs.replace(/\s(width|height)\s*=\s*("[^"]*"|'[^']*')/gi, '');
    if (!/viewBox/i.test(a)) a += ' viewBox="0 0 100 100"';
    if (!/xmlns=/i.test(a)) a += ' xmlns="http://www.w3.org/2000/svg"';
    return `<svg${a} width="512" height="512">`;
  });
  if (s.length > 40_000) throw new Error('SVG troppo grande');
  return s;
}
