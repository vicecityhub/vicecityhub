#!/usr/bin/env node
/**
 * Vice City Hub v13 - IndexNow ping (Bing, Yandex, Seznam, Naver; Google ignores IndexNow, use Search Console for it).
 * Runs after a successful deploy: reads the LIVE sitemap, takes URLs modified in the last 2 days plus the key landing
 * pages, and tells the search engines. Never fails the pipeline.
 */
import { readFileSync } from 'node:fs';
import { cfg, SITE } from './lib/seo.mjs';

const KEY = '12a0c5e63f4b789d'; // matches public/12a0c5e63f4b789d.txt
const HOST = new URL(SITE).host;

try {
  const r = await fetch(`${SITE}/sitemap.xml`, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error('sitemap HTTP ' + r.status);
  const xml = await r.text();
  const cutoff = Date.now() - 2 * 86400000;
  const fresh = [];
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)) {
    if (!m[1].startsWith(SITE + '/') || /\.(json|txt|xml)$/.test(m[1])) continue;
    if (new Date(m[2]).getTime() >= cutoff) fresh.push(m[1].replace(/&amp;/g, '&'));
  }
  const urlList = [...new Set([`${SITE}/`, `${SITE}/n/`, `${SITE}/gta-6-release-date/`, ...fresh])].slice(0, 100);
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList }),
    signal: AbortSignal.timeout(20000),
  });
  console.log(`[indexnow] submitted ${urlList.length} URLs -> HTTP ${res.status}`);
} catch (e) {
  console.warn('[indexnow] skipped:', e.message);
}
