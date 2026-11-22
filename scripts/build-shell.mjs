#!/usr/bin/env node
/**
 * Builds the persistent shell (src/shell/index.ts) into public/vch-shell.js: ONE classic script without imports that every
 * page of the site loads. It owns the Leonida FM <audio> element and the soft navigation, so the music keeps playing
 * (and never needs another touch on a phone) while the visitor moves between sections.
 *
 * Runs first in `prebuild` / `predev`: the HTML plugin and the generated static pages reference the file by content hash.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { shellHash } from './lib/shell-ref.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'vch-shell.js');

// esbuild is not a direct dependency: it comes with Vite, which is a dev dependency (skipped when NODE_ENV=production).
let build;
try {
  ({ build } = await import('esbuild'));
} catch {
  throw new Error('[build-shell] esbuild is not installed (it comes with vite, a dev dependency). Run: npm install --include=dev');
}

const result = await build({
  entryPoints: [join(root, 'src', 'shell', 'index.ts')],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  minify: true,
  legalComments: 'none',
  write: false,
  logLevel: 'warning',
});

const code = result.outputFiles[0].text;
const before = existsSync(out) ? readFileSync(out, 'utf8') : null;
if (before !== code) {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, code);
}
console.log(`[build-shell] public/vch-shell.js  ${code.length} bytes  v=${shellHash(root)}  ${before === code ? '(unchanged)' : '(updated)'}`);
