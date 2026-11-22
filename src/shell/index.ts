// The persistent shell. public/vch-shell.js is built from this file by scripts/build-shell.mjs and loaded by EVERY page
// of the site (React pages through the vite plugin, generated static pages through scripts/lib/seo.mjs).
//
// It owns what has to outlive a page change:
//   * Leonida FM: the one <audio> element of the document (src/shell/radio.ts);
//   * the soft-navigation controller: link clicks and back/forward swap the page in place instead of loading a new
//     document (src/shell/softNav.ts), so the music never stops and never needs another touch on a phone.
// Anything that goes wrong falls back to ordinary page loads: this file must never be able to break a page.
import { MUZ_ANON_KEY, MUZ_LIST_URL } from './playlist.ts';
import { createRadio } from './radio.ts';
import type { StorageLike } from './radio.ts';
import { createSoftNav } from './softNav.ts';

function memoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return { getItem: k => (map.has(k) ? (map.get(k) as string) : null), setItem: (k, v) => { map.set(k, v); } };
}

/** localStorage / sessionStorage throw when the browser blocks storage (private mode, strict settings): remember in memory then. */
function storage(kind: 'localStorage' | 'sessionStorage'): StorageLike {
  try {
    const s = window[kind];
    s.getItem('vch_probe');
    return s;
  } catch {
    return memoryStorage();
  }
}

/** The JSON listing of the public `muz` bucket (needs the muz_public_read policy: supabase/16_muz_public_read.sql). */
function listMuz(): Promise<unknown> {
  return fetch(MUZ_LIST_URL, {
    method: 'POST',
    headers: { apikey: MUZ_ANON_KEY, Authorization: 'Bearer ' + MUZ_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix: '', limit: 100, offset: 0 }),
  }).then(res => {
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  });
}

function boot() {
  if (window.vchShell) return; // a page that includes the script twice must not get a second radio

  const script = document.currentScript instanceof HTMLScriptElement
    ? document.currentScript
    : document.querySelector<HTMLScriptElement>('script[src*="vch-shell.js"]');
  const src = (script && script.src) || location.href;
  const base = new URL('.', src).pathname; // '/vicecityhub/': where the script lives is where the site lives
  let version = 'dev';
  try { version = new URL(src).searchParams.get('v') || 'dev'; } catch { /* keep dev */ }

  const radio = createRadio({
    audio: new Audio(),
    local: storage('localStorage'),
    session: storage('sessionStorage'),
    doc: document,
    win: window,
    listing: listMuz,
    warn: message => console.warn(message),
    isToggle: target => target instanceof Element && !!target.closest('[data-vch-radio]'),
  });

  const soft = createSoftNav(base, { disabled: !!script && script.hasAttribute('data-vch-dev') });

  window.vchShell = {
    version,
    radio,
    get referrer() { return soft.referrer; },
    navigate: soft.navigate,
    refresh: soft.refresh,
    definePage: soft.definePage,
    onLeave: soft.onLeave,
  };
}

try {
  boot();
} catch (err) {
  console.warn('[vch-shell] failed to start, the site works without it', err);
}
