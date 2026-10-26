import React from 'react';
import { MoreVertical, Pencil, Trash2 } from 'lucide-react';
import type { FeedPost } from '../PostCard';

/** Size and colour differences between the grid and the list card. */
export interface OwnerMenuStyle {
  wrapper: string;
  button: string;
  menu: string;
  triggerIcon: number;
  itemIcon: number;
}

export const GRID_MENU_STYLE: OwnerMenuStyle = {
  wrapper: 'absolute top-2 right-2',
  button: 'text-gray-400 hover:text-white p-1 rounded bg-black/40 transition-colors',
  menu: 'absolute right-0 mt-1 w-32 bg-[#0a0a0f] border border-white/10 rounded shadow-xl z-10 overflow-hidden',
  triggerIcon: 14,
  itemIcon: 11,
};

export const LIST_MENU_STYLE: OwnerMenuStyle = {
  wrapper: 'absolute top-3 right-3',
  button: 'text-gray-500 hover:text-white p-1 rounded transition-colors',
  menu: 'absolute right-0 mt-1 w-36 bg-[#0a0a0f] border border-white/10 rounded shadow-xl z-10 overflow-hidden',
  triggerIcon: 16,
  itemIcon: 12,
};

interface Props {
  post: FeedPost;
  style: OwnerMenuStyle;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onEdit?: (post: FeedPost) => void;
  onDelete?: (id: number) => void;
}

/** ⋮ button with an Edit / Delete dropdown. Clicks never reach the card behind it. */
export function OwnerMenu({ post, style, open, setOpen, onEdit, onDelete }: Props) {
  return (
    <div className={style.wrapper} onClick={(e) => e.stopPropagation()}>
      <button onClick={() => setOpen((m) => !m)} className={style.button}>
        <MoreVertical size={style.triggerIcon} />
      </button>
      {open && (
        <div className={style.menu}>
          {onEdit && (
            <button
              onClick={() => {
                setOpen(false);
                onEdit(post);
              }}
              className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/5 flex items-center gap-2"
            >
              <Pencil size={style.itemIcon} /> Edit
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => {
                setOpen(false);
                onDelete(post.id);
              }}
              className="w-full text-left px-3 py-2 text-xs text-neonPink hover:bg-white/5 flex items-center gap-2"
            >
              <Trash2 size={style.itemIcon} /> Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
