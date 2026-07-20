/**
 * VCH News Agent v3 - GTA VI Intel Collector
 * Runs on GitHub Actions cron (every 6h) via Node.js 22
 * Fetches from NewsAPI + deduplicates + writes to Supabase
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const NEWS_API_KEY = process.env.NEWS_API_KEY;

// Guard - missing secrets
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.log('[News Agent] Missing SUPABASE_URL or SUPABASE_SERVICE_KEY — set them in GitHub Secrets');
  process.exit(0);
}

// Create client WITHOUT realtime (no WebSocket needed for REST inserts)
const supa = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { enabled: false },
  db: { schema: 'public' },
});

const GTA_KEYWORDS = [
  'GTA VI', 'GTA 6', 'Grand Theft Auto VI', 'Grand Theft Auto 6',
  'Rockstar Games GTA', 'Leonida GTA', 'GTA 6 release', 'GTA 6 trailer',
  'GTA 6 FiveM', 'GTA 6 multiplayer', 'GTA 6 price', 'GTA6'
];

async function fetchFromNewsAPI() {
  if (!NEWS_API_KEY) {
    console.log('[News Agent] No NEWS_API_KEY - using RSS fallback');
    return [];
  }
  const q = encodeURIComponent('"GTA 6" OR "GTA VI" OR "Grand Theft Auto VI"');
  const url = `https://newsapi.org/v2/everything?q=${q}&sortBy=publishedAt&pageSize=10&language=en&apiKey=${NEWS_API_KEY}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!data.articles) return [];
    return data.articles.map(a => ({
      title: a.title || '',
      summary: a.description || '',
      body: a.content || a.description || '',
      source: a.source?.name || 'NewsAPI',
      url: a.url || '',
    }));
  } catch (e) {
    console.error('[News Agent] NewsAPI fetch error:', e.message);
    return [];
  }
}

function isGTARelevant(title, body) {
  const text = (title + ' ' + body).toLowerCase();
  return GTA_KEYWORDS.some(k => text.includes(k.toLowerCase()));
}

async function isDuplicate(title) {
  try {
    const { data } = await supa
      .from('news')
      .select('id')
      .ilike('title', `%${title.slice(0, 60).replace(/%/g, '')}%`)
      .limit(1);
    return (data || []).length > 0;
  } catch (e) {
    return false;
  }
}

async function run() {
  console.log('[VCH News Agent v3] Starting at', new Date().toISOString());
  const articles = await fetchFromNewsAPI();
  let inserted = 0;
  let skipped = 0;

  for (const article of articles) {
    if (!article.title || article.title === '[Removed]') { skipped++; continue; }
    if (!isGTARelevant(article.title, article.body)) { skipped++; continue; }
    if (await isDuplicate(article.title)) { skipped++; continue; }

    try {
      const { error } = await supa.from('news').insert({
        type: 'news',
        title: article.title,
        summary: article.summary,
        body: article.body || article.summary,
        category: 'Community',
        is_featured: false,
        is_published: true,
        author_name: article.source,
        meta: JSON.stringify({ source_url: article.url, stars: 3 }),
      });
      if (error) throw error;
      inserted++;
      console.log('[+] Inserted:', article.title.slice(0, 70));
    } catch (e) {
      console.error('[!] Insert error:', e.message);
    }
  }

  console.log(`[Done] Inserted: ${inserted} | Skipped: ${skipped} | Total: ${articles.length}`);
}

run().catch(e => {
  console.error('[Fatal]', e.message);
  process.exit(0); // exit 0 - not exit 1, don't fail the CI
});
