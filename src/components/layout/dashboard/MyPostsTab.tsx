import React from 'react';
import { Edit3, Save, Trash2 } from 'lucide-react';
import { getPostPrice } from '../../../lib/dashboardRows';
import { TAB_TITLE_CLASS } from './fields';
import type { usePostManager } from './usePostManager';

type PostManager = ReturnType<typeof usePostManager>;

const EDIT_INPUT_CLASS = 'w-full bg-[#050508] border border-white/10 rounded p-2 text-sm text-white';
const EDIT_LABEL_CLASS = 'text-[10px] text-gray-500 uppercase tracking-widest';

function PostEditor({ post, manager }: { post: any; manager: PostManager }) {
  const { editing, updateEditing, saveEdit, cancelEditing } = manager;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label className={EDIT_LABEL_CLASS}>Edit Title / Asset Name</label>
        <input
          type="text"
          value={editing.title}
          onChange={e => updateEditing({ title: e.target.value })}
          className={EDIT_INPUT_CLASS}
        />
      </div>
      {post.type === 'domain' && (
        <div className="flex flex-col gap-1.5">
          <label className={EDIT_LABEL_CLASS}>Asking Price (USD)</label>
          <input
            type="number"
            value={editing.price}
            onChange={e => updateEditing({ price: e.target.value })}
            className={EDIT_INPUT_CLASS}
          />
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <label className={EDIT_LABEL_CLASS}>Edit Body / Description</label>
        <textarea
          value={editing.body}
          onChange={e => updateEditing({ body: e.target.value })}
          rows={4}
          className="w-full bg-[#050508] border border-white/10 rounded p-2 text-sm text-white outline-none"
        />
      </div>
      <div className="flex gap-2">
        <button onClick={() => saveEdit(post.id, post.type)} className="border border-neonCyan/30 text-neonCyan px-4 py-1.5 rounded hover:bg-neonCyan hover:text-black font-orbitron text-xs flex items-center gap-1.5">
          <Save size={12} /> Save
        </button>
        <button onClick={cancelEditing} className="border border-white/15 text-gray-400 px-4 py-1.5 rounded hover:bg-white/5 font-orbitron text-xs">
          Cancel
        </button>
      </div>
    </div>
  );
}

function PostSummary({ post, manager }: { post: any; manager: PostManager }) {
  const price = getPostPrice(post.meta);
  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="font-bold text-lg text-white font-orbitron tracking-wide">{post.title}</span>
          <span className={`text-[9px] px-2 py-0.5 rounded font-extrabold uppercase ${post.type === 'domain' ? 'bg-neonOrange/10 text-neonOrange border border-neonOrange/20' : 'bg-neonCyan/10 text-neonCyan border border-neonCyan/20'
            }`}>{post.type}</span>
        </div>
        <p className="text-gray-400 text-xs line-clamp-2 max-w-[600px] mt-1">{post.body}</p>
        {post.type === 'domain' && price && (
          <span className="text-neonOrange text-xs font-orbitron font-extrabold mt-1">PRICE: ${price} USD</span>
        )}
        <span className="text-[10px] text-gray-600 font-bold uppercase tracking-wider mt-1">{new Date(post.created_at).toLocaleDateString()}</span>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => manager.startEditing(post)} className="border border-neonCyan/25 text-neonCyan p-2 rounded hover:bg-neonCyan hover:text-black transition-all" title="Edit Post">
          <Edit3 size={14} />
        </button>
        <button onClick={() => manager.deletePost(post.id)} className="border border-neonPink/25 text-neonPink p-2 rounded hover:bg-neonPink hover:text-black transition-all" title="Delete Post">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

export function MyPostsTab({ userPosts, manager }: { userPosts: any[]; manager: PostManager }) {
  return (
    <div className="flex flex-col gap-6">
      <div className={TAB_TITLE_CLASS}>Manage My Assets &amp; Posts</div>
      {userPosts.length === 0 ? (
        <div className="text-gray-500 text-xs font-bold uppercase tracking-wider">No uploads found. Publish something to populate your workspace dashboard.</div>
      ) : (
        <div className="flex flex-col gap-4">
          {userPosts.map(p => (
            <div key={p.id} className="glass-card p-6 border-white/5 hover:border-neonCyan transition-all flex flex-col gap-4 shadow-xl">
              {manager.editing.id === p.id ? <PostEditor post={p} manager={manager} /> : <PostSummary post={p} manager={manager} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
