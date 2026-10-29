import { SUPABASE_URL, supa } from '../../lib/SupabaseClient';
import { pollStatusOutcome } from '../../lib/highlights';
import type { PollOutcome } from '../../lib/highlights';

// Edge function `device-login`: start / poll (console side) and inspect / approve (phone side).
export const FN = `${SUPABASE_URL}/functions/v1/device-login`;

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export interface DeviceCode { code: string; secret: string; expires_in?: number }

/** Console side: ask for a fresh code to show on screen. */
export async function requestDeviceCode(): Promise<DeviceCode> {
  const r = await fetch(`${FN}/start`, { method: 'POST', headers: JSON_HEADERS, body: '{}' });
  if (!r.ok) throw new Error('start failed');
  return r.json();
}

/** Console side: one poll. 'approved' means the session is now signed in; a network blip is just 'retry'. */
export async function pollDeviceLogin(secret: string): Promise<PollOutcome> {
  try {
    const r = await fetch(`${FN}/poll`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ secret }) });
    const outcome = pollStatusOutcome(r.status);
    if (outcome !== 'approved') return outcome;
    const pj = await r.json();
    const { error } = await supa.auth.verifyOtp({ token_hash: pj.token_hash, type: 'magiclink' });
    return error ? 'error' : 'approved';
  } catch (_e) {
    return 'retry';
  }
}

/** Phone side: call one of the signed-in endpoints (/inspect, /approve). Always resolves to { status, body }. */
export async function callDeviceLogin(path: string, body: object): Promise<{ status: number; body: any }> {
  const { data: s } = await supa.auth.getSession();
  const r = await fetch(`${FN}${path}`, { method: 'POST', headers: { ...JSON_HEADERS, Authorization: `Bearer ${s.session?.access_token || ''}` }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
