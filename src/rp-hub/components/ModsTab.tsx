import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://lpglkglhjdqnktybksth.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwZ2xrZ2xoamRxbmt0eWJrc3RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMTYzMjUsImV4cCI6MjA5MTU5MjMyNX0.fMZo0fjEfPSf20w-rRQh25zPj7xPVOpU6lO2lon3EEk'
);
import { IMod, ModCategory } from '../types';
import { MOCK_MODS } from '../data/mockData';

const CAT_CONFIG: Record<ModCategory, { label: string; icon: string; color: string }> = {
  SCRIPTS: { label: 'Scripts', icon: '⚙️', color: '#00f5ff' },
  VEHICLES: { label: 'Vehicles', icon: '🚗', color: '#ff9900' },
  GRAPHICS: { label: 'Graphics', icon: '🎨', color: '#b44fff' },
  INTERIORS: { label: 'Interiors', icon: '🏠', color: '#44ff88' },
  WEAPONS: { label: 'Weapons', icon: '🔫', color: '#ff2d78' },
  MAPS: { label: 'Maps', icon: '🗺️', color: '#ffd700' },
};

const ALL_CATEGORIES: ModCategory[] = ['SCRIPTS', 'VEHICLES', 'GRAPHICS', 'INTERIORS', 'WEAPONS', 'MAPS'];

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="w-full h-1.5 bg-white/10 rounded overflow-hidden">
      <div
        className="h-full rounded transition-all duration-500"
        style={{ width: `${pct}%`, background: color, boxShadow: `0 0 6px ${color}88` }}
      />
    </div>
  );
}

function ModCard({ mod, onVote, userId }: { mod: IMod; onVote: (id: string) => void; userId: string | null }) {
  const cat = CAT_CONFIG[mod.category];
  const voted = userId ? localStorage.getItem(`voted_mod_${mod.id}_${userId}`) === 'true' : false;

  return (
    <div className="glass-card rounded-xl p-4 server-card-hover flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{cat.icon}</span>
          <div>
            <h3 className="text-sm font-black text-white leading-tight">{mod.title}</h3>
            <p className="text-[10px] text-white/40">by {mod.author}</p>
          </div>
        </div>
        <span
          className="text-[8px] font-black px-2 py-0.5 rounded border tracking-wider flex-shrink-0"
          style={{ color: cat.color, borderColor: `${cat.color}55` }}
        >
          {cat.label.toUpperCase()}
        </span>
      </div>

      <p className="text-xs text-white/55 leading-relaxed mb-3 flex-1">{mod.description}</p>

      {/* Tags */}
      <div className="flex flex-wrap gap-1 mb-3">
        {mod.tags.map(tag => (
          <span key={tag} className="text-[8px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/35">
            {tag}
          </span>
        ))}
      </div>

      {/* Progress */}
      <div className="mb-3">
        <div className="flex justify-between text-[9px] mb-1">
          <span className="text-white/35 font-bold">GTA 6 COMPATIBILITY</span>
          <span className="font-black" style={{ color: cat.color }}>{mod.progress_pct}%</span>
        </div>
        <ProgressBar pct={mod.progress_pct} color={cat.color} />
      </div>

      {/* Vote */}
      <button
        onClick={() => onVote(mod.id)}
        disabled={voted}
        className={`flex items-center justify-center gap-2 w-full py-2 rounded text-[10px] font-black tracking-wider transition-all
          ${voted
            ? 'bg-[rgba(255,45,120,0.15)] border border-[var(--neon-pink)]/50 text-[var(--neon-pink)]/70 cursor-not-allowed'
            : !userId
            ? 'border border-white/20 text-white/40 hover:border-neonCyan hover:text-neonCyan cursor-pointer'
            : 'btn-neon-pink cursor-pointer'}`}
      >
        <span>{voted ? '✓' : '▲'}</span>
        <span>{!userId ? 'SIGN IN TO VOTE' : (voted ? 'VOTED' : `${mod.votes} UPVOTES`)}</span>
      </button>
    </div>
  );
}

export default function ModsTab() {
  const [mods, setMods] = useState<IMod[]>(MOCK_MODS);
  const [categoryFilter, setCategoryFilter] = useState<ModCategory | 'ALL'>('ALL');
  const [sort, setSort] = useState<'votes' | 'progress' | 'newest'>('votes');
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
      setAuthChecked(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const filtered = useMemo(() => {
    let list = categoryFilter === 'ALL' ? mods : mods.filter(m => m.category === categoryFilter);
    if (sort === 'votes') list = [...list].sort((a, b) => b.votes - a.votes);
    if (sort === 'progress') list = [...list].sort((a, b) => b.progress_pct - a.progress_pct);
    if (sort === 'newest') list = [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return list;
  }, [mods, categoryFilter, sort]);

  const handleVote = useCallback(async (id: string) => {
    if (!userId) {
      // Открываем auth modal через кастомный event (как в Layout.tsx)
      window.dispatchEvent(new CustomEvent('vch-open-modal', { detail: { id: 'auth', tab: 'login' } }));
      return;
    }
    if (localStorage.getItem(`voted_mod_${id}_${userId}`) === 'true') return;
    // Пишем голос в Supabase
    const { error } = await supabase.from('mod_votes').insert({ mod_id: id, user_id: userId }).select();
    if (error && error.code !== '23505') return; // 23505 = unique violation (уже голосовал)
    localStorage.setItem(`voted_mod_${id}_${userId}`, 'true');
    setMods(prev => prev.map(m => m.id === id ? { ...m, votes: m.votes + 1 } : m));
  }, [userId]);

  const topMod = useMemo(() => [...mods].sort((a, b) => b.votes - a.votes)[0], [mods]);

  return (
    <div className="slide-in">
      <div className="mb-6">
        <h2 className="text-2xl font-black tracking-widest neon-text-purple mb-1">◈ MOD VAULT</h2>
        <p className="text-white/40 text-xs tracking-wider">
          GTA 6 ADAPTATION STATUS — COMMUNITY UPVOTE SYSTEM ACTIVE
        </p>
      </div>

      {/* Top Mod Banner */}
      {topMod && (
        <div className="glass-card-pink rounded-xl p-4 mb-6 border border-[var(--neon-pink)]/30">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-yellow-400">👑</span>
            <span className="text-[9px] font-black tracking-widest text-yellow-400">MOST WANTED MOD</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-white">{topMod.title}</h3>
              <p className="text-[10px] text-white/40">{topMod.votes.toLocaleString()} upvotes · {topMod.progress_pct}% GTA6 ready</p>
            </div>
            <span className="text-3xl">{CAT_CONFIG[topMod.category].icon}</span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="glass-card rounded-lg p-4 mb-5 flex flex-col sm:flex-row gap-4">
        <div className="flex flex-wrap gap-1.5 flex-1">
          <button
            onClick={() => setCategoryFilter('ALL')}
            className={`text-[9px] px-3 py-1 rounded font-black tracking-wider border transition-all
              ${categoryFilter === 'ALL'
                ? 'bg-[rgba(255,45,120,0.2)] border-[var(--neon-pink)] text-[var(--neon-pink)]'
                : 'border-white/15 text-white/35 hover:border-white/30'}`}
          >
            ALL
          </button>
          {ALL_CATEGORIES.map(cat => {
            const c = CAT_CONFIG[cat];
            return (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`text-[9px] px-3 py-1 rounded font-black tracking-wider border transition-all
                  ${categoryFilter === cat
                    ? 'border text-white'
                    : 'border-white/15 text-white/35 hover:border-white/30'}`}
                style={categoryFilter === cat ? { borderColor: c.color, background: `${c.color}22`, color: c.color } : {}}
              >
                {c.icon} {c.label}
              </button>
            );
          })}
        </div>
        <div className="flex gap-1.5">
          {[
            { id: 'votes', label: '▲ TOP' },
            { id: 'progress', label: '⚡ PROGRESS' },
            { id: 'newest', label: '🕑 NEWEST' },
          ].map(s => (
            <button
              key={s.id}
              onClick={() => setSort(s.id as typeof sort)}
              className={`text-[9px] px-3 py-1 rounded font-black tracking-wider border transition-all
                ${sort === s.id
                  ? 'bg-[rgba(180,79,255,0.2)] border-[var(--neon-purple)] text-[var(--neon-purple)]'
                  : 'border-white/15 text-white/35 hover:border-white/30'}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(mod => <ModCard key={mod.id} mod={mod} onVote={handleVote} userId={userId} />)}
      </div>

      <p className="text-center text-[10px] text-white/20 mt-8 font-bold tracking-wider">
        VOTES ARE COMMUNITY SIGNALS — NOT OFFICIAL ROCKSTAR METRICS.<br />
        <span className="text-[9px]">Obviously. Don't @ us.</span>
      </p>
    </div>
  );
}
