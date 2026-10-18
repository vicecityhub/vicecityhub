// Vice City Hub v12 — tiny typed client for the public Agent API (used by the human-facing /agents page).
export const SITE = 'https://vicecityhub.github.io/vicecityhub';
export const API = 'https://lpglkglhjdqnktybksth.supabase.co/functions/v1/agent-api';

export type Kind = 'merch' | 'plan' | 'domain' | 'product' | 'server';

export interface CatalogItem {
  sku: string;
  kind: Kind;
  title: string;
  description: string | null;
  price_usd: number | null;
  price_note?: string;
  currency: string;
  seller: string;
  availability: string;
  purchase: { mode: 'order' | 'intent'; rails: string[]; requires: string[]; external_url?: string };
  url: string;
  image?: string | null;
}

export interface OwnerKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  max_order_usd: number;
  max_daily_usd: number;
  allowed_kinds: string[];
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
}

export interface MintBody {
  name: string;
  max_order_usd: number;
  max_daily_usd: number;
  allowed_kinds: string[];
  expires_in_days?: number;
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public hint?: string) {
    super(message);
  }
}

async function call<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const { token, ...rest } = init;
  const res = await fetch(`${API}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(rest.headers || {}),
    },
  });
  let data: any = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    const e = data?.error || {};
    throw new ApiError(res.status, e.code || 'http_error', e.message || `Request failed (${res.status})`, e.hint);
  }
  return data as T;
}

export const agentApi = {
  index: () => call<any>('/v1'),
  catalog: (p: { kind?: string; q?: string; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    if (p.kind) qs.set('kind', p.kind);
    if (p.q) qs.set('q', p.q);
    qs.set('limit', String(p.limit ?? 24));
    return call<{ items: CatalogItem[]; total: number; next_cursor: string | null }>(`/v1/catalog?${qs}`);
  },
  news: (limit = 1) => call<{ items: any[]; count: number }>(`/v1/news?limit=${limit}`),
  orderStatus: (id: string) => call<{ id: string; status: string; total_usd: number; payment_rail: string; updated_at: string; expires_at: string }>(`/v1/orders/${encodeURIComponent(id)}/status`),
  capture: (id: string) => call<any>(`/v1/orders/${encodeURIComponent(id)}/capture`, { method: 'POST', body: '{}' }),
  register: (name: string) => call<{ api_key: string; limits: { max_order_usd: number; max_daily_usd: number } }>('/v1/agents/register', { method: 'POST', body: JSON.stringify({ name }) }),
  ownerKeys: (token: string) => call<{ items: OwnerKey[] }>('/v1/owner/keys', { token }),
  mintKey: (token: string, body: MintBody) => call<{ api_key: string; key_prefix: string; limits: { max_order_usd: number; max_daily_usd: number }; expires_at: string | null }>('/v1/owner/keys', { method: 'POST', token, body: JSON.stringify(body) }),
  revokeKey: (token: string, id: string) => call<{ key_id: string; is_active: boolean }>(`/v1/owner/keys/${id}/revoke`, { method: 'POST', token, body: '{}' }),
};
