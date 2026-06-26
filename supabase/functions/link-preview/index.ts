// Supabase Edge Function: link-preview
// Runtime: Deno (this is how all Supabase Edge Functions run — not Node.js)
//
// WHAT THIS DOES
// Given a URL, fetches that page's HTML server-side and extracts Open
// Graph / Twitter Card meta tags (title, description, image, site name).
// This is exactly the mechanism X/Twitter, Discord, Slack, and iMessage
// use for "rich link previews" — there is no public API for this; every
// platform that does it runs its own crawler, because the only standard
// is meta tags embedded in the target page's <head>, not a public protocol.
//
// WHY THIS HAS TO RUN SERVER-SIDE (not in the browser)
// Fetching an arbitrary third-party URL directly from the browser hits
// CORS almost everywhere — sites don't grant cross-origin permission to
// random web pages reading their HTML. An Edge Function has no such
// restriction because server-to-server HTTP requests aren't subject to
// CORS (CORS is a browser-enforced policy, not a network-level one).
//
// CACHING
// Results are cached in a Postgres table (link_previews) for 7 days, so
// the same URL posted by multiple users, or viewed many times, doesn't
// re-trigger a fetch every time. This also protects the function from
// being used as an open proxy / scraping tool for unrelated purposes.
//
// DEPLOY
//   supabase functions deploy link-preview
// CALL FROM THE FRONTEND
//   const { data } = await supa.functions.invoke('link-preview', { body: { url } })

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Don't let this function be pointed at internal/private network ranges —
// otherwise it becomes a server-side request forgery (SSRF) tool that
// could be used to probe Supabase's own internal infrastructure.
const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^::1$/,
  /\.local$/i,
];

function isBlockedHost(hostname: string): boolean {
  return BLOCKED_HOST_PATTERNS.some((pattern) => pattern.test(hostname));
}

function extractMetaTag(html: string, property: string): string | null {
  // Matches <meta property="og:title" content="..."> in either attribute order
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${property}["']`, 'i'),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${property}["']`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return decodeHtmlEntities(match[1]);
  }
  return null;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'");
}

function extractTitleFallback(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match ? decodeHtmlEntities(match[1].trim()) : null;
}

interface LinkPreviewData {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  site_name: string | null;
}

async function fetchPreview(targetUrl: string): Promise<LinkPreviewData> {
  const parsed = new URL(targetUrl);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only http/https URLs are supported.');
  }
  if (isBlockedHost(parsed.hostname)) {
    throw new Error('This host is not allowed.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  let html: string;
  try {
    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        // Identify as a normal browser-ish crawler; many sites serve
        // different (or no) markup to unknown/blank user agents.
        'User-Agent':
          'Mozilla/5.0 (compatible; ViceCityHubLinkPreview/1.0; +https://vicecityhub.github.io/vicecityhub/)',
        Accept: 'text/html',
      },
      redirect: 'follow',
    });
    if (!response.ok) {
      throw new Error(`Target site responded with ${response.status}`);
    }
    // Cap how much we read — we only need the <head>, not the whole page.
    const reader = response.body?.getReader();
    let received = '';
    if (reader) {
      const decoder = new TextDecoder();
      while (received.length < 100_000) {
        const { done, value } = await reader.read();
        if (done) break;
        received += decoder.decode(value, { stream: true });
        if (received.includes('</head>')) break;
      }
      reader.cancel();
    }
    html = received;
  } finally {
    clearTimeout(timeout);
  }

  return {
    url: targetUrl,
    title: extractMetaTag(html, 'og:title') || extractTitleFallback(html),
    description: extractMetaTag(html, 'og:description') || extractMetaTag(html, 'description'),
    image: extractMetaTag(html, 'og:image'),
    site_name: extractMetaTag(html, 'og:site_name') || parsed.hostname,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const { url } = await req.json();
    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing "url" in request body.' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Check the cache first.
    const { data: cached } = await supabase
      .from('link_previews')
      .select('*')
      .eq('url', url)
      .gte('fetched_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .maybeSingle();

    if (cached) {
      return new Response(JSON.stringify(cached), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // 2. Not cached (or stale) — fetch fresh and store it.
    const preview = await fetchPreview(url);

    await supabase
      .from('link_previews')
      .upsert({ ...preview, fetched_at: new Date().toISOString() }, { onConflict: 'url' });

    return new Response(JSON.stringify(preview), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
