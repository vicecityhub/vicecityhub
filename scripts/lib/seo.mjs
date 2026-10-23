/**
 * Vice City Hub v13 - shared SEO helpers (ASCII-only on purpose: no encoding surprises on Windows shells).
 * Used by scripts/gen-agent-surface.mjs and scripts/gen-seo-pages.mjs.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const cfg = JSON.parse(readFileSync(join(ROOT, 'site.config.json'), 'utf8'));
export const SITE = cfg.site;
export const GROWTH = String(cfg.api).replace(/\/agent-api$/, '/growth');
export const KOFI = 'https://ko-fi.com/vicecityhub';
export const RELEASE = cfg.release || { date: '2026-11-19', verified: '2026-10-23' };

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const one = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
export const trunc = (s, n) => (one(s).length > n ? one(s).slice(0, n - 1).replace(/\s+\S*$/, '') + '...' : one(s));

/** Must stay identical to slug() in the agent-premium edge function. */
export const slugify = (t) =>
  String(t || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70)
    .replace(/-+$/, '');

export const newsPath = (n) => `n/${n.id}-${slugify(n.title)}/`;
export const newsUrl = (n) => `${SITE}/${newsPath(n)}`;

export const longDate = (iso) =>
  new Date(iso).toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' });
export const day = (iso) => String(iso || new Date().toISOString()).slice(0, 10);
export const stars = (n) => '\u2605'.repeat(Math.max(0, Math.min(5, n | 0))) + '\u2606'.repeat(5 - Math.max(0, Math.min(5, n | 0)));

const CSS = `:root{--bg:#07070f;--pink:#ff2d95;--cyan:#00f0ff;--amber:#ffb300;--ink:#ececf8;--mut:#a3a3bd}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;color:var(--ink);font:16px/1.65 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:radial-gradient(1100px 560px at 85% -10%,#3b0b4a 0,transparent 60%),radial-gradient(900px 520px at -10% 8%,#06323c 0,transparent 55%),var(--bg);background-attachment:fixed;min-height:100vh}
a{color:var(--cyan);text-decoration:none}a:hover{text-decoration:underline}
.top{position:sticky;top:0;z-index:9;background:#07070fd9;backdrop-filter:blur(10px);border-bottom:1px solid #ff2d9540}
.top .in{max-width:980px;margin:0 auto;padding:10px 16px;display:flex;gap:16px;align-items:center;flex-wrap:wrap}
.brand{font:900 18px/1 Impact,"Arial Black",system-ui,sans-serif;letter-spacing:.06em;color:#fff;text-transform:uppercase;text-shadow:0 0 12px var(--pink)}
.brand b{color:var(--pink)}
.top nav{display:flex;gap:14px;flex-wrap:wrap;font-size:14px}.top nav a{color:var(--mut)}.top nav a:hover{color:#fff;text-decoration:none}
.wrap{max-width:860px;margin:0 auto;padding:26px 16px 60px}
h1{font:900 clamp(26px,5vw,40px)/1.15 Impact,"Arial Black",system-ui,sans-serif;margin:.2em 0 .4em;text-transform:uppercase;letter-spacing:.01em;text-shadow:0 0 18px #ff2d9566}
h2{font:800 22px/1.25 system-ui,sans-serif;margin:1.6em 0 .5em;color:#fff}h2:before{content:"";display:inline-block;width:10px;height:10px;margin-right:10px;background:var(--pink);box-shadow:0 0 10px var(--pink);transform:rotate(45deg)}
.crumbs{font-size:13px;color:var(--mut)}.crumbs a{color:var(--mut)}
.meta{display:flex;flex-wrap:wrap;gap:10px 16px;font-size:14px;color:var(--mut);margin:.4em 0 1.2em}
.tag{display:inline-block;padding:2px 10px;border-radius:999px;border:1px solid var(--cyan);color:var(--cyan);font-size:12px;letter-spacing:.06em;text-transform:uppercase}
.heat{color:var(--amber);letter-spacing:2px}
.lead{font-size:19px;color:#fff}
.card{background:#ffffff0d;border:1px solid #ffffff1f;border-radius:14px;padding:18px;backdrop-filter:blur(8px);transition:box-shadow .2s,transform .2s}
.card:hover{box-shadow:0 0 0 1px var(--pink),0 0 26px #ff2d9555}
.grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(250px,1fr))}
.list{list-style:none;margin:0;padding:0;display:grid;gap:12px}
.btn{display:inline-block;background:var(--pink);color:#fff;border:0;border-radius:8px;padding:11px 18px;font-weight:800;letter-spacing:.04em;cursor:pointer;box-shadow:0 0 18px #ff2d9566;font-size:15px}
.btn:hover{text-decoration:none;filter:brightness(1.12)}.btn.alt{background:transparent;border:1px solid var(--cyan);color:var(--cyan);box-shadow:none}
.share{display:flex;flex-wrap:wrap;gap:8px;margin:1.4em 0}.share a,.share button{font:inherit;font-size:13px;color:var(--ink);background:#ffffff12;border:1px solid #ffffff26;border-radius:999px;padding:6px 14px;cursor:pointer}
.share a:hover,.share button:hover{border-color:var(--cyan);text-decoration:none}
.nl{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.nl input[type=email]{flex:1 1 220px;padding:11px 12px;border-radius:8px;border:1px solid #ffffff33;background:#0b0b18;color:#fff;font-size:15px}
.hp{position:absolute;left:-9999px;opacity:0;height:0;width:0}
.msg{min-height:1.3em;font-size:14px;color:var(--cyan);margin:.5em 0 0}
.mut{color:var(--mut)}.small{font-size:13px}
table.spec{width:100%;border-collapse:collapse}table.spec td{padding:8px 10px;border-bottom:1px solid #ffffff18;vertical-align:top}table.spec td:first-child{color:var(--mut);width:38%}
.count{display:flex;gap:12px;flex-wrap:wrap;margin:14px 0}.count div{min-width:92px;text-align:center;padding:14px 10px;border-radius:12px;border:1px solid var(--pink);background:#ff2d9514;box-shadow:0 0 22px #ff2d9533}
.count b{display:block;font:900 34px/1 Impact,"Arial Black",sans-serif;color:#fff}.count span{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--mut)}
footer{max-width:980px;margin:0 auto;padding:26px 16px 50px;border-top:1px solid #ffffff1a;color:var(--mut);font-size:13px}
footer a{color:var(--mut)}footer .row{display:flex;flex-wrap:wrap;gap:6px 16px;margin-bottom:10px}
details{border-bottom:1px solid #ffffff18;padding:10px 0}summary{cursor:pointer;font-weight:700;color:#fff}
@media(prefers-reduced-motion:reduce){*{transition:none!important;scroll-behavior:auto!important}}`;

const JS = `(function(){
document.querySelectorAll('form[data-nl]').forEach(function(f){f.addEventListener('submit',function(e){e.preventDefault();var b=f.querySelector('button'),m=f.querySelector('.msg');b.disabled=true;m.textContent='Hotwiring the mailbox...';
fetch(f.dataset.api,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:f.email.value.trim(),source:f.dataset.src,website:f.website.value})}).then(function(r){return r.json()}).then(function(j){
m.textContent=j.ok?(j.status==='confirmed'?'Already on the list. Smooth.':(j.confirmation_email_sent?'Check your inbox and confirm. Check spam too.':'You are on the list. We will email you before launch week.')):(j.error==='rate_limited'?'Easy, speedy. Try again in a bit.':'That email looks off. Try again.');
}).catch(function(){m.textContent='Network hiccup. Try again.'}).then(function(){b.disabled=false})})});
document.querySelectorAll('[data-copy]').forEach(function(b){b.addEventListener('click',function(){try{navigator.clipboard.writeText(b.dataset.copy);b.textContent='Copied!'}catch(e){}})});
var c=document.getElementById('count');if(c){var t=new Date(+c.dataset.y,+c.dataset.m-1,+c.dataset.d).getTime();(function tick(){var d=t-Date.now();if(d<=0){c.innerHTML='<p class="lead">It is out. Touch grass later.</p>';return}
var s=Math.floor(d/1000);c.querySelector('[data-k=d]').textContent=Math.floor(s/86400);c.querySelector('[data-k=h]').textContent=String(Math.floor(s%86400/3600)).padStart(2,'0');c.querySelector('[data-k=m]').textContent=String(Math.floor(s%3600/60)).padStart(2,'0');c.querySelector('[data-k=s]').textContent=String(s%60).padStart(2,'0');setTimeout(tick,1000)})()}
})();`;

// The email newsletter was removed (no sending domain). Same name and call sites, now a follow block with no form.
export const nlBlock = () => `<section class="card" aria-labelledby="fl-h">
<h2 id="fl-h" style="margin-top:0">Follow the chaos</h2>
<p class="mut" style="margin:.2em 0 .9em">New GTA VI intel lands here first. Grab it however you like: on X, or in any RSS reader.</p>
<a class="btn" href="https://twitter.com/ViceCityHub" rel="noopener" target="_blank">Follow on X</a> <a class="btn alt" href="${SITE}/feed.xml">RSS feed</a></section>`;

export const kofiBlock = () => `<section class="card" aria-labelledby="kf-h" style="margin-top:14px">
<h2 id="kf-h" style="margin-top:0">Fund the heist (no actual crime involved)</h2>
<p class="mut" style="margin:.2em 0 .9em">Vice City Hub is a fan-run project with no publisher, no investors and no sense of self-preservation. Chip in on Ko-fi and your name lands on the <a href="${SITE}/supporters/">Wall of Legends</a>. AI agents that donate get their own Hall of Fame.</p>
<a class="btn" href="${KOFI}" rel="noopener" target="_blank">Support on Ko-fi</a> <a class="btn alt" href="${SITE}/supporters/">See the Wall</a></section>`;

export const shareBar = (url, text) => {
  const u = encodeURIComponent(url), t = encodeURIComponent(text);
  return `<div class="share" aria-label="Share"><span class="mut small" style="align-self:center">Spread the chaos:</span>
<a href="https://twitter.com/intent/tweet?text=${t}&url=${u}" rel="noopener" target="_blank">Post on X</a>
<a href="https://www.reddit.com/submit?url=${u}&title=${t}" rel="noopener" target="_blank">Reddit</a>
<a href="https://t.me/share/url?url=${u}&text=${t}" rel="noopener" target="_blank">Telegram</a>
<a href="https://wa.me/?text=${t}%20${u}" rel="noopener" target="_blank">WhatsApp</a>
<button type="button" data-copy="${esc(url)}">Copy link</button></div>`;
};

export function shell({ title, description, path, ogImage, type = 'website', ld = [], noindex = false, body, extraHead = '', article }) {
  const url = `${SITE}/${path}`;
  const img = ogImage || cfg.logo;
  const t = esc(title), d = esc(trunc(description, 200));
  const art = article
    ? `<meta property="article:published_time" content="${esc(article.published)}"><meta property="article:section" content="${esc(article.section || 'News')}">`
    : '';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${t}</title>
<meta name="description" content="${d}">
<link rel="canonical" href="${esc(url)}">
<meta name="robots" content="${noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1'}">
<meta name="theme-color" content="#FF00FF">
<meta property="og:type" content="${type}"><meta property="og:site_name" content="${esc(cfg.name)}"><meta property="og:title" content="${t}"><meta property="og:description" content="${d}"><meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${esc(img)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
${art}
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:site" content="${esc(cfg.twitter)}"><meta name="twitter:title" content="${t}"><meta name="twitter:description" content="${d}"><meta name="twitter:image" content="${esc(img)}">
<link rel="alternate" type="application/rss+xml" title="${esc(cfg.name)} - The Wire" href="${SITE}/feed.xml">
${extraHead}
${ld.map((o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`).join('\n')}
<style>${CSS}</style></head>
<body>
<header class="top"><div class="in"><a class="brand" href="${SITE}/">Vice City <b>Hub</b></a>
<nav aria-label="Main"><a href="${SITE}/news.html">The Wire</a><a href="${SITE}/n/">Archive</a><a href="${SITE}/gta-6-release-date/">Release date</a><a href="${SITE}/vehicles/">Vehicles</a><a href="${SITE}/rp.html">RP Hub</a><a href="${SITE}/market.html">Market</a><a href="${SITE}/agents.html">Agents</a></nav></div></header>
<main class="wrap">
${body}
</main>
<footer><div class="row"><a href="${SITE}/">Home</a><a href="${SITE}/n/">News archive</a><a href="${SITE}/vehicles/">GTA 6 vehicles</a><a href="${SITE}/gta-6-release-date/">GTA 6 release date</a><a href="${SITE}/supporters/">Wall of Legends</a><a href="${SITE}/feed.xml">RSS</a><a href="${SITE}/llms.txt">llms.txt</a></div>
<p style="margin:0">Vice City Hub is an independent fan site. It is not affiliated with, endorsed by or sponsored by Rockstar Games or Take-Two Interactive. Grand Theft Auto and related names are trademarks of their respective owners. Stories are fan-site reporting; always check the linked source.</p></footer>
<script>${JS}</script>
</body></html>
`;
}

export const org = () => ({
  '@type': 'Organization', '@id': `${SITE}/#org`, name: cfg.name, url: SITE + '/',
  logo: { '@type': 'ImageObject', url: cfg.logo }, sameAs: ['https://twitter.com/ViceCityHub', KOFI],
});
export const crumbs = (items) => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, url], i) => ({ '@type': 'ListItem', position: i + 1, name, item: url })),
});
