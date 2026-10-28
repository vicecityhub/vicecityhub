import { useState } from 'react';
import { supa } from '../../lib/SupabaseClient';
import { useDashboard } from './dashboard/useDashboard';
import { useAuthModal } from './useAuthModal';
import { useAuthSession } from './useAuthSession';
import type { ShowToast } from './useToasts';

/** Everything about the signed-in visitor: login modal, Supabase session, dashboard and the "my posts" list they share. */
export function useAccountArea(showToast: ShowToast) {
  const [userPosts, setUserPosts] = useState<any[]>([]);

  const auth = useAuthModal(showToast);
  const { session, username } = useAuthSession({
    onSignedOut: () => setUserPosts([]),
    onPasswordRecovery: auth.openPasswordReset,
  });
  const dashboard = useDashboard({
    session,
    username,
    showToast,
    openLogin: () => auth.openModal('login'),
    userPosts,
    setUserPosts,
  });

  const logout = async () => {
    await supa.auth.signOut();
    showToast('Signed out.', 'info');
    dashboard.close();
  };

  /** Dashboard for members, login for guests. */
  const openSettings = () => {
    if (session) dashboard.openDashboard();
    else auth.openModal();
  };

  return { auth, session, username, dashboard, logout, openSettings };
}
