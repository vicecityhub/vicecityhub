import { useCallback, useEffect, useRef, useState } from 'react';
import { supa } from '../../lib/SupabaseClient';
import { buildCommentTree, enrichComments, uniqueAuthorIds } from '../../lib/postDetail';
import type { MediaType } from '../../lib/postDetail';
import type { CommentNode } from '../CommentThread';

export interface FullPost {
  id: number;
  title: string;
  body: string | null;
  media_url: string | null;
  media_type?: MediaType | null;
  link_url: string | null;
  score: number;
  is_pinned: boolean;
  created_at: string;
  author_id: string;
  subhub_id: number | null;
}

/** Display names and avatars of the given authors, keyed by user id. */
async function fetchProfiles(authorIds: string[]) {
  let names: Record<string, string> = {};
  let avatars: Record<string, string | null> = {};
  if (authorIds.length > 0) {
    const { data: profiles } = await supa
      .from('player_profiles')
      .select('user_id,display_name,avatar_url')
      .in('user_id', authorIds);
    if (profiles) {
      names = Object.fromEntries(profiles.map((p: any) => [p.user_id, p.display_name]));
      avatars = Object.fromEntries(profiles.map((p: any) => [p.user_id, p.avatar_url]));
    }
  }
  return { names, avatars };
}

/** The signed-in user's votes on the given comments, keyed by comment id. */
async function fetchUserVotes(userId: string, commentIds: number[]) {
  const { data: voteRows } = await supa
    .from('comment_votes')
    .select('comment_id,value')
    .eq('user_id', userId)
    .in('comment_id', commentIds);
  return voteRows ? (Object.fromEntries(voteRows.map((v: any) => [v.comment_id, v.value])) as Record<number, 1 | -1>) : {};
}

/**
 * Loads the post, its author, its sub-hub and its comment tree.
 * `onPostLoaded` runs with each freshly loaded post row (the editor uses it to reset its fields).
 */
export function usePostData(postId: number, session: any, onPostLoaded: (post: FullPost) => void) {
  const [post, setPost] = useState<FullPost | null>(null);
  const [authorName, setAuthorName] = useState('agent');
  const [authorAvatar, setAuthorAvatar] = useState<string | null>(null);
  const [subhubSlug, setSubhubSlug] = useState<string | null>(null);
  const [comments, setComments] = useState<CommentNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const loaded = useRef(onPostLoaded);
  loaded.current = onPostLoaded;

  const loadComments = useCallback(async () => {
    if (!postId) return;

    const { data: commentRows } = await supa
      .from('post_comments')
      .select('id,post_id,parent_comment_id,author_id,body,score,created_at,is_deleted')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (!commentRows) {
      setComments([]);
      return;
    }

    const { names, avatars } = await fetchProfiles(uniqueAuthorIds(commentRows));
    const userVotes = session?.user ? await fetchUserVotes(session.user.id, commentRows.map((c: any) => c.id)) : {};
    setComments(buildCommentTree(enrichComments(commentRows, names, avatars, userVotes)));
  }, [postId, session]);

  const loadPost = useCallback(async () => {
    if (!postId) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data: postRow, error } = await supa
      .from('feed_posts')
      .select('id,title,body,media_url,media_type,link_url,score,is_pinned,created_at,author_id,subhub_id')
      .eq('id', postId)
      .maybeSingle();

    if (error || !postRow) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setPost(postRow);
    loaded.current(postRow);

    const { data: authorRow } = await supa
      .from('player_profiles')
      .select('display_name,avatar_url')
      .eq('user_id', postRow.author_id)
      .maybeSingle();
    if (authorRow) {
      setAuthorName(authorRow.display_name);
      setAuthorAvatar(authorRow.avatar_url);
    }

    if (postRow.subhub_id) {
      const { data: subhubRow } = await supa
        .from('subhubs')
        .select('slug')
        .eq('id', postRow.subhub_id)
        .maybeSingle();
      if (subhubRow) setSubhubSlug(subhubRow.slug);
    }

    await loadComments();
    setLoading(false);
  }, [postId, loadComments]);

  // Like before, only a change of post id reloads (not a change of session).
  useEffect(() => {
    loadPost();
  }, [postId]);

  return { post, authorName, authorAvatar, subhubSlug, comments, loading, notFound, loadPost, loadComments };
}
