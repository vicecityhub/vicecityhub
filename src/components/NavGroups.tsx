import React, { useEffect, useState } from 'react';
import nav from '../lib/nav.json';

type Item = { href: string; label: string; key: string; badge?: string };
type Group = { key: string; label: string; items: Item[] };

const groups = nav.groups as Group[];
const bottom = nav.bottom as { href: string; label: string; group: string }[];

const groupActive = (g: Group, page: string) => g.items.some((i) => i.key === page);
const activeGroupKey = (page: string) => groups.find((g) => groupActive(g, page))?.key ?? '';

const Badge = ({ text }: { text: string }) => (
  <span className="text-[8px] px-1.5 py-0.5 rounded border border-neonPink/60 bg-neonPink/10 text-neonPink font-orbitron font-black mr-1.5">{text}</span>
);

/** One-row desktop menu: five groups, dropdowns open on hover, keyboard focus or click. */
export function DesktopNav({ activePage }: { activePage: string }) {
  const [openKey, setOpenKey] = useState<string | null>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement)?.closest?.('[data-navgroup]')) setOpenKey(null);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  return (
    <div className="hidden lg:flex flex-1 items-center justify-center gap-9 font-bold tracking-widest text-xs uppercase">
      {groups.map((g) => {
        const active = groupActive(g, activePage);
        const tone = active ? 'text-neonCyan neon-text-cyan' : 'text-gray-400';
        if (g.items.length === 1) {
          const it = g.items[0];
          return (
            <a key={g.key} href={`./${it.href}`} className={`py-2 hover:text-neonCyan transition-all ${tone}`} aria-current={active ? 'page' : undefined}>
              {g.label}
            </a>
          );
        }
        const open = openKey === g.key;
        return (
          <div key={g.key} data-navgroup className="relative group">
            <button
              type="button"
              aria-haspopup="true"
              aria-expanded={open}
              onClick={() => setOpenKey(open ? null : g.key)}
              className={`py-2 uppercase tracking-widest font-bold hover:text-neonCyan transition-all ${tone}`}
            >
              {g.label} <span aria-hidden className="text-[9px] opacity-70">▾</span>
            </button>
            <div className={`absolute left-1/2 -translate-x-1/2 top-full pt-3 z-[700] group-hover:block group-focus-within:block ${open ? 'block' : 'hidden'}`}>
              <div className="glass-card min-w-[210px] py-2 border border-neonPink/25 shadow-2xl flex flex-col">
                {g.items.map((it) => (
                  <a
                    key={it.key}
                    href={`./${it.href}`}
                    aria-current={it.key === activePage ? 'page' : undefined}
                    className={`px-5 py-2.5 flex items-center hover:bg-white/5 hover:text-neonCyan transition-all ${it.key === activePage ? 'text-neonCyan neon-text-cyan' : 'text-gray-300'}`}
                  >
                    {it.badge && <Badge text={it.badge} />}
                    {it.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Phone hamburger content: the same groups, as headed lists. */
export function MobileNavList({ activePage, onNavigate }: { activePage: string; onNavigate: () => void }) {
  return (
    <div className="w-full max-w-[420px] px-8 grid grid-cols-2 gap-x-6 gap-y-7 text-left">
      {groups.map((g) => (
        <div key={g.key} className={g.items.length === 1 ? 'col-span-1' : ''}>
          <div className="font-orbitron text-[10px] tracking-[0.25em] text-neonPink mb-2">{g.label}</div>
          <div className="flex flex-col gap-2.5">
            {g.items.map((it) => (
              <a
                key={it.key}
                href={`./${it.href}`}
                onClick={onNavigate}
                className={`flex items-center hover:text-neonCyan transition-all ${it.key === activePage ? 'text-neonCyan neon-text-cyan' : 'text-gray-300'}`}
              >
                {it.badge && <Badge text={it.badge} />}
                {it.label}
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Fixed bottom tab bar, phones and small tablets only. */
export function BottomTabs({ activePage }: { activePage: string }) {
  const current = activeGroupKey(activePage);
  return (
    <nav
      aria-label="Quick navigation"
      className="lg:hidden fixed bottom-0 inset-x-0 z-[600] grid grid-cols-5 bg-[#07070f]/95 backdrop-blur-xl border-t border-neonPink/30"
    >
      {bottom.map((b) => (
        <a
          key={b.group}
          href={`./${b.href}`}
          aria-current={current === b.group ? 'page' : undefined}
          className={`py-3.5 text-center font-orbitron font-bold text-[10px] tracking-[0.12em] uppercase transition-all ${current === b.group ? 'text-neonCyan neon-text-cyan' : 'text-gray-500'}`}
        >
          {b.label}
        </a>
      ))}
    </nav>
  );
}

/** Compact footer sitemap: five short columns plus a link to the full map. */
export function FooterNav() {
  return (
    <div className="mt-6 w-full">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-x-8 gap-y-6 text-left max-w-[760px] mx-auto">
        {groups.map((g) => (
          <div key={g.key}>
            <div className="font-orbitron text-[10px] tracking-[0.25em] text-neonPink mb-2">{g.label}</div>
            <div className="flex flex-col gap-1.5">
              {g.items.map((it) => (
                <a key={it.key} href={`./${it.href}`} className="text-[11px] text-gray-500 hover:text-neonCyan transition-colors uppercase tracking-wider font-bold">
                  {it.label}
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
      <a href="./map/" className="inline-block mt-5 text-[10px] text-neonOrange hover:text-neonCyan tracking-widest uppercase font-bold">All pages &rarr;</a>
    </div>
  );
}
