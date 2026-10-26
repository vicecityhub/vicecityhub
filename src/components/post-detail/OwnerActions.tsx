import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import type { PostEditor } from './usePostEditor';

/** Edit / delete buttons in the top-right corner of the post (owner only). */
export function OwnerActions({ editor }: { editor: PostEditor }) {
  return (
    <div className="absolute top-3 right-3 flex gap-2">
      <button
        onClick={editor.start}
        className="text-gray-500 hover:text-neonCyan p-1.5 rounded transition-colors"
        title="Edit post"
      >
        <Pencil size={15} />
      </button>
      <button
        onClick={editor.remove}
        disabled={editor.deleting}
        className="text-gray-500 hover:text-neonPink p-1.5 rounded transition-colors disabled:opacity-40"
        title="Delete post"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}
