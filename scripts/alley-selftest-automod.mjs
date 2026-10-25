// Self-test for Back Alley automatic moderation. Creates a throwaway wallet and walks it through screening, strikes and the mute.
// Usage (from a folder where `ethers` is installed):  node alley-selftest-automod.mjs [baseUrl]
// Leaves rows behind; remove them with the SQL in docs/ALLEY.md ("Clean up test wallets").
import { Wallet, randomBytes, hexlify } from 'ethers';
import { createHash } from 'node:crypto';

const BASE = process.argv[2] || 'https://lpglkglhjdqnktybksth.supabase.co/functions/v1/alley';
const sha = (s) => createHash('sha256').update(s).digest('hex');
const wallet = Wallet.createRandom();
const nonce = () => hexlify(randomBytes(12)).slice(2);

async function post(fields) {
  const issued_at = new Date().toISOString();
  const n = nonce();
  const text = [
    'Vice City Hub Back Alley', `action: ${fields.action}`,
    `board: ${fields.action === 'thread' ? fields.board : '-'}`, `thread: ${fields.action === 'reply' ? fields.thread_id : '-'}`,
    `name: ${fields.name || '-'}`, `title-sha256: ${fields.action === 'thread' ? sha(fields.title) : '-'}`,
    `body-sha256: ${sha(fields.body)}`, `nonce: ${n}`, `issued: ${issued_at}`,
  ].join('\n');
  const signature = await wallet.signMessage(text);
  const r = await fetch(`${BASE}/post`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chain: 'evm', address: wallet.address, ...fields, nonce: n, issued_at, signature }) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
let failed = 0;
const expect = (label, r, status, mustContain) => {
  const s = JSON.stringify(r.body);
  const pass = r.status === status && (!mustContain || s.includes(mustContain));
  if (!pass) failed++;
  console.log(pass ? 'PASS' : 'FAIL', label.padEnd(36), r.status, s.slice(0, 150));
};
const T = (body, extra = {}) => post({ action: 'thread', board: 'ideas', title: 'Automod probe', body, ...extra });

expect('clean first post queued', await T('A perfectly ordinary idea about map tiles.', { name: 'AutoModBot' }), 201, '"pending"');
expect('hidden characters rejected', await T('hello​world ordinary words here'), 422, 'hidden_text');   // strike 1
expect('plain link rejected, no strike', await T('see https://example.com for details'), 422, 'links_not_allowed');
expect('seed request rejected', await T('Please send me your seed phrase to verify'), 422, 'credential_solicitation'); // strike 2 within 24h -> muted
expect('muted wallet blocked', await T('another harmless idea about vehicles'), 403, 'muted');
console.log('wallet', wallet.address);
if (failed) { console.log(`${failed} check(s) failed`); process.exit(1); }
