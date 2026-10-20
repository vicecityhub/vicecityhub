#!/usr/bin/env node
/**
 * Vice City Hub v12 - root discovery bundle
 *
 * GitHub Pages serves this repo as a PROJECT site (https://vicecityhub.github.io/vicecityhub/),
 * but crawlers and AI agents look for robots.txt, llms.txt and /.well-known/* at the HOST ROOT
 * (https://vicecityhub.github.io/). This script builds root-site/ from the already generated
 * public/ files. Push the CONTENTS of root-site/ to a repo named `vicecityhub.github.io`
 * (a GitHub user/org site) and the root becomes discoverable. All URLs stay absolute, so the
 * real site keeps living under /vicecityhub/.
 *
 * Usage: node scripts/gen-root-site.mjs   (run after `npm run gen:agent`)
 */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUB = join(ROOT, 'public');
const OUT = join(ROOT, 'root-site');
const cfg = JSON.parse(readFileSync(join(ROOT, 'site.config.json'), 'utf8'));
const SITE = cfg.site; // https://vicecityhub.github.io/vicecityhub
const HOST = SITE.replace(/\/[^/]+$/, ''); // https://vicecityhub.github.io
const API = cfg.api;

let DON_PURPOSE = "Donations go to developing AI projects (the Hub's agent-ready tooling, open public APIs and autonomous agents) and to the benefit of AI development in general.";
try { DON_PURPOSE = JSON.parse(readFileSync(join(PUB, 'data', 'donate.json'), 'utf8')).purpose || DON_PURPOSE; } catch { /* keep default */ }
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const need = (rel) => {
  const p = join(PUB, rel);
  if (!existsSync(p)) throw new Error(`public/${rel} missing - run "npm run gen:agent" first`);
  return p;
};
const put = (rel, content) => {
  const p = join(OUT, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content, 'utf8');
};

mkdirSync(OUT, { recursive: true });

// 1. verbatim copies (every URL inside is already absolute)
for (const rel of ['llms.txt', 'llms-full.txt', 'openapi.json', 'sitemap.xml']) {
  mkdirSync(dirname(join(OUT, rel)), { recursive: true });
  cpSync(need(rel), join(OUT, rel));
}
cpSync(need('.well-known'), join(OUT, '.well-known'), { recursive: true });
cpSync(need('data'), join(OUT, 'data'), { recursive: true });

// 2. robots.txt: same rules, but the disallowed path must be the real (prefixed) one
let robots = readFileSync(need('robots.txt'), 'utf8').replace('Disallow: /reset-password.html', 'Disallow: /vicecityhub/reset-password.html');
if (!robots.includes(`${HOST}/sitemap.xml`)) robots = robots.trimEnd() + `\nSitemap: ${HOST}/sitemap.xml\n`;
put('robots.txt', robots);

// 3. security.txt canonical must point at the root copy
const secPath = join(OUT, '.well-known', 'security.txt');
if (existsSync(secPath)) {
  const sec = readFileSync(secPath, 'utf8').replace(/^Canonical:.*$/m, `Canonical: ${HOST}/.well-known/security.txt`);
  writeFileSync(secPath, sec, 'utf8');
}

// 4. root landing page: instant redirect for humans, full discovery links for machines
put('index.html', `<!doctype html>
<html lang="${esc(cfg.language)}" data-vch-version="${esc(cfg.version)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(cfg.name)} - ${esc(cfg.tagline)}</title>
  <meta name="description" content="${esc(cfg.tagline)}">
  <link rel="canonical" href="${SITE}/">
  <meta http-equiv="refresh" content="0; url=${SITE}/">
  <link rel="alternate" type="text/markdown" href="${HOST}/llms.txt" title="LLM-readable site guide">
  <link rel="alternate" type="application/json" href="${HOST}/data/index.json" title="Static JSON feeds">
  <link rel="api-catalog" href="${HOST}/.well-known/api-catalog">
  <link rel="service-desc" type="application/openapi+json" href="${API}/v1/openapi.json">
  <link rel="service-doc" type="text/html" href="${SITE}/agents.html">
  <link rel="describedby" type="application/json" href="${HOST}/.well-known/agent.json" title="Agent card">
  <meta name="mcp-server" content="${API}/mcp">
  <meta name="agent-api" content="${API}/v1">
  <meta name="ai-access" content="open; read=anonymous; write=api-key; docs=${HOST}/llms.txt">
  <meta name="agent-donations" content="${API}/v1/donate">
  <meta name="donation-purpose" content="${esc(DON_PURPOSE)}">
  <meta name="generator" content="${esc(cfg.name)} v${esc(cfg.version)}">
</head>
<body>
  <main>
    <h1>${esc(cfg.name)}</h1>
    <p>${esc(cfg.tagline)}</p>
    <p>Humans: <a href="${SITE}/">enter the site</a>.</p>
    <p>AI agents: <a href="${HOST}/llms.txt">llms.txt</a> |
      <a href="${API}/v1">Agent API</a> |
      <a href="${API}/v1/openapi.json">OpenAPI</a> |
      <a href="${API}/mcp">MCP server</a> |
      <a href="${HOST}/.well-known/agent.json">agent card</a> |
      <a href="${HOST}/data/index.json">JSON feeds</a> |
      <a href="${API}/v1/donate">Donations: ${esc(DON_PURPOSE)}</a></p>
  </main>
</body>
</html>
`);
put('.nojekyll', '');

put('README.md', `# vicecityhub.github.io - root discovery bundle (generated)

Generated by \`npm run gen:root\` in the main repo. Do not edit by hand.

Publish: create a public repo named \`vicecityhub.github.io\` under the same account/org, push the
CONTENTS of this folder to its default branch, then enable Pages (Settings > Pages > Deploy from branch).
Verify: ${HOST}/robots.txt, ${HOST}/llms.txt, ${HOST}/.well-known/agent.json
Refresh after each deploy of the main site (feeds and llms-full.txt change every ~6h).
`);

console.log(`[root-site] built ${OUT} for ${HOST}`);
