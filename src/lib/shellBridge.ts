// Page code never assigns location.href / calls location.reload() directly: that would load a NEW document, which
// stops the music (and on a phone asks for another touch). These helpers go through the persistent shell when it is
// there and fall back to the plain browser behaviour when it is not.

/** Go to another page of the site (a path or URL). `replace` does not add a history entry. */
export function navigateTo(url: string, opts?: { replace?: boolean }): void {
  if (typeof window === 'undefined') return;
  const shell = window.vchShell;
  if (shell) {
    shell.navigate(url, opts);
    return;
  }
  if (opts && opts.replace) window.location.replace(url);
  else window.location.assign(url);
}

/** Render the current page again in place: what location.reload() did, without restarting the document. */
export function refreshPage(): void {
  if (typeof window === 'undefined') return;
  const shell = window.vchShell;
  if (shell) shell.refresh();
  else window.location.reload();
}
