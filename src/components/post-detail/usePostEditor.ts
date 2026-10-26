import { useState } from 'react';
import { supa } from '../../lib/SupabaseClient';
import { buildStorageUploadPath } from '../../lib/fileUpload';
import { buildPostUpdate, planMediaEdit } from '../../lib/postDetail';
import type { FullPost } from './usePostData';

interface Args {
  post: FullPost | null;
  session: any;
  /** Reload the post after a successful save. */
  reload: () => Promise<void>;
}

/** Owner-only editing and deleting of the post. */
export function usePostEditor({ post, session, reload }: Args) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [removeMedia, setRemoveMedia] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  /** Fill the fields from a freshly loaded post (without opening the editor). */
  const syncFromPost = (p: FullPost) => {
    setTitle(p.title);
    setBody(p.body || '');
  };

  const start = () => {
    if (!post) return;
    syncFromPost(post);
    setMediaFile(null);
    setRemoveMedia(false);
    setError('');
    setEditing(true);
  };

  const cancel = () => setEditing(false);

  /** A newly picked file replaces any pending "remove" click. */
  const pickFile = (file: File | null) => {
    setMediaFile(file);
    setRemoveMedia(false);
  };

  const save = async () => {
    if (!post || !title.trim()) return;
    setSaving(true);
    setError('');

    try {
      const plan = planMediaEdit(post, removeMedia, mediaFile);
      let mediaUrl = plan.url;

      if (plan.upload && mediaFile) {
        const path = buildStorageUploadPath(session.user.id, mediaFile.name);
        const { error: uploadError } = await supa.storage.from('post-media').upload(path, mediaFile);
        if (uploadError) throw uploadError;
        const { data: urlData } = supa.storage.from('post-media').getPublicUrl(path);
        mediaUrl = urlData.publicUrl;
      }

      const { error: updateError } = await supa
        .from('feed_posts')
        .update(buildPostUpdate(title, body, mediaUrl, plan.type))
        .eq('id', post.id);

      if (updateError) throw updateError;

      setEditing(false);
      await reload();
    } catch (e: any) {
      setError(e.message || 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!post) return;
    if (!window.confirm('Delete this post permanently? This cannot be undone.')) return;
    setDeleting(true);
    const { error: deleteError } = await supa.from('feed_posts').delete().eq('id', post.id);
    setDeleting(false);
    if (!deleteError) {
      window.location.href = './community.html';
    }
  };

  return { editing, title, setTitle, body, setBody, mediaFile, removeMedia, setRemoveMedia, saving, error, deleting, syncFromPost, start, cancel, pickFile, save, remove };
}

export type PostEditor = ReturnType<typeof usePostEditor>;
