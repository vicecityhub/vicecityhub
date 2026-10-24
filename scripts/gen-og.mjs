// Open Graph share cards (1200x630 PNG) in the Hub look: one per news item + release-date and "Is GTA 6 out yet?" cards.
// Output: public/og/<news id>.png, public/og/release.png, public/og/is-out.png
// Run order: gen-agent-surface (writes public/data/news.json) -> gen-og -> gen-seo-pages (links the cards in og:image / twitter:image).
// Needs @resvg/resvg-js and scripts/fonts/Rajdhani-Bold.ttf (SIL OFL). If either is missing the step is skipped and pages keep their old image.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, RELEASE, esc, longDate } from './lib/seo.mjs';

let Resvg;
try { ({ Resvg } = await import('@resvg/resvg-js')); } catch { console.log('[og] @resvg/resvg-js not installed - skipping share cards'); process.exit(0); }
// Optional: quantize to 256 colours. Smooth neon gradients make 24-bit PNGs ~350 KB; palette PNGs are ~5x smaller and look the same at share-card size.
let UPNG = null;
try { UPNG = (await import('upng-js')).default; } catch { /* fall back to the full-colour PNG */ }
const FONT = join(ROOT, 'scripts', 'fonts', 'Rajdhani-Bold.ttf');
if (!existsSync(FONT)) { console.log('[og] scripts/fonts/Rajdhani-Bold.ttf missing - skipping share cards'); process.exit(0); }

const OUT = join(ROOT, 'public', 'og');
mkdirSync(OUT, { recursive: true });

const TINT = { Official: '#00FFFF', Leaks: '#FF2D95', Rumors: '#FFE135', Community: '#7CFF6B' };
const W = 1200, H = 630;

function wrap(text, maxChars, maxLines) {
  const lines = [];
  let cur = '';
  for (const w of String(text).replace(/\s+/g, ' ').trim().split(' ')) {
    if ((cur + ' ' + w).trim().length > maxChars && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = lines[maxLines - 1].replace(/[\s,.;:!?-]*\S*$/, '') + '...';
  }
  return lines;
}
function fitTitle(title) {
  for (const size of [84, 74, 66, 58, 52]) {
    const maxChars = Math.floor(1040 / (size * 0.47));
    const lines = wrap(title, maxChars, 99);
    if (lines.length <= (size >= 66 ? 3 : 4)) return { size, lines };
  }
  return { size: 46, lines: wrap(title, Math.floor(1040 / (46 * 0.47)), 4) };
}
const star = (cx, cy, r, fill) => {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.42 : r;
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`);
  }
  return `<polygon points="${pts.join(' ')}" fill="${fill}"/>`;
};

function card({ kicker, title, sub, heat = 0, tint = '#FF00FF', right = '' }) {
  const { size, lines } = fitTitle(title);
  const lh = Math.round(size * 1.06);
  const subLines = sub ? wrap(sub, 70, 1) : [];
  const blockH = lines.length * lh + (subLines.length ? 52 : 0);
  const y0 = 150 + Math.max(0, (380 - blockH) / 2) + size * 0.82;
  const titleSvg = lines.map((l, i) => `<text x="64" y="${(y0 + i * lh).toFixed(0)}" font-size="${size}">${esc(l)}</text>`).join('');
  const subSvg = subLines.length ? `<text x="64" y="${(y0 + lines.length * lh + 8).toFixed(0)}" font-size="32" fill="#b9b9d6">${esc(subLines[0])}</text>` : '';
  // synthwave floor: converging verticals + receding horizontals
  let grid = '';
  for (let x = -1200; x <= 2400; x += 150) grid += `<line x1="600" y1="440" x2="${x}" y2="630"/>`;
  for (let k = 1; k <= 7; k++) { const y = 440 + 190 * Math.pow(k / 7, 2); grid += `<line x1="0" y1="${y.toFixed(1)}" x2="1200" y2="${y.toFixed(1)}"/>`; }
  const kw = Math.max(150, kicker.length * 17 + 44);
  const stars5 = heat > 0 ? [0, 1, 2, 3, 4].map((i) => star(1126 - 4 * 30 + i * 30, 168, 12, i < heat ? tint : '#2a2a44')).join('') : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#12062a"/><stop offset="1" stop-color="#05050c"/></linearGradient>
<radialGradient id="gp" cx="0.08" cy="0.02" r="0.75"><stop offset="0" stop-color="#FF00FF" stop-opacity="0.38"/><stop offset="1" stop-color="#FF00FF" stop-opacity="0"/></radialGradient>
<radialGradient id="gc" cx="0.98" cy="1" r="0.7"><stop offset="0" stop-color="#00FFFF" stop-opacity="0.30"/><stop offset="1" stop-color="#00FFFF" stop-opacity="0"/></radialGradient>
<linearGradient id="brand" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FF00FF"/><stop offset="1" stop-color="#00FFFF"/></linearGradient>
<filter id="blur" x="-10%" y="-30%" width="120%" height="160%"><feGaussianBlur stdDeviation="9"/></filter>
</defs>
<rect width="${W}" height="${H}" fill="url(#bg)"/><rect width="${W}" height="${H}" fill="url(#gp)"/><rect width="${W}" height="${H}" fill="url(#gc)"/>
<g stroke="#FF00FF" stroke-opacity="0.22" stroke-width="1.4">${grid}</g>
<rect x="22" y="22" width="${W - 44}" height="${H - 44}" rx="20" fill="none" stroke="url(#brand)" stroke-width="3"/>
<text x="64" y="104" font-size="40" letter-spacing="7" fill="url(#brand)">VICE CITY HUB</text>
<rect x="64" y="124" width="150" height="3" fill="url(#brand)"/>
<rect x="${W - 64 - kw}" y="64" width="${kw}" height="50" rx="25" fill="${tint}" fill-opacity="0.14" stroke="${tint}" stroke-width="2"/>
<text x="${W - 64 - kw / 2}" y="98" font-size="28" letter-spacing="3" text-anchor="middle" fill="${tint}">${esc(kicker.toUpperCase())}</text>
${stars5}
<g font-weight="700" fill="${tint}" opacity="0.55" filter="url(#blur)">${titleSvg}</g>
<g fill="#ffffff">${titleSvg}</g>
${subSvg}
<rect x="22" y="552" width="${W - 44}" height="56" fill="#05050c" fill-opacity="0.82"/>
<text x="64" y="592" font-size="30" letter-spacing="1" fill="#00FFFF">vicecityhub.github.io/vicecityhub</text>
<text x="${W - 64}" y="592" font-size="30" letter-spacing="2" text-anchor="end" fill="#ff7be5">${esc(right.toUpperCase())}</text>
</svg>`;
}

function render(svg) {
  const img = new Resvg(svg, { fitTo: { mode: 'width', value: W }, font: { fontFiles: [FONT], loadSystemFonts: false, defaultFontFamily: 'Rajdhani' } }).render();
  if (!UPNG) return img.asPng();
  const px = img.pixels;
  const ab = px.buffer.slice(px.byteOffset, px.byteOffset + px.byteLength);
  return Buffer.from(UPNG.encode([ab], img.width, img.height, 256));
}
let written = 0, kept = 0;
function save(name, svg) {
  const f = join(OUT, name);
  const png = render(svg);
  if (existsSync(f) && Buffer.compare(readFileSync(f), png) === 0) { kept++; return; }
  writeFileSync(f, png);
  written++;
}

let news = [];
try { news = JSON.parse(readFileSync(join(ROOT, 'public', 'data', 'news.json'), 'utf8')).items || []; } catch { /* no news yet */ }
const shortDate = (iso) => { const d = new Date(iso); return Number.isNaN(+d) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }); };
for (const n of news) {
  if (!n.id || !n.title) continue;
  save(`${n.id}.png`, card({ kicker: n.category || 'News', title: n.title, heat: Number(n.stars) || 0, tint: TINT[n.category] || '#FF00FF', right: shortDate(n.published_at) }));
}
const pretty = longDate(`${RELEASE.date}T12:00:00Z`);
save('release.png', card({ kicker: 'Release date', title: `GTA 6 launches ${pretty}`, sub: 'PlayStation 5 and Xbox Series X|S', tint: '#00FFFF', right: 'Countdown' }));
save('is-out.png', card({ kicker: 'Live answer', title: 'Is GTA 6 out yet?', sub: `Short answer, countdown and the facts. Launch: ${pretty}`, tint: '#FF2D95', right: 'Updated daily' }));
console.log(`[og] ${news.length + 2} share cards (${written} written, ${kept} unchanged)`);
