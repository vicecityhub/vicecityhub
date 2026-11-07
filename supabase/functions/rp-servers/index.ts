// Vice City Hub - rp-servers edge function (v14). Keeps public.rp_servers fresh from the public Cfx.re list.
//   GET  /sync      refresh live fields (cron every 2 min, throttled)
//   GET  /enrich    validate Discord invites + member counts (cron every 15 min, throttled)
//   GET  /lookup?code=<cfx code>   preview + reasons (public, rate limited)
//   POST /submit    {code, company}  self-service listing (automatic, rules in submit.ts)
//   GET  /health
// Deployed with verify_jwt = false (public endpoint; every route validates its own input). See docs/RP-SERVERS.md.
import { db, json, CORS, rate, ipHash, throttle, pool } from "./util.ts";
import { fetchLive, isCode, type Live } from "./cfx.ts";
import { checkInvite, parseInvite, type InviteResult } from "./discord.ts";
import { lookupCode, handleSubmit } from "./submit.ts";

const DAY = 864e5;
const BUDGET_MS = 45_000; // a cron run stops starting new work after this long (the function limit is higher, the next run picks up)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------- /sync ----------
const newSyncStats = () => ({ checked: 0, live: 0, offline: 0, errors: 0, dead: 0, revived: 0, skipped_budget: 0 });
type SyncStats = ReturnType<typeof newSyncStats>;
type Row = Record<string, unknown>;

/** Cfx.re no longer lists the server: offline now, and "dead" after 14 days without a sighting (an active listing only). */
function offlinePatch(row: Row, now: string, st: SyncStats): Row {
  const since = Date.parse((row.last_seen_at as string) || (row.created_at as string));
  const dead = Number.isFinite(since) && Date.now() - since > 14 * DAY;
  const patch: Row = { live: false, status: "OFFLINE", online_count: null, last_checked_at: now };
  if (dead && row.listing_status === "active") { patch.listing_status = "dead"; st.dead++; }
  st.offline++;
  return patch;
}

/** The fields every sighting refreshes. A listing that was not refreshed lately counts as offline. */
const sightingFields = (l: Live, now: string): Row => ({
  host_name: l.host_name, project_desc: l.project_desc, live: l.fresh, status: l.fresh ? "ONLINE" : "OFFLINE",
  online_count: l.fresh ? l.online_count : null, max_players: l.max_players || null, peak_players: l.peak_players,
  upvotes: l.upvotes, resources_count: l.resources_count, owner_name: l.owner_name, fx_build: l.fx_build,
  icon_url: l.icon_url, banner_url: l.banner_url, last_checked_at: now, last_seen_at: l.last_seen_at,
});

/** Fields written only when the listing (or the row) calls for them. */
const conditionalFields = (row: Row, l: Live, revived: boolean): Row => ({
  ...(l.locale ? { locale: l.locale } : {}),
  ...(l.allowlist ? { access: "allowlist" } : {}),
  ...(row.source === "submitted" ? { name: l.name } : {}),
  ...(revived ? { listing_status: "active" } : {}),
});

/** The server is listed: refresh its live fields; a dead listing that is live again comes back. */
function livePatch(row: Row, l: Live, now: string, st: SyncStats): Row {
  const revived = row.listing_status === "dead" && l.fresh;
  if (revived) st.revived++;
  if (l.fresh) st.live++; else st.offline++;
  return { ...sightingFields(l, now), ...conditionalFields(row, l, revived) };
}

async function syncRow(row: Row, st: SyncStats, t0: number): Promise<void> {
  if (Date.now() - t0 > BUDGET_MS) { st.skipped_budget++; return; }
  const r = await fetchLive(row.cfx_code as string);
  const now = new Date().toISOString();
  st.checked++;
  if (r.kind === "error") { st.errors++; return; }
  const patch = r.kind === "gone" ? offlinePatch(row, now, st) : livePatch(row, r.live, now, st);
  await db.from("rp_servers").update(patch).eq("id", row.id);
}

async function sync(): Promise<Response> {
  if (!(await throttle("rp-sync", 90))) return json({ ok: true, skipped: true });
  const t0 = Date.now();
  const { data: rows, error } = await db.from("rp_servers")
    .select("id,cfx_code,source,access,listing_status,last_seen_at,created_at")
    .not("cfx_code", "is", null).in("listing_status", ["active", "dead"])
    .order("last_checked_at", { ascending: true, nullsFirst: true }).limit(60);
  if (error) { console.error("rp-sync", error.message); return json({ ok: false, error: "db" }, 500); }
  const st = newSyncStats();
  await pool((rows || []) as Row[], 6, (row) => syncRow(row, st, t0));
  return json({ ok: true, ...st, ms: Date.now() - t0 });
}

// ---------- /enrich ----------
// Discord answers one invite at a time and rate limits (429), so the rows are checked one after another with a pause: this is
// deliberate pacing, not an N+1 to batch away.
const DISCORD_PAUSE_MS = 400;
const newEnrichStats = () => ({ checked: 0, valid: 0, replaced: 0, cleared: 0, errors: 0 });
type EnrichStats = ReturnType<typeof newEnrichStats>;

/** The invite the server itself advertises on Cfx.re right now (null when it is unlisted, advertises none or something else). */
async function advertisedInvite(row: Row): Promise<string | null> {
  const f = await fetchLive(row.cfx_code as string);
  return f.kind === "ok" && f.live.discord_link ? parseInvite(f.live.discord_link) : null;
}

/** Checks the stored invite; when it is gone (or missing) the curated link may have expired, so try the advertised one if it differs. */
async function checkRowInvite(row: Row, st: EnrichStats): Promise<InviteResult> {
  const res: InviteResult = row.discord_url ? await checkInvite(row.discord_url as string) : { kind: "invalid" };
  if (res.kind !== "invalid") return res;
  const advertised = await advertisedInvite(row);
  if (!advertised || advertised === parseInvite((row.discord_url as string) || "")) return res;
  const replacement = await checkInvite(advertised);
  if (replacement.kind === "ok") st.replaced++;
  return replacement;
}

/** A valid invite refreshes the Discord fields, a dead one clears them, an answer we could not get changes nothing. */
async function recordInvite(row: Row, res: InviteResult, st: EnrichStats): Promise<void> {
  if (res.kind === "error") { st.errors++; return; }
  const checked = { discord_checked_at: new Date().toISOString() };
  if (res.kind === "invalid") {
    st.cleared++;
    await db.from("rp_servers").update({ discord_url: null, discord_members: null, discord_online: null, discord_verified: false, ...checked }).eq("id", row.id);
    return;
  }
  st.valid++;
  await db.from("rp_servers").update({ discord_url: res.url, discord_members: res.members, discord_online: res.online, discord_verified: res.verified || res.partnered, ...checked }).eq("id", row.id);
}

async function enrich(): Promise<Response> {
  if (!(await throttle("rp-enrich", 600))) return json({ ok: true, skipped: true });
  const t0 = Date.now();
  const { data: rows, error } = await db.from("rp_servers").select("id,cfx_code,discord_url")
    .eq("listing_status", "active").not("cfx_code", "is", null)
    .order("discord_checked_at", { ascending: true, nullsFirst: true }).limit(20);
  if (error) return json({ ok: false, error: "db" }, 500);
  const st = newEnrichStats();
  for (const row of rows || []) {
    if (Date.now() - t0 > BUDGET_MS) break;
    st.checked++;
    await recordInvite(row, await checkRowInvite(row, st), st);
    await sleep(DISCORD_PAUSE_MS);
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

async function lookup(req: Request, url: URL): Promise<Response> {
  const code = (url.searchParams.get("code") || "").trim().toLowerCase();
  if (!isCode(code)) return json({ ok: false, code, reasons: ["That is not a Cfx.re join code."] }, 422);
  if (!(await rate(`rplook:${await ipHash(req)}`, 20, 3600))) return json({ ok: false, error: "rate_limited" }, 429);
  return json(await lookupCode(code));
}

const INDEX = { name: "Vice City Hub RP servers API", routes: ["GET /sync", "GET /enrich", "GET /lookup?code=", "POST /submit", "GET /health"], docs: "docs/RP-SERVERS.md" };

/** "METHOD /path" -> handler. */
const ROUTES: Record<string, (req: Request, url: URL) => Promise<Response> | Response> = {
  "GET /sync": () => sync(),
  "GET /enrich": () => enrich(),
  "GET /health": () => health(),
  "GET /lookup": lookup,
  "POST /submit": (req) => handleSubmit(req),
  "GET /": () => json(INDEX),
};

const pathOf = (url: URL): string => url.pathname.replace(/^\/rp-servers/, "").replace(/\/+$/, "") || "/";

async function route(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const url = new URL(req.url);
  const key = `${req.method} ${pathOf(url)}`;
  const handler = Object.hasOwn(ROUTES, key) ? ROUTES[key] : undefined;
  return handler ? await handler(req, url) : json({ error: "not_found" }, 404);
}

Deno.serve(async (req) => {
  try {
    return await route(req);
  } catch (e) {
    console.error("rp-servers", (e as Error).message);
    return json({ error: "internal_error" }, 500);
  }
});
