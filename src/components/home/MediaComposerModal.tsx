import React from 'react';
import { X } from 'lucide-react';
import type { MediaCardsController } from './useMediaCards';
import type { MediaType } from '../../lib/homeLogic';

const INPUT_CLASS = 'w-full bg-[#050508] border border-white/10 focus:border-neonCyan outline-none rounded p-3 text-sm text-white';
const LABEL_CLASS = 'text-[10px] text-gray-500 uppercase tracking-widest font-bold block mb-1.5';

function submitLabel(saving: boolean, editing: boolean) {
  return saving ? 'Submitting...' : editing ? 'Save Changes' : 'Submit for Review';
}

/** Add / edit modal for a community media card. */
export function MediaComposerModal({ composer, activeTab }: { composer: MediaCardsController['composer']; activeTab: MediaType }) {
  const { form, updateForm, editingId, error, saving, close, save } = composer;
  return (
    <div className="fixed inset-0 z-[1000] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass-card max-w-lg w-full p-7 relative border border-neonCyan shadow-[0_0_40px_rgba(0,255,255,0.2)] max-h-[90vh] overflow-y-auto">
        <button onClick={close} className="absolute top-4 right-4 text-gray-500 hover:text-white">
          <X size={20} />
        </button>
        <h2 className="font-orbitron font-extrabold text-xl text-neonCyan uppercase tracking-wider mb-2">
          {editingId ? 'Edit Submission' : `Submit ${activeTab}`}
        </h2>
        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-6">
          {editingId
            ? 'Your pending submission will be updated.'
            : 'Submissions are reviewed before appearing on the site.'}
        </p>

        <div className="flex flex-col gap-4">
          <div>
            <label className={LABEL_CLASS}>Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={e => updateForm({ title: e.target.value })}
              maxLength={120}
              className={INPUT_CLASS}
              placeholder="GTA VI — Official Trailer 4"
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>Description</label>
            <textarea
              value={form.description}
              onChange={e => updateForm({ description: e.target.value })}
              rows={2}
              maxLength={500}
              className={INPUT_CLASS}
              placeholder="Short description..."
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>YouTube Video ID</label>
            <input
              type="text"
              value={form.youtube_id}
              onChange={e => updateForm({ youtube_id: e.target.value })}
              className={INPUT_CLASS}
              placeholder="e.g. EiQEBYDox_k  (from youtu.be/EiQEBYDox_k)"
            />
            <p className="text-[10px] text-gray-600 mt-1">Paste the part after youtu.be/ or watch?v=</p>
          </div>
          <div>
            <label className={LABEL_CLASS}>External Link (optional)</label>
            <input
              type="text"
              value={form.external_url}
              onChange={e => updateForm({ external_url: e.target.value })}
              className={INPUT_CLASS}
              placeholder="https://..."
            />
          </div>
          {error && <p className="text-xs text-neonPink">{error}</p>}
          <div className="flex gap-3 mt-2">
            <button
              onClick={save}
              disabled={saving || !form.title.trim()}
              className="border border-neonCyan/30 text-neonCyan px-5 py-2 rounded hover:bg-neonCyan hover:text-black font-orbitron text-xs disabled:opacity-40 transition-all"
            >
              {submitLabel(saving, !!editingId)}
            </button>
            <button
              onClick={close}
              className="border border-white/15 text-gray-400 px-5 py-2 rounded hover:bg-white/5 font-orbitron text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
