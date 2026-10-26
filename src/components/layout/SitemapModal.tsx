import React from 'react';
import { X } from 'lucide-react';

interface SitemapLink { href: string; icon: string; label: string }

const SITEMAP_LINKS: SitemapLink[] = [
  { href: './index.html', icon: '🎬', label: 'Home & Media' },
  { href: './news.html', icon: '📡', label: 'The Wire News' },
  { href: './market.html', icon: '💰', label: 'Web3 Market' },
  { href: './realestate.html', icon: '🏢', label: 'Dynasty 8 ROI' },
  { href: './document.html', icon: '📁', label: 'Leonida Database' },
  { href: './agents.html', icon: '🤖', label: 'Agent Gateway' },
  { href: './community.html', icon: '🏘️', label: 'Community' },
];

const TILE = 'glass-card p-6 text-center hover:border-neonCyan flex flex-col items-center gap-3';

/** Full-site navigation panel. `onOpenSettings` opens the dashboard (or the login modal when signed out). */
export function SitemapModal({ onClose, onOpenSettings }: { onClose: () => void; onOpenSettings: () => void }) {
  return (
    <div className="fixed inset-0 z-[1000] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass-card max-w-2xl w-full p-8 relative border border-neonCyan shadow-[0_0_40px_rgba(0,255,255,0.2)]">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-neonCyan transition-colors">
          <X size={20} />
        </button>
        <div className="font-orbitron font-extrabold text-3xl text-neonCyan neon-text-cyan mb-1 tracking-widest uppercase">SITE MAP</div>
        <div className="text-[10px] text-gray-500 tracking-widest uppercase mb-8 font-bold">Direct Navigation Panel</div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {SITEMAP_LINKS.map(l => (
            <a key={l.href} href={l.href} className={TILE}>
              <span className="text-3xl">{l.icon}</span>
              <span className="text-xs uppercase font-orbitron tracking-widest text-gray-300">{l.label}</span>
            </a>
          ))}
          <a href="./rp.html" className="glass-card p-6 text-center hover:border-neonPink flex flex-col items-center gap-3 relative border border-neonPink/20">
            <span className="absolute -top-2 -right-2 text-[8px] px-1.5 py-0.5 rounded border border-neonPink/70 bg-neonPink/15 text-neonPink font-orbitron font-black">NEW</span>
            <span className="text-3xl">🎮</span>
            <span className="text-xs uppercase font-orbitron tracking-widest text-neonPink">RP Hub</span>
          </a>
          <div onClick={onOpenSettings} className={`${TILE} cursor-pointer`}>
            <span className="text-3xl">⚙️</span>
            <span className="text-xs uppercase font-orbitron tracking-widest text-gray-300">User Settings</span>
          </div>
        </div>
      </div>
    </div>
  );
}
