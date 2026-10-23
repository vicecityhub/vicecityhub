import React, { useCallback, useEffect, useState } from 'react';
import { supa } from '../lib/SupabaseClient';

/**
 * v13: Vice City Hustle post-game panel - leaderboard, share card and a Ko-fi nudge.
 * Rendered by ViceArcadeGame when the run is over. Scores are honor-system (the DB only enforces sane bounds).
 */
const SITE = 'https://vicecityhub.github.io/vicecityhub/';
const KOFI = 'https://ko-fi.com/vicecityhub';

type Row = { player_name: string; score: number; level_name: string | null };
interface Props { score: number; levelName: string; gameOver: boolean }

const fmt = (n: number) => '$' + n.toLocaleString('en-US');

function drawCard(score: number, levelName: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 1200; c.height = 630;
  const g = c.getContext('2d')!;
  const bg = g.createLinearGradient(0, 0, 0, 630);
  bg.addColorStop(0, '#12002b'); bg.addColorStop(0.6, '#4a0a52'); bg.addColorStop(1, '#ff2d78');
  g.fillStyle = bg; g.fillRect(0, 0, 1200, 630);
  // sun
  g.fillStyle = '#ffb300'; g.beginPath(); g.arc(600, 410, 140, Math.PI, 0); g.fill();
  // neon grid floor
  g.strokeStyle = 'rgba(0,240,255,0.55)'; g.lineWidth = 2;
  for (let i = -14; i <= 14; i++) { g.beginPath(); g.moveTo(600 + i * 26, 410); g.lineTo(600 + i * 170, 630); g.stroke(); }
  for (let y = 0; y < 8; y++) { const yy = 410 + Math.pow(y / 8, 2) * 220; g.beginPath(); g.moveTo(0, yy); g.lineTo(1200, yy); g.stroke(); }
  g.textAlign = 'center'; g.shadowColor = '#ff2d78'; g.shadowBlur = 24; g.fillStyle = '#ffffff';
  g.font = '900 46px Impact, "Arial Black", sans-serif'; g.fillText('VICE CITY HUSTLE', 600, 84);
  g.font = '900 124px Impact, "Arial Black", sans-serif'; g.fillText(fmt(score), 600, 214);
  g.shadowBlur = 0; g.fillStyle = '#00f0ff'; g.font = 'bold 34px monospace'; g.fillText('REACHED: ' + levelName, 600, 268);
  g.fillStyle = '#ffffff'; g.font = 'bold 28px monospace'; g.fillText('BEAT ME: vicecityhub.github.io/vicecityhub', 600, 598);
  return c;
}

export default function HustleLeaderboard({ score, levelName, gameOver }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [name, setName] = useState(() => { try { return localStorage.getItem('vch_hustle_name') || ''; } catch { return ''; } });
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [rank, setRank] = useState<number | null>(null);

  const load = useCallback(async () => {
    const { data } = await supa.from('hustle_scores').select('player_name,score,level_name').order('score', { ascending: false }).limit(3);
    if (data) setRows(data as Row[]);
  }, []);

  useEffect(() => {
    if (gameOver) { setState('idle'); setRank(null); void load(); }
  }, [gameOver, load]);

  if (!gameOver || score < 1) return null;

  const text = `I just hit ${fmt(score)} in Vice City Hustle (${levelName}). Think you can outrun the cops better than a fan site? #GTA6 #ViceCityHub`;

  const submit = async () => {
    const n = name.replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 16);
    if (!n || state === 'sending') return;
    setState('sending');
    try { localStorage.setItem('vch_hustle_name', n); } catch { /* private mode */ }
    const { error } = await supa.from('hustle_scores').insert({ player_name: n, score, level_name: levelName });
    if (error) { setState('error'); return; }
    const { count } = await supa.from('hustle_scores').select('id', { count: 'exact', head: true }).gt('score', score);
    setRank((count ?? 0) + 1);
    setState('done');
    void load();
  };

  const shareX = () => window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(SITE), '_blank', 'noopener');
  const download = () => drawCard(score, levelName).toBlob((b) => {
    if (!b) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = `vice-city-hustle-${score}.png`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }, 'image/png');
  const nativeShare = async () => {
    try {
      const blob = await new Promise<Blob | null>((res) => drawCard(score, levelName).toBlob(res, 'image/png'));
      if (blob) {
        const file = new File([blob], 'vice-city-hustle.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ text, url: SITE, files: [file] }); return; }
      }
      if (navigator.share) { await navigator.share({ text, url: SITE }); return; }
    } catch { /* user cancelled or unsupported */ }
    shareX();
  };

  const btn = 'px-2 py-1 rounded font-orbitron font-black text-[9px] tracking-widest uppercase transition-all hover:brightness-125';
  return (
    <div className="absolute left-2 right-2 bottom-2 z-20 rounded-lg p-2 text-[11px] text-white"
      style={{ background: 'rgba(7,7,15,0.92)', border: '1px solid rgba(255,45,120,0.55)', boxShadow: '0 0 18px rgba(255,45,120,0.25)' }}
      onClick={(e) => e.stopPropagation()}>
      {state === 'done' ? (
        <div className="font-orbitron font-black text-[10px] tracking-widest text-neonCyan">SCORE LOGGED{rank ? ` - RANK #${rank}` : ''}</div>
      ) : (
        <div className="flex gap-2 items-center">
          <input value={name} maxLength={16} placeholder="YOUR STREET NAME"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') void submit(); }}
            className="flex-1 min-w-0 px-2 py-1 rounded bg-black/60 border border-white/20 text-white placeholder-white/30 outline-none focus:border-neonPink font-mono text-[11px]" />
          <button className={btn} style={{ background: '#FF2D78', color: '#fff' }} disabled={state === 'sending' || !name.trim()} onClick={() => void submit()}>
            {state === 'sending' ? '...' : 'Log it'}
          </button>
        </div>
      )}
      {state === 'error' && <div className="mt-1 text-[10px] text-yellow-300">Could not log that score. Try again later.</div>}
      <div className="flex flex-wrap gap-1.5 mt-2">
        <button className={btn} style={{ border: '1px solid #00F0FF', color: '#00F0FF' }} onClick={() => void nativeShare()}>Share</button>
        <button className={btn} style={{ border: '1px solid #00F0FF', color: '#00F0FF' }} onClick={shareX}>Post on X</button>
        <button className={btn} style={{ border: '1px solid rgba(255,255,255,0.35)', color: '#fff' }} onClick={download}>Save card</button>
        <a className={btn} style={{ border: '1px solid #FFB300', color: '#FFB300' }} href={KOFI} target="_blank" rel="noopener noreferrer">Fund the heist</a>
      </div>
      {rows.length > 0 && (
        <ol className="mt-2 space-y-0.5 font-mono text-[10px] text-white/70">
          {rows.map((r, i) => (
            <li key={i} className="flex justify-between gap-2"><span className="truncate">#{i + 1} {r.player_name}</span><span className="text-neonCyan">{fmt(r.score)}</span></li>
          ))}
        </ol>
      )}
    </div>
  );
}
