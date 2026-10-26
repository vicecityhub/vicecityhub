import React, { useEffect, useState } from 'react';
import { supa } from '../lib/SupabaseClient';
import { trackPageView } from '../lib/analytics';
import { BottomTabs } from './NavGroups';
import { AuthModal } from './layout/AuthModal';
import { DashboardModal } from './layout/dashboard/DashboardModal';
import { useDashboard } from './layout/dashboard/useDashboard';
import { KofiModal } from './layout/KofiModal';
import { SiteFooter } from './layout/SiteFooter';
import { SiteHeader } from './layout/SiteHeader';
import { SitemapModal } from './layout/SitemapModal';
import { Toasts } from './layout/Toasts';
import { useAuthModal } from './layout/useAuthModal';
import { useAuthSession } from './layout/useAuthSession';
import { useModalEvents } from './layout/useModalEvents';
import { useRadio } from './layout/useRadio';
import { useToasts } from './layout/useToasts';

interface LayoutProps {
  children: React.ReactNode;
  activePage: 'home' | 'news' | 'market' | 'realestate' | 'document' | 'community' | 'profile' | 'rp' | 'agents' | 'highlights';
}

/**
 * Page shell shared by every HTML entry: header, footer, radio, toasts and the account modals.
 * Each concern lives in src/components/layout/ (hooks for state and Supabase calls, components for markup).
 */
export default function Layout({ children, activePage }: LayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sitemapOpen, setSitemapOpen] = useState(false);
  const [kofiOpen, setKofiOpen] = useState(false);
  const [userPosts, setUserPosts] = useState<any[]>([]);

  const { toasts, showToast } = useToasts();
  const { isPlaying, toggleRadio } = useRadio();
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

  useModalEvents({
    auth: auth.openModal,
    sitemap: () => setSitemapOpen(true),
    dashboard: () => dashboard.openDashboard(),
  });

  useEffect(() => { trackPageView(); }, []);

  const handleLogout = async () => {
    await supa.auth.signOut();
    showToast('Signed out.', 'info');
    dashboard.close();
  };

  // "User Settings" tile of the sitemap: dashboard for members, login for guests
  const openSettingsFromSitemap = () => {
    setSitemapOpen(false);
    if (session) dashboard.openDashboard();
    else auth.openModal();
  };

  return (
    <div className="min-h-screen vibe-bg scanlines relative flex flex-col font-rajdhani text-gray-200">
      <Toasts toasts={toasts} />

      <SiteHeader
        activePage={activePage}
        session={session}
        username={username}
        isPlaying={isPlaying}
        mobileMenuOpen={mobileMenuOpen}
        onToggleMobileMenu={() => setMobileMenuOpen(open => !open)}
        onCloseMobileMenu={() => setMobileMenuOpen(false)}
        onToggleRadio={toggleRadio}
        onOpenAuth={auth.openModal}
        onOpenDashboard={() => dashboard.openDashboard('overview')}
        onLogout={handleLogout}
        onOpenSitemap={() => setSitemapOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-grow min-h-0">
        {children}
      </main>

      <BottomTabs activePage={activePage} />

      <SiteFooter onOpenKofi={() => setKofiOpen(true)} />

      {kofiOpen && <KofiModal onClose={() => setKofiOpen(false)} />}
      {auth.open && <AuthModal auth={auth} />}
      {sitemapOpen && <SitemapModal onClose={() => setSitemapOpen(false)} onOpenSettings={openSettingsFromSitemap} />}
      {dashboard.open && <DashboardModal dashboard={dashboard} username={username} />}
    </div>
  );
}
