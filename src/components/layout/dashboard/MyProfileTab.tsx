import React from 'react';
import { ExternalLink, Save, Upload, User } from 'lucide-react';
import { FormField, INPUT_CLASS, TAB_TITLE_CLASS } from './fields';
import type { usePlayerProfile } from './usePlayerProfile';

type Player = ReturnType<typeof usePlayerProfile>;

function AvatarUpload({ player }: { player: Player }) {
  const { profile, uploadAvatar } = player;
  return (
    <div className="flex flex-col gap-2">
      <label className="text-[10px] text-gray-500 uppercase tracking-widest">Profile Avatar</label>
      <div className="flex items-center gap-4">
        <div className="w-24 h-24 rounded-full bg-white/5 border-2 border-neonCyan/30 overflow-hidden flex-shrink-0 flex items-center justify-center">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
          ) : (
            <User size={36} className="text-gray-600" />
          )}
        </div>
        <div className="flex flex-col gap-2 flex-grow">
          <label className="flex items-center justify-center gap-2 border border-neonCyan/30 text-neonCyan px-4 py-2.5 rounded cursor-pointer hover:bg-neonCyan hover:text-black font-orbitron text-[10px] font-bold uppercase tracking-wider transition-all">
            <Upload size={13} />
            {profile?.avatar_url ? 'Change Avatar' : 'Upload Avatar'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => uploadAvatar(e.target.files?.[0])}
            />
          </label>
          <p className="text-[9px] text-gray-600 text-center">Displayed next to your posts in Community</p>
        </div>
      </div>
    </div>
  );
}

export function MyProfileTab({ player }: { player: Player }) {
  const { profile, form, saving, updateForm, save } = player;
  return (
    <div className="flex flex-col gap-5 max-w-[650px]">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className={TAB_TITLE_CLASS}>My Agent Profile</div>
        {profile && (
          <a href={`./profile.html?u=${encodeURIComponent(profile.display_name)}`} target="_blank" rel="noreferrer" className="text-xs text-neonCyan hover:underline flex items-center gap-1">
            <ExternalLink size={13} /> View public page
          </a>
        )}
      </div>

      <p className="text-xs text-gray-500 leading-relaxed -mt-2">
        Rockstar Social Club and PSN don't offer a public login API, so those fields are
        self-reported — they show with an "Unverified" badge until a moderator checks a
        screenshot. Steam can be linked for real, automatic verification.
      </p>

      <div className="flex flex-col gap-4">
        {/* Avatar upload — prominent, at top of form */}
        <AvatarUpload player={player} />

        <FormField label="Display Name">
          <input type="text" value={form.displayName} onChange={e => updateForm({ displayName: e.target.value })} className={INPUT_CLASS} placeholder="Lucia69" />
        </FormField>

        <FormField label="Bio">
          <textarea value={form.bio} onChange={e => updateForm({ bio: e.target.value })} rows={3} maxLength={500} className={INPUT_CLASS} placeholder="What's your story in Leonida?" />
        </FormField>

        <FormField label="Platform">
          <select value={form.platform} onChange={e => updateForm({ platform: e.target.value })} className={INPUT_CLASS}>
            <option value="pc">PC</option>
            <option value="playstation">PlayStation</option>
            <option value="xbox">Xbox</option>
          </select>
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Rockstar Social Club Username">
            <input type="text" value={form.rsc} onChange={e => updateForm({ rsc: e.target.value })} className={INPUT_CLASS} placeholder="RSC_Handle" />
          </FormField>
          <FormField label="PSN Username">
            <input type="text" value={form.psn} onChange={e => updateForm({ psn: e.target.value })} className={INPUT_CLASS} placeholder="PSN_Handle" />
          </FormField>
        </div>

        <FormField label="Gang / Crew Tag">
          <input type="text" value={form.gangTag} onChange={e => updateForm({ gangTag: e.target.value })} className={INPUT_CLASS} placeholder="VCH" />
        </FormField>

        {profile && (
          <div className="flex items-center gap-2 text-xs text-gray-400 bg-white/5 rounded p-3">
            Verification status: <span className="text-neonCyan font-bold uppercase">{profile.verification_level.replace('_', ' ')}</span>
          </div>
        )}

        <button onClick={save} disabled={saving || !form.displayName.trim()} className="btn-neon font-orbitron text-xs uppercase disabled:opacity-40 self-start flex items-center gap-2">
          <Save size={14} /> {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </div>
    </div>
  );
}
