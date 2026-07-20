import React, { useState, useMemo, useEffect } from 'react';
import { supa } from '../../lib/SupabaseClient';

type ServerStatus = 'ONLINE' | 'IN_DEVELOPMENT' | 'WHITELIST_OPEN' | 'OFFLINE';

interface IServer {
  id: string; name: string; color?: string; status: ServerStatus;
  online_count: number; max_players: number; tags: string[];
  description: string; connect_url?: string; discord_url?: string;
}
interface IServerNews {
  id: string; server_name: string; title: string; body: string;
  category: string; is_pinned: boolean; created_at: string;
}

const STATUS_CFG: Record<ServerStatus, { label: string; color: string; dot: string }> = {
  ONLINE:         { label: 'ONLINE',  color: '#4ade80', dot: 'bg-emerald-400 animate-pulse' },
  IN_DEVELOPMENT: { label: 'IN DEV',  color: '#facc15', dot: 'bg-yellow-400' },
  WHITELIST_OPEN: { label: 'WL OPEN', color: '#00FFFF', dot: 'bg-cyan-400 animate-pulse' },
  OFFLINE:        { label: 'OFFLINE', color: '#f87171', dot: 'bg-red-400' },
};

const NEWS_C: Record<string,string> = {
  DRAMA:'text-neonPink border-neonPink', WIPE:'text-red-400 border-red-400',
  UPDATE:'text-neonCyan border-neonCyan', EVENT:'text-yellow-400 border-yellow-400',
  ANNOUNCEMENT:'text-purple-400 border-purple-400',
};

const ALL_TAGS = ['Hard RP','Voice Only','Custom UI','Economy Sim','Whitelisted','Public','FiveM','NoPixel Style'];

function ConnectModal({ server, onClose }: { server: IServer; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const ip = (server.connect_url || '').replace(/^fivem:\/\/connect\//i, '').replace(/\/$/, '');
  const copy = async () => { await navigator.clipboard.writeText(ip); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }} onClick={onClose}>
      <div className="glass-card-static rounded-xl w-full max-w-md p-6 border border-neonPink/50 shadow-[0_0_40px_rgba(255,0,255,0.2)] slide-in"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="font-orbitron font-black text-neonPink text-sm tracking-widest mb-1">CONNECT TO SERVER</div>
            <div className="text-white font-bold">{server.name}</div>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white text-xl font-black">✕</button>
        </div>
        <div className="mb-4 p-4 rounded-lg" style={{ background:'rgba(0,255,255,0.05)', border:'1px solid rgba(0,255,255,0.2)' }}>
          <div className="font-orbitron font-black text-[10px] text-neonCyan tracking-widest mb-2">STEP 1 — COPY ADDRESS</div>
          <div className="flex items-center gap-2">
            <div className="flex-1 font-mono text-sm text-white bg-black/40 rounded px-3 py-2 border border-white/10 truncate">{ip || 'No IP'}</div>
            {ip && <button onClick={copy} className={`btn-neon btn-neon-sm ${copied?'btn-neon-cyan':''}`}>{copied?'✓ COPIED':'COPY'}</button>}
          </div>
        </div>
        <div className="mb-4 p-4 rounded-lg" style={{ background:'rgba(255,0,255,0.04)', border:'1px solid rgba(255,0,255,0.15)' }}>
          <div className="font-orbitron font-black text-[10px] text-neonPink tracking-widest mb-2">STEP 2 — OPEN FIVEM</div>
          {['Launch FiveM','Press F8 to open console',`Type: connect ${ip}`,'Hit Enter'].map((s,i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-white/65 mb-1">
              <span className="font-orbitron font-black text-neonPink/70 w-4">{i+1}.</span><span>{s}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          {server.discord_url && <a href={server.discord_url} target="_blank" rel="noreferrer" className="btn-neon btn-neon-cyan btn-neon-sm flex-1 text-center justify-center">JOIN DISCORD</a>}
          <button onClick={onClose} className="btn-neon btn-neon-sm flex-1 justify-center">CLOSE</button>
        </div>
      </div>
    </div>
  );
}

function ServerCard({ server, onConnect }: { server: IServer; onConnect: (s: IServer) => void }) {
  const st = STATUS_CFG[server.status] || STATUS_CFG.OFFLINE;
  const c = server.color || '#b44fff';
  return (
    <div className="glass-card rounded-lg p-4 flex flex-col h-full">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-base font-black flex-shrink-0"
            style={{ background:`${c}18`, border:`1px solid ${c}44`, color:c, textShadow:`0 0 8px ${c}` }}>
            {server.name.charAt(0)}
          </div>
          <div>
            <h3 className="font-black text-sm text-white tracking-wide leading-tight">{server.name}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
              <span className="text-[10px] font-bold tracking-widest" style={{ color:st.color }}>{st.label}</span>
            </div>
          </div>
        </div>
        {server.status === 'ONLINE' && (
          <div className="text-right flex-shrink-0">
            <div className="font-black text-sm text-neonCyan">{server.online_count}</div>
            <div className="text-[10px] text-white/40">/ {server.max_players}</div>
          </div>
        )}
      </div>
      <p className="text-white/55 text-xs leading-relaxed mb-3 flex-1 line-clamp-2">{server.description}</p>
      <div className="flex flex-wrap gap-1 mb-3">
        {(server.tags||[]).map(tag => (
          <span key={tag} className="text-[9px] px-2 py-0.5 rounded-full font-bold tracking-wider"
            style={{ background:'rgba(180,79,255,0.12)', border:'1px solid rgba(180,79,255,0.3)', color:'var(--neon-purple)' }}>{tag}</span>
        ))}
      </div>
      <div className="flex gap-2 mt-auto">
        {server.connect_url
          ? <button onClick={() => onConnect(server)} className="btn-neon flex-1 btn-neon-sm justify-center">CONNECT NOW</button>
          : <span className="flex-1 px-3 py-1.5 rounded text-[10px] font-black tracking-wider text-center select-none"
              style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.25)' }}>
              {server.status==='IN_DEVELOPMENT'?'NOT LIVE YET':'JOIN WAITLIST'}
            </span>
        }
        {server.discord_url && (
          <a href={server.discord_url} target="_blank" rel="noreferrer" className="btn-neon btn-neon-cyan btn-neon-sm px-3">DISCORD</a>
        )}
      </div>
    </div>
  );
}

function NewsCard({ news }: { news: IServerNews }) {
  const c = NEWS_C[news.category] || 'text-white/60 border-white/30';
  return (
    <div className="glass-card-static rounded-lg p-3 mb-2 border border-white/[0.06]">
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`text-[9px] px-2 py-0.5 rounded border font-black tracking-widest ${c}`}>{news.category}</span>
        <span className="text-[10px] text-white/35">{news.server_name}</span>
        {news.is_pinned && <span className="text-[8px] text-neonPink/70">📌</span>}
      </div>
      <h4 className="text-xs font-black text-white leading-tight mb-1">{news.title}</h4>
      <p className="text-[10px] text-white/50 line-clamp-2 leading-relaxed">{news.body}</p>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="glass-card-static rounded-lg p-4 border border-white/[0.04]">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-white/5 animate-pulse" />
        <div className="flex-1"><div className="h-3 bg-white/8 rounded animate-pulse mb-1.5 w-3/4" /><div className="h-2 bg-white/5 rounded animate-pulse w-1/2" /></div>
      </div>
      <div className="h-2 bg-white/5 rounded animate-pulse mb-1.5" /><div className="h-2 bg-white/5 rounded animate-pulse w-4/5 mb-3" />
      <div className="h-7 bg-white/5 rounded animate-pulse" />
    </div>
  );
}

export default function ServersTab() {
  const [servers, setServers] = useState<IServer[]>([]);
  const [news, setNews] = useState<IServerNews[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState<string|null>(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [connectServer, setConnectServer] = useState<IServer|null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [{ data: sv }, { data: nw }] = await Promise.all([
          supa.from('rp_servers').select('*').order('sort_order').order('created_at'),
          supa.from('server_news').select('*').order('is_pinned',{ascending:false}).order('created_at',{ascending:false}).limit(8),
        ]);
        if (sv?.length) setServers(sv as IServer[]);
        if (nw?.length) setNews(nw as IServerNews[]);
      } catch(e) { console.error('[ServersTab]', e); }
      finally { setLoading(false); }
    })();
  }, []);

  const filtered = useMemo(() => servers.filter(s => {
    const q = search.toLowerCase();
    return (s.name.toLowerCase().includes(q) || (s.description||'').toLowerCase().includes(q))
      && (!tagFilter || (s.tags||[]).includes(tagFilter))
      && (statusFilter==='ALL' || s.status===statusFilter);
  }), [servers, search, tagFilter, statusFilter]);

  return (
    <div className="slide-in">
      {connectServer && <ConnectModal server={connectServer} onClose={() => setConnectServer(null)} />}
      <div className="mb-6">
        <h2 className="font-orbitron font-black text-2xl tracking-widest mb-1 neon-text-pink">◈ SERVER INTEL DATABASE</h2>
        <p className="text-white/40 text-xs tracking-wider font-bold">
          LIVE FEED — {servers.filter(s=>s.status==='ONLINE').length} SERVERS BROADCASTING
        </p>
      </div>
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1">
          <div className="glass-card-static rounded-lg p-4 mb-4 border border-white/[0.05]">
            <input type="text" placeholder="SEARCH SERVER DATABASE..." value={search} onChange={e=>setSearch(e.target.value)}
              className="w-full bg-transparent text-white text-sm font-bold tracking-wider placeholder-white/25 outline-none pb-2 mb-4"
              style={{borderBottom:'1px solid rgba(255,0,255,0.3)'}} />
            <div className="flex flex-wrap gap-2 mb-3">
              {['ALL','ONLINE','WHITELIST_OPEN','IN_DEVELOPMENT'].map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`text-[10px] px-3 py-1 rounded font-orbitron font-black tracking-wider transition-all border ${statusFilter===s?'border-neonPink/60 bg-neonPink/15 text-neonPink':'border-white/15 text-white/40 hover:border-white/30'}`}>
                  {s==='ALL'?'ALL STATUS':STATUS_CFG[s as ServerStatus]?.label||s}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ALL_TAGS.map(tag => (
                <button key={tag} onClick={() => setTagFilter(tagFilter===tag?null:tag)}
                  className={`text-[9px] px-2 py-0.5 rounded-full font-bold tracking-wider transition-all border ${tagFilter===tag?'border-neonPink/60 bg-neonPink/15 text-neonPink':'border-white/15 text-white/35 hover:border-white/30'}`}>
                  {tag}
                </button>
              ))}
            </div>
          </div>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{[1,2,3,4].map(i=><Skeleton key={i}/>)}</div>
          ) : filtered.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filtered.map(s => <ServerCard key={s.id} server={s} onConnect={setConnectServer}/>)}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="font-orbitron text-sm text-white/25 tracking-widest">NO SERVERS MATCH YOUR FILTERS</div>
              <button onClick={()=>{setSearch('');setTagFilter(null);setStatusFilter('ALL');}}
                className="mt-3 text-[10px] text-neonPink/60 hover:text-neonPink transition-colors font-bold">CLEAR FILTERS</button>
            </div>
          )}
        </div>
        <div className="lg:w-72 xl:w-80">
          <div className="glass-card-static rounded-lg p-4 mb-4 border border-white/[0.05]">
            <h3 className="text-[11px] font-orbitron font-black tracking-widest mb-3 pb-2 text-neonCyan"
              style={{borderBottom:'1px solid rgba(0,255,255,0.2)'}}>◈ INCOMING TRANSMISSIONS</h3>
            {news.length>0 ? news.map(n=><NewsCard key={n.id} news={n}/>) : <p className="text-xs text-white/25 text-center py-4">No transmissions yet</p>}
          </div>
          <div className="glass-card-static rounded-lg p-4 border border-white/[0.05]">
            <h3 className="text-[11px] font-orbitron font-black tracking-widest mb-3" style={{color:'var(--neon-purple)'}}>◈ LIVE STREAMERS</h3>
            <div className="space-y-2">
              {[{name:'SUMMIT1G',url:'https://www.twitch.tv/summit1g'},{name:'SHROUD',url:'https://www.twitch.tv/shroud'},
                {name:'LIRIK',url:'https://www.twitch.tv/lirik'},{name:'MOONMOON',url:'https://www.twitch.tv/moonmoon'}].map(s => (
                <a key={s.name} href={s.url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 p-2 rounded transition-all hover:scale-[1.02] group"
                  style={{background:'rgba(180,79,255,0.08)',border:'1px solid rgba(180,79,255,0.15)'}}>
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                  <span className="text-[11px] font-black text-white/70 flex-1 group-hover:text-white/90">{s.name}</span>
                  <span className="text-[9px] font-black" style={{color:'#9146FF'}}>▶ LIVE</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
