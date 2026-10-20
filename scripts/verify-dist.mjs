#!/usr/bin/env node
/**
 * Vice City Hub v12 — verifies the BUILT site (dist/) is actually agent-ready.
 * Exit code 1 on any failure. Run after `npm run build`:  node scripts/verify-dist.mjs
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const cfg = JSON.parse(readFileSync('site.config.json', 'utf8'));
let bad = 0;
const check = (name, ok, extra = '') => { if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  → ' + extra : ''}`); };
const read = (f) => readFileSync(join(DIST, f), 'utf8');

// 1. required files
for (const f of ['llms.txt', 'llms-full.txt', 'openapi.json', 'sitemap.xml', 'robots.txt', '.well-known/agent.json', '.well-known/mcp.json', '.well-known/mcp/server-card.json', '.well-known/api-catalog', '.well-known/ai-plugin.json', '.well-known/security.txt', 'data/index.json', 'data/catalog.json', 'data/news.json'])
  check(`file ${f}`, existsSync(join(DIST, f)) && read(f).length > 20);

// 2. JSON files parse
for (const f of ['openapi.json', '.well-known/agent.json', '.well-known/mcp.json', '.well-known/api-catalog', '.well-known/ai-plugin.json', 'data/index.json', 'data/catalog.json', 'data/news.json']) {
  try { JSON.parse(read(f)); check(`json ${f}`, true); } catch (e) { check(`json ${f}`, false, e.message); }
}

// 3. every HTML entry got the discovery layer; indexable ones got JSON-LD
for (const p of cfg.pages) {
  if (!existsSync(join(DIST, p.file))) { check(`page ${p.file}`, false, 'missing in dist'); continue; }
  const h = read(p.file);
  const ldBlocks = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  let ldOk = true, types = [];
  for (const m of ldBlocks) { try { types = types.concat((JSON.parse(m[1])['@graph'] || []).map((x) => x['@type'])); } catch { ldOk = false; } }
  const links = h.includes('rel="alternate" type="text/markdown"') && h.includes('name="mcp-server"') && h.includes('rel="service-desc"') && h.includes('rel="api-catalog"');
  check(`${p.file}: discovery links + <noscript>`, links && /<noscript>/.test(h));
  if (p.index) check(`${p.file}: JSON-LD (${[...new Set(types)].join(', ')})`, ldBlocks.length === 1 && ldOk && types.includes('Organization') && types.includes('WebSite'));
  else check(`${p.file}: not indexable → no JSON-LD`, ldBlocks.length === 0);
}
const market = read('market.html');
check('market.html: Product + Offer in JSON-LD', market.includes('"@type":"Product"') && market.includes('"@type":"Offer"'));
check('news.html: NewsArticle in JSON-LD', read('news.html').includes('"@type":"NewsArticle"'));
check('rp.html: GameServer in JSON-LD', read('rp.html').includes('"@type":"GameServer"'));
check('index.html: WebAPI in JSON-LD', read('index.html').includes('"@type":"WebAPI"'));

// 3b. donations are discoverable by agents and state their purpose
check('llms.txt: donation section states the AI purpose', /Support the project \(donations for AI development\)/.test(read('llms.txt')) && /AI projects/.test(read('llms.txt')) && /never on your own initiative/.test(read('llms.txt')));
check('agent.json: donations block', (() => { try { const a = JSON.parse(read('.well-known/agent.json')); return /AI/.test(a.donations?.purpose || '') && /\/v1\/donations$/.test(a.donations?.create || '') && a.donations?.voluntary === true; } catch { return false; } })());
check('index.html: DonateAction in JSON-LD + meta', read('index.html').includes('"@type":"DonateAction"') && read('index.html').includes('name="agent-donations"'));
check('data/donate.json present', existsSync(join(DIST, 'data/donate.json')) && /AI/.test(read('data/donate.json')));

// 4. sitemap & robots sanity
const sm = read('sitemap.xml');
check('sitemap lists agents.html', sm.includes('/agents.html'));
check('sitemap has no noindex pages', !/post\.html|profile\.html|reset-password\.html/.test(sm));
const rb = read('robots.txt');
check('robots.txt allows AI agents', /User-agent: ChatGPT-User/.test(rb) && /User-agent: Claude-User/.test(rb) && /Sitemap:/.test(rb));

// 5. PayPal client id still compiled into the market bundle (guards the .env.production move)
try {
  const id = (readFileSync('.env.production', 'utf8').match(/VITE_PAYPAL_CLIENT_ID=(\S+)/) || [])[1];
  let js = '';
  for (const f of readdirSync(join(DIST, 'assets', 'js'))) js += read(join('assets', 'js', f));
  check('PayPal client id present in bundle', !!id && js.includes(id));
} catch (e) { check('PayPal client id present in bundle', false, e.message); }

console.log(bad ? `\n${bad} check(s) FAILED` : '\nAll checks passed');
process.exitCode = bad ? 1 : 0; // (not process.exit: it truncates piped stdout on Windows)
