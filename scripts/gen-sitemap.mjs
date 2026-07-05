/**
 * VCH Sitemap Generator — динамический sitemap из Supabase
 * Включает все новости, страницы и RP-сервера
 */
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';

const BASE = 'https://vicecityhub.github.io/vicecityhub';
const supa = createClient(
  process.env.SUPABASE_URL || 'https://lpglkglhjdqnktybksth.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

const STATIC_PAGES = [
  { url: 'index.html',      priority: '1.0', freq: 'daily' },
  { url: 'rp.html',         priority: '0.9', freq: 'daily' },
  { url: 'news.html',       priority: '0.9', freq: 'hourly' },
  { url: 'community.html',  priority: '0.8', freq: 'daily' },
  { url: 'market.html',     priority: '0.7', freq: 'weekly' },
  { url: 'realestate.html', priority: '0.6', freq: 'weekly' },
  { url: 'document.html',   priority: '0.7', freq: 'weekly' },
];

async function generate() {
  const today = new Date().toISOString().split('T')[0];
  let urls = STATIC_PAGES.map(p => `
  <url>
    <loc>${BASE}/${p.url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${p.freq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join('');

  // Динамические URL из Supabase news
  try {
    const { data: news } = await supa.from('news').select('id, updated_at').eq('is_published', true).limit(200);
    if (news) {
      urls += news.map(n => `
  <url>
    <loc>${BASE}/news.html?id=${n.id}</loc>
    <lastmod>${(n.updated_at || today).split('T')[0]}</lastmod>
    <changefreq>never</changefreq>
    <priority>0.5</priority>
  </url>`).join('');
    }
  } catch (e) { console.warn('News sitemap fetch failed:', e.message); }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

  writeFileSync('sitemap.xml', xml);
  console.log(`[Sitemap] Generated with ${(xml.match(/<url>/g) || []).length} URLs`);
}

generate().catch(console.error);
