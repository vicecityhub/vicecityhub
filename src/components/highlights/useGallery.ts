import { useCallback, useEffect, useRef, useState } from 'react';
import { hasMorePages, isReportAccepted, mergePage, toggledSet, withLikeDelta, withoutItem, storagePaths } from '../../lib/highlights';
import type { HL, HlKind, HlSort, HlUser } from '../../lib/highlights';
import { addLike, addReport, deleteHighlight, fetchHighlights, fetchLikedIds, removeLike } from './api';
import { removeFiles } from './storage';

type OpenModal = (id: string, tab?: 'login' | 'register') => void;

/** The wall: paged list with kind/sort filters, plus likes, reports and deleting your own posts. */
export function useGallery(user: HlUser | null, onOpenModal: OpenModal) {
  const [items, setItems] = useState<HL[]>([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [kind, setKind] = useState<HlKind>('all');
  const [sort, setSort] = useState<HlSort>('new');
  const [liked, setLiked] = useState<Set<number>>(new Set());
  const [reported, setReported] = useState<Set<number>>(new Set());
  const pageRef = useRef(0);

  const load = useCallback(async (reset: boolean) => {
    setLoading(true);
    const page = reset ? 0 : pageRef.current;
    const rows = await fetchHighlights(kind, sort, page);
    setItems((prev) => mergePage(prev, rows, reset));
    setMore(hasMorePages(rows));
    pageRef.current = page + 1;
    setLoading(false);
  }, [kind, sort]);

  useEffect(() => { pageRef.current = 0; load(true); }, [load]);

  useEffect(() => {
    if (!user || !items.length) return;
    fetchLikedIds(items.map((i) => i.id)).then(setLiked);
  }, [user, items.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleLike = async (h: HL) => {
    if (!user) return onOpenModal('auth', 'login');
    const has = liked.has(h.id);
    setLiked((s) => toggledSet(s, h.id, has));
    setItems((arr) => withLikeDelta(arr, h.id, has));
    if (has) await removeLike(h.id, user.id);
    else await addLike(h.id);
  };

  const report = async (h: HL) => {
    if (!user) return onOpenModal('auth', 'login');
    if (!window.confirm('Report this highlight as abusive, illegal or not from a game? Three reports from established accounts hide it automatically.')) return;
    const { error } = await addReport(h.id);
    if (isReportAccepted(error)) setReported((s) => new Set(s).add(h.id));
  };

  const remove = async (h: HL) => {
    if (!window.confirm('Delete this highlight for good?')) return;
    const { error } = await deleteHighlight(h.id);
    if (error) return;
    await removeFiles(storagePaths(h.media_path, h.poster_path));
    setItems((arr) => withoutItem(arr, h.id));
  };

  /** After a successful post: back to page one of "All, newest" so the new highlight is on top. */
  const showFreshest = () => { pageRef.current = 0; setSort('new'); setKind('all'); load(true); };

  return { items, loading, more, kind, sort, liked, reported, setKind, setSort, load, toggleLike, report, remove, showFreshest };
}
