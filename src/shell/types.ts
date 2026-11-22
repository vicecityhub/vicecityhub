import type { Radio } from './radio.ts';

/** Starts a page (mounts the React root, binds a static page...). May return the cleanup that runs when the page is left. */
export type PageStart = () => void | (() => void);

/** The API of the persistent shell: `window.vchShell`, created once per browser document by public/vch-shell.js. */
export interface VchShell {
  /** Content hash of the shell build (for diagnostics). */
  version: string;
  /** Leonida FM: one <audio> for the whole document, alive across page swaps. */
  radio: Radio;
  /** The page the visitor came from: the previous page for a soft navigation, document.referrer for the first one. */
  referrer: string;
  /** Go to a page of the site without reloading the document; anything else (or any failure) is a normal navigation. */
  navigate(url: string, opts?: { replace?: boolean }): void;
  /** Re-render the current page in place (what location.reload() would do, minus the reload that stops the music). */
  refresh(): void;
  /**
   * A page entry registers how it starts. `entry` is the entry module's own URL (import.meta.url). For the page the
   * document was loaded with the shell runs `start` at once; for any other page it only remembers `start` (the entry is
   * evaluated ahead of the swap) and runs it when the visitor gets there, and again on every later visit.
   */
  definePage(start: PageStart, entry?: string): void;
  /** Run `cb` when the current page is left (a static page removes its timers and subscriptions here). */
  onLeave(cb: () => void): void;
}

declare global {
  interface Window {
    vchShell?: VchShell;
  }
}
