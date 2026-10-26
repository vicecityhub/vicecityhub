import { useState } from 'react';
import { supa } from '../../../lib/SupabaseClient';
import { EMPTY_PROFILE_FORM, avatarStoragePath, buildProfilePayload, profileFormFromRow } from '../../../lib/dashboardRows';
import type { ProfileForm } from '../../../lib/dashboardRows';
import type { ShowToast } from '../useToasts';

interface Args {
  session: any;
  username: string;
  showToast: ShowToast;
}

/** The logged-in user's `player_profiles` row (My Profile tab): load, save, avatar upload. */
export function usePlayerProfile({ session, username, showToast }: Args) {
  const [profile, setProfile] = useState<any>(null);
  const [form, setForm] = useState<ProfileForm>(EMPTY_PROFILE_FORM);
  const [saving, setSaving] = useState(false);

  const updateForm = (patch: Partial<ProfileForm>) => setForm(prev => ({ ...prev, ...patch }));

  const refresh = async () => {
    if (!session?.user) return;
    try {
      const { data, error } = await supa
        .from('player_profiles')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setProfile(data);
        setForm(profileFormFromRow(data));
      } else {
        setProfile(null);
        // no row yet: only the display name is pre-filled
        setForm(prev => ({ ...prev, displayName: username || '' }));
      }
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const save = async () => {
    if (!session?.user || !form.displayName.trim()) return;
    setSaving(true);
    try {
      const { error } = await supa.from('player_profiles').upsert(buildProfilePayload(session.user.id, form), { onConflict: 'user_id' });
      if (error) throw error;
      showToast('Profile saved', 'success');
      refresh();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  /** Upload the chosen image to Storage and point the profile at it. Fails silently, as before. */
  const uploadAvatar = async (file: File | undefined) => {
    if (!file || !session?.user) return;
    const path = avatarStoragePath(session.user.id, file.name);
    const { error: upErr } = await supa.storage.from('player-media').upload(path, file, { upsert: true });
    if (upErr) return;
    const { data: urlData } = supa.storage.from('player-media').getPublicUrl(path);
    await supa.from('player_profiles').update({ avatar_url: urlData.publicUrl }).eq('user_id', session.user.id);
    setProfile((prev: any) => (prev ? { ...prev, avatar_url: urlData.publicUrl } : prev));
  };

  return { profile, form, saving, updateForm, refresh, save, uploadAvatar };
}
