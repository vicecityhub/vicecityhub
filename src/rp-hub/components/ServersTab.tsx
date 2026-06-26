import React, { useState, useMemo } from 'react';
import { IServer, IServerNews, ServerStatus, ServerTag } from '../types';
import { MOCK_SERVERS, MOCK_NEWS } from '../data/mockData';

const STATUS_CONFIG: Record<ServerStatus, { label: string; color: string; dot: string }> = {
  ONLINE:          { label: 'ONLINE',   color: 'text-emerald-400',             dot: 'bg-emerald-400 animate-pulse' },
  IN_DEVELOPMENT:  { label: 'IN DEV',   color: 'text-yellow-400',              dot: 'bg-yellow-400' },
  WHITELIST_OPEN:  { label: 'WL OPEN',  color: 'text-[var(--neon-cyan)]',      dot: 'bg-[var(--neon-cyan)] animate-pulse' },
  OFFLINE:         { label: 'OFFLINE',  color: 'text-red-400',                 dot: 'bg-red-400' },
};

const NEWS_CAT_COLOR: Record<string, string> = {
  DRAMA:        'text-[var(--neon-pink)] border-[var(--neon-pink)]',
  WIPE:         'text-red-400 border-red-400',
  UPDATE:       'text-[var(--neon-cyan)] border-[var(--neon-cyan)]',
  EVENT:        'text-yellow-400 border-yellow-400',
  ANNOUNCEMENT: 'text-[var(--neon-purple)] border-[var(--neon-purple)]',
};

const ALL_TAGS: ServerTag[] = ['Hard RP','Voice Only','Custom UI','Economy Sim','Whitelisted','Public','FiveM','NoPixel Style'];

// ── Извлекаем IP из fivem:// URL ──────────────────────────────────────────
function extractIP(url: string): string {
  return url.replace(/^fivem:\/\/connect\//i, '').replace(/\/$/, '');
}

// ── Модал подключения ──────────────────────────────────────────────────────
function ConnectModal({ server, onClose }: { server: IServer; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const ip = server.connect_url ? extractIP(server.connect_url) : '';

  const copy = async () => {
    await navigator.clipboard.writeText(ip);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-[600] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="glass-card-static rounded-xl w-full max-w-md p-6 border border-neonPink/50 shadow-[0_0_40px_rgba(255,0,255,0.2)] slide-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="font-orbitron font-black text-neonPink text-sm tracking-widest mb-1">
              CONNECT TO SERVER
            </div>
            <div className="text-white font-bold text-base">{server.name}</div>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white text-xl font-black transition-colors leading-none">✕</button>
        </div>

        {/* Step 1 */}
        <div className="mb-4 p-4 rounded-lg" style={{ background: 'rgba(0,255,255,0.05)', border: '1px solid rgba(0,255,255,0.2)' }}>
          <div className="font-orbitron font-black text-[10px] text-neonCyan tracking-widest mb-2">
            STEP 1 — COPY SERVER ADDRESS
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 font-mono text-sm text-white bg-black/40 rounded px-3 py-2 border border-white/10 truncate">
              {ip}
            </div>
            <button
              onClick={copy}
              className={`btn-neon btn-neon-sm flex-shrink-0 transition-all ${copied ? 'btn-neon-cyan' : ''}`}
            >
              {copied ? '✓ COPIED' : 'COPY'}
            </button>
          </div>
        </div>

        {/* Step 2 */}
        <div className="mb-4 p-4 rounded-lg" style={{ background: 'rgba(255,0,255,0.04)', border: '1px solid rgba(255,0,255,0.15)' }}>
          <div className="font-orbitron font-black text-[10px] text-neonPink tracking-widest mb-3">
            STEP 2 — OPEN FIVEM
          </div>
          <div className="space-y-2">
            {[
              { num: '1', text: 'Launch FiveM on your PC' },
              { num: '2', text: 'Press F8 to open console' },
              { num: '3', text: 'Type: connect ' + ip },
              { num: '4', text: 'Hit Enter — loading starts' },
            ].map(s => (
              <div key={s.num} className="flex items-start gap-3 text-xs text-white/65">
                <span className="font-orbitron font-black text-neonPink/70 flex-shrink-0 w-4">{s.num}.</span>
                <span>{s.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Alt method */}
        <div className="p-3 rounded-lg mb-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="font-orbitron font-black text-[9px] text-white/30 tracking-widest mb-1">OR — DIRECT CONNECT</div>
          <p className="text-[10px] text-white/45">
            In FiveM main menu → <span className="text-neonCyan font-bold">Search</span> → paste the address → <span className="text-neonCyan font-bold">Connect</span>
          </p>
        </div>

        {/* Discord button if available */}
        <div className="flex gap-2">
          {server.discord_url && (
            <a
              href={server.discord_url}
              target="_blank"
              rel="noreferrer"
              className="btn-neon btn-neon-cyan btn-neon-sm flex-1 text-center justify-center"
            >
              JOIN DISCORD
            </a>
          )}
          <button onClick={onClose} className="btn-neon btn-neon-sm flex-1 justify-center">
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Server Card ────────────────────────────────────────────────────────────
function ServerCard({ server, onConnect }: { server: IServer; onConnect: (s: IServer) => void }) {
  const status = STATUS_CONFIG[server.status];
  return (
    <div className="glass-card rounded-lg p-4 flex flex-col h-full" style={{ transition: 'all 0.25s ease' }}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* Аватар сервера — SVG с буквой и цветом фракции, как в Store */}
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-base font-black flex-shrink-0 select-none"
            style={{
              background: server.color
                ? `linear-gradient(135deg, ${server.color}22, ${server.color}44)`
                : 'rgba(180,79,255,0.15)',
              border: `1px solid ${server.color ? server.color + '66' : 'rgba(180,79,255,0.3)'}`,
              color: server.color || 'var(--neon-purple)',
              textShadow: server.color ? `0 0 8px ${server.color}` : undefined,
            }}
          >
            {server.name.charAt(0)}
          </div>
          <div>
            <h3 className="font-black text-sm text-white tracking-wide leading-tight">{server.name}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
              <span className={`text-[10px] font-bold tracking-widest ${status.color}`}>{status.label}</span>
            </div>
          </div>
        </div>
        {server.status === 'ONLINE' && (
          <div className="text-right flex-shrink-0">
            <div className="font-black text-sm" style={{ color: 'var(--neon-cyan)' }}>{server.online_count}</div>
            <div className="text-[10px] text-white/40">/ {server.max_players}</div>
          </div>
        )}
      </div>

      <p className="text-white/55 text-xs leading-relaxed mb-3 flex-1 line-clamp-2">{server.description}</p>

      <div className="flex flex-wrap gap-1 mb-3">
        {server.tags.map(tag => (
          <span key={tag} className="text-[9px] px-2 py-0.5 rounded-full font-bold tracking-wider"
            style={{ background: 'rgba(180,79,255,0.12)', border: '1px solid rgba(180,79,255,0.3)', color: 'var(--neon-purple)' }}>
            {tag}
          </span>
        ))}
      </div>

      <div className="flex gap-2 mt-auto">
        {server.connect_url ? (
          <button
            onClick={() => onConnect(server)}
            className="btn-neon flex-1 btn-neon-sm justify-center"
          >
            CONNECT NOW
          </button>
        ) : (
          <span className="flex-1 px-3 py-1.5 rounded text-[10px] font-black tracking-wider text-center select-none"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.25)' }}>
            {server.status === 'IN_DEVELOPMENT' ? 'NOT LIVE YET' : 'JOIN WAITLIST'}
          </span>
        )}
        {server.discord_url && (
          <a
            href={server.discord_url}
            target="_blank"
            rel="noreferrer"
            className="btn-neon btn-neon-cyan btn-neon-sm px-3"
          >
            DISCORD
          </a>
        )}
      </div>
    </div>
  );
}

// ── News Card ──────────────────────────────────────────────────────────────
function NewsCard({ news }: { news: IServerNews }) {
  const catStyle = NEWS_CAT_COLOR[news.category] || 'text-white/60 border-white/30';
  return (
    <div className="glass-card-static rounded-lg p-3 mb-2 border border-white/[0.06]">
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`text-[9px] px-2 py-0.5 rounded border font-black tracking-widest ${catStyle}`}>
          {news.category}
        </span>
        <span className="text-[10px] text-white/35">{news.server_name}</span>
      </div>
      <h4 className="text-xs font-black text-white leading-tight mb-1">{news.title}</h4>
      <p className="text-[10px] text-white/50 line-clamp-2 leading-relaxed">{news.body}</p>
    </div>
  );
}

// ── Main Export ────────────────────────────────────────────────────────────
export default function ServersTab() {
  const [search, setSearch]           = useState('');
  const [activeFilter, setActiveFilter] = useState<ServerTag | null>(null);
  const [statusFilter, setStatusFilter] = useState<ServerStatus | 'ALL'>('ALL');
  const [connectServer, setConnectServer] = useState<IServer | null>(null);

  const filtered = useMemo(() => {
    return MOCK_SERVERS.filter(s => {
      const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.description.toLowerCase().includes(search.toLowerCase());
      const matchTag    = !activeFilter || s.tags.includes(activeFilter);
      const matchStatus = statusFilter === 'ALL' || s.status === statusFilter;
      return matchSearch && matchTag && matchStatus;
    });
  }, [search, activeFilter, statusFilter]);

  return (
    <div className="slide-in">
      {/* Connect Modal */}
      {connectServer && (
        <ConnectModal server={connectServer} onClose={() => setConnectServer(null)} />
      )}

      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-black tracking-widest mb-1" style={{ color: 'var(--neon-pink)', textShadow: '0 0 10px rgba(255,0,255,0.6)' }}>
          ◈ SERVER INTEL DATABASE
        </h2>
        <p className="text-white/40 text-xs tracking-wider font-bold">
          LIVE FEED — {MOCK_SERVERS.filter(s => s.status === 'ONLINE').length} SERVERS BROADCASTING
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main Browser */}
        <div className="flex-1">
          {/* Filters */}
          <div className="glass-card-static rounded-lg p-4 mb-4 border border-white/[0.06]">
            <input
              type="text"
              placeholder="SEARCH SERVER DATABASE..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-transparent text-white text-sm font-bold tracking-wider placeholder-white/25 outline-none pb-2 mb-4"
              style={{ borderBottom: '1px solid rgba(255,0,255,0.3)' }}
            />
            <div className="flex flex-wrap gap-2 mb-3">
              {(['ALL','ONLINE','WHITELIST_OPEN','IN_DEVELOPMENT'] as const).map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`text-[10px] px-3 py-1 rounded font-black tracking-wider transition-all border ${
                    statusFilter === s
                      ? 'border-neonPink/60 bg-neonPink/15 text-neonPink'
                      : 'border-white/15 text-white/40 hover:border-white/30'
                  }`}>
                  {s === 'ALL' ? 'ALL STATUS' : STATUS_CONFIG[s].label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ALL_TAGS.map(tag => (
                <button key={tag} onClick={() => setActiveFilter(activeFilter === tag ? null : tag)}
                  className={`text-[9px] px-2 py-0.5 rounded-full font-bold tracking-wider transition-all border ${
                    activeFilter === tag
                      ? 'border-neonPurple/70 bg-neonPurple/20 text-neonPurple'
                      : 'border-white/15 text-white/35 hover:border-white/30'
                  }`}>
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filtered.length > 0
              ? filtered.map(s => <ServerCard key={s.id} server={s} onConnect={setConnectServer} />)
              : (
                <div className="col-span-2 text-center py-12 text-white/30 text-sm font-bold tracking-widest">
                  NO SERVERS MATCH YOUR CRITERIA.
                </div>
              )
            }
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:w-72 xl:w-80">
          <div className="glass-card-static rounded-lg p-4 mb-4 border border-white/[0.06]">
            <h3 className="text-[11px] font-black tracking-widest mb-3 pb-2 font-orbitron"
              style={{ color: 'var(--neon-cyan)', borderBottom: '1px solid rgba(0,255,255,0.2)' }}>
              ◈ INCOMING TRANSMISSIONS
            </h3>
            {MOCK_NEWS.map(n => <NewsCard key={n.id} news={n} />)}
          </div>

          <div className="glass-card-static rounded-lg p-4 border border-white/[0.06]">
            <h3 className="text-[11px] font-black tracking-widest mb-3 font-orbitron" style={{ color: 'var(--neon-purple)' }}>
              ◈ LIVE STREAMERS
            </h3>
            <div className="space-y-2">
              {([
                { name: 'SUMMIT1G', url: 'https://www.twitch.tv/summit1g' },
                { name: 'SHROUD',   url: 'https://www.twitch.tv/shroud' },
                { name: 'LIRIK',    url: 'https://www.twitch.tv/lirik' },
                { name: 'MOON_RP',  url: 'https://www.twitch.tv/moonmoon' },
              ] as { name: string; url: string }[]).map(s => (
                <a
                  key={s.name}
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 p-2 rounded transition-all hover:scale-[1.02]"
                  style={{ background: 'rgba(180,79,255,0.08)', border: '1px solid rgba(180,79,255,0.15)' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(145,70,255,0.5)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(180,79,255,0.15)')}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                  <span className="text-[11px] font-black text-white/70 flex-1">{s.name}</span>
                  <span className="text-[9px] font-black tracking-wider flex items-center gap-1" style={{ color: '#9146FF' }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>
                    WATCH
                  </span>
                </a>
              ))}
              <p className="text-[10px] text-white/20 text-center mt-2 font-bold tracking-wider">
                CLICK TO OPEN ON TWITCH
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
