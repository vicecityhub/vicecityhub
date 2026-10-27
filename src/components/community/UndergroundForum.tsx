import React from 'react';
import { MessageSquare, Pencil, Trash2 } from 'lucide-react';
import LinkedText from '../LinkedText';
import type { LegacyForumPost } from '../../lib/community';
import type { LegacyForum } from './useLegacyForum';

function TopicCard({ post, isAuthor, forum }: { post: LegacyForumPost; isAuthor: boolean; forum: LegacyForum }) {
  return (
    <div className="glass-card p-5 border-l-4 border-l-neonPink border-y-white/5 border-r-white/5 flex flex-col justify-between shadow-xl min-h-[425px] relative">
      {isAuthor && (
        <div className="absolute top-3 right-3 flex gap-2">
          <button
            onClick={() => forum.startEditing(post)}
            className="text-gray-500 hover:text-neonCyan p-1.5 rounded transition-colors"
            title="Edit topic"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => forum.remove(post.id)}
            className="text-gray-500 hover:text-neonPink p-1.5 rounded transition-colors"
            title="Delete topic"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
      <div>
        <h4 className="font-bold text-base text-white font-orbitron leading-snug mb-2 tracking-wide">
          {post.title}
        </h4>
        <div className="max-h-[265px] overflow-y-auto pr-1 custom-scrollbar">
          <p className="text-xs text-gray-400 leading-relaxed font-bold whitespace-pre-wrap">
            <LinkedText text={post.body} showPreview={false} />
          </p>
        </div>
      </div>
      <div className="flex justify-between items-center border-t border-white/5 pt-3 mt-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest font-orbitron">
        <div>
          Agent: <span className="text-neonCyan">{post.author_name}</span>
        </div>
        <span>{new Date(post.created_at).toLocaleDateString()}</span>
      </div>
    </div>
  );
}

/** Legacy forum section (migrated from the old Home page "Underground" section, still fully active). */
export function UndergroundForum({ forum, currentUserId }: { forum: LegacyForum; currentUserId: string | null }) {
  return (
    <div className="pt-2">
      <div className="flex flex-col sm:flex-row sm:items-baseline gap-3 mb-6">
        <h2 className="font-orbitron font-extrabold text-xl tracking-widest uppercase text-white">
          The <span className="text-neonPink">Underground</span> Forum
        </h2>
        <span className="text-[10px] font-bold text-gray-500 tracking-widest uppercase sm:ml-auto">
          Long-form syndicate discussions
        </span>
        <button
          onClick={forum.startNewTopic}
          className="btn-neon !py-1.5 !px-5 !text-[10px] font-orbitron text-neonPink border-neonPink hover:bg-neonPink hover:text-black font-extrabold tracking-widest self-start sm:self-auto"
        >
          + New Topic
        </button>
      </div>

      {forum.posts.length === 0 ? (
        <div className="glass-card p-8 text-center border-white/5">
          <MessageSquare size={28} className="text-gray-600 mx-auto mb-2" />
          <div className="text-gray-400 font-bold uppercase tracking-widest text-xs">No topics yet — start one</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {forum.posts.map((p) => (
            <TopicCard key={p.id} post={p} isAuthor={currentUserId === p.author_id} forum={forum} />
          ))}
        </div>
      )}
    </div>
  );
}
