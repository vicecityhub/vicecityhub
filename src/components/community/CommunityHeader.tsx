import React from 'react';

/** Page title and the "+ New Post" button. */
export function CommunityHeader({ onNewPost }: { onNewPost: () => void }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div>
        <h1 className="font-orbitron font-extrabold text-3xl text-white uppercase tracking-wider">
          Vice City Community
        </h1>
        <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mt-1">
          Where Leonida's agents talk shop, trade leaks, and start fights
        </p>
      </div>
      <button
        onClick={onNewPost}
        className="btn-neon font-orbitron text-xs uppercase tracking-wider self-start sm:self-auto"
      >
        + New Post
      </button>
    </div>
  );
}
