import { useEffect, useState } from 'react';
import { supa } from '../../lib/SupabaseClient';
import { EMPTY_MAP_COMMENTS, commentAuthorName, groupMapComments } from '../../lib/homeLogic';
import type { MapComments } from '../../lib/homeLogic';

/** Comments under the speculative map: load, draft text per map, and post. */
export function useMapComments(session: any, onOpenModal: (id: string, tab?: 'login' | 'register') => void) {
  const [comments, setComments] = useState<MapComments>(EMPTY_MAP_COMMENTS());
  const [drafts, setDrafts] = useState<{ [mapId: string]: string }>({ map1: '', map2: '' });

  const fetchComments = async () => {
    try {
      const { data } = await supa
        .from('map_comments')
        .select('*')
        .order('created_at', { ascending: false });
      setComments(groupMapComments(data));
    } catch (e) { }
  };

  useEffect(() => {
    fetchComments();
  }, []);

  const setDraft = (mapId: string, text: string) => setDrafts(prev => ({ ...prev, [mapId]: text }));

  const submit = async (mapId: string) => {
    if (!session?.user) {
      onOpenModal('auth', 'login');
      return;
    }

    const text = drafts[mapId]?.trim();
    if (!text) return;

    try {
      const { error } = await supa.from('map_comments').insert({
        map_id: mapId,
        body: text,
        author_id: session.user.id,
        author_name: commentAuthorName(session.user),
      });

      if (!error) {
        setDrafts(prev => ({ ...prev, [mapId]: '' }));
        fetchComments();
      }
    } catch (e) { }
  };

  return { comments, drafts, setDraft, submit };
}
