import { useEffect, useRef, useState } from 'react';
import { supa } from '../../lib/SupabaseClient';
import type { Subhub } from '../../lib/community';

/** The sub-hub list, loaded once. `onLoaded` runs with the rows right after they arrive. */
export function useSubhubs(onLoaded: (subhubs: Subhub[]) => void) {
  const [subhubs, setSubhubs] = useState<Subhub[]>([]);
  const loaded = useRef(onLoaded);
  loaded.current = onLoaded;

  useEffect(() => {
    supa
      .from('subhubs')
      .select('*')
      .order('id')
      .then(({ data }) => {
        if (data) {
          setSubhubs(data);
          loaded.current(data);
        }
      });
  }, []);

  return subhubs;
}
