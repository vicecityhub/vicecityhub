import { useEffect, useState } from 'react';
import { supa } from '../../lib/SupabaseClient';
import { buildFeed } from '../../lib/news';
import type { NewsArticle } from '../../lib/news';

/** Published news rows: featured first, then manual order, then newest. */
async function fetchPublishedNews(): Promise<NewsArticle[]> {
  const { data, error } = await supa
    .from('news')
    .select('*')
    .or('is_published.is.null,is_published.eq.true')
    .order('is_featured', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

/** State of The Wire: the loaded rows, the tag tab, the search box and which cards are expanded. */
export function useNews() {
  const [dbNews, setDbNews] = useState<NewsArticle[]>([]);
  const [selectedTag, setSelectedTag] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchPublishedNews()
      .then(setDbNews)
      .catch(err => console.error('Error fetching news:', err));
  }, []);

  const toggleExpanded = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const feed = buildFeed(dbNews, selectedTag, searchQuery);

  return { feed, selectedTag, setSelectedTag, searchQuery, setSearchQuery, expandedIds, toggleExpanded };
}
