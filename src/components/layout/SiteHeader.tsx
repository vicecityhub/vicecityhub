import React from 'react';
import { Map, Menu, User, Volume2, VolumeX, X } from 'lucide-react';
import { DesktopNav, MobileNavList } from '../NavGroups';

interface SiteHeaderProps {
  activePage: string;
  session: any;
  username: string;
  isPlaying: boolean;
  mobileMenuOpen: boolean;
  onToggleMobileMenu: () => void;
  onCloseMobileMenu: () => void;
  onToggleRadio: (e: React.MouseEvent) => void;
  onOpenAuth: (tab: 'login' | 'register') => void;
  onOpenDashboard: () => void;
  onLogout: () => void;
  onOpenSitemap: () => void;
}

/** Sticky top bar: logo, desktop nav, auth buttons, radio toggle and the mobile dropdown menu. */
export function SiteHeader(props: SiteHeaderProps) {
  const { activePage, session, username, isPlaying, mobileMenuOpen } = props;
  const { onToggleMobileMenu, onCloseMobileMenu, onToggleRadio, onOpenAuth, onOpenDashboard, onLogout, onOpenSitemap } = props;

  return (
    <nav className="sticky top-0 z-[500] bg-[#07070f]/90 backdrop-blur-xl border-b border-white/5 flex flex-wrap items-center justify-between px-6 lg:px-12 py-[17px] lg:py-3 shadow-2xl">
      <div className="gradient-line absolute left-0 right-0 bottom-0 pointer-events-none" />
      <a className="font-orbitron font-extrabold text-2xl tracking-widest bg-gradient-to-r from-neonPink to-neonCyan bg-clip-text text-transparent hover:scale-105 transition-transform" href="./index.html">
        VICE CITY HUB
      </a>

      {/* Desktop menu: five groups with dropdowns (data in src/lib/nav.json) */}
      <DesktopNav activePage={activePage} />

      {/* Music Player & Auth Controls */}
      <div className="flex items-center gap-4">
        {session ? (
          <div className="hidden md:flex items-center gap-3 z-10">
            <span className="text-neonCyan font-bold tracking-wider text-xs uppercase">
              <User size={12} className="inline mr-1" /> {username}
            </span>
            <button onClick={onOpenDashboard} className="btn-neon btn-neon-cyan !py-1.5 !px-4 !text-xs font-bold font-orbitron">
              Dashboard
            </button>
            <button onClick={onLogout} className="border border-white/10 hover:border-neonPink text-xs uppercase px-4 py-1.5 rounded transition-all">
              Logout
            </button>
          </div>
        ) : (
          <div className="hidden md:flex gap-3 z-10">
            <button onClick={() => onOpenAuth('login')} className="border border-white/10 hover:border-neonCyan text-xs uppercase px-4 py-1.5 rounded transition-all">
              Sign In
            </button>
            <button onClick={() => onOpenAuth('register')} className="btn-neon !py-1.5 !px-4 !text-xs font-bold font-orbitron">
              Join
            </button>
          </div>
        )}

        {/* Music Button */}
        <button
          onClick={onToggleRadio}
          className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all ${isPlaying ? 'text-neonPink border-neonPink shadow-[0_0_15px_rgba(255,0,255,0.4)] animate-pulse' : 'text-neonCyan border-neonCyan'
            }`}
          title="Toggle Leonida FM"
        >
          {isPlaying ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>

        {/* Hamburger Mobile Menu */}
        <button aria-label="Toggle menu" aria-expanded={mobileMenuOpen} onClick={onToggleMobileMenu} className="lg:hidden text-gray-200 hover:text-neonPink transition-colors">
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Dropdown Nav Menu */}
      {mobileMenuOpen && (
        <div className="absolute top-full left-0 w-full bg-[#050508] border-b border-white/10 flex flex-col items-center gap-6 py-8 font-bold tracking-widest text-sm uppercase lg:hidden animate-fade-in shadow-2xl z-[999] max-h-[calc(100vh-70px)] overflow-y-auto">
          <MobileNavList activePage={activePage} onNavigate={onCloseMobileMenu} />
          <div className="flex md:hidden flex-col items-center gap-4 mt-2">
            {session ? (
              <>
                <span className="text-neonCyan text-xs">{username}</span>
                <button onClick={() => { onCloseMobileMenu(); onOpenDashboard(); }} className="btn-neon btn-neon-cyan !py-1.5 !px-5 !text-xs font-orbitron">Dashboard</button>
                <button onClick={() => { onCloseMobileMenu(); onLogout(); }} className="text-xs uppercase border border-white/10 px-5 py-1.5 rounded">Logout</button>
              </>
            ) : (
              <>
                <button onClick={() => { onCloseMobileMenu(); onOpenAuth('login'); }} className="text-xs uppercase border border-white/10 px-5 py-1.5 rounded">Sign In</button>
                <button onClick={() => { onCloseMobileMenu(); onOpenAuth('register'); }} className="btn-neon !py-1.5 !px-5 !text-xs font-orbitron">Join</button>
              </>
            )}
          </div>
          <button onClick={() => { onCloseMobileMenu(); onOpenSitemap(); }} className="text-xs text-neonOrange tracking-widest uppercase flex items-center gap-1.5 mt-2">
            <Map size={14} /> Full Sitemap
          </button>
        </div>
      )}
    </nav>
  );
}
