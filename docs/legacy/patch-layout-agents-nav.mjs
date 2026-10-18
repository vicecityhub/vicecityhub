/** v12: add the "Agents" entry to Layout.tsx navigation (desktop, mobile, footer, sitemap modal). Idempotent. */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const file = join(dirname(fileURLToPath(import.meta.url)), '../src/components/Layout.tsx');
const raw = readFileSync(file, 'utf8');
const crlf = raw.includes('\r\n');
let t = raw.replace(/\r\n/g, '\n');
if (t.includes("./agents.html")) { console.log('Layout.tsx already has the Agents nav'); process.exit(0); }

const must = (cond, msg) => { if (!cond) { console.error('ANCHOR NOT FOUND: ' + msg); process.exit(1); } };
const rep = (from, to, msg) => { must(t.includes(from), msg); t = t.replace(from, to); };

rep("'profile' | 'rp';", "'profile' | 'rp' | 'agents';", 'activePage type');
rep("'text-gray-500'}`}>Leonida Database</a>\n          <a href=\"./rp.html\"",
  "'text-gray-500'}`}>Leonida Database</a>\n          <a href=\"./agents.html\" className={`hover:text-neonCyan transition-all ${activePage === 'agents' ? 'text-neonCyan neon-text-cyan' : 'text-gray-500'}`}>Agents</a>\n          <a href=\"./rp.html\"", 'desktop nav');
rep("'text-gray-300'}`}>Leonida Database</a>\n            <a href=\"./rp.html\"",
  "'text-gray-300'}`}>Leonida Database</a>\n            <a href=\"./agents.html\" onClick={() => setMobileMenuOpen(false)} className={`hover:text-neonCyan transition-all ${activePage === 'agents' ? 'text-neonCyan neon-text-cyan' : 'text-gray-300'}`}>Agents</a>\n            <a href=\"./rp.html\"", 'mobile nav');
rep('font-bold">📁 Leonida DB</a>',
  'font-bold">📁 Leonida DB</a>\n            <a href="./agents.html" className="text-[10px] text-gray-600 hover:text-neonCyan transition-colors uppercase tracking-wider font-bold">🤖 Agents</a>', 'footer');
rep('              <a href="./community.html" className="glass-card p-6 text-center hover:border-neonCyan flex flex-col items-center gap-3">',
  '              <a href="./agents.html" className="glass-card p-6 text-center hover:border-neonCyan flex flex-col items-center gap-3">\n                <span className="text-3xl">🤖</span>\n                <span className="text-xs uppercase font-orbitron tracking-widest text-gray-300">Agent Gateway</span>\n              </a>\n              <a href="./community.html" className="glass-card p-6 text-center hover:border-neonCyan flex flex-col items-center gap-3">', 'sitemap modal');

writeFileSync(file, crlf ? t.replace(/\n/g, '\r\n') : t, 'utf8');
console.log('Layout.tsx: Agents nav added (desktop, mobile, footer, sitemap modal)');
