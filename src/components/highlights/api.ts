import { supa } from '../../lib/SupabaseClient';
import { pageRange } from '../../lib/highlights';
import type { HL, HlKind, HlSort } from '../../lib/highlights';

const COLUMNS = 'id, author_id, author_name, kind, media_path, poster_path, title, game, platform, likes, created_at';

/** One page of approved highlights, filtered by kind and ordered by date or by likes. */
export async function fetchHighlights(kind: HlKind, sort: HlSort, page: number): Promise<HL[]> {
  let q = supa.from('highlights').select(COLUMNS).eq('status', 'approved');
  if (kind !== 'all') q = q.eq('kind', kind);
  q = sort === 'top' ? q.order('likes', { ascending: false }).order('created_at', { ascending: false }) : q.order('created_at', { ascending: false });
  const [from, to] = pageRange(page);
  const { data } = await q.range(from, to);
  return (data || []) as HL[];
}

/** Which of these highlights the signed-in user has liked (RLS limits the rows to their own likes). */
export async function fetchLikedIds(ids: number[]): Promise<Set<number>> {
  const { data } = await supa.from('highlight_likes').select('highlight_id').in('highlight_id', ids);
  return new Set((data || []).map((r: any) => r.highlight_id));
}

export const addLike = (highlightId: number) => supa.from('highlight_likes').insert({ highlight_id: highlightId });

export const removeLike = (highlightId: number, userId: string) =>
  supa.from('highlight_likes').delete().eq('highlight_id', highlightId).eq('user_id', userId);

export const addReport = (highlightId: number) => supa.from('highlight_reports').insert({ highlight_id: highlightId });

export const deleteHighlight = (id: number) => supa.from('highlights').delete().eq('id', id);
