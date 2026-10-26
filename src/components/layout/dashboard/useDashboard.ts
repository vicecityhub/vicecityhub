import { useEffect, useState } from 'react';
import type { ShowToast } from '../useToasts';
import { usePlayerProfile } from './usePlayerProfile';
import { usePostManager } from './usePostManager';
import { useSubmitForms } from './useSubmitForms';

export type DashTab = 'overview' | 'myposts' | 'myprofile' | 'news' | 'forum' | 'stream' | 'podcast' | 'domain';

interface Args {
  session: any;
  username: string;
  showToast: ShowToast;
  openLogin: () => void;
  /** The user's posts. The state is owned by Layout so the auth session can clear it on sign-out. */
  userPosts: any[];
  setUserPosts: (posts: any[]) => void;
}

/** The wide user dashboard: open/tab state plus posts, submit forms and player profile. */
export function useDashboard({ session, username, showToast, openLogin, userPosts, setUserPosts }: Args) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<DashTab>('overview');

  const posts = usePostManager({ session, showToast, setUserPosts });
  const submits = useSubmitForms({ session, username, showToast, refresh: posts.refresh, openLogin, onPublished: () => setTab('overview') });
  const player = usePlayerProfile({ session, username, showToast });

  useEffect(() => {
    if (open) {
      posts.refresh();
      player.refresh();
    }
  }, [open, session]);

  /** Open the dashboard, optionally on a given tab (no tab keeps the current one). */
  const openDashboard = (nextTab?: DashTab) => {
    setOpen(true);
    if (nextTab) setTab(nextTab);
  };

  return { open, tab, setTab, openDashboard, close: () => setOpen(false), userPosts, posts, submits, player };
}

export type DashboardController = ReturnType<typeof useDashboard>;
