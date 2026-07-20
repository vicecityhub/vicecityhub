import React, { useState, useEffect, useCallback } from 'react';
import { supa } from '../../lib/SupabaseClient';

// ── TYPES ──────────────────────────────────────────────────────────────────
type FactionType = 'GANG' | 'MC' | 'CARTEL' | 'LSPD' | 'EMS' | 'GOV' | 'CIVILIAN' | 'LEGAL_BIZ';
type PostType = 'LOOKING_FOR_SERVER' | 'LOOKING_FOR_PLAYERS' | 'SERVER_PROMO' | 'DEV_OFFER' | 'GENERAL';

interface FactionSlot {
  id: string; server_name: string; faction_name: string;
  faction_type: FactionType; slots_total: number; slots_filled: number;
  requirements: string[]; description: string; discord_url?: string;
  is_available: boolean; is_lore_friendly: boolean; sort_order: number;
}
interface CommunityPost {
  id: string; post_type: PostType; title: string; body: string;
  tags: string[]; contact_discord?: string; contact_url?: string;
  server_name?: string; faction_pref?: string; is_pinned: boolean;
  upvotes: number; created_at: string;
}
interface MarketplaceItem {
  id: string; seller_contact: string; title: string; description: string;
  price_eur: number; price_label: string; framework: string;
  discord_members: number; player_slots: number; includes: string[];
  is_wl: boolean; status: string; created_at: string;
}
interface VerifiedDev {
  id: string; name: string; specialties: string[]; frameworks: string[];
  rate_label: string; bio: string; discord_handle?: string;
  badge_level: 'STANDARD' | 'VERIFIED' | 'ELITE'; is_available: boolean;
  completed_projects: number;
}

// ── CONSTANTS ──────────────────────────────────────────────────────────────
const FACTION_CONFIG: Record<FactionType, { icon: string; color: string; label: string }> = {
  GANG:      { icon: '🔫', color: '#FF2D78', label: 'Gang' },
  MC:        { icon: '🏍️', color: '#FF6B35', label: 'MC' },
  CARTEL:    { icon: '💊', color: '#b44fff', label: 'Cartel' },
  LSPD:      { icon: '🚔', color: '#4488ff', label: 'LSPD' },
  EMS:       { icon: '🚑', color: '#00FFFF', label: 'EMS' },
  GOV:       { icon: '🏛️', color: '#FFE135', label: 'Government' },
  CIVILIAN:  { icon: '🧑', color: '#88cc88', label: 'Civilian' },
  LEGAL_BIZ: { icon: '🏢', color: '#ffd700', label: 'Business' },
};

const POST_CONFIG: Record<PostType, { label: string; color: string; icon: string }> = {
  LOOKING_FOR_SERVER:  { label: 'LFG', icon: '🔍', color: '#00FFFF' },
  LOOKING_FOR_PLAYERS: { label: 'LFP', icon: '📢', color: '#FF2D78' },
  SERVER_PROMO:        { label: 'PROMO', icon: '🏪', color: '#b44fff' },
  DEV_OFFER:           { label: 'DEV', icon: '⚙️', color: '#FFE135' },
  GENERAL:             { label: 'INTEL', icon: '📋', color: '#88cc88' },
};

// ── SUB-COMPONENTS ─────────────────────────────────────────────────────────

function SectionHeader({ icon, title, subtitle, color }: { icon: string; title: string; subtitle: string; color: string }) {
  return (
    <div className="mb-5">
      <h2 className="font-orbitron font-black text-2xl tracking-widest flex items-center gap-2 mb-1"
        style={{ color, textShadow: `0 0 12px ${color}88` }}>
        <span>{icon}</span> {title}
      </h2>
      <p className="text-white/35 text-xs tracking-wider font-bold uppercase">{subtitle}</p>
    </div>
  );
}

// ── FACTION SLOT CARD ──────────────────────────────────────────────────────
function FactionSlotCard({ slot }: { slot: FactionSlot }) {
  const cfg = FACTION_CONFIG[slot.faction_type];
  const pct = slot.slots_total > 0 ? (slot.slots_filled / slot.slots_total) * 100 : 0;

  return (
    <div className={`glass-card-static rounded-xl p-4 flex flex-col border transition-all duration-300 ${
      slot.is_available
        ? 'hover:transform hover:-translate-y-1'
        : 'opacity-60'
    }`}
      style={{ borderColor: slot.is_available ? `${cfg.color}44` : 'rgba(255,255,255,0.06)' }}>

      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0"
            style={{ background: `${cfg.color}18`, border: `1px solid ${cfg.color}44` }}>
            {cfg.icon}
          </div>
          <div>
            <div className="font-black text-sm text-white leading-tight">{slot.faction_name}</div>
            <div className="text-[9px] font-bold tracking-wider" style={{ color: cfg.color }}>{cfg.label} • {slot.server_name}</div>
          </div>
        </div>

        {/* Available badge */}
        <div className={`text-[8px] font-black tracking-widest px-2 py-1 rounded border ${
          slot.is_available
            ? 'text-emerald-400 border-emerald-400/50 bg-emerald-400/10'
            : 'text-red-400 border-red-400/30 bg-red-400/08'
        }`}>
          {slot.is_available ? '● OPEN' : '● TAKEN'}
        </div>
      </div>

      {/* Slots bar */}
      <div className="mb-3">
        <div className="flex justify-between text-[9px] mb-1">
          <span className="text-white/35 font-bold tracking-wider">SLOTS</span>
          <span className="font-black" style={{ color: cfg.color }}>{slot.slots_filled}/{slot.slots_total}</span>
        </div>
        <div className="w-full h-1.5 bg-white/10 rounded overflow-hidden">
          <div className="h-full rounded transition-all duration-500"
            style={{ width: `${pct}%`, background: cfg.color, boxShadow: `0 0 6px ${cfg.color}88` }} />
        </div>
      </div>

      {/* Description */}
      <p className="text-[10px] text-white/50 leading-relaxed mb-3 flex-1">{slot.description}</p>

      {/* Requirements */}
      {slot.requirements?.length > 0 && (
        <div className="mb-3">
          <div className="text-[8px] text-white/30 font-black tracking-widest mb-1.5">REQUIREMENTS</div>
          <div className="flex flex-wrap gap-1">
            {slot.requirements.map((r, i) => (
              <span key={i} className="text-[8px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/45">{r}</span>
            ))}
          </div>
        </div>
      )}

      {/* Lore badge */}
      {!slot.is_lore_friendly && (
        <div className="text-[8px] text-yellow-400/70 mb-2 flex items-center gap-1">
          <span>⚠</span> Hors lore accepté — préférence lore existant
        </div>
      )}

      {/* Action */}
      {slot.is_available && slot.discord_url ? (
        <a href={slot.discord_url} target="_blank" rel="noreferrer"
          className="btn-neon btn-neon-sm w-full justify-center text-center"
          style={{ borderColor: cfg.color, color: cfg.color }}>
          APPLY NOW
        </a>
      ) : slot.is_available ? (
        <div className="text-[9px] text-white/30 text-center font-bold tracking-wider pt-1">
          Contact server Discord to apply
        </div>
      ) : (
        <div className="text-[9px] text-red-400/60 text-center font-bold tracking-wider pt-1">
          SLOT OCCUPIED
        </div>
      )}
    </div>
  );
}

// ── COMMUNITY POST CARD ────────────────────────────────────────────────────
function PostCard({ post }: { post: CommunityPost }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = POST_CONFIG[post.post_type];
  const dateStr = new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div className={`glass-card-static rounded-xl p-4 border transition-all duration-200 hover:transform hover:-translate-y-0.5 ${
      post.is_pinned ? 'border-neonPink/30' : 'border-white/[0.06]'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[8px] font-black tracking-widest px-2 py-0.5 rounded border"
            style={{ color: cfg.color, borderColor: `${cfg.color}55`, background: `${cfg.color}11` }}>
            {cfg.icon} {cfg.label}
          </span>
          {post.is_pinned && (
            <span className="text-[8px] font-black tracking-widest px-2 py-0.5 rounded border border-neonPink/50 bg-neonPink/10 text-neonPink">
              📌 PINNED
            </span>
          )}
          <span className="text-[9px] text-white/25">{dateStr}</span>
        </div>
        <span className="text-[9px] text-white/25 flex-shrink-0">{post.upvotes} ▲</span>
      </div>

      <h3 className="font-bold text-sm text-white leading-tight mb-2">{post.title}</h3>

      <p className={`text-[10px] text-white/55 leading-relaxed mb-3 ${!expanded ? 'line-clamp-3' : ''}`}>
        {post.body}
      </p>

      {post.body.length > 200 && (
        <button onClick={() => setExpanded(!expanded)}
          className="text-[9px] text-white/35 hover:text-white/60 font-bold tracking-wider transition-colors mb-2">
          {expanded ? '▲ COLLAPSE' : '▼ READ MORE'}
        </button>
      )}

      {/* Tags */}
      {post.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {post.tags.map(t => (
            <span key={t} className="text-[8px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/35">{t}</span>
          ))}
        </div>
      )}

      {/* Contact */}
      {(post.contact_url || post.contact_discord) && (
        <div className="flex gap-2 mt-2">
          {post.contact_url && post.contact_url.startsWith('http') && (
            <a href={post.contact_url} target="_blank" rel="noreferrer"
              className="btn-neon btn-neon-sm btn-neon-cyan px-3 text-[9px]">
              JOIN DISCORD
            </a>
          )}
          {post.contact_discord && !post.contact_discord.startsWith('http') && (
            <span className="text-[9px] text-neonCyan/60 font-bold flex items-center gap-1">
              💬 {post.contact_discord}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── NEW POST FORM ──────────────────────────────────────────────────────────
function NewPostForm({ onSubmit, onClose }: { onSubmit: (p: Partial<CommunityPost>) => Promise<void>; onClose: () => void }) {
  const [form, setForm] = useState({
    post_type: 'LOOKING_FOR_SERVER' as PostType,
    title: '', body: '', contact_discord: '', contact_url: '', tags: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!form.title || !form.body) return;
    setSubmitting(true);
    await onSubmit({
      post_type: form.post_type,
      title: form.title,
      body: form.body,
      contact_discord: form.contact_discord || undefined,
      contact_url: form.contact_url || undefined,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    });
    setDone(true);
    setSubmitting(false);
  };

  if (done) return (
    <div className="text-center py-8">
      <div className="text-4xl mb-3">✅</div>
      <div className="font-orbitron font-black text-neonCyan tracking-widest text-sm mb-2">POST SUBMITTED</div>
      <p className="text-white/45 text-xs mb-4">Your intel is live on the board. The district is watching.</p>
      <button onClick={onClose} className="btn-neon btn-neon-sm btn-neon-cyan">CLOSE</button>
    </div>
  );

  return (
    <div className="glass-card-static rounded-xl p-5 border border-neonPink/20 mb-6 slide-in">
      <div className="flex items-center justify-between mb-4">
        <div className="font-orbitron font-black text-neonPink text-xs tracking-widest">◈ POST TO COMMUNITY BOARD</div>
        <button onClick={onClose} className="text-white/30 hover:text-white font-black text-lg transition-colors">✕</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-[9px] text-white/35 font-bold tracking-widest block mb-1">POST TYPE</label>
          <select value={form.post_type}
            onChange={e => setForm(p => ({ ...p, post_type: e.target.value as PostType }))}
            className="w-full bg-black/40 border border-neonPink/20 rounded px-3 py-2 text-sm text-white outline-none focus:border-neonPink/50">
            <option value="LOOKING_FOR_SERVER">🔍 Looking for Server</option>
            <option value="LOOKING_FOR_PLAYERS">📢 Looking for Players</option>
            <option value="SERVER_PROMO">🏪 Server Promo</option>
            <option value="DEV_OFFER">⚙️ Dev Services</option>
            <option value="GENERAL">📋 General Intel</option>
          </select>
        </div>
        <div>
          <label className="text-[9px] text-white/35 font-bold tracking-widest block mb-1">TITLE *</label>
          <input type="text" placeholder="Your headline..." value={form.title}
            onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            className="w-full bg-black/40 border border-neonPink/20 rounded px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-neonPink/50" />
        </div>
      </div>

      <div className="mb-3">
        <label className="text-[9px] text-white/35 font-bold tracking-widest block mb-1">MESSAGE *</label>
        <textarea rows={4} placeholder="Drop your full intel here..." value={form.body}
          onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
          className="w-full bg-black/40 border border-neonPink/20 rounded px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-neonPink/50 resize-none" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div>
          <label className="text-[9px] text-white/35 font-bold tracking-widest block mb-1">DISCORD</label>
          <input type="text" placeholder="discord.gg/..." value={form.contact_discord}
            onChange={e => setForm(p => ({ ...p, contact_discord: e.target.value }))}
            className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-xs text-white placeholder-white/20 outline-none focus:border-neonCyan/40" />
        </div>
        <div>
          <label className="text-[9px] text-white/35 font-bold tracking-widest block mb-1">URL (optional)</label>
          <input type="url" placeholder="https://..." value={form.contact_url}
            onChange={e => setForm(p => ({ ...p, contact_url: e.target.value }))}
            className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-xs text-white placeholder-white/20 outline-none focus:border-neonCyan/40" />
        </div>
        <div>
          <label className="text-[9px] text-white/35 font-bold tracking-widest block mb-1">TAGS (comma sep.)</label>
          <input type="text" placeholder="WL, LSPD, Serious RP" value={form.tags}
            onChange={e => setForm(p => ({ ...p, tags: e.target.value }))}
            className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-xs text-white placeholder-white/20 outline-none focus:border-neonCyan/40" />
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={submit} disabled={!form.title || !form.body || submitting}
          className={`btn-neon flex-1 justify-center ${form.title && form.body && !submitting ? '' : 'opacity-40 cursor-not-allowed'}`}>
          {submitting ? 'POSTING...' : 'POST TO BOARD'}
        </button>
        <button onClick={onClose} className="btn-neon btn-neon-cyan px-5 btn-neon-sm">CANCEL</button>
      </div>
    </div>
  );
}

// ── MARKETPLACE CARD ───────────────────────────────────────────────────────
function MarketplaceCard({ item }: { item: MarketplaceItem }) {
  return (
    <div className="glass-card-static rounded-xl p-5 border border-neonYellow/20 hover:border-neonYellow/40 transition-all duration-200 hover:transform hover:-translate-y-0.5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-[8px] font-black tracking-widest text-neonYellow/70 mb-1">💰 FOR SALE</div>
          <h3 className="font-bold text-sm text-white leading-tight">{item.title}</h3>
        </div>
        <div className="text-right flex-shrink-0 ml-3">
          <div className="font-orbitron font-black text-neonYellow text-lg">{item.price_label}</div>
          <div className="text-[9px] text-white/30">{item.framework}</div>
        </div>
      </div>

      <p className="text-[10px] text-white/50 leading-relaxed mb-3 line-clamp-3">{item.description}</p>

      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { label: 'Discord Members', val: item.discord_members.toLocaleString() },
          { label: 'Player Slots', val: item.player_slots },
          { label: 'Type', val: item.is_wl ? 'Whitelist' : 'Free Access' },
        ].map(s => (
          <div key={s.label} className="text-center p-2 rounded bg-white/[0.03] border border-white/[0.05]">
            <div className="font-orbitron font-black text-sm text-neonYellow">{s.val}</div>
            <div className="text-[8px] text-white/30 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {item.includes?.length > 0 && (
        <div className="mb-4">
          <div className="text-[8px] text-white/30 font-black tracking-widest mb-1.5">INCLUDES</div>
          <div className="space-y-1">
            {item.includes.map((inc, i) => (
              <div key={i} className="text-[9px] text-white/55 flex items-center gap-1.5">
                <span className="text-neonYellow/60">✓</span> {inc}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-[9px] text-white/35 font-bold">
        📬 Contact: {item.seller_contact}
      </div>
    </div>
  );
}

// ── VERIFIED DEV CARD ──────────────────────────────────────────────────────
function DevCard({ dev }: { dev: VerifiedDev }) {
  const badgeColor = dev.badge_level === 'ELITE' ? '#FF2D78' : dev.badge_level === 'VERIFIED' ? '#00FFFF' : '#88cc88';
  const badgeIcon  = dev.badge_level === 'ELITE' ? '⬡ ELITE' : dev.badge_level === 'VERIFIED' ? '✓ VERIFIED' : '◎ STANDARD';

  return (
    <div className="glass-card-static rounded-xl p-4 border border-white/[0.06] hover:border-white/15 transition-all duration-200">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="font-orbitron font-black text-sm text-white">{dev.name}</div>
          <div className="text-[9px] font-bold mt-0.5" style={{ color: badgeColor }}>
            {badgeIcon} · {dev.completed_projects} projects
          </div>
        </div>
        <div className={`flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded border ${
          dev.is_available
            ? 'text-emerald-400 border-emerald-400/50 bg-emerald-400/10'
            : 'text-white/30 border-white/15'
        }`}>
          {dev.is_available ? '● AVAILABLE' : '● BUSY'}
        </div>
      </div>

      <p className="text-[10px] text-white/50 leading-relaxed mb-3">{dev.bio}</p>

      <div className="flex flex-wrap gap-1 mb-3">
        {dev.frameworks?.map(f => (
          <span key={f} className="text-[8px] px-1.5 py-0.5 rounded bg-neonCyan/10 border border-neonCyan/25 text-neonCyan/70 font-bold">{f}</span>
        ))}
        {dev.specialties?.slice(0, 3).map(s => (
          <span key={s} className="text-[8px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/40">{s}</span>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <span className="font-orbitron font-black text-xs text-neonPink">{dev.rate_label}</span>
        {dev.discord_handle && (
          <span className="text-[9px] text-white/30 font-bold">💬 {dev.discord_handle}</span>
        )}
      </div>
    </div>
  );
}

// ── MAIN EXPORT ─────────────────────────────────────────────────────────────
type Section = 'factions' | 'board' | 'market' | 'devs';

export default function CommunityTab() {
  const [section, setSection] = useState<Section>('factions');
  const [factions, setFactions] = useState<FactionSlot[]>([]);
  const [posts, setPosts]   = useState<CommunityPost[]>([]);
  const [market, setMarket] = useState<MarketplaceItem[]>([]);
  const [devs, setDevs]     = useState<VerifiedDev[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPostForm, setShowPostForm] = useState(false);
  const [factionTypeFilter, setFactionTypeFilter] = useState<FactionType | 'ALL'>('ALL');
  const [serverFilter, setServerFilter] = useState<string>('ALL');
  const [postTypeFilter, setPostTypeFilter] = useState<PostType | 'ALL'>('ALL');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [f, p, m, d] = await Promise.all([
          supa.from('faction_slots').select('*').order('sort_order'),
          supa.from('community_posts').select('*').order('is_pinned', { ascending: false }).order('created_at', { ascending: false }),
          supa.from('server_marketplace').select('*').eq('status', 'ACTIVE').order('created_at', { ascending: false }),
          supa.from('verified_devs').select('*').order('badge_level', { ascending: false }),
        ]);
        if (f.data && f.data.length > 0) setFactions(f.data as FactionSlot[]);
        if (p.data && p.data.length > 0) setPosts(p.data as CommunityPost[]);
        if (m.data && m.data.length > 0) setMarket(m.data as MarketplaceItem[]);
        if (d.data && d.data.length > 0) setDevs(d.data as VerifiedDev[]);
      } catch (err) {
        console.error('[CommunityTab] Load error:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const submitPost = useCallback(async (post: Partial<CommunityPost>) => {
    await supa.from('community_posts').insert({ ...post, is_approved: true, upvotes: 0 });
    const { data } = await supa.from('community_posts').select('*').order('is_pinned', { ascending: false }).order('created_at', { ascending: false });
    if (data) setPosts(data as CommunityPost[]);
    setShowPostForm(false);
  }, []);

  const filteredFactions = factions.filter(f =>
    (factionTypeFilter === 'ALL' || f.faction_type === factionTypeFilter) &&
    (serverFilter === 'ALL' || f.server_name === serverFilter)
  );

  const filteredPosts = posts.filter(p =>
    postTypeFilter === 'ALL' || p.post_type === postTypeFilter
  );

  const servers = [...new Set(factions.map(f => f.server_name))];
  const openSlots = factions.filter(f => f.is_available).length;

  const SECTIONS: { id: Section; label: string; icon: string; badge?: string }[] = [
    { id: 'factions', label: 'FACTION SLOTS', icon: '🎯', badge: `${openSlots} OPEN` },
    { id: 'board',    label: 'INTEL BOARD',   icon: '📋', badge: `${posts.length}` },
    { id: 'market',   label: 'MARKETPLACE',   icon: '💰', badge: `${market.length}` },
    { id: 'devs',     label: 'VERIFIED DEVS', icon: '⚙️' },
  ];

  return (
    <div className="slide-in">

      {/* Hero */}
      <div className="mb-6">
        <h2 className="font-orbitron font-black text-2xl tracking-widest mb-1"
          style={{ color: '#FF2D78', textShadow: '0 0 12px rgba(255,45,120,0.6)' }}>
          ◈ COMMUNITY BOARD
        </h2>
        <p className="text-white/35 text-xs tracking-wider font-bold uppercase">
          Faction Slots · Intel Board · Server Market · Verified Devs
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { val: `${openSlots}`, label: 'Faction Slots Open',   color: '#FF2D78' },
          { val: `${posts.filter(p => p.is_pinned).length + posts.length}`, label: 'Board Posts', color: '#00FFFF' },
          { val: `${market.length}`,  label: 'Servers For Sale', color: '#FFE135' },
          { val: `${devs.filter(d => d.is_available).length}`, label: 'Devs Available',  color: '#b44fff' },
        ].map(s => (
          <div key={s.label} className="glass-card-static rounded-xl p-4 text-center border border-white/[0.05]">
            <div className="font-orbitron font-black text-2xl" style={{ color: s.color, textShadow: `0 0 10px ${s.color}66` }}>
              {s.val}
            </div>
            <div className="text-[9px] text-white/30 tracking-wider mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Sub-navigation */}
      <div className="flex flex-wrap gap-1 p-1 glass-card-static rounded-lg mb-6 border border-white/[0.05]">
        {SECTIONS.map(s => (
          <button key={s.id} onClick={() => setSection(s.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded text-[10px] font-orbitron font-black tracking-widest transition-all ${
              section === s.id
                ? 'bg-neonPink/20 border border-neonPink/60 text-neonPink'
                : 'text-white/35 hover:text-white/60'
            }`}>
            <span>{s.icon}</span>
            <span>{s.label}</span>
            {s.badge && (
              <span className="text-[8px] px-1.5 py-0.5 rounded bg-white/10 text-white/50 font-bold">{s.badge}</span>
            )}
          </button>
        ))}
      </div>

      {loading && (
        <div className="text-center py-16">
          <div className="font-orbitron text-xs text-white/30 tracking-widest animate-pulse">LOADING INTEL...</div>
        </div>
      )}

      {!loading && (
        <>
          {/* ── FACTION SLOTS ── */}
          {section === 'factions' && (
            <div>
              <SectionHeader icon="🎯" title="FACTION SLOTS" subtitle="Available gang, MC, LEO and business slots across active servers" color="#FF2D78" />

              {/* Filters */}
              <div className="glass-card-static rounded-lg p-4 mb-5 border border-white/[0.05] flex flex-wrap gap-3 items-center">
                <div className="flex flex-wrap gap-1.5 flex-1">
                  {(['ALL', ...Object.keys(FACTION_CONFIG)] as (FactionType | 'ALL')[]).map(ft => (
                    <button key={ft} onClick={() => setFactionTypeFilter(ft)}
                      className={`text-[9px] px-2.5 py-1 rounded font-orbitron font-black tracking-wider border transition-all ${
                        factionTypeFilter === ft
                          ? 'border-neonPink/60 bg-neonPink/15 text-neonPink'
                          : 'border-white/10 text-white/30 hover:border-white/25'
                      }`}>
                      {ft === 'ALL' ? 'ALL TYPES' : `${FACTION_CONFIG[ft as FactionType].icon} ${FACTION_CONFIG[ft as FactionType].label}`}
                    </button>
                  ))}
                </div>
                <select value={serverFilter} onChange={e => setServerFilter(e.target.value)}
                  className="bg-black/40 border border-white/15 rounded px-3 py-1.5 text-[10px] text-white font-bold outline-none">
                  <option value="ALL">All Servers</option>
                  {servers.map(sv => <option key={sv} value={sv}>{sv}</option>)}
                </select>
              </div>

              {/* Open slots first */}
              {filteredFactions.filter(f => f.is_available).length > 0 && (
                <div className="mb-6">
                  <div className="text-[10px] font-orbitron font-black tracking-widest text-emerald-400 mb-3">
                    ● {filteredFactions.filter(f => f.is_available).length} OPEN SLOTS
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredFactions.filter(f => f.is_available).map(f => <FactionSlotCard key={f.id} slot={f} />)}
                  </div>
                </div>
              )}

              {/* Taken slots */}
              {filteredFactions.filter(f => !f.is_available).length > 0 && (
                <div>
                  <div className="text-[10px] font-orbitron font-black tracking-widest text-red-400/60 mb-3">
                    ✕ {filteredFactions.filter(f => !f.is_available).length} TAKEN SLOTS
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredFactions.filter(f => !f.is_available).map(f => <FactionSlotCard key={f.id} slot={f} />)}
                  </div>
                </div>
              )}

              {filteredFactions.length === 0 && (
                <div className="text-center py-12 text-white/25 font-bold text-sm tracking-widest">
                  NO SLOTS MATCH YOUR FILTERS
                </div>
              )}
            </div>
          )}

          {/* ── INTEL BOARD ── */}
          {section === 'board' && (
            <div>
              <SectionHeader icon="📋" title="INTEL BOARD" subtitle="Community recruitment posts, server promos, dev offers and general intel" color="#00FFFF" />

              <div className="flex flex-wrap gap-2 mb-5 items-center justify-between">
                <div className="flex flex-wrap gap-1.5">
                  {(['ALL', ...Object.keys(POST_CONFIG)] as (PostType | 'ALL')[]).map(pt => {
                    const cfg = pt !== 'ALL' ? POST_CONFIG[pt as PostType] : null;
                    return (
                      <button key={pt} onClick={() => setPostTypeFilter(pt)}
                        className={`text-[9px] px-2.5 py-1 rounded font-orbitron font-black tracking-wider border transition-all ${
                          postTypeFilter === pt
                            ? 'border-neonCyan/60 bg-neonCyan/15 text-neonCyan'
                            : 'border-white/10 text-white/30 hover:border-white/25'
                        }`}>
                        {pt === 'ALL' ? 'ALL POSTS' : `${cfg?.icon} ${cfg?.label}`}
                      </button>
                    );
                  })}
                </div>
                <button onClick={() => setShowPostForm(!showPostForm)}
                  className="btn-neon btn-neon-sm">
                  + POST INTEL
                </button>
              </div>

              {showPostForm && <NewPostForm onSubmit={submitPost} onClose={() => setShowPostForm(false)} />}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredPosts.map(p => <PostCard key={p.id} post={p} />)}
                {filteredPosts.length === 0 && (
                  <div className="col-span-2 text-center py-12 text-white/25 font-bold text-sm tracking-widest">
                    NO POSTS YET. BE THE FIRST.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── MARKETPLACE ── */}
          {section === 'market' && (
            <div>
              <SectionHeader icon="💰" title="SERVER MARKETPLACE" subtitle="Buy and sell complete FiveM server packages — CFX keys, scripts, Discord communities" color="#FFE135" />

              <div className="glass-card-static rounded-xl p-4 mb-5 border border-neonYellow/15"
                style={{ background: 'rgba(255,225,53,0.03)' }}>
                <p className="text-[10px] text-neonYellow/60 leading-relaxed">
                  ⚠ <strong>VICE CITY HUB IS NOT A PARTY TO THESE TRANSACTIONS.</strong> Always verify CFX key ownership, request working server proof, and use milestone-based payments. We recommend escrow for transactions over €500.
                  No refunds. No exceptions. The streets aren't a courtroom.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
                {market.map(m => <MarketplaceCard key={m.id} item={m} />)}
                {market.length === 0 && (
                  <div className="col-span-2 text-center py-12 text-white/25 font-bold text-sm tracking-widest">
                    NO SERVERS LISTED RIGHT NOW
                  </div>
                )}
              </div>

              <div className="glass-card-static rounded-xl p-5 border border-white/[0.06] text-center">
                <div className="font-orbitron font-black text-xs tracking-widest text-white/40 mb-2">SELLING YOUR SERVER?</div>
                <p className="text-[10px] text-white/30 mb-4">
                  List your complete server package on the Vice City Hub marketplace. Reach thousands of serious buyers in the FiveM community.
                </p>
                <button className="btn-neon btn-neon-sm">
                  LIST YOUR SERVER — coming soon
                </button>
              </div>
            </div>
          )}

          {/* ── VERIFIED DEVS ── */}
          {section === 'devs' && (
            <div>
              <SectionHeader icon="⚙️" title="VERIFIED DEVS" subtitle="Pre-vetted FiveM developers. Portfolio reviewed. Community rated. No ghost jobs." color="#b44fff" />

              {/* Community warning card */}
              <div className="glass-card-static rounded-xl p-4 mb-5 border border-red-400/20"
                style={{ background: 'rgba(255,50,50,0.04)' }}>
                <div className="flex items-start gap-3">
                  <span className="text-xl flex-shrink-0">⚠️</span>
                  <div>
                    <div className="font-orbitron font-black text-xs text-red-400 tracking-widest mb-1">COMMUNITY ALERT — DEV FRAUD</div>
                    <p className="text-[10px] text-white/50 leading-relaxed">
                      Multiple community reports of developers taking €65–€500+ payments, promising server builds in weeks,
                      then going dark. <strong className="text-white/70">Never pay 100% upfront.</strong> Always demand a live portfolio link,
                      split payments into milestones, and verify their CFX work. Use the verified list below.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                {devs.map(d => <DevCard key={d.id} dev={d} />)}
              </div>

              {/* Get verified CTA */}
              <div className="glass-card-static rounded-xl p-6 border border-neonPurple/20 text-center">
                <div className="font-orbitron font-black text-sm text-neonPurple tracking-widest mb-2">GET VERIFIED</div>
                <p className="text-[10px] text-white/40 leading-relaxed mb-4">
                  Submit your portfolio for review. Badge levels: Standard → Verified → Elite.<br />
                  Elite status requires 10+ completed projects with community ratings and active references.
                </p>
                <button className="btn-neon btn-neon-sm">
                  APPLY FOR VERIFICATION — coming soon
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
