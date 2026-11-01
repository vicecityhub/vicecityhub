// Self-service listing: a server owner (or anyone) pastes a Cfx.re join code; we list it only if the LIVE Cfx.re listing proves it.
// Stored data comes from the listing and Discord's API, never from the request body.
import { db, json, rate, ipHash } from "./util.ts";
import { fetchLive, isCode, isRoleplay, displayTags, BAD_WORDS, type Live } from "./cfx.ts";
import { checkInvite, parseInvite, type InviteResult } from "./discord.ts";

export interface LookupResult {
  ok: boolean;
  code: string;
  reasons: string[];
  preview?: { name: string; players: number; max: number; locale: string | null; discord_url: string | null; discord_members: number | null };
  existing?: { id: string; name: string };
}

const BRANDS = ["nopixel", "gtaworld", "gtaw", "prodigy", "eclipse", "lucid", "citylife", "mafiacity"];
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

interface Evaluated { result: LookupResult; live?: Live; invite?: Extract<InviteResult, { kind: "ok" }> }

async function evaluate(codeIn: string): Promise<Evaluated> {
  const code = String(codeIn || "").trim().toLowerCase();
  const reasons: string[] = [];
  if (!isCode(code)) return { result: { ok: false, code, reasons: ["That is not a Cfx.re join code (5-16 letters/digits after cfx.re/join/)."] } };

  const { data: ex } = await db.from("rp_servers").select("id,name").eq("cfx_code", code).maybeSingle();
  if (ex) return { result: { ok: false, code, reasons: ["This server is already in the directory."], existing: { id: ex.id, name: ex.name } } };

  const f = await fetchLive(code);
  if (f.kind === "gone") return { result: { ok: false, code, reasons: ["Cfx.re does not list this code right now. Start the server and make sure it shows up in the FiveM server browser."] } };
  if (f.kind === "error") return { result: { ok: false, code, reasons: ["Cfx.re did not answer. Try again in a minute."] } };
  const l = f.live;

  if (l.gamename !== "gta5") reasons.push("Only GTA V (FiveM) servers are listed.");
  if (!l.fresh) reasons.push("The listing was not refreshed in the last 20 minutes. The server must be online.");
  if (l.online_count < 5) reasons.push(`At least 5 players must be online right now (currently ${l.online_count}).`);
  if (!isRoleplay(l)) reasons.push("The listing does not look like a roleplay server. Add roleplay tags in your Cfx.re portal.");
  if (BAD_WORDS.test(`${l.name} ${l.host_name} ${l.project_desc ?? ""} ${l.tags_raw.join(" ")}`)) reasons.push("The name or description contains words we do not list.");

  let invite: Extract<InviteResult, { kind: "ok" }> | undefined;
  const code0 = l.discord_link ? parseInvite(l.discord_link) : null;
  if (!code0) {
    reasons.push("Add a Discord invite (discord.gg/...) to your listing in the Cfx.re portal.");
  } else {
    const d = await checkInvite(code0);
    if (d.kind === "invalid") reasons.push("The Discord invite in your listing is invalid or expired. Use a permanent invite.");
    else if (d.kind === "error") reasons.push("Discord did not answer. Try again in a minute.");
    else {
      invite = d;
      if ((d.members ?? 0) < 100) reasons.push(`The Discord server needs at least 100 members (it has ${d.members ?? "unknown"}).`);
      const nName = norm(`${l.name}${l.host_name}`);
      const miss = BRANDS.filter((b) => nName.includes(b) && !norm(d.guild_name).includes(b));
      if (miss.length) reasons.push("The server name uses a well-known community brand that does not match the Discord server. We do not list impersonators.");
    }
  }

  return {
    result: {
      ok: reasons.length === 0, code, reasons,
      preview: { name: l.name, players: l.online_count, max: l.max_players, locale: l.locale, discord_url: invite?.url ?? null, discord_members: invite?.members ?? null },
    },
    live: l, invite,
  };
}

export async function lookupCode(code: string): Promise<LookupResult> { return (await evaluate(code)).result; }

export async function handleSubmit(req: Request): Promise<Response> {
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object") return json({ ok: false, error: "invalid_json" }, 400);
  if (b.company) return json({ ok: true, listed: false }); // honeypot: pretend success
  const ih = await ipHash(req);
  if (!(await rate(`rpsub:${ih}`, 3, 3600)) || !(await rate("rpsub:global", 40, 86400))) return json({ ok: false, error: "rate_limited" }, 429);

  const ev = await evaluate(String(b.code ?? ""));
  if (ev.result.existing) return json({ ok: false, error: "duplicate", existing: ev.result.existing, reasons: ev.result.reasons }, 409);
  if (!ev.result.ok || !ev.live || !ev.invite) return json({ ok: false, error: "rejected", reasons: ev.result.reasons }, 422);

  const l = ev.live, d = ev.invite, now = new Date().toISOString();
  const row = {
    cfx_code: l.code, name: l.name, host_name: l.host_name, project_desc: l.project_desc, description: null,
    status: "ONLINE", live: true, online_count: l.online_count, max_players: l.max_players, peak_players: l.peak_players, upvotes: l.upvotes,
    locale: l.locale, rp_style: l.style, access: l.allowlist ? "allowlist" : "public", framework: l.framework,
    tags: displayTags(l), features: l.features, icon_url: l.icon_url, banner_url: l.banner_url,
    discord_url: d.url, discord_members: d.members, discord_online: d.online, discord_verified: d.verified || d.partnered, discord_checked_at: now,
    resources_count: l.resources_count, owner_name: l.owner_name, fx_build: l.fx_build,
    last_checked_at: now, last_seen_at: l.last_seen_at, listing_status: "active", source: "submitted", sort_order: 1000,
  };
  const { data, error } = await db.from("rp_servers").insert(row).select("id,name").single();
  if (error) {
    if (error.code === "23505") return json({ ok: false, error: "duplicate", reasons: ["This server is already in the directory."] }, 409);
    console.error("rp-submit", error.message);
    return json({ ok: false, error: "unavailable" }, 503);
  }
  return json({ ok: true, listed: true, server: data });
}
