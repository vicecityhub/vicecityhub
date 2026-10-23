// Vice City Hub - growth API (v13)
// One small public edge function for the revenue/traffic features that need a server:
//   POST /newsletter/subscribe   body {email, source?, website?}      (double opt-in, honeypot, rate limited)
//   GET  /newsletter/confirm?t=  -> 302 to the site                    (token from the confirmation mail)
//   GET  /newsletter/unsubscribe?t= -> 302 to the site
//   POST /promo                  body {server_name, contact_email, discord_url?, tier, message?, website?}
//   POST /kofi                   Ko-fi webhook (form field `data`, verified with KOFI_VERIFICATION_TOKEN)
//   GET  /wall                   public JSON for the Supporters / Agent Hall of Fame page (no secrets, no emails)
// Secrets used: SUPABASE_SERVICE_ROLE_KEY (auto), RESEND_API_KEY, KOFI_VERIFICATION_TOKEN (optional),
//               NEWSLETTER_FROM (optional: set to "Name <you@your-verified-domain>" once a domain is verified in Resend).
// Deployed with verify_jwt = false (public endpoint; every route validates its own input).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SB = Deno.env.get("SUPABASE_URL")!;
const db = createClient(SB, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const SITE = "https://vicecityhub.github.io/vicecityhub";
const FN = `${SB}/functions/v1/growth`;
const OWNER = "vicecityhub@proton.me";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (b: unknown, status = 200, h: Record<string, string> = {}) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json; charset=utf-8", ...h } });
const redirect = (to: string) => new Response(null, { status: 302, headers: { ...CORS, Location: to } });
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
const clean = (s: unknown, n: number) => String(s ?? "").replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

async function sha(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}
const ipHash = async (req: Request) => (await sha("vch-growth|" + ((req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "?"))).slice(0, 24);

async function rate(bucket: string, limit: number, windowSec: number): Promise<boolean> {
  const ws = new Date(Math.floor(Date.now() / 1000 / windowSec) * windowSec * 1000).toISOString();
  const { data } = await db.from("agent_rate").select("hits").eq("bucket", bucket).eq("window_start", ws).maybeSingle();
  const hits = (data?.hits ?? 0) + 1;
  if (hits > limit) return false;
  await db.from("agent_rate").upsert({ bucket, window_start: ws, hits }, { onConflict: "bucket,window_start" });
  return true;
}

async function sendMail(to: string[], subject: string, body: string, from?: string): Promise<boolean> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return false;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: from || "Vice City Hub <onboarding@resend.dev>", to, subject, html: body }),
    });
    return r.ok;
  } catch (_) { return false; }
}

const band = (a: number) => (a < 5 ? "coffee" : a < 15 ? "rider" : a < 50 ? "boss" : "kingpin");
const short = (s: string | null) => (s && s.length > 14 ? `${s.slice(0, 6)}...${s.slice(-4)}` : s || "anonymous");

// ---------- newsletter ----------
async function subscribe(req: Request): Promise<Response> {
  const b = await req.json().catch(() => null);
  if (!b) return json({ ok: false, error: "invalid_json" }, 400);
  if (b.website) return json({ ok: true, status: "pending" }); // honeypot: pretend success
  const email = clean(b.email, 254).toLowerCase();
  if (!EMAIL.test(email)) return json({ ok: false, error: "invalid_email" }, 422);
  if (!(await rate(`nl:${await ipHash(req)}`, 6, 3600))) return json({ ok: false, error: "rate_limited" }, 429);

  const source = clean(b.source, 60) || null;
  const ins = await db.from("subscribers").insert({ email, source }).select("token").single();
  let token = ins.data?.token as string | undefined;
  if (ins.error) {
    if (ins.error.code !== "23505") { console.error("subscribe", ins.error.message); return json({ ok: false, error: "unavailable" }, 503); }
    const { data: ex } = await db.from("subscribers").select("id,status,token").ilike("email", email).maybeSingle();
    if (!ex) return json({ ok: true, status: "pending" });
    if (ex.status === "confirmed") return json({ ok: true, status: "confirmed" });
    if (ex.status === "unsubscribed") await db.from("subscribers").update({ status: "pending" }).eq("id", ex.id);
    token = ex.token;
  }
  const from = Deno.env.get("NEWSLETTER_FROM");
  let sent = false;
  if (from && token) {
    sent = await sendMail([email], "Confirm your Vice City Daily subscription",
      `<div style="font-family:Arial,sans-serif;background:#07070f;color:#e8e8f0;padding:28px"><h2 style="color:#ff2d95;margin:0 0 12px">One more step, Leonida citizen</h2><p>Confirm that you want the Vice City Daily: GTA VI news with a side of sarcasm, a couple of times a week.</p><p><a href="${FN}/newsletter/confirm?t=${token}" style="background:#ff2d95;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold">Confirm subscription</a></p><p style="color:#8a8aa0;font-size:12px">Didn't ask for this? Ignore this email and nothing happens.</p></div>`, from);
  }
  return json({ ok: true, status: "pending", confirmation_email_sent: sent });
}

async function confirm(url: URL, unsub: boolean): Promise<Response> {
  const t = clean(url.searchParams.get("t"), 64);
  if (!/^[0-9a-f]{32}$/.test(t)) return redirect(`${SITE}/newsletter/?s=error`);
  const patch = unsub ? { status: "unsubscribed" } : { status: "confirmed", confirmed_at: new Date().toISOString() };
  const { data, error } = await db.from("subscribers").update(patch).eq("token", t).select("id");
  if (error || !data?.length) return redirect(`${SITE}/newsletter/?s=error`);
  return redirect(`${SITE}/newsletter/?s=${unsub ? "unsubscribed" : "confirmed"}`);
}

// ---------- RP server promo ----------
async function promo(req: Request): Promise<Response> {
  const b = await req.json().catch(() => null);
  if (!b) return json({ ok: false, error: "invalid_json" }, 400);
  if (b.website) return json({ ok: true });
  const email = clean(b.contact_email, 254).toLowerCase();
  const name = clean(b.server_name, 80);
  const tier = clean(b.tier, 20);
  if (name.length < 2) return json({ ok: false, error: "server_name_required" }, 422);
  if (!EMAIL.test(email)) return json({ ok: false, error: "invalid_email" }, 422);
  const { data: plan } = await db.from("server_promo_plans").select("name,price_usd,days").eq("tier", tier).eq("is_active", true).maybeSingle();
  if (!plan) return json({ ok: false, error: "unknown_tier" }, 422);
  const ih = await ipHash(req);
  if (!(await rate(`promo:${ih}`, 4, 3600))) return json({ ok: false, error: "rate_limited" }, 429);
  const row = { server_name: name, contact_email: email, discord_url: clean(b.discord_url, 200) || null, tier, message: clean(b.message, 1000) || null, ip_hash: ih };
  const { error } = await db.from("server_promo_requests").insert(row);
  if (error) { console.error("promo", error.message); return json({ ok: false, error: "unavailable" }, 503); }
  await sendMail([OWNER], `[PROMO] ${name}: ${plan.name} ($${plan.price_usd}/${plan.days}d)`,
    `<div style="font-family:Arial,sans-serif"><h3>New RP server promotion request</h3><p><b>Server:</b> ${esc(name)}<br><b>Plan:</b> ${esc(plan.name)} - $${esc(plan.price_usd)} / ${esc(plan.days)} days<br><b>Contact:</b> ${esc(email)}<br><b>Discord:</b> ${esc(row.discord_url || "-")}</p><p>${esc(row.message || "")}</p><p style="color:#888">Table: server_promo_requests</p></div>`);
  return json({ ok: true, message: "Request received. We will email you with payment options." });
}

// ---------- Ko-fi webhook ----------
async function kofi(req: Request): Promise<Response> {
  const secret = Deno.env.get("KOFI_VERIFICATION_TOKEN");
  if (!secret) return json({ ok: false, error: "kofi_not_configured" }, 503);
  const ct = req.headers.get("content-type") || "";
  let raw: string | null = null;
  if (ct.includes("application/json")) {
    const b = await req.json().catch(() => null);
    raw = b?.data ? (typeof b.data === "string" ? b.data : JSON.stringify(b.data)) : null;
  } else {
    raw = new URLSearchParams(await req.text()).get("data");
  }
  let d: any;
  try { d = JSON.parse(raw || ""); } catch { return json({ ok: false, error: "bad_payload" }, 400); }
  if ((await sha(String(d?.verification_token ?? ""))) !== (await sha(secret))) return json({ ok: false, error: "unauthorized" }, 401);

  const type = String(d.type || "Donation");
  const kind = type === "Subscription" ? "subscription" : type === "Shop Order" ? "shop_order" : "donation";
  const amount = Number(d.amount);
  const { error } = await db.from("supporters").upsert({
    kofi_message_id: String(d.message_id || d.kofi_transaction_id || "") || null,
    display_name: clean(d.from_name, 40) || "Anonymous Rat",
    kind,
    tier_name: clean(d.tier_name, 60) || null,
    amount: Number.isFinite(amount) ? amount : null,
    currency: clean(d.currency, 8) || null,
    message: clean(d.message, 280) || null,
    is_public: d.is_public === true || d.is_public === "true",
  }, { onConflict: "kofi_message_id", ignoreDuplicates: true });
  if (error) { console.error("kofi", error.message); return json({ ok: false }, 500); }
  return json({ ok: true });
}

// ---------- public wall ----------
async function wall(): Promise<Response> {
  const [s, dd, o] = await Promise.all([
    db.from("supporters").select("display_name,kind,tier_name,amount,message,created_at").eq("is_public", true).order("created_at", { ascending: false }).limit(200),
    db.from("agent_direct_donations").select("network,tx_hash,payer,asset,amount_usd,created_at").order("created_at", { ascending: false }).limit(200),
    db.from("agent_orders").select("total_usd,created_at,items,agent_keys(name)").eq("status", "completed").contains("items", JSON.stringify([{ kind: "donation" }])).order("created_at", { ascending: false }).limit(200),
  ]);
  const supporters = (s.data || []).map((r: any) => ({ name: clean(r.display_name, 40), kind: r.kind, tier: r.tier_name, band: band(Number(r.amount) || 0), message: clean(r.message, 140) || null, at: r.created_at }));
  const agents = [
    ...(dd.data || []).map((r: any) => ({ name: short(r.payer), via: "x402", network: r.network, amount_usd: Number(r.amount_usd), tx: r.tx_hash, at: r.created_at })),
    ...(o.data || []).map((r: any) => {
      const donor = r.items?.[0]?.donor || r.items?.[0]?.meta?.donor || {};
      const name = clean(donor.agent || donor.name || (Array.isArray(r.agent_keys) ? r.agent_keys[0]?.name : r.agent_keys?.name) || "unnamed agent", 40);
      return { name, via: "order", network: "crypto", amount_usd: Number(r.total_usd), tx: null, at: r.created_at };
    }),
  ].sort((a, b) => +new Date(b.at) - +new Date(a.at));
  const total = agents.reduce((n, a) => n + (a.amount_usd || 0), 0);
  return json({ generated_at: new Date().toISOString(), supporters, agents, totals: { agent_donations: agents.length, agent_total_usd: Math.round(total * 100) / 100, human_supporters: supporters.length } }, 200, { "Cache-Control": "public, max-age=300" });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/growth/, "").replace(/\/+$/, "") || "/";
  try {
    if (req.method === "POST" && path === "/newsletter/subscribe") return await subscribe(req);
    if (req.method === "GET" && path === "/newsletter/confirm") return await confirm(url, false);
    if (req.method === "GET" && path === "/newsletter/unsubscribe") return await confirm(url, true);
    if (req.method === "POST" && path === "/promo") return await promo(req);
    if (req.method === "POST" && path === "/kofi") return await kofi(req);
    if (req.method === "GET" && path === "/wall") return await wall();
    if (req.method === "GET" && path === "/") return json({ name: "Vice City Hub growth API", routes: ["POST /newsletter/subscribe", "GET /newsletter/confirm", "GET /newsletter/unsubscribe", "POST /promo", "POST /kofi", "GET /wall"], site: SITE });
    return json({ error: "not_found" }, 404);
  } catch (e) {
    console.error("growth", (e as Error).message);
    return json({ error: "internal_error" }, 500);
  }
});
