// Vice City Hub AI Support, Neural Search & Real-Time Query Analytics Edge Function
// Runtime: Deno (Supabase Edge Functions)
// Required secret: GEMINI_API_KEY (free tier at https://aistudio.google.com/apikey)
// Auto-injected by Supabase: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const ALLOWED_ORIGINS = new Set([
  "https://vicecityhub.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://localhost:3000",
]);

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const allowOrigin = ALLOWED_ORIGINS.has(origin)
    ? origin
    : "https://vicecityhub.github.io";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Vary": "Origin",
  };
}

const HUB_BASE_URL = "https://vicecityhub.github.io/vicecityhub";

interface HubMatch {
  type: "news" | "catalog" | "server" | "faction" | "job" | "mod" | "page";
  id: string;
  title: string;
  subtitle: string;
  url: string;
  meta: string;
  score: number;
}

interface HubCache {
  syncedAt: number;
  news: any[];
  catalog: any[];
  servers: any[];
  factions: any[];
  jobs: any[];
  mods: any[];
}

const HUB_PAGES = [
  {
    title: "Home — Vice City Hub",
    url: `${HUB_BASE_URL}/index.html`,
    description:
      "Landing page with featured GTA VI news, media cards, community highlights, and the arcade game.",
    section: "home",
  },
  {
    title: "News — The Wire",
    url: `${HUB_BASE_URL}/news.html`,
    description:
      "Curated GTA VI, Rockstar, and GTA modding news with star ratings and JSON feeds.",
    section: "news",
  },
  {
    title: "RP Hub",
    url: `${HUB_BASE_URL}/rp.html`,
    description:
      "FiveM GTA RP server browser, open faction slots, jobs, mod vault, and store district.",
    section: "rp",
  },
  {
    title: "Market",
    url: `${HUB_BASE_URL}/market.html`,
    description:
      "Official merch (Printful + PayPal/USDC), Web3 domains, RP store plans, and partner products.",
    section: "market",
  },
  {
    title: "Agent Gateway",
    url: `${HUB_BASE_URL}/agents.html`,
    description:
      "Agent API console and documentation: MCP (JSON-RPC 2.0), REST, OpenAPI 3.1, and spend-limited keys.",
    section: "agents",
  },
  {
    title: "Community",
    url: `${HUB_BASE_URL}/community.html`,
    description:
      "Community feed, sub-hubs, player profiles, and legacy forum archive.",
    section: "community",
  },
  {
    title: "Highlights",
    url: `${HUB_BASE_URL}/highlights.html`,
    description:
      "Screenshots and short GTA clips posted by Hub players plus live Restream drops.",
    section: "highlights",
  },
  {
    title: "Leonida Database",
    url: `${HUB_BASE_URL}/document.html`,
    description:
      "Interactive database of confirmed GTA VI vehicles filterable by class, maker, and status.",
    section: "vehicles",
  },
  {
    title: "Vice City Real Estate",
    url: `${HUB_BASE_URL}/realestate.html`,
    description:
      "Leonida and Vice City virtual real estate showcase and listings.",
    section: "realestate",
  },
];

let hubCache: HubCache | null = null;

async function fetchJsonSafe(path: string): Promise<any[]> {
  try {
    const res = await fetch(`${HUB_BASE_URL}/${path}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.items) ? data.items : [];
  } catch {
    return [];
  }
}

async function getHubCache(): Promise<HubCache> {
  const now = Date.now();
  if (hubCache && now - hubCache.syncedAt < 5 * 60_000) {
    return hubCache;
  }
  const [news, catalog, servers, factions, jobs, mods] = await Promise.all([
    fetchJsonSafe("data/news.json"),
    fetchJsonSafe("data/catalog.json"),
    fetchJsonSafe("data/rp-servers.json"),
    fetchJsonSafe("data/rp-factions.json"),
    fetchJsonSafe("data/rp-jobs.json"),
    fetchJsonSafe("data/rp-mods.json"),
  ]);
  hubCache = { syncedAt: now, news, catalog, servers, factions, jobs, mods };
  return hubCache;
}

const SYNONYM_MAP: Array<[RegExp, string[]]> = [
  [/сервер|рп|rp|fivem|онлайн|играть|подключ|servidor/i, ["server", "rp", "fivem", "online", "public", "voice", "esx"]],
  [/фракц|полиц|коп|lspd|банд|мафи|ems|медик|facci[oó]n/i, ["faction", "lspd", "police", "gang", "ems", "highway", "patrol"]],
  [/работ|ваканс|зарплат|професс|trabajo/i, ["job", "salary", "patrol", "legal", "illegal"]],
  [/мод|аддон|скрипт|транспорт|погод|машин/i, ["mod", "vehicle", "weather", "police", "pack", "gta6"]],
  [/мерч|худи|футболк|одежд|товар|купить|магазин|маркет|домен|оплат|крипт|paypal|tienda|comprar/i, ["merch", "hoodie", "market", "domain", "printful", "paypal", "crypto", "order"]],
  [/новост|релиз|гта|gta|rockstar|sony|ps5|предзаказ|утечк|слух|дату|noticias/i, ["gta", "rockstar", "ps5", "pre-order", "launch", "rumor", "news", "release"]],
  [/агент|api|mcp|токен|ключ|документац|интеграц/i, ["agent", "api", "mcp", "openapi", "key", "llms"]],
  [/недвиж|дом|квартир|особняк|леонид/i, ["real estate", "leonida", "property", "vehicle", "database"]],
];

function buildSearchTerms(query: string): string[] {
  const baseTerms = query
    .toLowerCase()
    .split(/[\s,.;:!?/\\()[\]"']+/)
    .filter((t) => t.length >= 2);
  const expanded = new Set<string>(baseTerms);
  for (const [pattern, synonyms] of SYNONYM_MAP) {
    if (pattern.test(query)) {
      for (const s of synonyms) expanded.add(s);
    }
  }
  return Array.from(expanded);
}

function scoreText(text: string, terms: string[], rawQuery: string): number {
  const lower = text.toLowerCase();
  let score = 0;
  if (rawQuery.trim().length > 2 && lower.includes(rawQuery.toLowerCase().trim())) {
    score += 12;
  }
  for (const term of terms) {
    if (lower.includes(term)) score += term.length > 4 ? 3 : 2;
  }
  return score;
}

function searchEntities(
  cache: HubCache,
  query: string,
  category = "all",
  limit = 8
): HubMatch[] {
  const terms = buildSearchTerms(query);
  const matches: HubMatch[] = [];

  if (category === "all" || category === "news") {
    for (const item of cache.news) {
      const hay = `${item.title} ${item.summary} ${item.category} ${item.source_name} ${item.body ?? ""}`;
      const s = scoreText(hay, terms, query) + (item.stars ?? 0) * 0.2;
      if (s > 1) {
        matches.push({
          type: "news",
          id: `news:${item.id}`,
          title: item.title,
          subtitle: item.summary,
          url: item.url,
          meta: `${item.category} · ${item.source_name} · ${String(item.published_at ?? "").slice(0, 10)}`,
          score: s,
        });
      }
    }
  }

  if (category === "all" || category === "rp") {
    for (const srv of cache.servers) {
      const tags = Array.isArray(srv.tags) ? srv.tags : [];
      const hay = `${srv.name} ${srv.description} ${tags.join(" ")} ${srv.status}`;
      const base = scoreText(hay, terms, query);
      if (base > 0) {
        matches.push({
          type: "server",
          id: `server:${srv.id}`,
          title: srv.name,
          subtitle: srv.description,
          url: srv.connect_url || `${HUB_BASE_URL}/rp.html`,
          meta: `${srv.status} · ${srv.online_count}/${srv.max_players} players · ${tags.slice(0, 3).join(", ")}`,
          score: base + Math.min((srv.online_count ?? 0) / 300, 3),
        });
      }
    }
    for (const fac of cache.factions) {
      const reqs = Array.isArray(fac.requirements) ? fac.requirements : [];
      const hay = `${fac.faction_name} ${fac.server_name} ${fac.faction_type} ${fac.description} ${reqs.join(" ")}`;
      const s = scoreText(hay, terms, query);
      if (s > 0.5) {
        matches.push({
          type: "faction",
          id: `faction:${fac.id}`,
          title: `${fac.faction_name} (${fac.server_name})`,
          subtitle: fac.description,
          url: fac.discord_url || `${HUB_BASE_URL}/rp.html`,
          meta: `Slots: ${fac.slots_filled}/${fac.slots_total}`,
          score: s + 0.5,
        });
      }
    }
    for (const job of cache.jobs) {
      const resp = Array.isArray(job.responsibilities) ? job.responsibilities : [];
      const hay = `${job.title} ${job.faction} ${job.legality} ${job.description} ${resp.join(" ")}`;
      const s = scoreText(hay, terms, query);
      if (s > 0.5) {
        matches.push({
          type: "job",
          id: `job:${job.id}`,
          title: job.title,
          subtitle: job.description,
          url: `${HUB_BASE_URL}/rp.html`,
          meta: `${job.legality} · ${job.salary_range}`,
          score: s + 0.4,
        });
      }
    }
    for (const mod of cache.mods) {
      const tags = Array.isArray(mod.tags) ? mod.tags : [];
      const hay = `${mod.title} ${mod.category} ${mod.author} ${mod.description} ${tags.join(" ")}`;
      const s = scoreText(hay, terms, query);
      if (s > 0.5) {
        matches.push({
          type: "mod",
          id: `mod:${mod.id}`,
          title: mod.title,
          subtitle: mod.description,
          url: mod.download_url || `${HUB_BASE_URL}/rp.html`,
          meta: `${mod.category} · ${mod.progress_pct}% complete`,
          score: s + 0.4,
        });
      }
    }
  }

  if (category === "all" || category === "market") {
    for (const item of cache.catalog) {
      const hay = `${item.title} ${item.description} ${item.kind} ${item.seller} ${item.sku}`;
      const s = scoreText(hay, terms, query);
      if (s > 0.5) {
        matches.push({
          type: "catalog",
          id: `catalog:${item.sku}`,
          title: item.title,
          subtitle: item.description,
          url: item.url,
          meta: `$${item.price_usd} ${item.currency} · ${item.kind}`,
          score: s + 0.3,
        });
      }
    }
  }

  if (category === "all" || category === "pages") {
    for (const page of HUB_PAGES) {
      const hay = `${page.title} ${page.description} ${page.section}`;
      const s = scoreText(hay, terms, query);
      if (s > 0.5) {
        matches.push({
          type: "page",
          id: `page:${page.section}`,
          title: page.title,
          subtitle: page.description,
          url: page.url,
          meta: `Hub Section · ${page.section}`,
          score: s + 0.2,
        });
      }
    }
  }

  return matches.sort((a, b) => b.score - a.score).slice(0, limit);
}

async function callGemini(
  apiKey: string,
  models: string[],
  body: Record<string, unknown>
): Promise<string> {
  let lastError = "Gemini API request failed.";
  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(18000),
      });
      if (res.ok) {
        const json = await res.json();
        const text =
          json?.candidates?.[0]?.content?.parts
            ?.map((p: any) => p?.text ?? "")
            .join("") ?? "";
        return text;
      }
      const errText = await res.text();
      lastError = `Gemini ${model} (${res.status}): ${errText}`;
      if (![404, 429, 500, 502, 503, 504].includes(res.status)) {
        throw new Error(lastError);
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  throw new Error(lastError);
}

async function classifyQuery(
  apiKey: string,
  query: string
): Promise<Record<string, unknown>> {
  const prompt = `Classify this user request from Vice City Hub (https://vicecityhub.github.io/vicecityhub/) into JSON:
"${query}"
Use American English for topicCluster, painPoint, suggestedAction, summary. Detect ISO language in "language".
Valid hubSection: index.html, news.html, rp.html, market.html, agents.html, community.html, document.html, realestate.html.
Valid intent: rp_navigation, market_order, news_gta6, agent_api, account_bug, modding_help, general_info.
Valid urgency: low, medium, high.
Valid sentiment: positive, neutral, frustrated.`;

  const text = await callGemini(
    apiKey,
    ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-4-hydrogen"],
    {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            language: { type: "STRING" },
            intent: { type: "STRING" },
            urgency: { type: "STRING" },
            sentiment: { type: "STRING" },
            hubSection: { type: "STRING" },
            topicCluster: { type: "STRING" },
            painPoint: { type: "STRING" },
            suggestedAction: { type: "STRING" },
            summary: { type: "STRING" },
          },
          required: [
            "language",
            "intent",
            "urgency",
            "sentiment",
            "hubSection",
            "topicCluster",
            "painPoint",
            "suggestedAction",
            "summary",
          ],
        },
      },
    }
  );
  return JSON.parse(text.trim());
}

function detectAnomalies(rows: any[]) {
  const alerts: any[] = [];
  if (rows.length < 3) return alerts;

  const recent = rows.slice(0, 10);
  const windowSize = recent.length;

  const neg = recent.filter(
    (r) => r.sentiment === "frustrated" || r.urgency === "high"
  );
  const negRatio = neg.length / windowSize;
  let consecutiveNeg = 0;
  for (const r of recent) {
    if (r.sentiment === "frustrated" || r.urgency === "high") consecutiveNeg++;
    else break;
  }

  if ((neg.length >= 2 && negRatio >= 0.4) || consecutiveNeg >= 2) {
    const pct = Math.round(negRatio * 100);
    const secCounts: Record<string, number> = {};
    for (const r of neg) {
      secCounts[r.hub_section] = (secCounts[r.hub_section] ?? 0) + 1;
    }
    const topSection =
      Object.entries(secCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ??
      "index.html";
    alerts.push({
      id: `neg_${neg.length}_${windowSize}`,
      type: "negative_spike",
      severity: pct >= 60 || consecutiveNeg >= 3 ? "critical" : "warning",
      title: "Negative Feedback Spike Detected",
      message: `${neg.length} of the last ${windowSize} requests (${pct}%) are frustrated or high-urgency. Most affected: ${topSection}.`,
      metricValue: `${pct}% negative`,
      affectedSection: topSection,
      filterKey: "frustrated",
      detectedAt: recent[0]?.created_at ?? new Date().toISOString(),
    });
  }

  const topicCounts: Record<string, { count: number; section: string }> = {};
  for (const r of recent) {
    const t = String(r.topic_cluster || "").trim();
    if (!t) continue;
    if (!topicCounts[t]) topicCounts[t] = { count: 0, section: r.hub_section };
    topicCounts[t].count += 1;
  }
  const top = Object.entries(topicCounts).sort(
    (a, b) => b[1].count - a[1].count
  )[0];
  if (top) {
    const [topicName, info] = top;
    const ratio = info.count / windowSize;
    if (info.count >= 2 && ratio >= 0.35) {
      const pct = Math.round(ratio * 100);
      alerts.push({
        id: `topic_${topicName}_${info.count}`,
        type: "topic_surge",
        severity: pct >= 50 || info.count >= 4 ? "critical" : "warning",
        title: "Anomalous Search Topic Surge",
        message: `Topic "${topicName}" accounts for ${pct}% of recent activity (${info.count} of ${windowSize} queries).`,
        metricValue: `${info.count} of ${windowSize} (${pct}%)`,
        affectedSection: info.section,
        filterKey: topicName,
        detectedAt: recent[0]?.created_at ?? new Date().toISOString(),
      });
    }
  }

  return alerts;
}

serve(async (req) => {
  const headers = {
    ...corsHeaders(req),
    "Content-Type": "application/json",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  try {
    const body = req.method === "POST" ? await req.json() : {};
    const action = String(body?.action || "chat");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    if (action === "analytics") {
      const { data: rows, error } = await db
        .from("ai_query_analytics")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        return new Response(
          JSON.stringify({
            total: 0,
            avgLatencyMs: 0,
            byTopic: {},
            bySection: {},
            painPointsCount: {},
            alerts: [],
            records: [],
            note: "Run supabase/16_ai_support_analytics.sql to enable persistent query telemetry.",
          }),
          { status: 200, headers }
        );
      }

      const list = rows ?? [];
      const byTopic: Record<string, number> = {};
      const bySection: Record<string, number> = {};
      const painPointsCount: Record<string, number> = {};
      let latencySum = 0;

      for (const r of list) {
        if (r.topic_cluster) {
          byTopic[r.topic_cluster] = (byTopic[r.topic_cluster] ?? 0) + 1;
        }
        if (r.hub_section) {
          bySection[r.hub_section] = (bySection[r.hub_section] ?? 0) + 1;
        }
        if (
          r.pain_point &&
          !/^(none|no pain|no explicit)/i.test(String(r.pain_point).trim())
        ) {
          painPointsCount[r.pain_point] =
            (painPointsCount[r.pain_point] ?? 0) + 1;
        }
        latencySum += Number(r.latency_ms ?? 0);
      }

      return new Response(
        JSON.stringify({
          total: list.length,
          avgLatencyMs: list.length ? Math.round(latencySum / list.length) : 0,
          byTopic,
          bySection,
          painPointsCount,
          alerts: detectAnomalies(list),
          records: list,
        }),
        { status: 200, headers }
      );
    }

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) {
      return new Response(
        JSON.stringify({
          error:
            "GEMINI_API_KEY secret is not configured in Supabase Edge Function secrets yet.",
        }),
        { status: 503, headers }
      );
    }

    if (action === "insights") {
      const { data: rows } = await db
        .from("ai_query_analytics")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(40);

      const list = rows ?? [];
      if (list.length === 0) {
        return new Response(
          JSON.stringify({
            error: "No logged user queries yet to synthesize an insights report.",
          }),
          { status: 400, headers }
        );
      }

      const raw = await callGemini(
        geminiKey,
        ["gemini-4-hydrogen", "gemini-3.5-flash-lite", "gemini-3.8-flash"],
        {
          systemInstruction: {
            parts: [
              {
                text: "You are a senior product analyst for Vice City Hub. Identify recurring FAQ patterns, UX pain points, and content opportunities in American English.",
              },
            ],
          },
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `Analyze these ${list.length} user queries and return structured JSON insights:\n${JSON.stringify(
                    list.map((r) => ({
                      query: r.query,
                      intent: r.intent,
                      sentiment: r.sentiment,
                      hubSection: r.hub_section,
                      topicCluster: r.topic_cluster,
                      painPoint: r.pain_point,
                    }))
                  )}`,
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                executiveSummary: { type: "STRING" },
                topFaqs: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      questionPattern: { type: "STRING" },
                      frequencyLabel: { type: "STRING" },
                      hubSection: { type: "STRING" },
                      recommendedAnswer: { type: "STRING" },
                    },
                    required: [
                      "questionPattern",
                      "frequencyLabel",
                      "hubSection",
                      "recommendedAnswer",
                    ],
                  },
                },
                painPoints: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      issue: { type: "STRING" },
                      severity: { type: "STRING" },
                      affectedSection: { type: "STRING" },
                      uxFixRecommendation: { type: "STRING" },
                    },
                    required: [
                      "issue",
                      "severity",
                      "affectedSection",
                      "uxFixRecommendation",
                    ],
                  },
                },
                interestAreas: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      topic: { type: "STRING" },
                      demandLevel: { type: "STRING" },
                      contentOpportunity: { type: "STRING" },
                    },
                    required: ["topic", "demandLevel", "contentOpportunity"],
                  },
                },
              },
              required: [
                "executiveSummary",
                "topFaqs",
                "painPoints",
                "interestAreas",
              ],
            },
          },
        }
      );

      const parsed = JSON.parse(raw.trim());
      return new Response(
        JSON.stringify({
          generatedAt: new Date().toISOString(),
          analyzedCount: list.length,
          ...parsed,
        }),
        { status: 200, headers }
      );
    }

    // "search" or "chat"
    const query = String(body?.query || "").trim();
    const category = String(body?.category || "all");
    const pagePath = String(body?.pagePath || "");
    const history = Array.isArray(body?.messages) ? body.messages : [];

    if (!query) {
      return new Response(
        JSON.stringify({ error: "Query cannot be empty." }),
        { status: 400, headers }
      );
    }

    const started = Date.now();
    const cache = await getHubCache();
    const matches = searchEntities(cache, query, category, 8);

    const matchedBlock =
      matches.length > 0
        ? matches
            .map(
              (m, i) =>
                `${i + 1}. [${m.type.toUpperCase()}] ${m.title} | ${m.meta} | URL: ${m.url}\n   ${m.subtitle}`
            )
            .join("\n")
        : "No exact feed items matched; use general Vice City Hub navigation knowledge.";

    const hubContext = `VICE CITY HUB LIVE CONTEXT:
Site: ${HUB_BASE_URL}/
Pages: Home (index.html), News — The Wire (news.html), RP Hub (rp.html), Market (market.html), Agent Gateway (agents.html), Community (community.html), Highlights (highlights.html), Leonida Database (document.html), Real Estate (realestate.html).
Agent API: https://lpglkglhjdqnktybksth.supabase.co/functions/v1/agent-api/v1 (REST + MCP JSON-RPC 2.0, default caps $100/order, $250/day).
Market Payments: Printful merch (merchv:... variant SKUs), Web3 domains, RP store plans via PayPal or USDC (Base/Solana).
Support email: vicecityhub@proton.me.

RELEVANT HUB MATCHES:
${matchedBlock}`;

    const contents = [
      ...history.slice(-6).map((m: any) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: String(m.text ?? "") }],
      })),
      {
        role: "user",
        parts: [{ text: `${hubContext}\n\nUSER QUERY: "${query}"` }],
      },
    ];

    const [answer, analysis] = await Promise.all([
      callGemini(
        geminiKey,
        ["gemini-3.5-flash-lite", "gemini-4-hydrogen", "gemini-3.8-flash"],
        {
          systemInstruction: {
            parts: [
              {
                text: "You are the official AI customer support and neural search assistant for Vice City Hub (https://vicecityhub.github.io/vicecityhub/). Respond in American English by default, or automatically reply in the user's language if they write in another language (e.g., Russian, Spanish). Ground answers strictly in the provided Hub context, include exact URLs and numbers, and never invent facts.",
              },
            ],
          },
          contents,
        }
      ),
      classifyQuery(geminiKey, query).catch(() => null),
    ]);

    const latencyMs = Date.now() - started;

    if (analysis) {
      try {
        await db.from("ai_query_analytics").insert({
          source: action === "search" ? "search" : "support",
          query: query.slice(0, 500),
          language: String(analysis.language ?? "en"),
          intent: String(analysis.intent ?? "general_info"),
          urgency: String(analysis.urgency ?? "low"),
          sentiment: String(analysis.sentiment ?? "neutral"),
          hub_section: String(analysis.hubSection ?? "index.html"),
          topic_cluster: String(analysis.topicCluster ?? "General Hub Inquiry"),
          pain_point: String(analysis.painPoint ?? "None"),
          suggested_action: String(analysis.suggestedAction ?? ""),
          latency_ms: latencyMs,
          page_path: pagePath.slice(0, 120),
        });
      } catch {
        /* non-blocking analytics fallback */
      }
    }

    return new Response(
      JSON.stringify({
        answer,
        matches,
        analysis,
        latencyMs,
      }),
      { status: 200, headers }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown Edge Function error.",
      }),
      { status: 500, headers }
    );
  }
});
