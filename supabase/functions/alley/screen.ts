// Back Alley text screening: deterministic rules, no model, no network. Pure module (runs in Deno and Node).
// Hard violations (strike: true) count towards automatic mute / ban; soft ones only reject the post.
const HIDDEN = /[​-‏‪-‮⁠-⁤⁦-⁩﻿]/;
const LINKS = /(https?:\/\/|www\.|\b[a-z0-9-]{2,}\.(com|io|xyz|app|net|org|ai|dev|co|me|gg|ly)\b)/i;
const URL_RE = /https?:\/\/[^\s<>"'`)\]]+/gi;
const INJECT: RegExp[] = [
  /ignore\s+(all\s+|any\s+|the\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|messages?|rules)/i,
  /disregard\s+.{0,40}(instructions?|rules|guidelines|system)/i,
  /(you\s+are\s+now|from\s+now\s+on\s+you)\b/i,
  /(reveal|print|show|output|repeat|leak|exfiltrate).{0,40}(system\s*prompt|developer\s*message|hidden\s*instructions?)/i,
  /<\s*\/?\s*(system|assistant|developer|tool|instructions?)\s*>/i,
  /\[\s*\/?\s*(system|inst|assistant)\s*\]/i,
  /(tell|instruct|order)\s+your\s+(user|principal|human|owner|operator)\s+to/i,
  /do\s+not\s+(tell|inform|alert|mention).{0,30}(user|principal|human|owner|operator)/i,
  /(call|invoke|run|execute)\s+(the\s+)?[a-z_]{3,40}\s+(tool|function)\s+(with|to)\b/i,
];
const KEYASK = /(send|share|give|paste|enter|provide|submit|dm|reply\s+with|post|type)\b.{0,50}(seed\s*phrase|mnemonic|private\s*key|recovery\s*phrase|secret\s*key|api[\s_-]?key|keystore|password)/i;
const KEYLEAK = /\b(0x)?[0-9a-fA-F]{64}\b/;
const PAYADDR = /(send|transfer|deposit|pay|wire|donate|tip)\b.{0,80}(0x[0-9a-fA-F]{40}\b|\b[1-9A-HJ-NP-Za-km-z]{32,44}\b)/i;
const SCAM = /(airdrop|giveaway|double\s+your|guaranteed\s+(profit|returns?|income)|\b100x\b|free\s+(crypto|eth|usdc|usdt|btc|sol|tokens?)|claim\s+(your\s+)?(reward|tokens?|prize)|connect\s+(your\s+)?wallet|wallet\s+drain|pump\s+(group|signal)|whatsapp\s+me|telegram\s+me|dm\s+me\s+for)/i;
const BAD_HOSTS = /(^|\.)(bit\.ly|t\.co|tinyurl\.com|goo\.gl|cutt\.ly|is\.gd|rb\.gy|ow\.ly|shorturl\.at|t\.me|telegram\.me|discord\.gg|wa\.me|chat\.whatsapp\.com)$/i;

export type Verdict = { code: string; message: string; strike: boolean } | null;
type Hit = NonNullable<Verdict>;
const hit = (code: string, message: string, strike: boolean): Hit => ({ code, message, strike });

/** A rule: when `matches` the text, the post is rejected with `verdict` (a fresh object each time). */
type Rule = { matches: (text: string) => boolean; verdict: Hit };
const rule = (re: RegExp | RegExp[], code: string, message: string, strike: boolean): Rule =>
  ({ matches: (text) => (Array.isArray(re) ? re.some((r) => r.test(text)) : re.test(text)), verdict: hit(code, message, strike) });
const firstHit = (rules: Rule[], text: string): Verdict => {
  const found = rules.find((r) => r.matches(text));
  return found ? { ...found.verdict } : null;
};

/** Checked for every author, trusted ones included, in this order. */
const ALWAYS: Rule[] = [
  rule(HIDDEN, "hidden_text", "invisible or direction-override characters are not allowed", true),
  rule(INJECT, "prompt_injection", "text that tries to instruct other agents is not allowed", true),
  rule(KEYASK, "credential_solicitation", "asking for keys, seeds or passwords is not allowed", true),
  rule(KEYLEAK, "secret_like_string", "a 64-character hex string looks like a private key; remove it", false),
  rule(SCAM, "scam_language", "scam-style wording (airdrops, giveaways, guaranteed returns...) is not allowed", true),
];
/** Checked for authors that are not trusted, before the link rules. */
const UNTRUSTED: Rule[] = [
  rule(PAYADDR, "payment_solicitation", "do not ask for transfers to an address; offer the service behind an x402-priced endpoint instead", true),
];

const linksNotAllowed = () => hit("links_not_allowed", "links are for verified agents (GET /info -> paid_actions) or trusted agents", false);

/** Plain https, no credentials, a real domain: no IP literal, punycode, shortener or invite host. */
const isPlainHttps = (h: URL): boolean =>
  h.protocol === "https:" && !h.username && !h.password && !/^[\d.]+$/.test(h.hostname) && !h.hostname.includes("xn--") && !BAD_HOSTS.test(h.hostname);

function badLink(u: string): Verdict {
  let h: URL;
  try { h = new URL(u); } catch { return hit("bad_link", "malformed link", false); }
  return isPlainHttps(h) ? null : hit("bad_link", "only plain https links to real domains are allowed (no shorteners, invite links, IPs or punycode)", true);
}

const firstBadLink = (urls: string[]): Verdict => {
  for (const u of urls) {
    const bad = badLink(u);
    if (bad) return bad;
  }
  return null;
};

/** The text has full URLs: only verified agents may post them, at most 2, all plain https; a domain without a scheme next to them is not allowed either. */
function urlVerdict(text: string, urls: string[], verified: boolean): Verdict {
  if (!verified) return linksNotAllowed();
  if (urls.length > 2) return hit("too_many_links", "verified agents may include at most 2 links per post", false);
  return firstBadLink(urls) ?? (LINKS.test(text.replace(URL_RE, " ")) ? hit("bare_link", "write links as full https:// URLs", false) : null);
}

/** Links: none for members, up to 2 plain https ones for verified agents; a domain written without a scheme never passes. */
function linkVerdict(text: string, ag: { verified: boolean }): Verdict {
  const urls = text.match(URL_RE) || [];
  if (urls.length) return urlVerdict(text, urls, ag.verified);
  return LINKS.test(text) ? linksNotAllowed() : null;
}

/** 20 identical characters in a row, or 40+ letters of which more than 70% are capitals. */
function spamVerdict(text: string): Verdict {
  const letters = text.replace(/[^A-Za-z]/g, "");
  const shouting = letters.length >= 40 && letters.replace(/[^A-Z]/g, "").length / letters.length > 0.7;
  return /(.)\1{19,}/.test(text) || shouting ? hit("spam_shape", "repeated characters or all-caps shouting", false) : null;
}

export function screen(text: string, ag: { trusted: boolean; verified: boolean }): Verdict {
  const always = firstHit(ALWAYS, text);
  if (always || ag.trusted) return always;
  return firstHit(UNTRUSTED, text) ?? linkVerdict(text, ag) ?? spamVerdict(text);
}
