import React, { useState, useEffect } from 'react';
import { supa } from '../lib/SupabaseClient';
import { buildStorageUploadPath } from '../lib/fileUpload';
import VerificationBadge, { VerificationLevel } from '../components/VerificationBadge';
import { Gamepad2, Shield, Upload, X, Link2 } from 'lucide-react';

interface PlayerProfile {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  rsc_username: string | null;
  psn_username: string | null;
  steam_id: string | null;
  platform: string | null;
  gang_tag: string | null;
  gang_role: string | null;
  verification_level: VerificationLevel;
}

interface MediaItem {
  id: number;
  media_url: string;
  media_type: 'image' | 'video';
  caption: string | null;
  created_at: string;
}

interface ProfileProps {
  onOpenModal: (id: string, tab?: 'login' | 'register') => void;
  session: any;
}

export default function Profile({ onOpenModal, session }: ProfileProps) {
  const params = new URLSearchParams(window.location.search);
  const requestedUsername = params.get('u');

  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const isOwnProfile = !!session?.user && profile?.user_id === session.user.id;
  const isLoggedIn = !!session?.user;
  const viewingOwnEmptyProfile = isLoggedIn && !requestedUsername;

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      let targetUserId: string | null = null;

      if (requestedUsername) {
        const { data } = await supa
          .from('player_profiles')
          .select('*')
          .eq('display_name', requestedUsername)
          .maybeSingle();
        if (data) {
          setProfile(data);
          targetUserId = data.user_id;
        } else {
          setNotFound(true);
        }
      } else if (session?.user) {
        const { data } = await supa
          .from('player_profiles')
          .select('*')
          .eq('user_id', session.user.id)
          .maybeSingle();
        if (data) {
          setProfile(data);
          targetUserId = data.user_id;
        }
      }

      if (targetUserId) {
        const { data: mediaRows } = await supa
          .from('player_media')
          .select('id,media_url,media_type,caption,created_at')
          .eq('user_id', targetUserId)
          .order('created_at', { ascending: false });
        if (mediaRows) setMedia(mediaRows);
      }

      setLoading(false);
    };
    load();
  }, [requestedUsername, session]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center text-gray-500 text-xs uppercase tracking-widest font-bold">
        Pulling up the file...
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <p className="text-gray-400 text-sm font-bold">No agent found under that name.</p>
      </div>
    );
  }

  if (!profile && viewingOwnEmptyProfile) {
    return <CreateProfilePrompt session={session} onCreated={() => window.location.reload()} />;
  }

  if (!profile) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <p className="text-gray-400 text-sm font-bold mb-4">Sign in to set up your agent profile.</p>
        <button onClick={() => onOpenModal('auth', 'login')} className="btn-neon font-orbitron text-xs uppercase">
          Sign In
        </button>
      </div>
    );
  }

  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');

  const handleAvatarUpload = async (file: File) => {
    if (!session?.user) return;
    setAvatarUploading(true);
    setAvatarError('');

    const path = buildStorageUploadPath(session.user.id, file.name);
    const { error: uploadErr } = await supa.storage.from('player-media').upload(path, file, { upsert: true });
    if (uploadErr) {
      setAvatarError(uploadErr.message);
      setAvatarUploading(false);
      return;
    }

    const { data: urlData } = supa.storage.from('player-media').getPublicUrl(path);
    const { error: updateErr } = await supa
      .from('player_profiles')
      .update({ avatar_url: urlData.publicUrl })
      .eq('user_id', session.user.id);

    setAvatarUploading(false);
    if (updateErr) {
      setAvatarError(updateErr.message);
    } else {
      setProfile((prev) => prev ? { ...prev, avatar_url: urlData.publicUrl } : prev);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 lg:px-6 py-10">
      {/* Header card */}
      <div className="glass-card border-white/5 p-7 flex flex-col sm:flex-row gap-6 items-start mb-8">
        {/* Avatar with upload button for own profile */}
        <div className="relative flex-shrink-0">
          <div className="w-20 h-20 rounded-full bg-white/5 border-2 border-neonCyan/30 overflow-hidden flex items-center justify-center">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.display_name} className="w-full h-full object-cover" />
            ) : (
              <Gamepad2 size={32} className="text-gray-600" />
            )}
          </div>
          {isOwnProfile && (
            <label
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-neonCyan flex items-center justify-center cursor-pointer hover:bg-white transition-colors shadow-lg"
              title="Upload avatar"
            >
              <Upload size={13} className="text-black" />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleAvatarUpload(f);
                }}
              />
            </label>
          )}
          {avatarUploading && (
            <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
              <span className="text-[9px] text-neonCyan font-bold">...</span>
            </div>
          )}
        </div>

        <div className="flex-grow">
          <div className="flex items-center gap-3 flex-wrap mb-1.5">
            <h1 className="font-orbitron font-extrabold text-2xl text-white">{profile.display_name}</h1>
            <VerificationBadge level={profile.verification_level} />
          </div>
          {avatarError && <p className="text-xs text-neonPink mb-2">{avatarError}</p>}

          {profile.gang_tag && (
            <p className="text-xs text-neonOrange font-bold uppercase tracking-wider mb-2">
              [{profile.gang_tag}] {profile.gang_role || 'Member'}
            </p>
          )}

          {profile.bio && <p className="text-sm text-gray-400 leading-relaxed mb-3 max-w-md">{profile.bio}</p>}

          <div className="flex flex-wrap gap-3 text-[11px] text-gray-500 font-bold uppercase tracking-wider">
            {profile.platform && (
              <span className="border border-white/10 rounded px-2.5 py-1">{profile.platform}</span>
            )}
            {profile.rsc_username && (
              <span className="border border-white/10 rounded px-2.5 py-1">RSC: {profile.rsc_username}</span>
            )}
            {profile.psn_username && (
              <span className="border border-white/10 rounded px-2.5 py-1">PSN: {profile.psn_username}</span>
            )}
            {profile.steam_id && (
              <span className="border border-neonOrange/30 text-neonOrange rounded px-2.5 py-1 flex items-center gap-1">
                <Link2 size={11} /> Steam Linked
              </span>
            )}
          </div>
        </div>

        {isOwnProfile && (
          <button
            onClick={() => setUploadOpen(true)}
            className="btn-neon btn-neon-cyan !text-xs !py-2 !px-4 font-orbitron uppercase flex items-center gap-1.5 self-start"
          >
            <Upload size={13} /> Add Media
          </button>
        )}
      </div>

      {/* Media gallery */}
      <div className="flex items-center gap-2 mb-4">
        <Shield size={16} className="text-neonCyan" />
        <h2 className="font-orbitron font-bold text-sm uppercase tracking-widest text-white">
          Field Footage ({media.length})
        </h2>
      </div>

      {media.length === 0 ? (
        <div className="text-gray-500 text-xs uppercase tracking-widest font-bold py-12 text-center border border-dashed border-white/10 rounded">
          No screenshots or clips posted yet.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {media.map((m) => (
            <div key={m.id} className="rounded overflow-hidden border border-white/5 group relative">
              {m.media_type === 'video' ? (
                <video src={m.media_url} className="w-full aspect-square object-cover" controls />
              ) : (
                <img src={m.media_url} alt={m.caption || ''} className="w-full aspect-square object-cover" loading="lazy" />
              )}
              {m.caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-2 text-[10px] text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity">
                  {m.caption}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {uploadOpen && (
        <MediaUploadModal userId={session.user.id} onClose={() => setUploadOpen(false)} onUploaded={() => window.location.reload()} />
      )}
    </div>
  );
}

// -------------------------------------------------------------------
// Inline sub-component: shown when a logged-in user has no profile row yet
// -------------------------------------------------------------------
function CreateProfilePrompt({ session, onCreated }: { session: any; onCreated: () => void }) {
  const [displayName, setDisplayName] = useState(session?.user?.user_metadata?.username || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const create = async () => {
    if (!displayName.trim()) return;
    setSubmitting(true);
    setError('');
    const { error: insertError } = await supa.from('player_profiles').insert({
      user_id: session.user.id,
      display_name: displayName.trim(),
    });
    setSubmitting(false);
    if (insertError) {
      setError(insertError.message);
    } else {
      onCreated();
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-24 text-center">
      <h1 className="font-orbitron font-extrabold text-xl text-white mb-2 uppercase">Set Up Your Agent File</h1>
      <p className="text-xs text-gray-500 mb-6">Pick the name other agents will see on the hub.</p>
      <input
        type="text"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        placeholder="Lucia69"
        className="w-full bg-[#050508] border border-white/10 focus:border-neonCyan outline-none rounded p-3 text-sm text-white mb-3"
      />
      {error && <p className="text-xs text-neonPink mb-3">{error}</p>}
      <button
        onClick={create}
        disabled={submitting || !displayName.trim()}
        className="btn-neon font-orbitron text-xs uppercase disabled:opacity-40"
      >
        {submitting ? 'Creating...' : 'Create Profile'}
      </button>
    </div>
  );
}

// -------------------------------------------------------------------
// Inline sub-component: simple media upload modal (image/video to Storage)
// -------------------------------------------------------------------
function MediaUploadModal({
  userId,
  onClose,
  onUploaded,
}: {
  userId: string;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError('');

    const mediaType = file.type.startsWith('video') ? 'video' : 'image';
    const path = buildStorageUploadPath(userId, file.name);

    const { error: uploadError } = await supa.storage.from('player-media').upload(path, file);
    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supa.storage.from('player-media').getPublicUrl(path);

    const { error: insertError } = await supa.from('player_media').insert({
      user_id: userId,
      media_url: urlData.publicUrl,
      media_type: mediaType,
      caption: caption.trim() || null,
    });

    setUploading(false);
    if (insertError) {
      setError(insertError.message);
    } else {
      onUploaded();
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass-card max-w-md w-full p-7 relative border border-neonCyan shadow-[0_0_40px_rgba(0,255,255,0.2)]">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-neonPink transition-colors">
          <X size={20} />
        </button>
        <div className="font-orbitron font-extrabold text-xl text-neonCyan mb-5 uppercase tracking-wider">
          Add Field Footage
        </div>
        <div className="flex flex-col gap-4">
          <input
            type="file"
            accept="image/*,video/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="text-xs text-gray-400"
          />
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={280}
            placeholder="Caption (optional)"
            className="w-full bg-[#050508] border border-white/10 focus:border-neonCyan outline-none rounded p-3 text-sm text-white"
          />
          {error && <p className="text-xs text-neonPink">{error}</p>}
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="btn-neon font-orbitron text-xs uppercase disabled:opacity-40"
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}
