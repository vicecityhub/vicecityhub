// Pure module (no Deno globals, no project imports): runs in Deno (edge function) and Node 22+ (selftest).
// Reads the public Cfx.re server list endpoint used by the official server browser (servers.fivem.net).
// Verified 2026-10-31: GET {CFX_BASE}/single/<lowercase code> -> {EndPoint, Data}. 404 = not listed.
export const CFX_BASE = "https://frontend.cfx-services.net/api/servers";
const CODE_RE = /^[a-z0-9]{5,16}$/;
const UA = "Mozilla/5.0 (compatible; ViceCityHubBot/1.0; +https://vicecityhub.github.io/vicecityhub/)";
const BANNER_OK = ["https://cfx-server-metadata.cfx-services.net/", "https://frontend.cfx-services.net/"];

export interface Live {
  code: string;
  name: string;
  host_name: string;
  project_desc: string | null;
  gametype: string;
  gamename: string;
  online_count: number;
  max_players: number;
  peak_players: number | null;
  upvotes: number;
  locale: string | null;
  allowlist: boolean;
  tags_raw: string[];
  discord_link: string | null;
  icon_url: string | null;
  banner_url: string | null;
  resources_count: number;
  owner_name: string | null;
  fx_build: string | null;
  last_seen_at: string | null;
  fresh: boolean;
  voice: boolean | null;
  framework: string | null;
  features: string[];
  style: "serious" | "semi" | "casual" | "mixed";
}
export type FetchResult = { kind: "ok"; live: Live } | { kind: "gone" } | { kind: "error"; message: string };

export const isCode = (c: unknown): c is string => typeof c === "string" && CODE_RE.test(c);

/** Strips Cfx colour codes (^1), control chars and angle brackets, collapses spaces, cuts to n chars. */
export const cleanText = (s: unknown, n: number): string =>
  String(s ?? "").replace(/\^\d/g, "").replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);

const has = (res: string[], re: RegExp) => res.some((x) => re.test(x));

function detectFramework(res: string[]): string | null {
  if (res.includes("qbx_core")) return "qbox";
  if (res.includes("qb-core")) return "qbcore";
  if (res.includes("es_extended")) return "esx";
  if (res.includes("vrp") || res.includes("vrp_basic")) return "vrp";
  return null;
}

function detectFeatures(tags: string[], res: string[], name: string): string[] {
  const t = (tags.join(" ") + " " + name).toLowerCase();
  const f = new Set<string>();
  if (/police|lspd|\bpd\b/.test(t) || has(res, /police|lspd/i)) f.add("police");
  if (/\bems\b|medic|ambulance/.test(t) || has(res, /ambulance|medic/i)) f.add("ems");
  if (/gang/.test(t) || has(res, /gang/i)) f.add("gangs");
  if (/mafia|\bmc\b|cartel|organi[sz]/.test(t)) f.add("mafia");
  if (/economy/.test(t) || has(res, /banking|economy/i)) f.add("economy");
  if (/\bjobs?\b/.test(t)) f.add("jobs");
  if (/business/.test(t) || has(res, /business/i)) f.add("businesses");
  if (/drug/.test(t) || has(res, /drug/i)) f.add("drugs");
  if (/heist/.test(t) || has(res, /heist/i)) f.add("heists");
  if (/racing|race/.test(t) || has(res, /racing/i)) f.add("racing");
  if (/custom cars|custom vehicles|addon cars|custom car/.test(t)) f.add("custom_cars");
  if (has(res, /pma-voice|saltychat|tokovoip|mumble-voip/i)) f.add("voice");
  if (/streamer/.test(t)) f.add("streamer");
  if (/miami|vice city|south beach|\b305\b|florida|leonida/.test(t)) f.add("miami");
  return [...f];
}

function detectStyle(tags: string[], name: string, gametype: string): Live["style"] {
  const t = (tags.join(" ") + " " + name + " " + gametype).toLowerCase();
  if (/semi.?serious|semi.?rp|semirp/.test(t)) return "semi";
  if (/serious|hardcore|realistic|midcore/.test(t)) return "serious";
  if (/casual|chill|fun|beginner|newbie|friendly/.test(t)) return "casual";
  return "mixed";
}

// deno-lint-ignore no-explicit-any
function toLive(code: string, d: any): Live {
  const v = d?.vars || {};
  const res: string[] = Array.isArray(d?.resources) ? d.resources.map(String) : [];
  const tags: string[] = String(v.tags || "").split(",").map((s: string) => cleanText(s, 30)).filter(Boolean);
  const name = cleanText(v.sv_projectName, 80) || cleanText(d?.hostname, 80);
  const last = d?.lastSeen ? Date.parse(d.lastSeen) : NaN;
  const bannerRaw = String(v.banner_detail || v.banner_connecting || "");
  const iconV = typeof d?.iconVersion === "number" ? d.iconVersion : null;
  const peak = parseInt(String(v.peak_players ?? ""), 10);
  const build = String(d?.server || "").match(/v1\.0\.0\.(\d+)/);
  return {
    code,
    name,
    host_name: cleanText(d?.hostname, 140),
    project_desc: cleanText(v.sv_projectDesc, 500) || null,
    gametype: cleanText(d?.gametype, 60),
    gamename: String(v.gamename || "gta5"),
    online_count: Number.isFinite(d?.clients) ? d.clients : 0,
    max_players: Number(d?.sv_maxclients || d?.svMaxclients || 0),
    peak_players: Number.isFinite(peak) ? peak : null,
    upvotes: Number(d?.upvotePower || 0),
    locale: /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/.test(String(v.locale || "")) ? String(v.locale) : null,
    allowlist: String(v.sv_appearAllowlisted) === "true",
    tags_raw: tags,
    discord_link: typeof v.discord_link === "string" && v.discord_link ? v.discord_link : null,
    icon_url: iconV !== null ? `${CFX_BASE}/icon/${code}/${iconV}.png` : null,
    banner_url: BANNER_OK.some((p) => bannerRaw.startsWith(p)) ? bannerRaw.slice(0, 300) : null,
    resources_count: res.length,
    owner_name: cleanText(d?.ownerName, 40) || null,
    fx_build: build ? build[0] : null,
    last_seen_at: Number.isFinite(last) ? new Date(last).toISOString() : null,
    fresh: Number.isFinite(last) && Date.now() - last < 20 * 60_000,
    voice: v.sv_voiceChat === undefined ? null : String(v.sv_voiceChat) === "true",
    framework: detectFramework(res),
    features: detectFeatures(tags, res, name),
    style: detectStyle(tags, name, String(d?.gametype || "")),
  };
}

export async function fetchLive(codeIn: string, timeoutMs = 8000): Promise<FetchResult> {
  const code = String(codeIn || "").toLowerCase();
  if (!CODE_RE.test(code)) return { kind: "gone" };
  let lastErr = "unknown";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(`${CFX_BASE}/single/${code}`, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs) });
      if (r.status === 404) return { kind: "gone" };
      if (!r.ok) { lastErr = `http ${r.status}`; continue; }
      const j = await r.json();
      if (!j?.Data) return { kind: "gone" };
      return { kind: "ok", live: toLive(code, j.Data) };
    } catch (e) { lastErr = (e as Error).message; }
  }
  return { kind: "error", message: lastErr };
}

const NEG = /pvp|hop ?outs?|redzone|red zone|freeroam|free roam|drift|racing only|deathmatch|gungame|minigame|ranked|stunt|zombie|battle ?royale/i;
const POS = /roleplay|\brp\b|serious|semi.?serious|allowlist|whitelist|lifestyle|economy|police|jobs/i;
export const BAD_WORDS = /porn|nsfw|\berp\b|\bsex|nude|onlyfans|nitro|robux|cheat|hack|modmenu|stake\.com|xxx/i;

/** True when the listing clearly describes a roleplay server and not a PvP / freeroam / race lobby. */
export function isRoleplay(l: Live): boolean {
  const nameish = `${l.name} ${l.host_name} ${l.gametype}`;
  const tags = l.tags_raw.join(" ");
  if (!POS.test(`${nameish} ${tags}`)) return false;
  if (NEG.test(nameish)) return false;
  if (NEG.test(tags) && !/roleplay/i.test(`${tags} ${nameish}`)) return false;
  return true;
}

const JUNK_TAGS = new Set(["default", "official", "enhanced", "onesync", "rp", "roleplay", "esx", "qb", "vrp"]);
/** Display tags: Title Case, de-duplicated, no junk, max 8. */
export function displayTags(l: Live): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (s: string) => {
    const k = s.toLowerCase();
    if (!k || k.length < 2 || k.length > 24 || seen.has(k) || JUNK_TAGS.has(k)) return;
    seen.add(k);
    out.push(s.replace(/\b([a-z])/g, (m) => m.toUpperCase()));
  };
  add(l.allowlist ? "Allowlist" : "Public");
  if (l.voice) add("In-Game Voice");
  for (const t of l.tags_raw) add(t);
  return out.slice(0, 8);
}
