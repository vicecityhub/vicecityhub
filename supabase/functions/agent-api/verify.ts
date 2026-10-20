// Vice City Hub — Agent API · on-chain stablecoin verification (fail-safe by design)
//
// Rules:
//  * A payment is accepted automatically ONLY if every check passes: tx succeeded, is final enough,
//    is newer than the order, pays OUR wallet in an allow-listed stablecoin, and the amount equals the
//    order's exact tagged amount (total + a unique 0.0001-0.0099 "dust tag"). The tag makes a tx
//    unclaimable by anyone who did not receive the order's payment instructions.
//  * Anything else is never auto-accepted. Errors never mark an order paid.
//  * Domain / slot DELIVERY is still performed by the operator: no private key ever lives in this function.
import { CRYPTO_WALLETS } from "./lib.ts";

export type Verdict =
  | { state: "confirmed"; network: string; paid_units: string; block_time: string }
  | { state: "pending"; network: string; detail: string }
  | { state: "not_found"; detail: string }
  | { state: "mismatch"; detail: string }
  | { state: "error"; detail: string };

const TRANSFER_SIG = "ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export const EVM_NETWORKS: Record<string, { rpc: string; confirmations: number; blockSec?: number; cap?: number; step?: number; tokens: Record<string, string> }> = {
  polygon: {
    rpc: Deno.env.get("EVM_RPC_POLYGON") || "https://polygon-bor-rpc.publicnode.com",
    confirmations: 128,
    tokens: {
      "0xc2132d05d31c914a87c6611c10748aeb04b58e8a": "USDT",
      "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359": "USDC",
      "0x2791bca1f2de4661ed88a30c99a7a9449aa84174": "USDC.e",
    },
  },
  ethereum: {
    rpc: Deno.env.get("EVM_RPC_ETHEREUM") || "https://ethereum-rpc.publicnode.com",
    confirmations: 12,
    tokens: {
      "0xdac17f958d2ee523a2206206994597c13d831ec7": "USDT",
      "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": "USDC",
    },
  },
  // L2s where most agent payments (x402 etc.) settle. All listed tokens use 6 decimals.
  base: {
    rpc: Deno.env.get("EVM_RPC_BASE") || "https://base-rpc.publicnode.com",
    confirmations: 20, blockSec: 2.05, cap: 6000,
    tokens: { "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": "USDC" },
  },
  arbitrum: {
    rpc: Deno.env.get("EVM_RPC_ARBITRUM") || "https://arb1.arbitrum.io/rpc",
    confirmations: 60, blockSec: 0.26, cap: 30000, step: 10000,
    tokens: {
      "0xaf88d065e77c8cc2239327c5edb3a432268e5831": "USDC",
      "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9": "USDT",
    },
  },
  optimism: {
    rpc: Deno.env.get("EVM_RPC_OPTIMISM") || "https://optimism-rpc.publicnode.com",
    confirmations: 20, blockSec: 2.05, cap: 6000,
    tokens: {
      "0x0b2c639c533813f4aa9d7837caf62653d097ff85": "USDC",
      "0x94b008aa00579c1307b0ef2c499ad98a8ce58e58": "USDT",
    },
  },
};

const TRON_API = Deno.env.get("TRON_API") || "https://api.trongrid.io";
const TRON_USDT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const SOL_RPC = Deno.env.get("SOLANA_RPC") || "https://api.mainnet-beta.solana.com";
const SOL_USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const TIMEOUT = 8000;

// ───────────── helpers ─────────────
export const fmtUnits = (u: bigint) => `${u / 1_000_000n}.${(u % 1_000_000n).toString().padStart(6, "0")}`;
/** exact amount due in 6-decimal stablecoin units: total + tag micro-dollars (tag 1..9999) */
export const dueUnits = (totalUsd: number, tag: number) => BigInt(Math.round(totalUsd * 100)) * 10_000n + BigInt(tag);

const wallet = (chain: string): string => (CRYPTO_WALLETS.find((w: any) => w.chain === chain)?.address as string) || "";

async function jrpc(url: string, method: string, params: unknown[]) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!r.ok) throw new Error(`rpc http ${r.status}`);
  const j = await r.json();
  if (j.error) throw new Error(String(j.error.message || "rpc error"));
  return j.result;
}

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function b58decode(s: string): Uint8Array {
  let n = 0n;
  for (const c of s) {
    const i = B58.indexOf(c);
    if (i < 0) throw new Error("bad base58");
    n = n * 58n + BigInt(i);
  }
  const bytes: number[] = [];
  while (n > 0n) { bytes.unshift(Number(n & 0xffn)); n >>= 8n; }
  for (const c of s) { if (c === "1") bytes.unshift(0); else break; }
  return Uint8Array.from(bytes);
}
/** TRON base58check address → 20-byte lowercase hex (no 0x41 prefix) */
function tronHex20(addr: string): string {
  const b = b58decode(addr);
  if (b.length !== 25 || b[0] !== 0x41) throw new Error("bad tron address");
  return [...b.slice(1, 21)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

// ───────────── EVM (Polygon / Ethereum) ─────────────
async function verifyEvm(tx: string, due: bigint, createdAtMs: number, network?: string): Promise<Verdict> {
  const to = wallet("evm").toLowerCase();
  if (!to) return { state: "error", detail: "EVM wallet is not configured" };
  const names = network ? [network] : Object.keys(EVM_NETWORKS);
  for (const name of names) {
    const n = EVM_NETWORKS[name];
    if (!n) return { state: "mismatch", detail: `unknown EVM network '${name}' (use ${Object.keys(EVM_NETWORKS).join(" | ")})` };
    const receipt = await jrpc(n.rpc, "eth_getTransactionReceipt", [tx]);
    if (!receipt) continue;
    if (receipt.status !== "0x1") return { state: "mismatch", detail: "transaction reverted" };
    const [latestHex, block] = await Promise.all([
      jrpc(n.rpc, "eth_blockNumber", []),
      jrpc(n.rpc, "eth_getBlockByNumber", [receipt.blockNumber, false]),
    ]);
    const ts = parseInt(block.timestamp, 16) * 1000;
    if (ts < createdAtMs - 60_000) return { state: "mismatch", detail: "transaction predates this order" };
    let got = 0n;
    for (const l of receipt.logs || []) {
      if (l.removed) continue;
      if (!n.tokens[String(l.address).toLowerCase()]) continue;
      const t = l.topics || [];
      if (t.length < 3 || String(t[0]).replace(/^0x/, "").toLowerCase() !== TRANSFER_SIG) continue;
      if (("0x" + String(t[2]).slice(26)).toLowerCase() !== to) continue;
      got += BigInt(l.data);
    }
    if (got === 0n) return { state: "mismatch", detail: `no USDT/USDC transfer to our ${name} wallet in this transaction` };
    if (got !== due) return { state: "mismatch", detail: `received ${fmtUnits(got)} but the exact amount due is ${fmtUnits(due)}` };
    const conf = Number(BigInt(latestHex) - BigInt(receipt.blockNumber)) + 1;
    if (conf < n.confirmations) return { state: "pending", network: name, detail: `${conf}/${n.confirmations} confirmations` };
    return { state: "confirmed", network: name, paid_units: got.toString(), block_time: new Date(ts).toISOString() };
  }
  return { state: "not_found", detail: "transaction not found on " + names.join(" or ") };
}

// ───────────── TRON (USDT TRC-20) ─────────────
async function verifyTron(tx: string, due: bigint, createdAtMs: number): Promise<Verdict> {
  const ours = wallet("tron");
  if (!ours) return { state: "error", detail: "TRON wallet is not configured" };
  const oursHex = tronHex20(ours);
  const usdtHex = tronHex20(TRON_USDT);
  const key = Deno.env.get("TRONGRID_API_KEY");
  const call = async (path: string) => {
    const r = await fetch(TRON_API + path, {
      method: "POST",
      headers: { "content-type": "application/json", ...(key ? { "TRON-PRO-API-KEY": key } : {}) },
      body: JSON.stringify({ value: tx }),
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!r.ok) throw new Error(`tron http ${r.status}`);
    return await r.json();
  };
  const info = await call("/walletsolidity/gettransactioninfobyid"); // solidified (final) only
  if (!info || !info.id) {
    const seen = await call("/wallet/gettransactioninfobyid");
    return seen && seen.id ? { state: "pending", network: "tron", detail: "not solidified yet" } : { state: "not_found", detail: "transaction not found on TRON" };
  }
  if (info.receipt?.result !== "SUCCESS") return { state: "mismatch", detail: `transaction result: ${info.receipt?.result || "unknown"}` };
  const ts = Number(info.blockTimeStamp || 0);
  if (ts < createdAtMs - 60_000) return { state: "mismatch", detail: "transaction predates this order" };
  let got = 0n;
  for (const l of info.log || []) {
    if (String(l.address).toLowerCase() !== usdtHex) continue;
    const t = l.topics || [];
    if (t.length < 3 || String(t[0]).toLowerCase() !== TRANSFER_SIG) continue;
    if (String(t[2]).slice(24).toLowerCase() !== oursHex) continue;
    got += BigInt("0x" + (l.data || "0"));
  }
  if (got === 0n) return { state: "mismatch", detail: "no USDT (TRC-20) transfer to our TRON wallet in this transaction" };
  if (got !== due) return { state: "mismatch", detail: `received ${fmtUnits(got)} but the exact amount due is ${fmtUnits(due)}` };
  return { state: "confirmed", network: "tron", paid_units: got.toString(), block_time: new Date(ts).toISOString() };
}

// ───────────── Solana (USDC) ─────────────
async function verifySolana(sig: string, due: bigint, createdAtMs: number): Promise<Verdict> {
  const ours = wallet("solana");
  if (!ours) return { state: "error", detail: "Solana wallet is not configured" };
  const get = (commitment: string) => jrpc(SOL_RPC, "getTransaction", [sig, { encoding: "jsonParsed", commitment, maxSupportedTransactionVersion: 0 }]);
  const t = await get("finalized");
  if (!t) {
    const seen = await get("confirmed");
    return seen ? { state: "pending", network: "solana", detail: "confirmed, not finalized yet" } : { state: "not_found", detail: "transaction not found on Solana" };
  }
  if (t.meta?.err) return { state: "mismatch", detail: "transaction failed on-chain" };
  const ts = Number(t.blockTime || 0) * 1000;
  if (ts < createdAtMs - 60_000) return { state: "mismatch", detail: "transaction predates this order" };
  const sum = (arr: any[]): bigint => (arr || []).filter((b) => b.owner === ours && b.mint === SOL_USDC).reduce((s: bigint, b: any) => s + BigInt(b.uiTokenAmount?.amount || "0"), 0n);
  const delta = sum(t.meta?.postTokenBalances) - sum(t.meta?.preTokenBalances);
  if (delta <= 0n) return { state: "mismatch", detail: "no USDC received by our Solana wallet in this transaction" };
  if (delta !== due) return { state: "mismatch", detail: `received ${fmtUnits(delta)} but the exact amount due is ${fmtUnits(due)}` };
  return { state: "confirmed", network: "solana", paid_units: delta.toString(), block_time: new Date(ts).toISOString() };
}

// ───────────── Incoming-transfer scanner (automatic settlement) ─────────────
// The scanner only DISCOVERS candidate transactions (amount -> tx hash). It never decides that an order is paid:
// every candidate goes through verifyCrypto() with the full rule set above before anything is marked paid.
export interface Incoming { chain: "tron" | "evm" | "solana"; network: string; tx: string; units: bigint }

const hex = (n: number) => "0x" + n.toString(16);

async function scanTron(sinceMs: number): Promise<Incoming[]> {
  const ours = wallet("tron");
  if (!ours) return [];
  const key = Deno.env.get("TRONGRID_API_KEY");
  const q = `only_to=true&only_confirmed=true&limit=100&order_by=block_timestamp,desc&min_timestamp=${Math.max(0, sinceMs - 60_000)}&contract_address=${TRON_USDT}`;
  const r = await fetch(`${TRON_API}/v1/accounts/${ours}/transactions/trc20?${q}`, { headers: key ? { "TRON-PRO-API-KEY": key } : {}, signal: AbortSignal.timeout(TIMEOUT) });
  if (!r.ok) throw new Error(`tron http ${r.status}`);
  const j = await r.json();
  return (j.data || [])
    .filter((t: any) => t.to === ours && t.token_info?.address === TRON_USDT && /^\d+$/.test(String(t.value)))
    .map((t: any) => ({ chain: "tron" as const, network: "tron", tx: String(t.transaction_id), units: BigInt(t.value) }));
}

async function scanEvm(sinceMs: number, errors: string[]): Promise<Incoming[]> {
  const to = wallet("evm").toLowerCase();
  if (!to) return [];
  const topicTo = "0x" + to.replace(/^0x/, "").padStart(64, "0");
  const out: Incoming[] = [];
  for (const [name, n] of Object.entries(EVM_NETWORKS)) {
    try {
      const latest = parseInt(await jrpc(n.rpc, "eth_blockNumber", []), 16);
      const blockSec = n.blockSec ?? (name === "polygon" ? 2.1 : 12.1);
      const cap = n.cap ?? (name === "polygon" ? 8000 : 1500);
      const back = Math.min(cap, Math.ceil((Date.now() - sinceMs) / 1000 / blockSec) + 60);
      const step = n.step ?? 1000;
      for (let a = Math.max(0, latest - back); a <= latest; a += step) {
        const logs = await jrpc(n.rpc, "eth_getLogs", [{ fromBlock: hex(a), toBlock: hex(Math.min(latest, a + step - 1)), address: Object.keys(n.tokens), topics: ["0x" + TRANSFER_SIG, null, topicTo] }]);
        for (const l of logs || []) if (!l.removed) out.push({ chain: "evm", network: name, tx: String(l.transactionHash), units: BigInt(l.data) });
      }
    } catch (e) { errors.push(`${name}: ${(e as Error).message}`); }
  }
  return out;
}

async function scanSolana(sinceMs: number): Promise<Incoming[]> {
  const ours = wallet("solana");
  if (!ours) return [];
  const ta = await jrpc(SOL_RPC, "getTokenAccountsByOwner", [ours, { mint: SOL_USDC }, { encoding: "jsonParsed" }]);
  const accts: string[] = (ta?.value || []).map((v: any) => v.pubkey).slice(0, 3);
  const out: Incoming[] = [];
  let fetched = 0;
  for (const acct of accts) {
    const sigs = await jrpc(SOL_RPC, "getSignaturesForAddress", [acct, { limit: 25, commitment: "finalized" }]);
    for (const s of sigs || []) {
      if (s.err || (s.blockTime && s.blockTime * 1000 < sinceMs - 60_000)) continue;
      if (fetched++ >= 10) return out; // keep public-RPC usage small
      const t = await jrpc(SOL_RPC, "getTransaction", [s.signature, { encoding: "jsonParsed", commitment: "finalized", maxSupportedTransactionVersion: 0 }]);
      if (!t || t.meta?.err) continue;
      const sum = (arr: any[]): bigint => (arr || []).filter((b) => b.owner === ours && b.mint === SOL_USDC).reduce((x: bigint, b: any) => x + BigInt(b.uiTokenAmount?.amount || "0"), 0n);
      const delta = sum(t.meta?.postTokenBalances) - sum(t.meta?.preTokenBalances);
      if (delta > 0n) out.push({ chain: "solana", network: "solana", tx: String(s.signature), units: delta });
    }
  }
  return out;
}

/** Candidate incoming stablecoin transfers to our wallets since `sinceMs`. A failing chain is reported in `errors`, never fatal. */
export async function scanIncoming(sinceMs: number): Promise<{ items: Incoming[]; errors: string[] }> {
  const errors: string[] = [];
  const items: Incoming[] = [];
  const run = async (name: string, f: () => Promise<Incoming[]>) => { try { items.push(...(await f())); } catch (e) { errors.push(`${name}: ${String((e as Error).message || e).slice(0, 160)}`); } };
  await Promise.all([run("tron", () => scanTron(sinceMs)), run("evm", () => scanEvm(sinceMs, errors)), run("solana", () => scanSolana(sinceMs))]);
  return { items, errors };
}

export async function verifyCrypto(a: { chain: string; tx: string; network?: string; due: bigint; createdAtMs: number }): Promise<Verdict> {
  try {
    if (a.chain === "evm") return await verifyEvm(a.tx, a.due, a.createdAtMs, a.network);
    if (a.chain === "tron") return await verifyTron(a.tx, a.due, a.createdAtMs);
    if (a.chain === "solana") return await verifySolana(a.tx, a.due, a.createdAtMs);
    return { state: "mismatch", detail: "unsupported chain" };
  } catch (e) {
    return { state: "error", detail: String((e as Error).message || e).slice(0, 200) };
  }
}
