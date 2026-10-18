/**
 * VCH v12 — offline self-test for supabase/functions/agent-api/verify.ts
 * Transpiles the Deno module with the local TypeScript, mocks fetch (no network), and checks that
 * on-chain verification accepts only exact, final, fresh, correctly-addressed stablecoin payments.
 *   node scripts/selftest-verify.mjs
 */
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const here = dirname(fileURLToPath(import.meta.url));

const WALLETS = [
  { chain: 'tron', address: 'TRyGNvj1NcVM1V6aDJmycNBiSKWumZ4Zhz' },
  { chain: 'evm', address: '0x04b9d483E4dcc059CC2fb9375De5244C0A7ddce1' },
  { chain: 'solana', address: 'Gc75C9QnC59nTVW4f729VbWxcE6fsatGkZBQmQDJqB8b' },
];

let src = readFileSync(join(here, '../supabase/functions/agent-api/verify.ts'), 'utf8');
src = src.replace(/import \{ CRYPTO_WALLETS \} from "\.\/lib\.ts";/, `const CRYPTO_WALLETS = ${JSON.stringify(WALLETS)};`);
src = src.replace(/Deno\.env\.get\(/g, 'globalThis.__env(');
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const dir = mkdtempSync(join(tmpdir(), 'vch-verify-'));
const file = join(dir, 'verify.mjs');
writeFileSync(file, js);
globalThis.__env = () => undefined;
const V = await import(pathToFileURL(file).href);

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  → ' + extra}`); };

// ── helpers
check('fmtUnits', V.fmtUnits(100001234n) === '100.001234', V.fmtUnits(100001234n));
check('dueUnits', V.dueUnits(100, 1234) === 100001234n, String(V.dueUnits(100, 1234)));
check('dueUnits cents', V.dueUnits(19.99, 7) === 19990007n, String(V.dueUnits(19.99, 7)));

// ── mock fetch
const NOW = Date.now();
const mock = (handler) => { globalThis.fetch = async (url, init) => ({ ok: true, status: 200, json: async () => handler(String(url), init?.body ? JSON.parse(init.body) : null) }); };
const pad = (hex, n = 64) => hex.replace(/^0x/, '').padStart(n, '0');

// ── EVM
const OURS = '0x04b9d483E4dcc059CC2fb9375De5244C0A7ddce1'.toLowerCase();
const POLY_USDT = '0xc2132D05D31c914a87C6611C10748AEb04B58e8a';
const SIG = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const evmRpc = ({ amount, to = OURS, token = POLY_USDT, status = '0x1', blockAge = 200, tsMs = NOW, missing = false }) => (u, b) => {
  if (b.method === 'eth_getTransactionReceipt') return { result: missing ? null : { status, blockNumber: '0x64', logs: [{ address: token, topics: [SIG, '0x' + pad('0x1111'), '0x' + pad(to)], data: '0x' + amount.toString(16).padStart(64, '0') }] } };
  if (b.method === 'eth_blockNumber') return { result: '0x' + (100 + blockAge).toString(16) };
  if (b.method === 'eth_getBlockByNumber') return { result: { timestamp: '0x' + Math.floor(tsMs / 1000).toString(16) } };
  throw new Error('unexpected ' + b.method);
};
const due = V.dueUnits(100, 1234);
const evm = (rpc, extra = {}) => { mock(rpc); return V.verifyCrypto({ chain: 'evm', tx: '0x' + 'a'.repeat(64), network: 'polygon', due, createdAtMs: NOW - 5000, ...extra }); };

let r = await evm(evmRpc({ amount: due }));
check('evm exact+final → confirmed', r.state === 'confirmed' && r.paid_units === String(due), JSON.stringify(r));
r = await evm(evmRpc({ amount: due, blockAge: 3 }));
check('evm too few confirmations → pending', r.state === 'pending', JSON.stringify(r));
r = await evm(evmRpc({ amount: due + 1n }));
check('evm wrong amount (over) → mismatch', r.state === 'mismatch', JSON.stringify(r));
r = await evm(evmRpc({ amount: due - 1n }));
check('evm wrong amount (under) → mismatch', r.state === 'mismatch', JSON.stringify(r));
r = await evm(evmRpc({ amount: due, to: '0x' + '2'.repeat(40) }));
check('evm other recipient → mismatch', r.state === 'mismatch', JSON.stringify(r));
r = await evm(evmRpc({ amount: due, token: '0x' + '3'.repeat(40) }));
check('evm non-allowlisted token → mismatch', r.state === 'mismatch', JSON.stringify(r));
r = await evm(evmRpc({ amount: due, status: '0x0' }));
check('evm reverted → mismatch', r.state === 'mismatch', JSON.stringify(r));
r = await evm(evmRpc({ amount: due, tsMs: NOW - 3_600_000 }));
check('evm tx older than order → mismatch', r.state === 'mismatch' && /predates/.test(r.detail), JSON.stringify(r));
r = await evm(evmRpc({ amount: due, missing: true }));
check('evm unknown tx → not_found', r.state === 'not_found', JSON.stringify(r));
r = await evm(evmRpc({ amount: due }), { network: 'bsc' });
check('evm unknown network → mismatch', r.state === 'mismatch', JSON.stringify(r));
globalThis.fetch = async () => { throw new Error('boom'); };
r = await V.verifyCrypto({ chain: 'evm', tx: '0x' + 'a'.repeat(64), network: 'polygon', due, createdAtMs: NOW });
check('rpc failure → error (never paid)', r.state === 'error', JSON.stringify(r));

// ── TRON  (USDT contract 41a614f8…d13c is a well-known constant → validates base58 decoding)
const USDT_HEX = 'a614f803b6fd780986a42c78ec9c7f77e6ded13c';
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const dec = (s) => { let n = 0n; for (const c of s) n = n * 58n + BigInt(B58.indexOf(c)); return n.toString(16).padStart(50, '0'); };
const oursTronHex = dec('TRyGNvj1NcVM1V6aDJmycNBiSKWumZ4Zhz').slice(2, 42);
check('base58: USDT TRC-20 contract hex', dec('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t').slice(2, 42) === USDT_HEX, dec('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'));
const tronRpc = ({ amount, to = oursTronHex, contract = USDT_HEX, result = 'SUCCESS', tsMs = NOW, solid = true, seen = true }) => (u) => {
  const info = { id: 'x', receipt: { result }, blockTimeStamp: tsMs, log: [{ address: contract, topics: ['ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef', pad('1111'), pad(to)], data: amount.toString(16).padStart(64, '0') }] };
  if (u.includes('walletsolidity')) return solid ? info : {};
  return seen ? info : {};
};
const tron = (h) => { mock(h); return V.verifyCrypto({ chain: 'tron', tx: 'b'.repeat(64), due, createdAtMs: NOW - 5000 }); };
r = await tron(tronRpc({ amount: due }));
check('tron exact+solidified → confirmed', r.state === 'confirmed', JSON.stringify(r));
r = await tron(tronRpc({ amount: due, solid: false }));
check('tron not solidified → pending', r.state === 'pending', JSON.stringify(r));
r = await tron(tronRpc({ amount: due, solid: false, seen: false }));
check('tron unknown → not_found', r.state === 'not_found', JSON.stringify(r));
r = await tron(tronRpc({ amount: due + 5n }));
check('tron wrong amount → mismatch', r.state === 'mismatch', JSON.stringify(r));
r = await tron(tronRpc({ amount: due, to: '2'.repeat(40) }));
check('tron other recipient → mismatch', r.state === 'mismatch', JSON.stringify(r));
r = await tron(tronRpc({ amount: due, contract: '3'.repeat(40) }));
check('tron other token contract → mismatch', r.state === 'mismatch', JSON.stringify(r));
r = await tron(tronRpc({ amount: due, result: 'REVERT' }));
check('tron failed tx → mismatch', r.state === 'mismatch', JSON.stringify(r));
r = await tron(tronRpc({ amount: due, tsMs: NOW - 3_600_000 }));
check('tron old tx → mismatch', r.state === 'mismatch', JSON.stringify(r));

// ── Solana
const OURS_SOL = 'Gc75C9QnC59nTVW4f729VbWxcE6fsatGkZBQmQDJqB8b';
const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const solRpc = ({ pre = 0n, post, owner = OURS_SOL, mint = USDC, err = null, tsMs = NOW, finalized = true, confirmed = true }) => (u, b) => {
  const c = b.params[1].commitment;
  const tx = { blockTime: Math.floor(tsMs / 1000), meta: { err, preTokenBalances: [{ owner, mint, uiTokenAmount: { amount: String(pre) } }], postTokenBalances: [{ owner, mint, uiTokenAmount: { amount: String(post) } }] } };
  if (c === 'finalized') return { result: finalized ? tx : null };
  return { result: confirmed ? tx : null };
};
const sol = (h) => { mock(h); return V.verifyCrypto({ chain: 'solana', tx: '5'.repeat(88), due, createdAtMs: NOW - 5000 }); };
r = await sol(solRpc({ pre: 1_000_000n, post: 1_000_000n + due }));
check('solana exact delta+finalized → confirmed', r.state === 'confirmed', JSON.stringify(r));
r = await sol(solRpc({ post: due, finalized: false }));
check('solana not finalized → pending', r.state === 'pending', JSON.stringify(r));
r = await sol(solRpc({ post: due, finalized: false, confirmed: false }));
check('solana unknown → not_found', r.state === 'not_found', JSON.stringify(r));
r = await sol(solRpc({ post: due + 1n }));
check('solana wrong amount → mismatch', r.state === 'mismatch', JSON.stringify(r));
r = await sol(solRpc({ post: due, owner: 'SomeoneElse1111111111111111111111111111111' }));
check('solana other owner → mismatch', r.state === 'mismatch', JSON.stringify(r));
r = await sol(solRpc({ post: due, mint: 'OtherMint11111111111111111111111111111111111' }));
check('solana other mint → mismatch', r.state === 'mismatch', JSON.stringify(r));
r = await sol(solRpc({ post: due, err: { InstructionError: [0, 'x'] } }));
check('solana failed tx → mismatch', r.state === 'mismatch', JSON.stringify(r));
r = await sol(solRpc({ post: due, tsMs: NOW - 3_600_000 }));
check('solana old tx → mismatch', r.state === 'mismatch', JSON.stringify(r));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
