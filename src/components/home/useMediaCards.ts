import { useEffect, useState } from 'react';
import { supa } from '../../lib/SupabaseClient';
import { EMPTY_MEDIA_FORM, buildMediaPayload, mediaFormFromCard } from '../../lib/homeLogic';
import type { MediaCard, MediaForm, MediaType } from '../../lib/homeLogic';

/** Community media: the `media_cards` list, the active tab and the add/edit composer. */
export function useMediaCards(session: any) {
  const [activeTab, setActiveTab] = useState<MediaType>('trailer');
  const [cards, setCards] = useState<MediaCard[]>([]);
  const [loading, setLoading] = useState(true);

  // composer (add / edit modal)
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<MediaForm>(EMPTY_MEDIA_FORM);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchCards = async () => {
    setLoading(true);
    const { data } = await supa
      .from('media_cards')
      .select('*')
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: true });
    if (data) setCards(data as MediaCard[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchCards();
  }, []);

  const openComposer = (card?: MediaCard) => {
    if (card) {
      setEditingId(card.id);
      setForm(mediaFormFromCard(card));
    } else {
      setEditingId(null);
      setForm(EMPTY_MEDIA_FORM);
    }
    setError('');
    setComposerOpen(true);
  };

  const closeComposer = () => setComposerOpen(false);

  const updateForm = (patch: Partial<MediaForm>) => setForm(prev => ({ ...prev, ...patch }));

  const save = async () => {
    if (!form.title.trim()) {
      setError('Title is required.');
      return;
    }
    setSaving(true);
    setError('');

    const payload = buildMediaPayload(form, activeTab);

    const { error: saveError } = editingId
      ? await supa.from('media_cards').update(payload).eq('id', editingId)
      : await supa.from('media_cards').insert({ ...payload, author_id: session.user.id });

    setSaving(false);
    if (saveError) {
      setError(saveError.message);
    } else {
      setComposerOpen(false);
      fetchCards();
    }
  };

  const deleteCard = async (id: number) => {
    if (!window.confirm('Delete this card? This cannot be undone.')) return;
    await supa.from('media_cards').delete().eq('id', id);
    setCards(prev => prev.filter(c => c.id !== id));
  };

  return {
    activeTab, setActiveTab, cards, loading,
    composer: { open: composerOpen, editingId, form, error, saving, updateForm, close: closeComposer, save },
    openComposer, deleteCard,
  };
}

export type MediaCardsController = ReturnType<typeof useMediaCards>;
