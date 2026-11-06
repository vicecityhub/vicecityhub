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

/** [feature, regex over tags + name (lower-case), regex over resource names]; a feature appears when either matches. Order = output order. */
type FeatureRule = [feature: string, text: RegExp | null, resources: RegExp | null];
const FEATURE_RULES: FeatureRule[] = [
  ["police", /police|lspd|\bpd\b/, /police|lspd/i],
  ["ems", /\bems\b|medic|ambulance/, /ambulance|medic/i],
  ["gangs", /gang/, /gang/i],
  ["mafia", /mafia|\bmc\b|cartel|organi[sz]/, null],
  ["economy", /economy/, /banking|economy/i],
  ["jobs", /\bjobs?\b/, null],
  ["businesses", /business/, /business/i],
  ["drugs", /drug/, /drug/i],
  ["heists", /heist/, /heist/i],
  ["racing", /racing|race/, /racing/i],
  ["custom_cars", /custom cars|custom vehicles|addon cars|custom car/, null],
  ["voice", null, /pma-voice|saltychat|tokovoip|mumble-voip/i],
  ["streamer", /streamer/, null],
  ["miami", /miami|vice city|south beach|\b305\b|florida|leonida/, null],
];

function detectFeatures(tags: string[], res: string[], name: string): string[] {
  const t = (tags.join(" ") + " " + name).toLowerCase();
  return FEATURE_RULES
    .filter(([, text, resources]) => text?.test(t) || (resources !== null && has(res, resources)))
    .map(([feature]) => feature);
}

function detectStyle(tags: string[], name: string, gametype: string): Live["style"] {
  const t = (tags.join(" ") + " " + name + " " + gametype).toLowerCase();
  if (/semi.?serious|semi.?rp|semirp/.test(t)) return "semi";
  if (/serious|hardcore|realistic|midcore/.test(t)) return "serious";
  if (/casual|chill|fun|beginner|newbie|friendly/.test(t)) return "casual";
  return "mixed";
}

const LOCALE_RE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/;
const FRESH_MS = 20 * 60_000;

// deno-lint-ignore no-explicit-any
type Raw = any;

/** The number itself when it is a finite number, else the fallback. */
const finiteOr = <T>(n: unknown, fallback: T): number | T => (Number.isFinite(n) ? (n as number) : fallback);

/** Player counts and votes. */
function readPlayers(d: Raw, v: Raw) {
  return {
    online_count: finiteOr(d?.clients, 0),
    max_players: Number(d?.sv_maxclients || d?.svMaxclients || 0),
    peak_players: finiteOr(parseInt(String(v.peak_players ?? ""), 10), null),
    upvotes: Number(d?.upvotePower || 0),
  };
}

const nonEmptyString = (x: unknown): string | null => (typeof x === "string" && x ? x : null);

/** The banner is only trusted from the Cfx hosts. */
const trustedBanner = (raw: string): string | null => (BANNER_OK.some((p) => raw.startsWith(p)) ? raw.slice(0, 300) : null);

/** Discord invite, icon and banner. */
function readLinks(d: Raw, v: Raw, code: string) {
  const iconV = typeof d?.iconVersion === "number" ? d.iconVersion : null;
  return {
    discord_link: nonEmptyString(v.discord_link),
    icon_url: iconV !== null ? `${CFX_BASE}/icon/${code}/${iconV}.png` : null,
    banner_url: trustedBanner(String(v.banner_detail || v.banner_connecting || "")),
  };
}

/** When the server was last seen and whether that is recent enough to call it live. */
function readSeen(d: Raw) {
  const last = d?.lastSeen ? Date.parse(d.lastSeen) : NaN;
  return {
    last_seen_at: Number.isFinite(last) ? new Date(last).toISOString() : null,
    fresh: Number.isFinite(last) && FRESH_MS > Date.now() - last,
  };
}

const readLocale = (v: Raw): string | null => (LOCALE_RE.test(String(v.locale || "")) ? String(v.locale) : null);
const readVoice = (v: Raw): boolean | null => (v.sv_voiceChat === undefined ? null : String(v.sv_voiceChat) === "true");
const readBuild = (d: Raw): string | null => String(d?.server || "").match(/v1\.0\.0\.(\d+)/)?.[0] ?? null;

const orNull = (s: string): string | null => s || null;
const readResources = (d: Raw): string[] => (Array.isArray(d?.resources) ? d.resources.map(String) : []);
const readTags = (v: Raw): string[] => String(v.tags || "").split(",").map((s: string) => cleanText(s, 30)).filter(Boolean);
const readName = (d: Raw, v: Raw): string => cleanText(v.sv_projectName, 80) || cleanText(d?.hostname, 80);

function toLive(code: string, d: Raw): Live {
  const v = d?.vars || {};
  const res = readResources(d);
  const tags = readTags(v);
  const name = readName(d, v);
  return {
    code,
    name,
    host_name: cleanText(d?.hostname, 140),
    project_desc: orNull(cleanText(v.sv_projectDesc, 500)),
    gametype: cleanText(d?.gametype, 60),
    gamename: String(v.gamename || "gta5"),
    ...readPlayers(d, v),
    locale: readLocale(v),
    allowlist: String(v.sv_appearAllowlisted) === "true",
    tags_raw: tags,
    ...readLinks(d, v, code),
    resources_count: res.length,
    owner_name: orNull(cleanText(d?.ownerName, 40)),
    fx_build: readBuild(d),
    ...readSeen(d),
    voice: readVoice(v),
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
/** A tag is shown when its length is 2-24 and it is not junk (an empty tag fails the length rule). */
const TAG_RULES: ((k: string) => boolean)[] = [(k) => k.length >= 2, (k) => k.length <= 24, (k) => !JUNK_TAGS.has(k)];
const titleCase = (s: string) => s.replace(/\b([a-z])/g, (m) => m.toUpperCase());

/** Display tags: Title Case, de-duplicated, no junk, max 8. */
export function displayTags(l: Live): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (s: string) => {
    const k = s.toLowerCase();
    if (seen.has(k) || !TAG_RULES.every((rule) => rule(k))) return;
    seen.add(k);
    out.push(titleCase(s));
  };
  add(l.allowlist ? "Allowlist" : "Public");
  if (l.voice) add("In-Game Voice");
  for (const t of l.tags_raw) add(t);
  return out.slice(0, 8);
}
