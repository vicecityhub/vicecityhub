import React from 'react';
import { Upload, X } from 'lucide-react';
import type { FullPost } from './usePostData';
import type { PostEditor } from './usePostEditor';

const FIELD_CLASS = 'w-full bg-[#050508] border border-white/10 focus:border-neonCyan outline-none rounded p-3 text-sm text-white';

/** Preview of the current media with a button that marks it for removal. */
function CurrentMedia({ post, editor }: { post: FullPost; editor: PostEditor }) {
  if (!post.media_url || editor.removeMedia || editor.mediaFile) return null;
  return (
    <div className="relative rounded overflow-hidden border border-white/10">
      {post.media_type === 'video' ? (
        <video src={post.media_url} className="w-full max-h-48" controls />
      ) : (
        <img src={post.media_url} alt="" className="w-full max-h-48 object-cover" />
      )}
      <button
        onClick={() => editor.setRemoveMedia(true)}
        className="absolute top-2 right-2 bg-black/70 text-neonPink rounded p-1.5 hover:bg-black"
        type="button"
      >
        <X size={14} />
      </button>
    </div>
  );
}

/** Owner-only edit form for title, body and media. */
export function PostEditForm({ post, editor }: { post: FullPost; editor: PostEditor }) {
  return (
    <div className="flex flex-col gap-3 max-w-lg">
      <input
        type="text"
        value={editor.title}
        onChange={(e) => editor.setTitle(e.target.value)}
        maxLength={300}
        className={FIELD_CLASS}
      />
      <textarea
        value={editor.body}
        onChange={(e) => editor.setBody(e.target.value)}
        rows={5}
        maxLength={10000}
        className={FIELD_CLASS}
      />
      <span className="text-[10px] text-gray-600 self-end -mt-2">{editor.body.length}/10000</span>

      <CurrentMedia post={post} editor={editor} />
      {editor.mediaFile && <p className="text-[10px] text-gray-400">Selected: {editor.mediaFile.name}</p>}

      <label className="flex items-center gap-2 border border-dashed border-white/15 rounded p-3 text-xs text-gray-400 hover:border-neonCyan cursor-pointer transition-colors">
        <Upload size={14} />
        {editor.mediaFile || post.media_url ? 'Replace file' : 'Upload image or video'}
        <input
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => editor.pickFile(e.target.files?.[0] || null)}
        />
      </label>

      {editor.error && <p className="text-xs text-neonPink">{editor.error}</p>}

      <div className="flex gap-2">
        <button
          onClick={editor.save}
          disabled={editor.saving || !editor.title.trim()}
          className="border border-neonCyan/30 text-neonCyan px-4 py-1.5 rounded hover:bg-neonCyan hover:text-black font-orbitron text-xs disabled:opacity-40 transition-all"
        >
          {editor.saving ? 'Saving...' : 'Save Changes'}
        </button>
        <button
          onClick={editor.cancel}
          className="border border-white/15 text-gray-400 px-4 py-1.5 rounded hover:bg-white/5 font-orbitron text-xs"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
