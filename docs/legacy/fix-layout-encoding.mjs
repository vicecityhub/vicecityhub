/**
 * One-off v12 repair: src/components/Layout.tsx contained double-encoded UTF-8 (mojibake) that showed up
 * in the live footer / modals ("â€”", "ðŸŽ¬ Home", "â€¢â€¢â€¢" ...). Safe to re-run: it is a no-op on a clean file.
 *   node scripts/fix-layout-encoding.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const file = join(dirname(fileURLToPath(import.meta.url)), '../src/components/Layout.tsx');
let t = readFileSync(file, 'utf8');
const before = t;

// how a UTF-8 string looks after being mis-decoded as Windows-1252
const mj = (s) => new TextDecoder('windows-1252').decode(Buffer.from(s, 'utf8'));
const strip = (s) => s.replace(/[\u0080-\u009f]+$/, ''); // bytes that cp1252 cannot represent were dropped/kept as C1 controls

t = t.replace(/^﻿+/, '');

// 1) lossless tokens
for (const ch of ['—', '•', '★', '✓', '✦']) t = t.split(mj(ch)).join(ch);
t = t.split(strip(mj('⚙️'))).join('⚙️');

// 2) middle dot became "Â-" / "Â·"
t = t.replace(/Â[-·]/g, '·');

// 3) footer links: "<mojibake emoji> Label" -> "🎬 Label"
const footer = { 'Home': '🎬', 'The Wire': '📡', 'Community': '🏘️', 'Market': '💰', 'Dynasty 8': '🏢', 'Leonida DB': '📁' };
for (const [label, emoji] of Object.entries(footer)) {
  t = t.replace(new RegExp(`(uppercase tracking-wider font-bold">)[^A-Za-z<]*${label}</a>`), `$1${emoji} ${label}</a>`);
}
t = t.replace(/(uppercase tracking-wider font-bold">)[^A-Za-z<]*RP Hub[^<]*<\/a>/, '$1🎮 RP Hub ✦</a>');

// 4) direct-navigation tiles, in document order
const tiles = ['🎬', '📡', '💰', '🏢', '📁', '🏘️', '🎮', '⚙️'];
let k = 0;
t = t.replace(/<span className="text-3xl">([^<]*)<\/span>/g, (m, inner) => (/[^\x00-\x7F]/.test(inner) && k < tiles.length ? `<span className="text-3xl">${tiles[k++]}</span>` : m));

// 5) modal heading
t = t.replace(/[^\x00-\x7F]+\s*Set Your New Password/, '🔐 Set Your New Password');

// 6) garbled Cyrillic code comments → English
const comment = (re, text) => { t = t.replace(re, (m, indent) => `${indent}${text}`); };
comment(/^(\s*)\/\/ [^\n]*Supabase Storage bucket 'muz'/m, "// Loaded dynamically from the Supabase Storage bucket 'muz'");
comment(/^(\s*)\/\/ Fallback [^\n]*fetch[^\n]*/m, '// Falls back to 2 default tracks if the fetch fails');
comment(/^(\s*)\/\/ [^\n]*bucket,[^\n]*Ð[^\n]*/m, '// Load the full track list from the bucket, then pick a random one');
t = t.replace(/\{\/\* Header [^\n]*?\*\/\}/, '{/* Header — always visible, close button always reachable */}');

const left = (t.match(/[ÃÂðâÐÑ][\u0080-ÿŒœŠšŸŽžƒˆ˜–-›€]/g) || []).length;
if (t !== before) writeFileSync(file, t, 'utf8');
console.log(t === before ? 'Layout.tsx already clean' : 'Layout.tsx repaired', `· remaining suspicious sequences: ${left}`);
if (left) t.split(/\r?\n/).forEach((l, i) => { if (/[ÃÂðâÐÑ][\u0080-ÿŒœŠšŸŽžƒˆ˜–-›€]/.test(l)) console.log(`  ${i + 1}: ${l.trim().slice(0, 140)}`); });
