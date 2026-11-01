// Pure module (no Deno globals): validates Discord invites through Discord's public invite API (no key needed).
const UA = "Mozilla/5.0 (compatible; ViceCityHubBot/1.0; +https://vicecityhub.github.io/vicecityhub/)";

/** discord.gg/x, discord.com/invite/x, discordapp.com/invite/x (scheme and www optional) -> invite code or null. */
export function parseInvite(s: string): string | null {
  const m = String(s ?? "").trim().match(/^(?:https?:\/\/)?(?:www\.)?(?:discord\.gg|discord(?:app)?\.com\/invite)\/([A-Za-z0-9-]{2,32})(?:[/?#].*)?$/i);
  return m ? m[1] : null;
}

export type InviteResult =
  | { kind: "ok"; code: string; url: string; guild_name: string; members: number | null; online: number | null; verified: boolean; partnered: boolean }
  | { kind: "invalid" }
  | { kind: "error"; message: string };

export async function checkInvite(codeOrUrl: string, timeoutMs = 8000): Promise<InviteResult> {
  const code = parseInvite(codeOrUrl) || (/^[A-Za-z0-9-]{2,32}$/.test(codeOrUrl) ? codeOrUrl : null);
  if (!code) return { kind: "invalid" };
  try {
    const r = await fetch(`https://discord.com/api/v10/invites/${code}?with_counts=true`, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs) });
    if (r.status === 404) return { kind: "invalid" };
    if (r.status === 429) return { kind: "error", message: "rate limited by discord" };
    if (!r.ok) return { kind: "error", message: `http ${r.status}` };
    const j = await r.json();
    const g = j?.guild || {};
    const feats: string[] = Array.isArray(g.features) ? g.features : [];
    return {
      kind: "ok",
      code,
      url: `https://discord.gg/${code}`,
      guild_name: String(g.name || "").slice(0, 100),
      members: Number.isFinite(j?.approximate_member_count) ? j.approximate_member_count : null,
      online: Number.isFinite(j?.approximate_presence_count) ? j.approximate_presence_count : null,
      verified: feats.includes("VERIFIED"),
      partnered: feats.includes("PARTNERED"),
    };
  } catch (e) { return { kind: "error", message: (e as Error).message }; }
}
