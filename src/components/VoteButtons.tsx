import React, { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { supa } from '../lib/SupabaseClient';

interface VoteButtonsProps {
  targetTable: 'post_votes' | 'comment_votes';
  targetIdColumn: 'post_id' | 'comment_id';
  targetId: number;
  initialScore: number;
  initialUserVote: 1 | -1 | 0;
  isLoggedIn: boolean;
  onRequireAuth: () => void;
  orientation?: 'vertical' | 'horizontal';
}

/*
  Reusable upvote/downvote control.

  - One row per (target, user) is enforced by a primary key in Supabase,
    so clicking the same arrow twice removes the vote (toggle off),
    and clicking the opposite arrow flips it.
  - The displayed score updates optimistically in the UI; the real
    source of truth is the `score` column on feed_posts/post_comments,
    which is recalculated server-side by a Postgres trigger every time
    a row in post_votes/comment_votes changes. If the optimistic update
    and the trigger ever disagree, a page refresh will resync correctly.
*/

export default function VoteButtons({
  targetTable,
  targetIdColumn,
  targetId,
  initialScore,
  initialUserVote,
  isLoggedIn,
  onRequireAuth,
  orientation = 'vertical',
}: VoteButtonsProps) {
  const [score, setScore] = useState(initialScore);
  const [userVote, setUserVote] = useState<1 | -1 | 0>(initialUserVote);
  const [busy, setBusy] = useState(false);

  const castVote = async (direction: 1 | -1) => {
    if (!isLoggedIn) {
      onRequireAuth();
      return;
    }
    if (busy) return;
    setBusy(true);

    const { data: sessionData } = await supa.auth.getSession();
    const uid = sessionData.session?.user.id;
    if (!uid) {
      setBusy(false);
      onRequireAuth();
      return;
    }

    const nextVote: 1 | -1 | 0 = userVote === direction ? 0 : direction;
    const prevVote = userVote;
    const scoreDelta = nextVote - prevVote;

    // Optimistic UI update
    setUserVote(nextVote);
    setScore((s) => s + scoreDelta);

    try {
      if (nextVote === 0) {
        await supa.from(targetTable).delete().eq(targetIdColumn, targetId).eq('user_id', uid);
      } else if (prevVote === 0) {
        await supa.from(targetTable).insert({ [targetIdColumn]: targetId, user_id: uid, value: nextVote });
      } else {
        await supa.from(targetTable).update({ value: nextVote }).eq(targetIdColumn, targetId).eq('user_id', uid);
      }
    } catch {
      // Roll back optimistic update on failure
      setUserVote(prevVote);
      setScore((s) => s - scoreDelta);
    } finally {
      setBusy(false);
    }
  };

  const wrapperClasses =
    orientation === 'vertical'
      ? 'flex flex-col items-center gap-0.5'
      : 'flex flex-row items-center gap-1.5';

  return (
    <div className={wrapperClasses}>
      <button
        onClick={() => castVote(1)}
        disabled={busy}
        className={`p-1 rounded transition-colors ${
          userVote === 1 ? 'text-neonOrange' : 'text-gray-500 hover:text-neonOrange'
        }`}
        title="Upvote"
      >
        <ChevronUp size={18} strokeWidth={3} />
      </button>
      <span
        className={`text-xs font-orbitron font-extrabold tabular-nums ${
          userVote === 1 ? 'text-neonOrange' : userVote === -1 ? 'text-neonCyan' : 'text-gray-300'
        }`}
      >
        {score}
      </span>
      <button
        onClick={() => castVote(-1)}
        disabled={busy}
        className={`p-1 rounded transition-colors ${
          userVote === -1 ? 'text-neonCyan' : 'text-gray-500 hover:text-neonCyan'
        }`}
        title="Downvote"
      >
        <ChevronDown size={18} strokeWidth={3} />
      </button>
    </div>
  );
}
