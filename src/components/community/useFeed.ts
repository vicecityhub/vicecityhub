import { useCallback, useEffect, useRef, useState } from 'react';
import { supa } from '../../lib/SupabaseClient';
import { applyFeedSort, enrichFeedPosts } from '../../lib/community';
import type { SortMode, Subhub } from '../../lib/community';
import { fetchProfileMaps } from '../../lib/profiles';
import type { FeedPost } from '../PostCard';

/** The signed-in user's votes on the given posts, keyed by post id. */
async function fetchPostVotes(userId: string, postIds: number[]) {
  const { data: voteRows } = await supa
    .from('post_votes')
    .select('post_id,value')
    .eq('user_id', userId)
    .in('post_id', postIds);
  return voteRows ? (Object.fromEntries(voteRows.map((v: any) => [v.post_id, v.value])) as Record<number, 1 | -1>) : {};
}

/** The feed: sub-hub filter, sort tabs, loading, and deleting a post. */
export function useFeed(session: any, subhubs: Subhub[]) {
  const [activeSubhub, setActiveSubhub] = useState<string | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>('hot');
  const [loading, setLoading] = useState(true);
  const feedRef = useRef<HTMLDivElement>(null);

  // Reset scroll to top when posts first load so the first card is never clipped
  useEffect(() => {
    if (!loading && feedRef.current) {
      feedRef.current.scrollTop = 0;
    }
  }, [loading]);

  const fetchPosts = useCallback(async () => {
    setLoading(true);

    let query = supa
      .from('feed_posts')
      .select('id,title,body,media_url,media_type,link_url,score,comments_count,is_pinned,created_at,author_id,subhub_id');

    if (activeSubhub) {
      const sh = subhubs.find((s) => s.slug === activeSubhub);
      if (sh) query = query.eq('subhub_id', sh.id);
    }

    const { data, error } = await applyFeedSort(query, sortMode).limit(50);

    if (!error && data) {
      const userVotes = session?.user ? await fetchPostVotes(session.user.id, data.map((p: any) => p.id)) : {};
      const { names, avatars } = await fetchProfileMaps([...new Set(data.map((p: any) => p.author_id))] as string[]);
      setPosts(enrichFeedPosts(data, subhubs, names, avatars, userVotes));
    }
    setLoading(false);
  }, [activeSubhub, sortMode, subhubs, session]);

  useEffect(() => {
    if (subhubs.length > 0) fetchPosts();
  }, [subhubs, fetchPosts]);

  const deletePost = async (id: number) => {
    if (!window.confirm('Delete this post permanently? This cannot be undone.')) return;
    const { error } = await supa.from('feed_posts').delete().eq('id', id);
    if (!error) {
      setPosts((prev) => prev.filter((p) => p.id !== id));
    }
  };

  return { posts, loading, activeSubhub, setActiveSubhub, sortMode, setSortMode, feedRef, fetchPosts, deletePost };
}

export type Feed = ReturnType<typeof useFeed>;
