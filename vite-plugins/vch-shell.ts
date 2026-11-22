/**
 * Vice City Hub — Vite plugin "vch-shell"
 *
 * Adds the persistent shell script (public/vch-shell.js, built by scripts/build-shell.mjs) to every React page. The
 * shell owns the Leonida FM <audio> element and the soft navigation between pages, so the music keeps playing across
 * sections. The tag goes to the END of <body> so that the whole <head> exists when the shell takes stock of it, and it
 * runs before the (deferred) page module. reset-password.html is left alone: there is nothing to keep alive there.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';

export default function vchShell(): Plugin {
  const file = join(process.cwd(), 'public', 'vch-shell.js');
  let base = '/';
  return {
    name: 'vch-shell',
    configResolved(config) { base = config.base; },
    // default order: runs AFTER Vite has processed the page's own assets, so this tag is never rewritten or hashed
    transformIndexHtml(_html, ctx) {
      if (/reset-password\.html$/.test(ctx.path)) return undefined;
      let hash: string;
      try {
        hash = createHash('sha1').update(readFileSync(file)).digest('hex').slice(0, 10); // same recipe as scripts/lib/shell-ref.mjs
      } catch {
        throw new Error('[vch-shell] public/vch-shell.js is missing: run `node scripts/build-shell.mjs` first');
      }
      return [{
        tag: 'script',
        attrs: { src: `${base}vch-shell.js?v=${hash}`, ...(ctx.server ? { 'data-vch-dev': '' } : {}) },
        injectTo: 'body',
      }];
    },
  };
}
