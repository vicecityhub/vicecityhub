import React, { useState } from 'react';
import { CornerDownRight, Pencil, Trash2 } from 'lucide-react';
import VoteButtons from './VoteButtons';
import LinkedText from './LinkedText';
import { supa } from '../lib/SupabaseClient';

export interface CommentNode {
  id: number;
  post_id: number;
  parent_comment_id: number | null;
  author_id: string;
  author_name?: string;
  author_avatar?: string | null;
  body: string;
  score: number;
  created_at: string;
  is_deleted: boolean;
  user_vote?: 1 | -1 | 0;
  children?: CommentNode[];
}

interface CommentThreadProps {
  comment: CommentNode;
  depth: number;
  isLoggedIn: boolean;
  currentUserId?: string | null;
  currentUserName: string;
  onRequireAuth: () => void;
  onReplyPosted: () => void;
}

const MAX_VISUAL_DEPTH = 6;

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function CommentThread({
  comment,
  depth,
  isLoggedIn,
  currentUserId,
  currentUserName,
  onRequireAuth,
  onReplyPosted,
}: CommentThreadProps) {
  const [replying, setReplying] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const indentPx = Math.min(depth, MAX_VISUAL_DEPTH) * 20;
  const isOwner = isLoggedIn && !!currentUserId && currentUserId === comment.author_id;

  const submitReply = async () => {
    if (!isLoggedIn) {
      onRequireAuth();
      return;
    }
    if (!replyBody.trim()) return;
    setSubmitting(true);

    const { data: sessionData } = await supa.auth.getSession();
    const uid = sessionData.session?.user.id;
    if (!uid) {
      setSubmitting(false);
      onRequireAuth();
      return;
    }

    const { error } = await supa.from('post_comments').insert({
      post_id: comment.post_id,
      parent_comment_id: comment.id,
      author_id: uid,
      body: replyBody.trim(),
    });

    setSubmitting(false);
    if (!error) {
      setReplyBody('');
      setReplying(false);
      onReplyPosted();
    }
  };

  const saveEdit = async () => {
    if (!editBody.trim()) return;
    setSavingEdit(true);
    const { error } = await supa
      .from('post_comments')
      .update({ body: editBody.trim() })
      .eq('id', comment.id);
    setSavingEdit(false);
    if (!error) {
      setEditing(false);
      onReplyPosted(); // re-uses the same "refresh the thread" callback
    }
  };

  const deleteComment = async () => {
    if (!window.confirm('Delete this comment? Replies underneath will stay visible.')) return;
    setDeleting(true);
    // Soft delete: keeps the row (and any child replies) intact, just
    // blanks the body and flips is_deleted, same pattern Reddit uses
    // for "[deleted]" comments with live replies underneath.
    const { error } = await supa
      .from('post_comments')
      .update({ body: '[deleted by author]', is_deleted: true })
      .eq('id', comment.id);
    setDeleting(false);
    if (!error) {
      onReplyPosted();
    }
  };

  return (
    <div style={{ marginLeft: indentPx }} className="mb-3">
      <div className="flex gap-3">
        <VoteButtons
          targetTable="comment_votes"
          targetIdColumn="comment_id"
          targetId={comment.id}
          initialScore={comment.score}
          initialUserVote={comment.user_vote || 0}
          isLoggedIn={isLoggedIn}
          onRequireAuth={onRequireAuth}
          orientation="horizontal"
        />
      </div>

      <div className="border-l-2 border-white/5 pl-4 mt-1.5">
        <div className="flex items-center gap-2 text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">
          {comment.author_avatar ? (
            <img src={comment.author_avatar} alt={comment.author_name || 'agent'} className="w-6 h-6 rounded-full object-cover border border-white/10 flex-shrink-0" />
          ) : (
            <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
              <span className="text-[8px] font-bold text-gray-400">{(comment.author_name || 'A').slice(0,1).toUpperCase()}</span>
            </div>
          )}
          <span className="text-neonCyan">{comment.author_name || 'agent'}</span>
          <span>•</span>
          <span>{timeAgo(comment.created_at)}</span>
        </div>

        {editing ? (
          <div className="flex flex-col gap-2 max-w-lg">
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              rows={3}
              maxLength={5000}
              className="w-full bg-[#050508] border border-white/10 focus:border-neonCyan outline-none rounded p-2.5 text-sm text-white"
            />
            <span className="text-[10px] text-gray-600 self-end">{editBody.length}/5000</span>
            <div className="flex gap-2">
              <button
                onClick={saveEdit}
                disabled={savingEdit || !editBody.trim()}
                className="border border-neonCyan/30 text-neonCyan px-4 py-1.5 rounded hover:bg-neonCyan hover:text-black font-orbitron text-xs disabled:opacity-40 transition-all"
              >
                {savingEdit ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setEditBody(comment.body);
                }}
                className="border border-white/15 text-gray-400 px-4 py-1.5 rounded hover:bg-white/5 font-orbitron text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : comment.is_deleted ? (
          <p className="text-xs text-gray-600 italic">[comment removed]</p>
        ) : (
          <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
            <LinkedText text={comment.body} />
          </p>
        )}

        {!editing && (
          <div className="flex items-center gap-3 mt-1.5">
            <button
              onClick={() => (isLoggedIn ? setReplying((r) => !r) : onRequireAuth())}
              className="text-[10px] text-gray-500 hover:text-neonCyan font-bold uppercase tracking-wider flex items-center gap-1 transition-colors"
            >
              <CornerDownRight size={11} /> Reply
            </button>

            {isOwner && !comment.is_deleted && (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="text-[10px] text-gray-500 hover:text-neonCyan font-bold uppercase tracking-wider flex items-center gap-1 transition-colors"
                >
                  <Pencil size={11} /> Edit
                </button>
                <button
                  onClick={deleteComment}
                  disabled={deleting}
                  className="text-[10px] text-gray-500 hover:text-neonPink font-bold uppercase tracking-wider flex items-center gap-1 transition-colors disabled:opacity-40"
                >
                  <Trash2 size={11} /> {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </>
            )}
          </div>
        )}

        {replying && (
          <div className="mt-2 flex flex-col gap-2 max-w-lg">
            <textarea
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              rows={3}
              maxLength={5000}
              placeholder={`Replying as ${currentUserName || 'you'}...`}
              className="w-full bg-[#050508] border border-white/10 focus:border-neonCyan outline-none rounded p-2.5 text-sm text-white"
            />
            <span className="text-[10px] text-gray-600 self-end">{replyBody.length}/5000</span>
            <div className="flex gap-2">
              <button
                onClick={submitReply}
                disabled={submitting || !replyBody.trim()}
                className="border border-neonCyan/30 text-neonCyan px-4 py-1.5 rounded hover:bg-neonCyan hover:text-black font-orbitron text-xs disabled:opacity-40 transition-all"
              >
                {submitting ? 'Posting...' : 'Post Reply'}
              </button>
              <button
                onClick={() => setReplying(false)}
                className="border border-white/15 text-gray-400 px-4 py-1.5 rounded hover:bg-white/5 font-orbitron text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {comment.children && comment.children.length > 0 && (
          <div className="mt-3">
            {comment.children.map((child) => (
              <CommentThread
                key={child.id}
                comment={child}
                depth={depth + 1}
                isLoggedIn={isLoggedIn}
                currentUserId={currentUserId}
                currentUserName={currentUserName}
                onRequireAuth={onRequireAuth}
                onReplyPosted={onReplyPosted}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
