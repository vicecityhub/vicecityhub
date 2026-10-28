import React, { useEffect } from 'react';
import { trackPageView } from '../lib/analytics';
import { BottomTabs } from './NavGroups';
import { AuthModal } from './layout/AuthModal';
import { DashboardModal } from './layout/dashboard/DashboardModal';
import { KofiModal } from './layout/KofiModal';
import { SiteFooter } from './layout/SiteFooter';
import { SiteHeader } from './layout/SiteHeader';
import { SitemapModal } from './layout/SitemapModal';
import { Toasts } from './layout/Toasts';
import { useAccountArea } from './layout/useAccountArea';
import { useModalEvents } from './layout/useModalEvents';
import { useRadio } from './layout/useRadio';
import { useShellModals } from './layout/useShellModals';
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
  const shell = useShellModals();
  const { toasts, showToast } = useToasts();
  const { isPlaying, toggleRadio } = useRadio();
  const { auth, session, username, dashboard, logout, openSettings } = useAccountArea(showToast);

  useModalEvents({
    auth: auth.openModal,
    sitemap: shell.openSitemap,
    dashboard: () => dashboard.openDashboard(),
  });

  useEffect(() => { trackPageView(); }, []);

  // "User Settings" tile of the sitemap
  const openSettingsFromSitemap = () => {
    shell.closeSitemap();
    openSettings();
  };

  return (
    <div className="min-h-screen vibe-bg scanlines relative flex flex-col font-rajdhani text-gray-200">
      <Toasts toasts={toasts} />

      <SiteHeader
        activePage={activePage}
        session={session}
        username={username}
        isPlaying={isPlaying}
        mobileMenuOpen={shell.mobileMenuOpen}
        onToggleMobileMenu={shell.toggleMobileMenu}
        onCloseMobileMenu={shell.closeMobileMenu}
        onToggleRadio={toggleRadio}
        onOpenAuth={auth.openModal}
        onOpenDashboard={() => dashboard.openDashboard('overview')}
        onLogout={logout}
        onOpenSitemap={shell.openSitemap}
      />

      {/* Main Content Area */}
      <main className="flex-grow min-h-0">
        {children}
      </main>

      <BottomTabs activePage={activePage} />

      <SiteFooter onOpenKofi={shell.openKofi} />

      {shell.kofiOpen && <KofiModal onClose={shell.closeKofi} />}
      {auth.open && <AuthModal auth={auth} />}
      {shell.sitemapOpen && <SitemapModal onClose={shell.closeSitemap} onOpenSettings={openSettingsFromSitemap} />}
      {dashboard.open && <DashboardModal dashboard={dashboard} username={username} />}
    </div>
  );
}
