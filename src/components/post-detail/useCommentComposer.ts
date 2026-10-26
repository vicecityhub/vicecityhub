import { useState } from 'react';
import { supa } from '../../lib/SupabaseClient';
import type { FullPost } from './usePostData';

interface Args {
  post: FullPost | null;
  session: any;
  isLoggedIn: boolean;
  requireAuth: () => void;
  /** Reload the comment tree after a successful post. */
  reloadComments: () => void;
}

/** The top-level comment box. Its text lives here (not in the box) so it survives a page reload. */
export function useCommentComposer({ post, session, isLoggedIn, requireAuth, reloadComments }: Args) {
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!isLoggedIn) {
      requireAuth();
      return;
    }
    if (!body.trim() || !post) return;
    setSubmitting(true);

    const { error } = await supa.from('post_comments').insert({
      post_id: post.id,
      parent_comment_id: null,
      author_id: session.user.id,
      body: body.trim(),
    });

    setSubmitting(false);
    if (!error) {
      setBody('');
      reloadComments();
    }
  };

  return { body, setBody, submitting, submit };
}

export type CommentComposerState = ReturnType<typeof useCommentComposer>;
