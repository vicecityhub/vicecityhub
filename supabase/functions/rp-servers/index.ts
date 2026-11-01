// Vice City Hub - rp-servers edge function (v14). Keeps public.rp_servers fresh from the public Cfx.re list.
//   GET  /sync      refresh live fields (cron every 2 min, throttled)
//   GET  /enrich    validate Discord invites + member counts (cron every 15 min, throttled)
//   GET  /lookup?code=<cfx code>   preview + reasons (public, rate limited)
//   POST /submit    {code, company}  self-service listing (automatic, rules in submit.ts)
//   GET  /health
// Deployed with verify_jwt = false (public endpoint; every route validates its own input). See docs/RP-SERVERS.md.
import { db, json, CORS, rate, ipHash, throttle, pool } from "./util.ts";
import { fetchLive, isCode } from "./cfx.ts";
import { checkInvite, parseInvite } from "./discord.ts";
import { lookupCode, handleSubmit } from "./submit.ts";

const DAY = 864e5;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function sync(): Promise<Response> {
  if (!(await throttle("rp-sync", 90))) return json({ ok: true, skipped: true });
  const t0 = Date.now();
  const { data: rows, error } = await db.from("rp_servers")
    .select("id,cfx_code,source,access,listing_status,last_seen_at,created_at")
    .not("cfx_code", "is", null).in("listing_status", ["active", "dead"])
    .order("last_checked_at", { ascending: true, nullsFirst: true }).limit(60);
  if (error) { console.error("rp-sync", error.message); return json({ ok: false, error: "db" }, 500); }
  const st = { checked: 0, live: 0, offline: 0, errors: 0, dead: 0, revived: 0, skipped_budget: 0 };
  await pool(rows || [], 6, async (row) => {
    if (Date.now() - t0 > 45_000) { st.skipped_budget++; return; }
    const r = await fetchLive(row.cfx_code as string);
    const now = new Date().toISOString();
    st.checked++;
    if (r.kind === "error") { st.errors++; return; }
    if (r.kind === "gone") {
      const since = Date.parse((row.last_seen_at as string) || (row.created_at as string));
      const dead = Number.isFinite(since) && Date.now() - since > 14 * DAY;
      const patch: Record<string, unknown> = { live: false, status: "OFFLINE", online_count: null, last_checked_at: now };
      if (dead && row.listing_status === "active") { patch.listing_status = "dead"; st.dead++; }
      st.offline++;
      await db.from("rp_servers").update(patch).eq("id", row.id);
      return;
    }
    const l = r.live;
    const patch: Record<string, unknown> = {
      host_name: l.host_name, project_desc: l.project_desc, live: l.fresh, status: l.fresh ? "ONLINE" : "OFFLINE",
      online_count: l.fresh ? l.online_count : null, max_players: l.max_players || null, peak_players: l.peak_players,
      upvotes: l.upvotes, resources_count: l.resources_count, owner_name: l.owner_name, fx_build: l.fx_build,
      icon_url: l.icon_url, banner_url: l.banner_url, last_checked_at: now, last_seen_at: l.last_seen_at,
    };
    if (l.locale) patch.locale = l.locale;
    if (l.allowlist) patch.access = "allowlist";
    if (row.source === "submitted") patch.name = l.name;
    if (row.listing_status === "dead" && l.fresh) { patch.listing_status = "active"; st.revived++; }
    if (l.fresh) st.live++; else st.offline++;
    await db.from("rp_servers").update(patch).eq("id", row.id);
  });
  return json({ ok: true, ...st, ms: Date.now() - t0 });
}

async function enrich(): Promise<Response> {
  if (!(await throttle("rp-enrich", 600))) return json({ ok: true, skipped: true });
  const t0 = Date.now();
  const { data: rows, error } = await db.from("rp_servers").select("id,cfx_code,discord_url")
    .eq("listing_status", "active").not("cfx_code", "is", null)
    .order("discord_checked_at", { ascending: true, nullsFirst: true }).limit(20);
  if (error) return json({ ok: false, error: "db" }, 500);
  const st = { checked: 0, valid: 0, replaced: 0, cleared: 0, errors: 0 };
  for (const row of rows || []) {
    if (Date.now() - t0 > 45_000) break;
    st.checked++;
    let res = row.discord_url ? await checkInvite(row.discord_url as string) : ({ kind: "invalid" } as const);
    if (res.kind === "invalid") { // curated link may have expired: try the invite the server itself advertises now
      const f = await fetchLive(row.cfx_code as string);
      const inv = f.kind === "ok" && f.live.discord_link ? parseInvite(f.live.discord_link) : null;
      if (inv && inv !== parseInvite((row.discord_url as string) || "")) { res = await checkInvite(inv); if (res.kind === "ok") st.replaced++; }
    }
    const now = new Date().toISOString();
    if (res.kind === "ok") {
      st.valid++;
      await db.from("rp_servers").update({ discord_url: res.url, discord_members: res.members, discord_online: res.online, discord_verified: res.verified || res.partnered, discord_checked_at: now }).eq("id", row.id);
    } else if (res.kind === "invalid") {
      st.cleared++;
      await db.from("rp_servers").update({ discord_url: null, discord_members: null, discord_online: null, discord_verified: false, discord_checked_at: now }).eq("id", row.id);
    } else st.errors++;
    await sleep(400);
  }
  return json({ ok: true, ...st, ms: Date.now() - t0 });
}

async function health(): Promise<Response> {
  const [a, b, c, d] = await Promise.all([
    db.from("rp_servers").select("id", { count: "exact", head: true }).eq("listing_status", "active"),
    db.from("rp_servers").select("id", { count: "exact", head: true }).eq("listing_status", "active").eq("live", true),
    db.from("rp_servers").select("last_checked_at").order("last_checked_at", { ascending: false, nullsFirst: false }).limit(1),
    db.from("agent_cache").select("key,refresh_lock").in("key", ["rp-sync", "rp-enrich"]),
  ]);
  const lock = (k: string) => (d.data || []).find((x: { key: string }) => x.key === k)?.refresh_lock ?? null;
  return json({ ok: true, listed: a.count ?? 0, live: b.count ?? 0, last_checked_at: c.data?.[0]?.last_checked_at ?? null, last_sync_at: lock("rp-sync"), last_enrich_at: lock("rp-enrich") }, 200, { "Cache-Control": "public, max-age=30" });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/rp-servers/, "").replace(/\/+$/, "") || "/";
  try {
    if (req.method === "GET" && path === "/sync") return await sync();
    if (req.method === "GET" && path === "/enrich") return await enrich();
    if (req.method === "GET" && path === "/health") return await health();
    if (req.method === "GET" && path === "/lookup") {
      const code = (url.searchParams.get("code") || "").trim().toLowerCase();
      if (!isCode(code)) return json({ ok: false, code, reasons: ["That is not a Cfx.re join code."] }, 422);
      if (!(await rate(`rplook:${await ipHash(req)}`, 20, 3600))) return json({ ok: false, error: "rate_limited" }, 429);
      return json(await lookupCode(code));
    }
    if (req.method === "POST" && path === "/submit") return await handleSubmit(req);
    if (req.method === "GET" && path === "/") return json({ name: "Vice City Hub RP servers API", routes: ["GET /sync", "GET /enrich", "GET /lookup?code=", "POST /submit", "GET /health"], docs: "docs/RP-SERVERS.md" });
    return json({ error: "not_found" }, 404);
  } catch (e) {
    console.error("rp-servers", (e as Error).message);
    return json({ error: "internal_error" }, 500);
  }
});
