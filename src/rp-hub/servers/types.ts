/**
 * RP Hub · Servers: shared data contract. SINGLE SOURCE OF TRUTH for the shape of public.rp_servers
 * and for every connect link. Do not duplicate these definitions elsewhere. See docs/RP-SERVERS.md.
 *
 * Rule of the project: no invented numbers, codes or descriptions. Live fields are written only by the
 * `rp-servers` edge function from the public Cfx.re list; the UI shows them as-is (or hides them when null).
 */

export type ListingStatus = 'active' | 'pending' | 'hidden' | 'dead';
export type ServerAccess = 'public' | 'allowlist';
export type RpStyle = 'serious' | 'semi' | 'casual' | 'mixed';
export type PromoTier = 'bump' | 'featured' | 'headline';
export type ServerStatus = 'ONLINE' | 'OFFLINE' | 'IN_DEVELOPMENT' | 'WHITELIST_OPEN';

/** One row of public.rp_servers (columns the UI reads). Anything live may be null until the first sync. */
export interface IRpServer {
  id: string;
  /** Lowercase Cfx.re join code (the part after cfx.re/join/). The only key we ever connect with. */
  cfx_code: string;
  /** Project name from the server's own listing (sv_projectName), emoji/colour codes stripped. */
  name: string;
  /** Raw hostname from the listing, colour codes stripped (can be long/spammy: use for search only). */
  host_name: string | null;
  /** Owner-written description from the listing (sv_projectDesc), sanitized, <= 500 chars. */
  project_desc: string | null;
  /** Hub-written blurb (English, GTA sarcasm allowed but facts only). May be null: fall back to project_desc. */
  description: string | null;
  status: ServerStatus | null;
  /** true when the Cfx.re list saw the server in the last sync. */
  live: boolean;
  online_count: number | null;
  max_players: number | null;
  peak_players: number | null;
  /** Cfx.re upvote power (real "votes" from the official list). */
  upvotes: number;
  /** BCP-47 like en-US, pt-BR, es-ES... straight from the server's convar. */
  locale: string | null;
  rp_style: RpStyle | null;
  /** allowlist = the server shows the padlock / needs approval before playing. */
  access: ServerAccess;
  /** esx | qbcore | qbox | vrp | custom | other (lowercase) */
  framework: string | null;
  /** Display tags (Title Case, max ~8). */
  tags: string[];
  /** Machine feature keys, subset of FEATURE_KEYS. */
  features: string[];
  icon_url: string | null;
  banner_url: string | null;
  website_url: string | null;
  /** Always an https://discord.gg/<code> or https://discord.com/invite/<code> link that was validated. */
  discord_url: string | null;
  discord_members: number | null;
  discord_online: number | null;
  discord_verified: boolean;
  resources_count: number | null;
  owner_name: string | null;
  fx_build: string | null;
  last_checked_at: string | null;
  last_seen_at: string | null;
  promo_tier: PromoTier | null;
  promo_until: string | null;
  is_featured: boolean;
  sort_order: number | null;
  source: 'curated' | 'submitted';
  listing_status: ListingStatus;
  created_at: string | null;
}

/** Column list for supabase-js .select(...) (keeps payload small; never select('*') in the UI). */
export const RP_SERVER_COLUMNS =
  'id,cfx_code,name,host_name,project_desc,description,status,live,online_count,max_players,peak_players,upvotes,locale,rp_style,access,framework,tags,features,icon_url,banner_url,website_url,discord_url,discord_members,discord_online,discord_verified,resources_count,owner_name,fx_build,last_checked_at,last_seen_at,promo_tier,promo_until,is_featured,sort_order,source,listing_status,created_at';

/** Allowed values for rp_servers.features, with UI labels. Curation and filters must use only these keys. */
export const FEATURES: Record<string, string> = {
  police: 'Police',
  ems: 'EMS',
  gangs: 'Gangs',
  mafia: 'Mafia / Orgs',
  economy: 'Economy',
  jobs: 'Jobs',
  businesses: 'Businesses',
  drugs: 'Drugs',
  heists: 'Heists',
  racing: 'Racing',
  pvp: 'PvP',
  custom_cars: 'Custom cars',
  voice: 'In-game voice',
  streamer: 'Streamer friendly',
  miami: 'Miami / Vice City vibes',
};
export const FEATURE_KEYS = Object.keys(FEATURES);

export const FRAMEWORKS: Record<string, string> = { esx: 'ESX', qbcore: 'QBCore', qbox: 'Qbox', vrp: 'vRP', custom: 'Custom', other: 'Other' };
export const STYLES: Record<RpStyle, string> = { serious: 'Serious RP', semi: 'Semi-serious', casual: 'Casual / Fun', mixed: 'Mixed' };

/* ───────── connect links: ONE definition, used by card, modal, SEO page and agent surface ───────── */
const CODE_RE = /^[a-z0-9]{5,16}$/;
export const isCfxCode = (c: unknown): c is string => typeof c === 'string' && CODE_RE.test(c);
/** Opens FiveM directly (needs FiveM installed; browsers ask for permission). */
export const fivemJoinUri = (code: string) => `fivem://connect/cfx.re/join/${code}`;
/** Official web join link (cfx.re shows the launch page and fallbacks). */
export const cfxJoinWeb = (code: string) => `https://cfx.re/join/${code}`;
/** What to type into the FiveM F8 console. */
export const fivemConsoleCmd = (code: string) => `connect cfx.re/join/${code}`;
/** The official server page on the Cfx.re list. */
export const cfxListUrl = (code: string) => `https://servers.fivem.net/servers/detail/${code}`;

/** The edge function that keeps the table fresh. */
export const RP_API_BASE =
  `${(import.meta as any).env?.VITE_SUPABASE_URL || 'https://lpglkglhjdqnktybksth.supabase.co'}/functions/v1/rp-servers`;
