import { useState } from 'react';

/** Open/closed state of the three shell-level overlays: the mobile menu, the sitemap and the Ko-fi popup. */
export function useShellModals() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sitemapOpen, setSitemapOpen] = useState(false);
  const [kofiOpen, setKofiOpen] = useState(false);

  return {
    mobileMenuOpen,
    toggleMobileMenu: () => setMobileMenuOpen(open => !open),
    closeMobileMenu: () => setMobileMenuOpen(false),
    sitemapOpen,
    openSitemap: () => setSitemapOpen(true),
    closeSitemap: () => setSitemapOpen(false),
    kofiOpen,
    openKofi: () => setKofiOpen(true),
    closeKofi: () => setKofiOpen(false),
  };
}
