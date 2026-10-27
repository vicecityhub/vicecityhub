import React from 'react';
import { Upload, X } from 'lucide-react';
import { isVideoMedia } from '../../lib/media';
import type { Subhub } from '../../lib/community';
import type { PostComposer } from './usePostComposer';

const FIELD_CLASS = 'w-full bg-[#050508] border border-white/10 focus:border-neonCyan outline-none rounded p-3 text-sm text-white';
const LABEL_CLASS = 'text-[10px] text-gray-500 uppercase tracking-widest font-bold';

function MediaPicker({ composer }: { composer: PostComposer }) {
  const { existingMediaUrl, removeMedia, mediaFile, setRemoveMedia, pickFile } = composer;
  const showExisting = !!existingMediaUrl && !removeMedia && !mediaFile;
  return (
    <div className="flex flex-col gap-1.5">
      <label className={LABEL_CLASS}>Screenshot or clip (optional)</label>

      {showExisting && (
        <div className="relative rounded overflow-hidden border border-white/10 mb-1">
          {isVideoMedia(existingMediaUrl!) ? (
            <video src={existingMediaUrl!} className="w-full max-h-48" controls />
          ) : (
            <img src={existingMediaUrl!} alt="" className="w-full max-h-48 object-cover" />
          )}
          <button
            onClick={() => setRemoveMedia(true)}
            className="absolute top-2 right-2 bg-black/70 text-neonPink rounded p-1.5 hover:bg-black"
            type="button"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {mediaFile && <p className="text-[10px] text-gray-400">Selected: {mediaFile.name}</p>}

      <label className="flex items-center gap-2 border border-dashed border-white/15 rounded p-3 text-xs text-gray-400 hover:border-neonCyan cursor-pointer transition-colors">
        <Upload size={14} />
        {mediaFile || existingMediaUrl ? 'Replace file' : 'Upload image or video'}
        <input
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0] || null)}
        />
      </label>
    </div>
  );
}

/** New / edit post modal (create and edit share it). */
export function PostComposerModal({ composer, subhubs }: { composer: PostComposer; subhubs: Subhub[] }) {
  if (!composer.open) return null;
  const { editingPostId, title, setTitle, body, setBody, subhubId, setSubhubId, submitting, error, close, submit } = composer;
  return (
    <div className="fixed inset-0 z-[1000] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass-card max-w-lg w-full p-7 relative border border-neonCyan shadow-[0_0_40px_rgba(0,255,255,0.2)] max-h-[90vh] overflow-y-auto">
        <button
          onClick={close}
          className="absolute top-4 right-4 text-gray-500 hover:text-neonPink transition-colors"
        >
          <X size={20} />
        </button>
        <div className="font-orbitron font-extrabold text-2xl text-neonCyan neon-text-cyan mb-5 tracking-widest uppercase">
          {editingPostId ? 'Edit Post' : 'New Post'}
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className={LABEL_CLASS}>Subhub</label>
            <select
              value={subhubId ?? ''}
              onChange={(e) => setSubhubId(Number(e.target.value))}
              className={FIELD_CLASS}
            >
              {subhubs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.icon ? `${s.icon} ` : ''}#{s.slug}{s.title !== s.slug ? ` — ${s.title}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={LABEL_CLASS}>Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={300}
              className={FIELD_CLASS}
              placeholder="Found something weird in the latest leak..."
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={LABEL_CLASS}>Body (optional)</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              maxLength={10000}
              className={FIELD_CLASS}
              placeholder="Lay out the details..."
            />
            <span className="text-[10px] text-gray-600 self-end">{body.length}/10000</span>
          </div>

          <MediaPicker composer={composer} />

          {error && <p className="text-xs text-neonPink">{error}</p>}

          <button
            onClick={submit}
            disabled={submitting || !title.trim()}
            className="btn-neon font-orbitron text-xs mt-2 uppercase disabled:opacity-40"
          >
            {submitting ? 'Saving...' : editingPostId ? 'Save Changes' : 'Publish Post'}
          </button>
        </div>
      </div>
    </div>
  );
}
