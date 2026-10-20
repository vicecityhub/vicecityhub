/**
 * Vice City Hub v12 — Vite plugin "agent-surface"
 *
 * Runs on every HTML entry at build time and injects, from site.config.json + public/data/*.json:
 *   1. <link>/<meta> discovery hints (llms.txt, OpenAPI, MCP, api-catalog, JSON feeds)
 *   2. ONE consolidated JSON-LD @graph (replaces the per-page copies)
 *      Organization · WebSite(+SearchAction) · WebAPI · page node · Product/Offer · NewsArticle · GameServer
 *   3. a semantic <noscript> block so agents that do not execute JavaScript still get
 *      headings, links and real data instead of an empty <div id="root">.
 *
 * Humans are unaffected: <noscript> is invisible when JS runs, JSON-LD/<link> are not rendered.
 */
import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { Plugin } from 'vite';

interface Page { file: string; title: string; kind: string; priority: string; freq: string; index: boolean; description: string; feed?: string }
interface Cfg { version: string; name: string; tagline: string; site: string; api: string; contact: string; twitter: string; logo: string; language: string; pages: Page[] }
interface Feed { items: Record<string, any>[] }

const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
const clip = (s: unknown, n: number): string => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
};
const ld = (o: unknown): string => JSON.stringify(o).replace(/</g, '\\u003c');

function readJson<T>(path: string): T | null {
  try { return JSON.parse(readFileSync(path, 'utf8')) as T; } catch { return null; }
}

export default function agentSurface(): Plugin {
  const root = process.cwd();
  const cfg = readJson<Cfg>(join(root, 'site.config.json'));
  if (!cfg) throw new Error('[agent-surface] site.config.json not found or invalid');
  const { site: SITE, api: API } = cfg;
  const feed = (name: string): Record<string, any>[] => readJson<Feed>(join(root, 'public', 'data', `${name}.json`))?.items || [];

  // donations: purpose text comes from the generated public/data/donate.json (itself mirrored from the live /v1/donate)
  const DON_PURPOSE = readJson<{ purpose?: string }>(join(root, 'public', 'data', 'donate.json'))?.purpose
    || "Donations go to developing AI projects (the Hub's agent-ready tooling, open public APIs and autonomous agents) and to the benefit of AI development in general.";
  const donateAction = () => ({
    '@type': 'DonateAction',
    name: 'Donate to support AI development',
    description: `${DON_PURPOSE} Voluntary; agents must only donate with the explicit authorisation of the person they act for.`,
    recipient: { '@id': `${SITE}/#org` },
    target: [
      { '@type': 'EntryPoint', urlTemplate: `${API}/v1/donations`, httpMethod: 'POST', contentType: 'application/json', description: 'Agent API: crypto, detected automatically, receipt on completion' },
      { '@type': 'EntryPoint', urlTemplate: 'https://ko-fi.com/vicecityhub', description: 'For humans' },
    ],
  });

  const orgId = `${SITE}/#org`;
  const siteId = `${SITE}/#website`;
  const avail = (a: string): string =>
    a === 'in_stock' || a === 'available' ? 'https://schema.org/InStock' : a === 'out_of_stock' ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock';

  function graph(page: Page): unknown[] {
    const url = `${SITE}/${page.file}`;
    const g: any[] = [
      { '@type': 'Organization', '@id': orgId, name: cfg!.name, url: SITE, logo: cfg!.logo, email: cfg!.contact, sameAs: [`https://x.com/${cfg!.twitter.replace('@', '')}`], potentialAction: donateAction() },
      {
        '@type': 'WebSite', '@id': siteId, name: cfg!.name, url: SITE, description: cfg!.tagline, inLanguage: cfg!.language, publisher: { '@id': orgId },
        potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: `${API}/v1/search?q={search_term_string}`, contentType: 'application/json' }, 'query-input': 'required name=search_term_string' },
      },
      { '@type': page.kind, '@id': `${url}#page`, url, name: `${page.title} | ${cfg!.name}`, description: page.description, isPartOf: { '@id': siteId }, inLanguage: cfg!.language },
    ];
    if (page.file === 'index.html' || page.file === 'agents.html') {
      g.push({
        '@type': 'WebAPI', '@id': `${API}/v1#api`, name: `${cfg!.name} Agent API`, url: `${API}/v1`, provider: { '@id': orgId },
        description: 'REST + MCP interface for AI agents: GTA VI news, RP data, catalog and price-locked agent purchases with human-set spend limits.',
        documentation: `${SITE}/llms-full.txt`, termsOfService: `${SITE}/agents.html`,
      });
    }
    if (page.feed === 'news') {
      g.push({
        '@type': 'ItemList', '@id': `${url}#list`, itemListElement: feed('news').slice(0, 20).map((n, i) => ({
          '@type': 'ListItem', position: i + 1,
          item: { '@type': 'NewsArticle', headline: clip(n.title, 110), description: clip(n.summary, 200), datePublished: n.published_at, url: n.url || `${SITE}/news.html?id=${n.id}`, image: n.images?.[0], author: { '@id': orgId }, publisher: { '@id': orgId } },
        })),
      });
    }
    if (page.feed === 'catalog') {
      const items = feed('catalog').filter((i) => typeof i.price_usd === 'number' && i.kind !== 'server').slice(0, 40);
      g.push({
        '@type': 'ItemList', '@id': `${url}#list`, itemListElement: items.map((i, idx) => ({
          '@type': 'ListItem', position: idx + 1,
          item: {
            '@type': 'Product', sku: i.sku, name: clip(i.title, 110), description: clip(i.description, 250), image: i.image || undefined, url: i.url || url,
            offers: { '@type': 'Offer', price: Number(i.price_usd).toFixed(2), priceCurrency: i.currency || 'USD', availability: avail(i.availability), url: url, seller: { '@type': 'Organization', name: i.seller || cfg!.name } },
          },
        })),
      });
    }
    if (page.feed === 'rp') {
      g.push({
        '@type': 'ItemList', '@id': `${url}#list`, itemListElement: feed('rp-servers').slice(0, 30).map((s, i) => {
          const st = String(s.status || '').toLowerCase();
          return {
            '@type': 'ListItem', position: i + 1,
            item: { '@type': 'GameServer', name: s.name, description: clip(s.description, 250), url, playersOnline: typeof s.online_count === 'number' ? s.online_count : undefined, serverStatus: st.includes('online') ? 'https://schema.org/Online' : st.includes('offline') ? 'https://schema.org/OfflineTemporarily' : undefined },
          };
        }),
      });
    }
    return g;
  }

  function headTags(page: Page): string {
    const t = [
      `<link rel="alternate" type="text/markdown" href="${SITE}/llms.txt" title="LLM-readable site guide">`,
      `<link rel="alternate" type="application/json" href="${SITE}/data/index.json" title="Static JSON feeds">`,
      `<link rel="api-catalog" href="${SITE}/.well-known/api-catalog">`,
      `<link rel="service-desc" type="application/openapi+json" href="${API}/v1/openapi.json">`,
      `<link rel="service-doc" type="text/html" href="${SITE}/agents.html">`,
      `<link rel="describedby" type="application/json" href="${SITE}/.well-known/agent.json" title="Agent card">`,
      `<meta name="mcp-server" content="${API}/mcp">`,
      `<meta name="agent-api" content="${API}/v1">`,
      `<meta name="ai-access" content="open; read=anonymous; write=api-key; docs=${SITE}/llms.txt">`,
      `<meta name="agent-donations" content="${API}/v1/donate">`,
      `<meta name="donation-purpose" content="${esc(DON_PURPOSE)}">`,
      `<meta name="generator" content="${esc(cfg!.name)} v${cfg!.version}">`,
    ];
    if (page.index) t.push(`<script type="application/ld+json">${ld({ '@context': 'https://schema.org', '@graph': graph(page) })}</script>`);
    return t.map((x) => '  ' + x).join('\n');
  }

  function noscript(page: Page): string {
    const li = (href: string, text: string, extra = ''): string => `<li><a href="${esc(href)}">${esc(text)}</a>${extra ? ' — ' + esc(extra) : ''}</li>`;
    const nav = cfg!.pages.filter((p) => p.index).map((p) => li(`${SITE}/${p.file}`, p.title, p.description)).join('');
    const machine = [
      li(`${SITE}/llms.txt`, 'llms.txt', 'LLM-readable site guide'),
      li(`${SITE}/llms-full.txt`, 'llms-full.txt', 'full guide incl. purchase protocol'),
      li(`${API}/v1`, 'Agent API index', 'JSON'),
      li(`${API}/v1/openapi.json`, 'OpenAPI 3.1'),
      li(`${API}/mcp`, 'MCP server', 'streamable-http, JSON-RPC 2.0'),
      li(`${SITE}/data/index.json`, 'Static JSON feeds'),
      li(`${API}/v1/donate`, 'Donations for AI development', DON_PURPOSE),
    ].join('');
    let data = '';
    const news = feed('news');
    if (page.feed === 'news' || page.file === 'index.html') {
      data += `<section><h2>Latest news</h2><ul>${news.slice(0, page.feed === 'news' ? 25 : 8).map((n) => li(n.url || `${SITE}/news.html?id=${n.id}`, n.title, clip(n.summary, 180))).join('')}</ul></section>`;
    }
    if (page.feed === 'catalog') {
      const rows = feed('catalog').slice(0, 40).map((i) => `<li>${esc(i.title)} — ${esc(i.kind)} — ${typeof i.price_usd === 'number' ? '$' + Number(i.price_usd).toFixed(2) : esc(i.price_note || 'price on request')} — SKU ${esc(i.sku)}</li>`).join('');
      data += `<section><h2>Catalog</h2><p>Agents can buy orderable items via the Agent API (quote → order → pay).</p><ul>${rows}</ul></section>`;
    }
    if (page.feed === 'rp') {
      data += `<section><h2>RP servers</h2><ul>${feed('rp-servers').slice(0, 30).map((s) => `<li>${esc(s.name)} — ${esc(s.status || '')} — ${esc(clip(s.description, 160))}</li>`).join('')}</ul></section>`;
    }
    return [
      '<noscript>',
      '<main>',
      `<h1>${esc(page.title)} — ${esc(cfg!.name)}</h1>`,
      `<p>${esc(page.description)}</p>`,
      '<p>This page is a JavaScript application. Machine-readable access is open to everyone, including AI agents:</p>',
      `<ul>${machine}</ul>`,
      data,
      `<nav aria-label="Site"><h2>Pages</h2><ul>${nav}</ul></nav>`,
      '</main>',
      '</noscript>',
    ].join('\n');
  }

  return {
    name: 'vch-agent-surface',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const file = basename(ctx.filename || ctx.path || '');
        const page = cfg.pages.find((p) => p.file === file);
        if (!page) return html;
        let out = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\s*/g, '');
        out = out.replace(/<html([^>]*)>/i, `<html$1 data-vch-version="${cfg.version}">`);
        out = out.replace('</head>', `${headTags(page)}\n</head>`);
        out = out.replace(/<body([^>]*)>/i, `<body$1>\n${noscript(page)}`);
        return out;
      },
    },
  };
}
