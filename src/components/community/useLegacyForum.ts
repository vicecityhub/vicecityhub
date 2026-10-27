import { useCallback, useEffect, useState } from 'react';
import { supa } from '../../lib/SupabaseClient';
import { legacyAuthorName, validateLegacyPost } from '../../lib/community';
import type { LegacyForumPost } from '../../lib/community';

interface Args {
  session: any;
  isLoggedIn: boolean;
  requireAuth: () => void;
}

/** "The Underground Forum": the old long-form topics (`posts` table, type = 'forum'), with create/edit/delete. */
export function useLegacyForum({ session, isLoggedIn, requireAuth }: Args) {
  const [posts, setPosts] = useState<LegacyForumPost[]>([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchPosts = useCallback(() => {
    supa
      .from('posts')
      .select('id,title,body,author_id,author_name,created_at')
      .eq('type', 'forum')
      .order('created_at', { ascending: false })
      .limit(12)
      .then(({ data }) => {
        if (data) setPosts(data);
      });
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  /** "+ New Topic": guests get the login modal, members an empty composer. */
  const startNewTopic = () => {
    if (!isLoggedIn) {
      requireAuth();
      return;
    }
    setEditingId(null);
    setTitle('');
    setBody('');
    setError('');
    setComposerOpen(true);
  };

  const startEditing = (post: LegacyForumPost) => {
    setEditingId(post.id);
    setTitle(post.title);
    setBody(post.body);
    setError('');
    setComposerOpen(true);
  };

  const close = () => setComposerOpen(false);

  const remove = async (id: number) => {
    if (!window.confirm('Delete this forum topic permanently? This cannot be undone.')) return;
    const { error: deleteError } = await supa.from('posts').delete().eq('id', id);
    if (!deleteError) {
      setPosts((prev) => prev.filter((p) => p.id !== id));
    } else {
      alert(deleteError.message);
    }
  };

  const submit = async () => {
    if (!isLoggedIn) {
      requireAuth();
      return;
    }
    const invalid = validateLegacyPost(title, body);
    if (invalid) {
      setError(invalid);
      return;
    }
    setSubmitting(true);
    setError('');

    const { error: saveError } = editingId
      ? await supa
          .from('posts')
          .update({ title: title.trim(), body: body.trim() })
          .eq('id', editingId)
      : await supa.from('posts').insert({
          author_id: session.user.id,
          author_name: legacyAuthorName(session.user),
          type: 'forum',
          title: title.trim(),
          body: body.trim(),
        });

    setSubmitting(false);
    if (saveError) {
      setError(saveError.message);
    } else {
      setTitle('');
      setBody('');
      setEditingId(null);
      setComposerOpen(false);
      fetchPosts();
    }
  };

  return { posts, composerOpen, editingId, title, setTitle, body, setBody, submitting, error, startNewTopic, startEditing, close, remove, submit };
}

export type LegacyForum = ReturnType<typeof useLegacyForum>;
