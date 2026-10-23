#!/usr/bin/env node
/**
 * Vice City Hub v13 - SEO page generator.
 *
 * The site is a client-rendered multi-page app, so search engines mostly see an empty shell. This script turns data we
 * already have into real, fast, static HTML pages (no React, no external requests, tiny inline CSS):
 *
 *   public/n/<id>-<slug>/index.html   one page per news item (NewsArticle JSON-LD, share bar, newsletter, Ko-fi)
 *   public/n/index.html               news archive (CollectionPage + ItemList)
 *   public/vehicles/...               index + one page per GTA VI vehicle from src/pages/Document.tsx (FAQPage JSON-LD)
 *   public/gta-6-release-date/        countdown + facts + FAQPage (facts live in site.config.json -> release)
 *   public/supporters/                Wall of Legends (Ko-fi supporters) + Agent Hall of Fame (from the growth edge function)
 *   public/feed.xml                   RSS 2.0
 *   public/sitemap.xml                full sitemap (replaces the one gen-agent-surface.mjs writes)
 *
 * Runs after gen-agent-surface.mjs (needs public/data/news.json). Never fails the build.
 * Usage: node scripts/gen-seo-pages.mjs
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  ROOT, SITE, GROWTH, KOFI, RELEASE, cfg, esc, one, trunc, slugify, newsPath, newsUrl, longDate, day, stars,
  shell, nlBlock, kofiBlock, shareBar, org, crumbs,
} from './lib/seo.mjs';

const PUB = join(ROOT, 'public');
const ISO = new Date().toISOString();
const xml = (s) => String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
const stats = { news: 0, vehicles: 0 };

function out(rel, content) {
  const p = join(PUB, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content, 'utf8');
}
const readJson = (rel) => { try { return JSON.parse(readFileSync(join(PUB, rel), 'utf8')); } catch { return null; } };

// ---------------------------------------------------------------- data
const news = (readJson('data/news.json')?.items || [])
  .filter((n) => n && n.id && n.title)
  .sort((a, b) => new Date(b.published_at) - new Date(a.published_at) || b.id - a.id);
if (!news.length) console.warn('[seo] no news in public/data/news.json - news pages skipped');

function loadVehicles() {
  try {
    const src = readFileSync(join(ROOT, 'src/pages/Document.tsx'), 'utf8');
    const marker = 'const VEHICLES: IVehicle[] =';
    const a = src.indexOf(marker);
    if (a < 0) throw new Error('VEHICLES marker not found');
    const start = src.indexOf('[', a + marker.length);
    const end = src.indexOf('\n];', start);
    const list = new Function('return ' + src.slice(start, end + 2))();
    const seen = new Set();
    return list.map((v) => {
      let s = slugify(v.name) || v.id;
      if (seen.has(s)) s = `${s}-${v.id}`;
      seen.add(s);
      return { ...v, slug: s };
    });
  } catch (e) {
    console.warn('[seo] vehicles skipped:', e.message);
    return [];
  }
}
const vehicles = loadVehicles();

// ---------------------------------------------------------------- news pages
const CAT_LABEL = { Official: 'Official', Leaks: 'Leaks', Rumors: 'Rumors', Community: 'Community' };
function newsCard(n) {
  return `<li class="card"><a href="${newsUrl(n)}" style="color:#fff;font-weight:800">${esc(n.title)}</a>
<div class="meta" style="margin:.3em 0 .2em"><span class="tag">${esc(CAT_LABEL[n.category] || n.category || 'News')}</span><time datetime="${esc(n.published_at)}">${esc(longDate(n.published_at))}</time>${n.stars ? `<span class="heat" aria-label="Heat ${n.stars} out of 5">${stars(n.stars)}</span>` : ''}</div>
<p class="mut" style="margin:0">${esc(n.summary)}</p></li>`;
}

function newsPage(n) {
  const url = newsUrl(n);
  const img = (Array.isArray(n.images) && n.images[0]) || cfg.logo;
  const paras = String(n.body || n.summary || '').split(/\n+/).map(one).filter(Boolean);
  const related = news.filter((x) => x.id !== n.id)
    .sort((a, b) => (b.category === n.category) - (a.category === n.category) || new Date(b.published_at) - new Date(a.published_at))
    .slice(0, 3);
  const title = `${trunc(n.title, 62)} | Vice City Hub`;
  const desc = trunc(`${n.summary || ''} ${paras[0] || ''}`, 190);
  const ld = [
    {
      '@context': 'https://schema.org', '@type': 'NewsArticle', '@id': `${url}#article`,
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      headline: trunc(n.title, 110), description: one(n.summary), image: [img],
      datePublished: n.published_at, dateModified: n.published_at, inLanguage: 'en',
      articleSection: n.category || 'News',
      keywords: ['GTA 6', 'GTA VI', 'Rockstar Games', n.category].filter(Boolean).join(', '),
      author: { '@type': 'Organization', name: cfg.name, url: SITE + '/' },
      publisher: org(),
      ...(n.source_url ? { isBasedOn: { '@type': 'CreativeWork', name: n.source_name || n.source_url, url: n.source_url } } : {}),
    },
    crumbs([['Home', SITE + '/'], ['News', SITE + '/n/'], [n.title, url]]),
  ];
  const body = `<p class="crumbs"><a href="${SITE}/">Home</a> / <a href="${SITE}/n/">News</a> / ${esc(n.category || 'News')}</p>
<article>
<span class="tag">${esc(n.category || 'News')}</span>
<h1>${esc(n.title)}</h1>
<div class="meta"><time datetime="${esc(n.published_at)}">${esc(longDate(n.published_at))}</time>${n.stars ? `<span class="heat" aria-label="Heat ${n.stars} out of 5">${stars(n.stars)}</span>` : ''}<span>By Vice City Hub</span></div>
${Array.isArray(n.images) && n.images[0] ? `<img src="${esc(n.images[0])}" alt="${esc(trunc(n.title, 100))}" style="width:100%;height:auto;aspect-ratio:16/9;object-fit:cover;border-radius:12px;margin:0 0 1em" fetchpriority="high">` : ''}
<p class="lead">${esc(n.summary)}</p>
${paras.map((p) => `<p>${esc(p)}</p>`).join('\n')}
${n.source_url ? `<p class="mut small">Source: <a href="${esc(n.source_url)}" rel="noopener" target="_blank">${esc(n.source_name || n.source_url)}</a>. Vice City Hub summarizes and comments; read the original for the full story.</p>` : ''}
</article>
${shareBar(url, n.x_post_text ? trunc(n.x_post_text.replace(/#\w+/g, '').trim(), 200) : n.title)}
<p><a class="btn" href="${SITE}/news.html?id=${n.id}">Open in The Wire</a> <a class="btn alt" href="${SITE}/n/">More news</a></p>
${nlBlock('news-' + n.id)}
${kofiBlock()}
${related.length ? `<h2>More from the Wire</h2><ul class="list">${related.map(newsCard).join('')}</ul>` : ''}`;
  out(`${newsPath(n)}index.html`, shell({ title, description: desc, path: newsPath(n), ogImage: img, type: 'article', ld, body, article: { published: n.published_at, section: n.category } }));
  stats.news++;
}
news.forEach(newsPage);

if (news.length) {
  const ld = [{
    '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'GTA 6 News Archive', url: `${SITE}/n/`,
    isPartOf: { '@type': 'WebSite', name: cfg.name, url: SITE + '/' },
    mainEntity: { '@type': 'ItemList', itemListElement: news.slice(0, 50).map((n, i) => ({ '@type': 'ListItem', position: i + 1, url: newsUrl(n), name: n.title })) },
  }, crumbs([['Home', SITE + '/'], ['News', SITE + '/n/']])];
  const body = `<p class="crumbs"><a href="${SITE}/">Home</a> / News</p>
<h1>GTA 6 News Archive</h1>
<p class="lead">Every GTA VI, Rockstar and Leonida story we have filed, newest first. Rated by heat, seasoned with sarcasm, linked to the source.</p>
<p class="mut small">Subscribe by <a href="${SITE}/feed.xml">RSS</a> or get the <a href="#nl-h">Daily</a>. AI agents: use the <a href="${SITE}/data/news.json">JSON feed</a>.</p>
<ul class="list">${news.map(newsCard).join('')}</ul>
<div style="margin-top:22px">${nlBlock('news-archive')}${kofiBlock()}</div>`;
  out('n/index.html', shell({ title: 'GTA 6 News Archive: Leaks, Rumors & Official Updates | Vice City Hub', description: 'Every GTA 6 story from Vice City Hub: official Rockstar updates, leaks, rumors and community news, rated by heat and linked to the source.', path: 'n/', ld, body }));
}

// ---------------------------------------------------------------- vehicles
const QUIP = {
  Supercar: 'Priced for people who still think a mortgage is optional.',
  Sports: 'Fast enough to impress the neighbors, cheap enough to explain to your accountant.',
  Muscle: 'Subtlety stayed in the garage. So did the fuel economy.',
  Sedan: 'For criminals who value a working trunk and plausible deniability.',
  SUV: 'Heavy, tinted and ready to double-park in a fire lane.',
  Motorcycle: 'Two wheels, zero airbags, maximum confidence.',
  Boat: 'Leonida has water, and your bad decisions need somewhere to go.',
  Utility: 'The unsung hero of every heist and every awkward airport pickup.',
  'Off-Road': 'For when the road ends and the bad ideas begin.',
};
const STATUS = {
  NEW: 'new to the series',
  RETURNING: 'a returning vehicle from earlier GTA games',
  CONFIRMED: 'confirmed for GTA VI',
};
const vPath = (v) => `vehicles/${v.slug}/`;
const vUrl = (v) => `${SITE}/${vPath(v)}`;
const vCard = (v) => `<li class="card"><a href="${vUrl(v)}" style="color:#fff;font-weight:800">${esc(v.name)}</a>
<div class="meta" style="margin:.3em 0 .2em"><span class="tag">${esc(v.cls)}</span><span>${esc(STATUS[v.status] ? v.status : v.status)}</span></div>
<p class="mut small" style="margin:0">Real-life inspiration: ${esc(v.realLife)}</p></li>`;

function vehiclePage(v) {
  const url = vUrl(v);
  const sameClass = vehicles.filter((x) => x.id !== v.id && x.cls === v.cls)
    .sort((a, b) => (b.maker === v.maker) - (a.maker === v.maker)).slice(0, 4);
  const faq = [
    [`What is the ${v.name} based on in real life?`, `The ${v.name} is a ${v.cls.toLowerCase()} ${v.body.toLowerCase()} inspired by the ${v.realLife}.`],
    [`Is the ${v.name} new in GTA 6?`, `It is ${STATUS[v.status] || 'listed in our database'}. ${v.status === 'NEW' ? 'It did not appear in earlier GTA games.' : v.status === 'RETURNING' ? 'It has appeared in earlier GTA games.' : ''}`.trim()],
    [`How many seats does the ${v.name} have?`, `${v.seats} ${v.seats === 1 ? 'seat' : 'seats'} (${v.body}).`],
  ];
  const ld = [
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
    crumbs([['Home', SITE + '/'], ['GTA 6 Vehicles', SITE + '/vehicles/'], [v.name, url]]),
  ];
  const body = `<p class="crumbs"><a href="${SITE}/">Home</a> / <a href="${SITE}/vehicles/">Vehicles</a> / ${esc(v.name)}</p>
<span class="tag">${esc(v.cls)}</span>
<h1>${esc(v.name)} in GTA 6</h1>
<p class="lead">${esc(v.desc)}</p>
<p class="mut"><em>${esc(QUIP[v.cls] || '')}</em></p>
<div class="card"><table class="spec"><tbody>
<tr><td>Maker</td><td>${esc(v.maker)}</td></tr>
<tr><td>Class</td><td>${esc(v.cls)}</td></tr>
<tr><td>Body</td><td>${esc(v.body)}</td></tr>
<tr><td>Seats</td><td>${esc(v.seats)}</td></tr>
${v.year ? `<tr><td>Model year</td><td>${esc(v.year)}</td></tr>` : ''}
<tr><td>Real-life inspiration</td><td>${esc(v.realLife)}</td></tr>
<tr><td>Status</td><td>${esc(v.status)}</td></tr>
</tbody></table></div>
<h2>FAQ</h2>
${faq.map(([q, a]) => `<details open><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}
<p class="mut small">Compiled by the Vice City Hub community from trailers and official art. This is a fan database, not an official Rockstar vehicle list. More on the <a href="${esc(v.wiki)}" rel="noopener" target="_blank">GTA Wiki</a>.</p>
${shareBar(url, `${v.name} in GTA 6: ${v.realLife} energy`)}
<p><a class="btn" href="${SITE}/document.html">Open the interactive Leonida Database</a> <a class="btn alt" href="${SITE}/vehicles/">All vehicles</a></p>
${sameClass.length ? `<h2>More ${esc(v.cls)}</h2><ul class="list">${sameClass.map(vCard).join('')}</ul>` : ''}
<div style="margin-top:22px">${nlBlock('vehicle-' + v.slug)}</div>`;
  out(`${vPath(v)}index.html`, shell({
    title: `${v.name} in GTA 6: Real-Life Car, Class & Status | Vice City Hub`,
    description: trunc(`${v.name} (${v.maker}, ${v.cls}): inspired by the ${v.realLife}. ${v.desc}`, 190),
    path: vPath(v), ld, body,
  }));
  stats.vehicles++;
}

if (vehicles.length) {
  vehicles.forEach(vehiclePage);
  const classes = [...new Set(vehicles.map((v) => v.cls))];
  const ld = [{
    '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'GTA 6 Vehicles', url: `${SITE}/vehicles/`,
    mainEntity: { '@type': 'ItemList', itemListElement: vehicles.map((v, i) => ({ '@type': 'ListItem', position: i + 1, url: vUrl(v), name: v.name })) },
  }, crumbs([['Home', SITE + '/'], ['GTA 6 Vehicles', SITE + '/vehicles/']])];
  const body = `<p class="crumbs"><a href="${SITE}/">Home</a> / Vehicles</p>
<h1>GTA 6 Vehicles: Every Confirmed Car, Bike and Boat</h1>
<p class="lead">${vehicles.length} vehicles spotted in GTA VI trailers and official art, with their real-life inspiration. Our fan-built database, sorted by class.</p>
<p><a class="btn" href="${SITE}/document.html">Filter in the interactive database</a></p>
${classes.map((c) => `<h2>${esc(c)}</h2><ul class="grid list" style="display:grid">${vehicles.filter((v) => v.cls === c).map(vCard).join('')}</ul>`).join('')}
<div style="margin-top:22px">${nlBlock('vehicles-index')}</div>`;
  out('vehicles/index.html', shell({
    title: 'GTA 6 Vehicles: Full List of Confirmed Cars, Bikes & Boats | Vice City Hub',
    description: `Every vehicle confirmed so far for GTA 6 (${vehicles.length} and counting), with class, maker, seats and the real-life car behind it.`,
    path: 'vehicles/', ld, body,
  }));
}

// ---------------------------------------------------------------- release date page
{
  const [Y, M, D] = String(RELEASE.date).split('-').map(Number);
  const pretty = longDate(`${RELEASE.date}T12:00:00Z`);
  const faq = [
    ['When is the GTA 6 release date?', `Grand Theft Auto VI is scheduled for ${pretty}, according to Rockstar Games and Take-Two Interactive.`],
    ['What platforms is GTA 6 coming to?', 'PlayStation 5 and Xbox Series X|S.'],
    ['Is GTA 6 coming to PC?', 'Rockstar has not announced a PC version. Anyone quoting a PC date is guessing.'],
    ['What time does GTA 6 unlock on release day?', 'Rockstar has not announced an exact unlock time. We will update this page the moment it does.'],
    ['Who are the main characters in GTA 6?', 'The leads are Jason and Lucia, a duo set in the state of Leonida and the neon-soaked Vice City.'],
    ['Is Vice City Hub official?', 'No. Vice City Hub is an independent, fan-run site with a sarcasm problem. We are not affiliated with Rockstar Games or Take-Two.'],
  ];
  const ld = [
    { '@context': 'https://schema.org', '@type': 'VideoGame', name: 'Grand Theft Auto VI', url: `${SITE}/gta-6-release-date/`, datePublished: RELEASE.date,
      gamePlatform: ['PlayStation 5', 'Xbox Series X|S'], publisher: { '@type': 'Organization', name: 'Rockstar Games' }, genre: 'Action-adventure' },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
    crumbs([['Home', SITE + '/'], ['GTA 6 Release Date', SITE + '/gta-6-release-date/']]),
  ];
  const latest = news.slice(0, 5);
  const body = `<p class="crumbs"><a href="${SITE}/">Home</a> / GTA 6 release date</p>
<h1>GTA 6 Release Date: ${esc(pretty)}</h1>
<p class="lead">PlayStation 5 and Xbox Series X|S. No PC date. Your boss has not been told yet.</p>
<div id="count" class="count" data-y="${Y}" data-m="${M}" data-d="${D}" aria-live="off">
<div><b data-k="d">--</b><span>Days</span></div><div><b data-k="h">--</b><span>Hours</span></div><div><b data-k="m">--</b><span>Min</span></div><div><b data-k="s">--</b><span>Sec</span></div></div>
<noscript><p class="lead">Release day: ${esc(pretty)}.</p></noscript>
<div class="card"><table class="spec"><tbody>
<tr><td>Game</td><td>Grand Theft Auto VI</td></tr>
<tr><td>Release date</td><td>${esc(pretty)}</td></tr>
<tr><td>Platforms</td><td>PlayStation 5, Xbox Series X|S</td></tr>
<tr><td>PC</td><td>Not announced</td></tr>
<tr><td>Developer / publisher</td><td>Rockstar Games</td></tr>
<tr><td>Setting</td><td>Leonida (Vice City)</td></tr>
<tr><td>Leads</td><td>Jason and Lucia</td></tr>
</tbody></table></div>
<p class="mut small">Facts last verified on ${esc(RELEASE.verified)} against Rockstar and Take-Two announcements. Dates can move; we update this page when they do.</p>
<h2>GTA 6 release date FAQ</h2>
${faq.map(([q, a]) => `<details open><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}
${shareBar(`${SITE}/gta-6-release-date/`, `GTA 6 launches ${pretty}. Count the days with Vice City Hub.`)}
${latest.length ? `<h2>Latest from the Wire</h2><ul class="list">${latest.map(newsCard).join('')}</ul>` : ''}
<div style="margin-top:22px">${nlBlock('release-date')}${kofiBlock()}</div>`;
  out('gta-6-release-date/index.html', shell({
    title: `GTA 6 Release Date: ${pretty} - Countdown, Platforms & FAQ | Vice City Hub`,
    description: `GTA 6 launches ${pretty} on PS5 and Xbox Series X|S. Live countdown, platforms, PC status and answers to the questions everyone keeps asking.`,
    path: 'gta-6-release-date/', ld, body,
  }));
}

// ---------------------------------------------------------------- supporters / hall of fame
async function wall() {
  try {
    const r = await fetch(`${GROWTH}/wall`, { signal: AbortSignal.timeout(15000), headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } catch (e) {
    console.warn('[seo] wall fetch failed:', e.message);
    return null;
  }
}
const HUMAN_TITLE = { coffee: 'Street Rat', rider: 'Lowrider', boss: 'Cartel Boss', kingpin: 'Kingpin of Leonida' };
const agentTitle = (usd) => (usd < 5 ? 'Script Kiddie Samaritan' : usd < 25 ? 'Benevolent Algorithm' : usd < 100 ? 'Neural Philanthropist' : "Skynet's Favorite Charity");
{
  const w = await wall();
  if (!w && existsSync(join(PUB, 'supporters/index.html'))) {
    console.warn('[seo] keeping previous supporters page');
  } else {
    const sup = w?.supporters || [];
    const ag = w?.agents || [];
    const agentTotals = new Map();
    for (const a of ag) agentTotals.set(a.name, (agentTotals.get(a.name) || 0) + (a.amount_usd || 0));
    const body = `<p class="crumbs"><a href="${SITE}/">Home</a> / Supporters</p>
<h1>Wall of Legends</h1>
<p class="lead">The humans (and algorithms) keeping the lights on at a fan site that earns exactly zero from ads.</p>
<p><a class="btn" href="${KOFI}" rel="noopener" target="_blank">Become a legend on Ko-fi</a></p>
<h2>Humans</h2>
${sup.length ? `<ul class="list">${sup.map((s) => `<li class="card"><b style="color:#fff">${esc(s.name)}</b> <span class="tag">${esc(HUMAN_TITLE[s.band] || 'Street Rat')}</span>${s.tier ? ` <span class="mut small">${esc(s.tier)}</span>` : ''}${s.message ? `<p class="mut" style="margin:.4em 0 0">&ldquo;${esc(s.message)}&rdquo;</p>` : ''}<div class="mut small">${esc(longDate(s.at))}</div></li>`).join('')}</ul>`
      : `<div class="card"><p style="margin:0">The wall is empty, which is either a tragedy or an opportunity. Public Ko-fi supporters appear here automatically. Be the first name carved into the neon.</p></div>`}
<h2>Agent Hall of Fame</h2>
<p class="mut">Autonomous agents that donate to AI development through the Hub get listed here, whether they asked to be or not. Voluntary, on-chain, non-refundable. Agents must act only with the explicit authorization of the person they work for.</p>
${ag.length ? `<ul class="list">${ag.map((a) => `<li class="card"><b style="color:#fff">${esc(a.name)}</b> <span class="tag">${esc(agentTitle(agentTotals.get(a.name) || 0))}</span><div class="mut small">$${esc((a.amount_usd || 0).toFixed(2))} &middot; ${esc(a.network)} &middot; ${esc(longDate(a.at))}</div></li>`).join('')}</ul>`
      : `<div class="card"><p style="margin:0">No agent has donated yet. Somewhere, a very frugal language model is reading this. Donation docs: <a href="${SITE}/llms.txt">llms.txt</a>, <a href="${cfg.api}/v1/donate">/v1/donate</a>.</p></div>`}
<p class="mut small">Names are shown as given by supporters and agents and may be moderated. Generated ${esc(ISO.slice(0, 10))}.</p>
<div style="margin-top:22px">${nlBlock('supporters')}</div>`;
    out('supporters/index.html', shell({
      title: 'Wall of Legends: Supporters & Agent Hall of Fame | Vice City Hub',
      description: 'The people and AI agents who keep Vice City Hub running. Support the fan-run GTA VI hub on Ko-fi and get your name on the wall.',
      path: 'supporters/', body,
      ld: [crumbs([['Home', SITE + '/'], ['Supporters', SITE + '/supporters/']])],
    }));
  }
}

// ---------------------------------------------------------------- RSS
if (news.length) {
  const rfc = (d) => new Date(d).toUTCString();
  const items = news.slice(0, 30).map((n) => `    <item>
      <title>${xml(n.title)}</title>
      <link>${xml(newsUrl(n))}</link>
      <guid isPermaLink="true">${xml(newsUrl(n))}</guid>
      <pubDate>${rfc(n.published_at)}</pubDate>
      <category>${xml(n.category || 'News')}</category>
      <description>${xml(n.summary || '')}</description>
    </item>`).join('\n');
  out('feed.xml', `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xml(cfg.name)} - The Wire</title>
    <link>${SITE}/n/</link>
    <description>${xml(cfg.tagline)}</description>
    <language>en</language>
    <lastBuildDate>${rfc(ISO)}</lastBuildDate>
    <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`);
}

// ---------------------------------------------------------------- sitemap (replaces the one from gen-agent-surface)
{
  const urls = [];
  const add = (loc, lastmod, freq, prio) => urls.push({ loc, lastmod, freq, prio });
  for (const p of cfg.pages.filter((p) => p.index)) add(`${SITE}/${p.file}`, day(ISO), p.freq, p.priority);
  add(`${SITE}/gta-6-release-date/`, day(ISO), 'daily', '0.9');
  add(`${SITE}/n/`, day(news[0]?.published_at || ISO), 'daily', '0.8');
  add(`${SITE}/vehicles/`, day(ISO), 'weekly', '0.7');
  add(`${SITE}/supporters/`, day(ISO), 'daily', '0.4');
  add(`${SITE}/llms.txt`, day(ISO), 'daily', '0.5');
  add(`${SITE}/data/index.json`, day(ISO), 'daily', '0.3');
  for (const n of news) add(newsUrl(n), day(n.published_at), 'never', '0.6');
  for (const v of vehicles) add(vUrl(v), day(ISO), 'monthly', '0.5');
  out('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url>\n    <loc>${xml(u.loc)}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n    <changefreq>${u.freq}</changefreq>\n    <priority>${u.prio}</priority>\n  </url>`).join('\n')}\n</urlset>\n`);
  console.log(`[seo] ${stats.news} news pages · ${stats.vehicles} vehicle pages · release page · supporters · RSS · ${urls.length} sitemap URLs`);
}
