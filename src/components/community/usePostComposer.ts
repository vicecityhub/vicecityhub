import { useState } from 'react';
import { supa } from '../../lib/SupabaseClient';
import { buildStorageUploadPath } from '../../lib/fileUpload';
import { buildFeedPostFields, canSubmitPost, planComposerMedia } from '../../lib/community';
import type { Subhub } from '../../lib/community';
import type { FeedPost } from '../PostCard';

interface Args {
  session: any;
  isLoggedIn: boolean;
  requireAuth: () => void;
  subhubs: Subhub[];
  /** The selected sub-hub lives in the page (it is also defaulted when the sub-hub list arrives). */
  subhubId: number | null;
  setSubhubId: (id: number | null) => void;
  /** Reload the feed after a successful save. */
  refetch: () => void;
}

/** The new/edit post modal (create and edit share it). */
export function usePostComposer({ session, isLoggedIn, requireAuth, subhubs, subhubId, setSubhubId, refetch }: Args) {
  const [open, setOpen] = useState(false);
  const [editingPostId, setEditingPostId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [existingMediaUrl, setExistingMediaUrl] = useState<string | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [removeMedia, setRemoveMedia] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const openCreate = () => {
    setEditingPostId(null);
    setTitle('');
    setBody('');
    setExistingMediaUrl(null);
    setMediaFile(null);
    setRemoveMedia(false);
    setError('');
    if (subhubs.length > 0) setSubhubId(subhubs[0].id);
    setOpen(true);
  };

  const openEdit = (post: FeedPost) => {
    setEditingPostId(post.id);
    setTitle(post.title);
    setBody(post.body || '');
    setExistingMediaUrl(post.media_url);
    setMediaFile(null);
    setRemoveMedia(false);
    setError('');
    const sh = subhubs.find((s) => s.slug === post.subhub_slug);
    if (sh) setSubhubId(sh.id);
    setOpen(true);
  };

  const close = () => setOpen(false);

  /** A newly picked file replaces any pending "remove" click. */
  const pickFile = (file: File | null) => {
    setMediaFile(file);
    setRemoveMedia(false);
  };

  const submit = async () => {
    if (!isLoggedIn) {
      requireAuth();
      return;
    }
    if (!canSubmitPost(title, subhubId)) return;
    setSubmitting(true);
    setError('');

    try {
      const plan = planComposerMedia(existingMediaUrl, removeMedia, mediaFile);
      let mediaUrl = plan.url;

      if (plan.upload && mediaFile) {
        const path = buildStorageUploadPath(session.user.id, mediaFile.name);
        const { error: uploadError } = await supa.storage.from('post-media').upload(path, mediaFile);
        if (uploadError) throw uploadError;
        const { data: urlData } = supa.storage.from('post-media').getPublicUrl(path);
        mediaUrl = urlData.publicUrl;
      }

      const fields = buildFeedPostFields(title, body, subhubId!, mediaUrl, plan.type);
      if (editingPostId) {
        const { error: updateError } = await supa.from('feed_posts').update(fields).eq('id', editingPostId);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supa.from('feed_posts').insert({ ...fields, author_id: session.user.id });
        if (insertError) throw insertError;
      }

      setOpen(false);
      refetch();
    } catch (e: any) {
      setError(e.message || 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  return { open, editingPostId, title, setTitle, body, setBody, subhubId, setSubhubId, existingMediaUrl, mediaFile, removeMedia, setRemoveMedia, submitting, error, openCreate, openEdit, close, pickFile, submit };
}

export type PostComposer = ReturnType<typeof usePostComposer>;
