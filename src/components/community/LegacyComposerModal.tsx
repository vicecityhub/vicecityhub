import React from 'react';
import { X } from 'lucide-react';
import type { LegacyForum } from './useLegacyForum';

const FIELD_CLASS = 'w-full bg-[#050508] border border-white/10 focus:border-neonPink outline-none rounded p-3 text-sm text-white';
const LABEL_CLASS = 'text-[10px] text-gray-500 uppercase tracking-widest font-bold';

/** New / edit Underground Forum topic modal. */
export function LegacyComposerModal({ forum }: { forum: LegacyForum }) {
  if (!forum.composerOpen) return null;
  const { editingId, title, setTitle, body, setBody, submitting, error, close, submit } = forum;
  return (
    <div className="fixed inset-0 z-[1000] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass-card max-w-lg w-full p-7 relative border border-neonPink shadow-[0_0_40px_rgba(255,0,128,0.2)] max-h-[90vh] overflow-y-auto">
        <button
          onClick={close}
          className="absolute top-4 right-4 text-gray-500 hover:text-neonPink transition-colors"
        >
          <X size={20} />
        </button>
        <div className="font-orbitron font-extrabold text-2xl text-neonPink mb-5 tracking-widest uppercase">
          {editingId ? 'Edit Topic' : 'New Forum Topic'}
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className={LABEL_CLASS}>Topic Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={300}
              className={FIELD_CLASS}
              placeholder="GTA VI Map compared to Red Dead Redemption 2"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={LABEL_CLASS}>Discussion Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              maxLength={10000}
              className={`${FIELD_CLASS} font-mono`}
              placeholder="Stitch your evidence, coordinate maps, or share rumors..."
            />
            <span className="text-[10px] text-gray-600 self-end">{body.length}/10000</span>
          </div>
          {error && <p className="text-xs text-neonPink">{error}</p>}
          <button
            onClick={submit}
            disabled={submitting || !title.trim() || !body.trim()}
            className="border border-neonPink text-neonPink px-4 py-2.5 rounded hover:bg-neonPink hover:text-black font-orbitron text-xs uppercase tracking-widest font-bold disabled:opacity-40 transition-all"
          >
            {submitting ? 'Saving...' : editingId ? 'Save Changes' : 'Publish Topic'}
          </button>
        </div>
      </div>
    </div>
  );
}
