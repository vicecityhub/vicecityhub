// Deployed with verify_jwt=false. Table: public.page_hits (RLS on, service role only).
// Vice City Hub - anonymous, cookie-free page-view counter.
// POST (text/plain JSON) {p: pathname, r: document.referrer, s: utm_source/ref}
// Stores: day, path, referrer host, source tag, device class, and a daily-rotating visitor hash.
// Never stores: IP address, user agent, cookies, or anything that can follow a person across days.
// Only accepts hits from the Hub's own origin. Always answers 204 so it never affects page behaviour.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const ORIGIN = "https://vicecityhub.github.io";
const CORS = { "Access-Control-Allow-Origin": ORIGIN, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "content-type", "Vary": "Origin" };
const done = () => new Response(null, { status: 204, headers: CORS });
const BOT = /bot|crawl|spider|slurp|facebookexternalhit|preview|monitor|headless|lighthouse|pagespeed|curl|wget|python|node-fetch|axios|go-http|java\/|okhttp|httpclient/i;

async function sha(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}
function normPath(p: unknown): string | null {
  const raw = String(p ?? "").split(/[?#]/)[0];
  if (!raw.startsWith("/vicecityhub/") && raw !== "/vicecityhub") return null;
  let rest = raw.slice("/vicecityhub".length) || "/";
  if (!/^[A-Za-z0-9/_.\-]{1,120}$/.test(rest)) return null;
  if (rest.length > 120) return null;
  return rest;
}
async function rate(bucket: string, limit: number): Promise<boolean> {
  const ws = new Date(Math.floor(Date.now() / 60_000) * 60_000).toISOString();
  const { data } = await db.from("agent_rate").select("hits").eq("bucket", bucket).eq("window_start", ws).maybeSingle();
  const hits = (data?.hits ?? 0) + 1;
  if (hits > limit) return false;
  await db.from("agent_rate").upsert({ bucket, window_start: ws, hits }, { onConflict: "bucket,window_start" });
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return done();
  if (req.method !== "POST") return new Response(null, { status: 405, headers: CORS });
  try {
    if (req.headers.get("origin") !== ORIGIN) return done();
    let b: any; try { b = JSON.parse(await req.text()); } catch { return done(); }
    const path = normPath(b?.p);
    if (!path) return done();

    let referrer: string | null = null;
    try {
      const h = new URL(String(b?.r || "")).hostname.replace(/^www\./, "").toLowerCase();
      if (h && h !== "vicecityhub.github.io") referrer = h.slice(0, 80);
    } catch (_) { /* no referrer */ }
    const src = /^[A-Za-z0-9_.\-]{1,40}$/.test(String(b?.s || "")) ? String(b.s).toLowerCase() : null;

    const ua = req.headers.get("user-agent") || "";
    const device = BOT.test(ua) || !ua ? "bot" : /mobile|android|iphone|ipad/i.test(ua) ? "mobile" : "desktop";
    const day = new Date().toISOString().slice(0, 10);
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
    const salt = await sha(`${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}|${day}`);
    const visitor = (await sha(`${salt}|${ip}|${ua}`)).slice(0, 16);

    if (!(await rate(`hit:${visitor}`, 90))) return done();
    await db.from("page_hits").insert({ path, referrer, src, device, visitor });
  } catch (e) {
    console.error("hit", (e as Error).message);
  }
  return done();
});
