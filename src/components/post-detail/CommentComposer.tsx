import React from 'react';
import type { CommentComposerState } from './useCommentComposer';

interface Props {
  composer: CommentComposerState;
  isLoggedIn: boolean;
  requireAuth: () => void;
}

/** Top-level comment composer: a box that sends guests to the login modal when focused. */
export function CommentComposer({ composer, isLoggedIn, requireAuth }: Props) {
  return (
    <div className="mb-6">
      <textarea
        value={composer.body}
        onChange={(e) => composer.setBody(e.target.value)}
        rows={3}
        maxLength={5000}
        placeholder={isLoggedIn ? 'Add to the conversation...' : 'Sign in to comment'}
        onFocus={() => !isLoggedIn && requireAuth()}
        className="w-full bg-[#050508] border border-white/10 focus:border-neonCyan outline-none rounded p-3 text-sm text-white"
      />
      <span className="text-[10px] text-gray-600 block text-right mt-1">{composer.body.length}/5000</span>
      <button
        onClick={composer.submit}
        disabled={composer.submitting || !composer.body.trim()}
        className="btn-neon font-orbitron text-xs uppercase mt-2 disabled:opacity-40"
      >
        {composer.submitting ? 'Posting...' : 'Comment'}
      </button>
    </div>
  );
}
