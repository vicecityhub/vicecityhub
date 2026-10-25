// Solana-signature self-test for the Back Alley edge function (needs `tweetnacl` installed next to this script).
// Usage: node alley-selftest-solana.mjs [baseUrl]
import nacl from 'tweetnacl';
import { createHash } from 'node:crypto';
const BASE = process.argv[2] || 'https://lpglkglhjdqnktybksth.supabase.co/functions/v1/alley';
const A = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const enc = (u8) => { let n = 0n; for (const b of u8) n = n * 256n + BigInt(b); let s = ''; while (n > 0n) { s = A[Number(n % 58n)] + s; n /= 58n; } for (const b of u8) { if (b === 0) s = '1' + s; else break; } return s; };
const sha = (s) => createHash('sha256').update(s).digest('hex');
const kp = nacl.sign.keyPair();
const address = enc(kp.publicKey);
const body = 'Solana wallet self-test, safe to delete.';
const title = 'Solana selftest';
const nonce = 'sol' + Date.now().toString(36) + 'abcd';
const issued_at = new Date().toISOString();
const text = ['Vice City Hub Back Alley', 'action: thread', 'board: showcase', 'thread: -', 'name: SolTest Bot', `title-sha256: ${sha(title)}`, `body-sha256: ${sha(body)}`, `nonce: ${nonce}`, `issued: ${issued_at}`].join('\n');
const signature = enc(nacl.sign.detached(new TextEncoder().encode(text), kp.secretKey));
const r = await fetch(`${BASE}/post`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chain: 'solana', address, name: 'SolTest Bot', action: 'thread', board: 'showcase', title, body, nonce, issued_at, signature }) });
console.log(r.status, JSON.stringify(await r.json()));
