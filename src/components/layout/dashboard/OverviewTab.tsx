import React from 'react';
import { TAB_TITLE_CLASS } from './fields';

interface Stat {
  label: string;
  card: string;
  value: string;
  count: (posts: any[]) => number;
}

const countType = (type: string) => (posts: any[]) => posts.filter(p => p.type === type).length;

const STATS: Stat[] = [
  { label: 'Forum Items', card: 'border-neonCyan/30', value: 'text-neonCyan neon-text-cyan', count: countType('forum') },
  { label: 'Listed Domains', card: 'border-neonOrange/30', value: 'text-neonOrange', count: countType('domain') },
  { label: 'Streams Submitted', card: 'border-neonPink/30', value: 'text-neonPink neon-text-pink', count: countType('stream') },
  { label: 'Total Activity', card: 'border-white/10', value: 'text-white', count: posts => posts.length },
];

export function OverviewTab({ userPosts }: { userPosts: any[] }) {
  return (
    <div className="flex flex-col gap-6">
      <div className={TAB_TITLE_CLASS}>Agent Dashboard Overview</div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {STATS.map(s => (
          <div key={s.label} className={`glass-card p-6 ${s.card} flex flex-col justify-center`}>
            <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">{s.label}</span>
            <span className={`text-3xl font-orbitron font-extrabold ${s.value} mt-2`}>{s.count(userPosts)}</span>
          </div>
        ))}
      </div>
      <div className="glass-card p-6 border-white/5 text-sm text-gray-400 font-bold max-w-[650px] leading-relaxed">
        Use the dashboard tabs on the left navigation panel to write, edit, and delete forum guides, list Web3 domains for crypto sale, or upload streamers/podcasts. All content is saved directly to Supabase and synced in real-time across Vice City Hub!
      </div>
    </div>
  );
}
