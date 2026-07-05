/**
 * VCH News Agent v2 — GTA VI Intel Collector
 * Runs on GitHub Actions cron (every 6h)
 * Searches NewsAPI + GTA-specific outlets, deduplicates, writes to Supabase
 */
import { createClient } from '@supabase/supabase-js';

const supa = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const GTA_SOURCES = [
  'https://www.rockstargames.com/newswire',
  'gtaboom.com',
  'rockstarintel.com',
  'gta6hype.com',
];

const KEYWORDS = [
  'GTA VI', 'GTA 6', 'Grand Theft Auto 6', 'Rockstar Games',
  'Leonida', 'GTA6 trailer', 'GTA6 release', 'GTA Online 2',
  'FiveM GTA6', 'Lucia GTA', 'Jason GTA6', 'Rockstar leak'
];

async function fetchNewsAPI() {
  if (!process.env.NEWS_API_KEY) {
    console.log('[Agent] No NEWS_API_KEY — skipping NewsAPI fetch');
    return [];
  }
  const query = encodeURIComponent('GTA 6 OR "Grand Theft Auto VI" OR Rockstar Games');
  const url = `https://newsapi.org/v2/everything?q=${query}&sortBy=publishedAt&pageSize=10&language=en&apiKey=${process.env.NEWS_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  return (data.articles || []).map(a => ({
    title: a.title,
    summary: a.description || '',
    body: a.content || a.description || '',
    source_url: a.url,
    source_name: a.source?.name || 'NewsAPI',
    published_at: a.publishedAt,
  }));
}

function isGTARelevant(title, body) {
  const text = (title + ' ' + body).toLowerCase();
  const directHits = ['gta 6', 'gta vi', 'grand theft auto 6', 'rockstar games', 'leonida', 'fivem gta'];
  const indirectHits = ['take-two interactive', 'strauss zelnick', 'vice city', 'lucia jason'];
  const hasDirect = directHits.some(k => text.includes(k));
  const hasIndirect = indirectHits.some(k => text.includes(k));
  return hasDirect || hasIndirect;
}

async function alreadyExists(title) {
  const { data } = await supa.from('news')
    .select('id')
    .ilike('title', `%${title.slice(0, 50)}%`)
    .limit(1);
  return (data || []).length > 0;
}

function buildSarcasticTitle(original) {
  const prefixes = [
    '🔴 BREAKING (probably):',
    '📡 LEONIDA INTEL:',
    '⚡ NOBODY ASKED BUT:',
    '🕵️ CLASSIFIED:',
    '🎰 ROCKSTAR WANTS YOU TO KNOW:',
  ];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  return `${prefix} ${original}`;
}

async function run() {
  console.log('[VCH News Agent] Starting cycle at', new Date().toISOString());

  const articles = await fetchNewsAPI();
  let inserted = 0;

  for (const article of articles) {
    if (!isGTARelevant(article.title, article.body)) {
      console.log('[Skip] Not GTA-relevant:', article.title.slice(0, 60));
      continue;
    }
    if (await alreadyExists(article.title)) {
      console.log('[Skip] Already exists:', article.title.slice(0, 60));
      continue;
    }

    const { error } = await supa.from('news').insert({
      type: 'news',
      title: article.title,
      summary: article.summary,
      body: article.body,
      category: 'Community',
      is_featured: false,
      is_published: true,
      author_name: article.source_name,
      meta: JSON.stringify({ source: article.source_name, url: article.source_url, stars: 3 }),
    });

    if (error) {
      console.error('[Error] Insert failed:', error.message);
    } else {
      inserted++;
      console.log('[✓] Inserted:', article.title.slice(0, 70));
    }
  }

  console.log(`[VCH News Agent] Cycle complete. Inserted: ${inserted}/${articles.length}`);
}

run().catch(console.error);
