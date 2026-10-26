import { useState } from 'react';
import { supa } from '../../../lib/SupabaseClient';
import { buildEditMeta, getPostPrice, validateEditedPost } from '../../../lib/dashboardRows';
import type { ShowToast } from '../useToasts';

export interface EditingPost { id: number | null; title: string; body: string; price: string }

const NOT_EDITING: EditingPost = { id: null, title: '', body: '', price: '' };

interface Args {
  session: any;
  showToast: ShowToast;
  setUserPosts: (posts: any[]) => void;
}

/** The signed-in user's posts: load, edit in place, delete. */
export function usePostManager({ session, showToast, setUserPosts }: Args) {
  const [editing, setEditing] = useState<EditingPost>(NOT_EDITING);

  /** Fetch the dashboard items of the logged-in user. */
  const refresh = async () => {
    if (!session?.user) return;
    try {
      const { data, error } = await supa
        .from('posts')
        .select('*')
        .eq('author_id', session.user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setUserPosts(data || []);
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const startEditing = (post: any) => {
    setEditing({ id: post.id, title: post.title || '', body: post.body || '', price: getPostPrice(post.meta) });
  };

  // Like the original, cancelling only closes the editor; the typed values stay in state.
  const cancelEditing = () => setEditing(prev => ({ ...prev, id: null }));

  const updateEditing = (patch: Partial<EditingPost>) => setEditing(prev => ({ ...prev, ...patch }));

  const saveEdit = async (id: number, type: string) => {
    const invalid = validateEditedPost(editing.title, editing.body);
    if (invalid) {
      showToast(invalid, 'error');
      return;
    }

    const { error } = await supa
      .from('posts')
      .update({
        title: editing.title,
        body: editing.body,
        meta: buildEditMeta(type, editing.title, editing.price),
      })
      .eq('id', id)
      .eq('author_id', session.user.id);

    if (error) {
      showToast(error.message, 'error');
    } else {
      showToast('Post updated successfully!');
      cancelEditing();
      refresh();
    }
  };

  const deletePost = async (id: number) => {
    if (!confirm('Are you sure you want to delete this listing?')) return;
    const { error } = await supa
      .from('posts')
      .delete()
      .eq('id', id)
      .eq('author_id', session.user.id);

    if (error) {
      showToast(error.message, 'error');
    } else {
      showToast('Successfully deleted!', 'info');
      refresh();
    }
  };

  return { editing, refresh, startEditing, cancelEditing, updateEditing, saveEdit, deletePost };
}
