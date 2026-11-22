import { StrictMode } from 'react';
import type { ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

/**
 * Mount a page entry (every src/main-*.tsx ends with this call).
 *
 * With the persistent shell (public/vch-shell.js) the entry only REGISTERS how its page starts: the shell starts it now
 * and again every time the visitor comes back to this page without a document reload (soft navigation: the Leonida FM
 * <audio> lives in the shell and never stops). `entryUrl` is the entry module's own URL, i.e. `import.meta.url`.
 * Without the shell (the dev server, or the script was blocked) the page simply mounts, as it always did.
 */
export function mountPage(entryUrl: string, render: () => ReactNode): void {
  const start = () => {
    const container = document.getElementById('root');
    if (!container) throw new Error('mountPage: #root is missing');
    const root = createRoot(container);
    // Synchronous: a soft navigation swaps the markup and mounts the page in ONE task, so no empty frame is painted in between.
    flushSync(() => { root.render(<StrictMode>{render()}</StrictMode>); });
    return () => root.unmount();
  };
  const shell = window.vchShell;
  if (shell) shell.definePage(start, entryUrl);
  else start();
}
