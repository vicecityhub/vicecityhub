// Cookie-free, anonymous page-view counter (see supabase/functions/hit). No cookies, no IPs, no cross-day ids.
// Skipped when the browser sends Do Not Track, and for the owner: open any page once with ?notrack to switch it off in that browser.
const ENDPOINT = 'https://lpglkglhjdqnktybksth.supabase.co/functions/v1/hit';

export function trackPageView(): void {
  try {
    if (navigator.doNotTrack === '1') return;
    if (/[?&]notrack/.test(location.search)) { localStorage.setItem('vch_ignore', '1'); return; }
    if (localStorage.getItem('vch_ignore') === '1') return;
    const q = new URLSearchParams(location.search);
    const s = q.get('utm_source') || q.get('ref') || '';
    // text/plain keeps this a "simple" request: no CORS preflight, and it can never block rendering
    fetch(ENDPOINT, {
      method: 'POST',
      body: JSON.stringify({ p: location.pathname, r: document.referrer, s }),
      headers: { 'Content-Type': 'text/plain' },
      keepalive: true,
    }).catch(() => {});
  } catch { /* analytics must never break the page */ }
}
