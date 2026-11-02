import { useCallback, useEffect, useRef, useState } from 'react';
import { supa } from '../../lib/SupabaseClient';
import { RP_SERVER_COLUMNS, type IRpServer } from './types';

const REFRESH_MS = 60_000;

/** Loads the active servers from public.rp_servers and re-reads them every minute while the tab is visible. */
export function useServers() {
  const [servers, setServers] = useState<IRpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const alive = useRef(true);

  const load = useCallback(async () => {
    try {
      const { data, error: err } = await supa
        .from('rp_servers')
        .select(RP_SERVER_COLUMNS)
        .eq('listing_status', 'active')
        .not('cfx_code', 'is', null)
        .order('sort_order', { ascending: true })
        .limit(500);
      if (!alive.current) return;
      if (err) throw err;
      setServers((data || []) as unknown as IRpServer[]);
      setUpdatedAt(Date.now());
      setError(false);
    } catch (e) {
      console.error('[rp-servers]', e);
      if (alive.current) setError(true);
    } finally {
      if (alive.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    load();
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, REFRESH_MS);
    return () => { alive.current = false; clearInterval(t); };
  }, [load]);

  return { servers, loading, error, updatedAt, reload: load };
}
