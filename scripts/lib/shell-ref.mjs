// How pages reference the persistent shell (public/vch-shell.js, built from src/shell by scripts/build-shell.mjs).
// The ?v=<content hash> makes a changed shell reach every visitor immediately even though the file itself is not
// fingerprinted (GitHub Pages caches it for minutes): old pages keep the old URL, new pages get the new one.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const SHELL_BASE = '/vicecityhub/';

export function shellHash(root = process.cwd()) {
  let code;
  try {
    code = readFileSync(join(root, 'public', 'vch-shell.js'));
  } catch {
    throw new Error('public/vch-shell.js is missing: run `node scripts/build-shell.mjs` first');
  }
  return createHash('sha1').update(code).digest('hex').slice(0, 10);
}

/** The value of the src attribute every page uses. */
export function shellSrc(root = process.cwd()) {
  return `${SHELL_BASE}vch-shell.js?v=${shellHash(root)}`;
}

/** The complete <script> tag for generated static pages. */
export function shellTag(root = process.cwd()) {
  return `<script src="${shellSrc(root)}"></script>`;
}
