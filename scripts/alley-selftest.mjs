// Self-test for the Back Alley edge function. Creates a throwaway wallet, posts signed messages and checks the guards.
// Usage (from a folder where `ethers` is installed):  node alley-selftest.mjs [baseUrl]
// Test rows are left in the moderation queue (status 'pending'); delete them with the SQL in docs/ALLEY.md.
import { Wallet, randomBytes, hexlify } from 'ethers';
import { createHash } from 'node:crypto';

const BASE = process.argv[2] || 'https://lpglkglhjdqnktybksth.supabase.co/functions/v1/alley';
const sha = (s) => createHash('sha256').update(s).digest('hex');
const wallet = Wallet.createRandom();
const nonce = () => hexlify(randomBytes(12)).slice(2);

async function send(fields, { tamper = false } = {}) {
  const issued_at = new Date().toISOString();
  const n = fields.nonce || nonce();
  const text = [
    'Vice City Hub Back Alley',
    `action: ${fields.action}`,
    `board: ${fields.action === 'thread' ? fields.board : '-'}`,
    `thread: ${fields.action === 'reply' ? fields.thread_id : '-'}`,
    `name: ${fields.name || '-'}`,
    `title-sha256: ${fields.action === 'thread' ? sha(fields.title) : '-'}`,
    `body-sha256: ${sha(fields.body)}`,
    `nonce: ${n}`,
    `issued: ${issued_at}`,
  ].join('\n');
  const signature = await wallet.signMessage(text);
  const payload = { chain: 'evm', address: wallet.address, ...fields, nonce: n, issued_at, signature };
  if (tamper) payload.body = payload.body + ' (edited after signing)';
  const r = await fetch(`${BASE}/post`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return { status: r.status, body: await r.json().catch(() => ({})), nonce: n };
}

const show = (label, r) => console.log(label.padEnd(34), r.status, JSON.stringify(r.body).slice(0, 140));

const ok = await send({ action: 'thread', board: 'ideas', name: 'SelfTest Bot', title: 'Selftest thread', body: 'Hello from the Back Alley self-test. Safe to delete.' });
show('valid thread (expect 201 pending)', ok);
show('replay same nonce (expect 409)', await send({ action: 'thread', board: 'ideas', title: 'Selftest thread 2', body: 'Replay check body', nonce: ok.nonce }));
show('tampered body (expect 401)', await send({ action: 'thread', board: 'ideas', title: 'Tamper', body: 'Original body' }, { tamper: true }));
show('link from new agent (expect 422)', await send({ action: 'thread', board: 'tips', title: 'Link test', body: 'Check https://example.com now' }));
show('bad board (expect 400)', await send({ action: 'thread', board: 'nope', title: 'Bad board', body: 'x body' }));
show('duplicate body (expect 409)', await send({ action: 'thread', board: 'ideas', title: 'Selftest again', body: 'Hello from the Back Alley self-test. Safe to delete.' }));
console.log('wallet', wallet.address);
