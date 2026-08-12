import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supa } from '../../lib/SupabaseClient';

type Cat = 'SCRIPTS'|'VEHICLES'|'GRAPHICS'|'INTERIORS'|'WEAPONS'|'MAPS';
interface IMod {
  id:string; title:string; author:string; category:Cat;
  description:string; progress_pct:number; votes:number;
  tags:string[]; created_at:string;
}
const CATS: Record<Cat,{label:string;icon:string;color:string}> = {
  SCRIPTS:  {label:'Scripts',  icon:'⚙️',color:'#00FFFF'},
  VEHICLES: {label:'Vehicles', icon:'🚗',color:'#FF9900'},
  GRAPHICS: {label:'Graphics', icon:'🎨',color:'#b44fff'},
  INTERIORS:{label:'Interiors',icon:'🏠',color:'#44ff88'},
  WEAPONS:  {label:'Weapons',  icon:'🔫',color:'#FF2D78'},
  MAPS:     {label:'Maps',     icon:'🗺️',color:'#FFD700'},
};
function PBar({pct,color}:{pct:number;color:string}) {
  return <div className="w-full h-1.5 bg-white/10 rounded overflow-hidden">
    <div className="h-full rounded" style={{width:`${pct}%`,background:color,boxShadow:`0 0 6px ${color}88`}}/>
  </div>;
}

function ModCard({mod,onVote,userId}:{mod:IMod;onVote:(id:string)=>void;userId:string|null}) {
  const cat=CATS[mod.category]||CATS.SCRIPTS;
  const voteKey=`voted_mod_${mod.id}_${userId||'guest'}`;
  const voted=typeof window!=='undefined'&&localStorage.getItem(voteKey)==='true';
  return (
    <div className="glass-card-static rounded-xl p-4 flex flex-col border border-white/[0.06] hover:border-white/15 transition-all duration-200 hover:-translate-y-0.5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
            style={{background:`${cat.color}18`,border:`1px solid ${cat.color}44`,color:cat.color}}>{cat.icon}</div>
          <div>
            <div className="font-black text-sm text-white leading-tight">{mod.title}</div>
            <p className="text-[10px] text-white/40">by {mod.author}</p>
          </div>
        </div>
        <span className="text-[8px] font-black px-2 py-0.5 rounded border tracking-wider flex-shrink-0"
          style={{color:cat.color,borderColor:`${cat.color}55`}}>{cat.label.toUpperCase()}</span>
      </div>
      <p className="text-xs text-white/55 leading-relaxed mb-3 flex-1">{mod.description}</p>
      <div className="flex flex-wrap gap-1 mb-3">
        {(mod.tags||[]).map(t=><span key={t} className="text-[8px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/35">{t}</span>)}
      </div>
      <div className="mb-3">
        <div className="flex justify-between text-[9px] mb-1">
          <span className="text-white/35 font-bold">GTA 6 COMPAT</span>
          <span className="font-black" style={{color:cat.color}}>{mod.progress_pct}%</span>
        </div>
        <PBar pct={mod.progress_pct} color={cat.color}/>
      </div>
      <button onClick={()=>onVote(mod.id)} disabled={voted}
        className={`flex items-center justify-center gap-2 w-full py-2 rounded text-[10px] font-black tracking-wider transition-all
          ${voted?'bg-neonPink/15 border border-neonPink/50 text-neonPink/70 cursor-not-allowed'
            :userId?'btn-neon':'border border-white/20 text-white/40 hover:border-neonCyan hover:text-neonCyan cursor-pointer'}`}>
        <span>{voted?'✓':'▲'}</span>
        <span>{!userId?'SIGN IN TO VOTE':voted?'VOTED':`${mod.votes} UPVOTES`}</span>
      </button>
    </div>
  );
}

export default function ModsTab() {
  const [mods,setMods]=useState<IMod[]>([]);
  const [loading,setLoading]=useState(true);
  const [catF,setCatF]=useState<Cat|'ALL'>('ALL');
  const [sort,setSort]=useState<'votes'|'progress'|'newest'>('votes');
  const [userId,setUserId]=useState<string|null>(null);

  useEffect(()=>{
    supa.auth.getSession().then(({data:{session}})=>setUserId(session?.user?.id||null));
    const {data:{subscription}}=supa.auth.onAuthStateChange((_,s)=>setUserId(s?.user?.id||null));
    return ()=>subscription.unsubscribe();
  },[]);

  useEffect(()=>{
    (async()=>{
      try {
        const {data}=await supa.from('mods_catalog').select('*').order('created_at',{ascending:false});
        if(data?.length) setMods(data as IMod[]);
      } catch(e){console.error('[ModsTab]',e);}
      finally{setLoading(false);}
    })();
  },[]);

  const handleVote=useCallback(async(id:string)=>{
    if(!userId){window.dispatchEvent(new CustomEvent('vch-open-modal',{detail:{id:'auth',tab:'login'}}));return;}
    const key=`voted_mod_${id}_${userId}`;
    if(localStorage.getItem(key)==='true') return;
    const {error}=await supa.from('mod_votes').insert({mod_id:id,user_id:userId}).select();
    if(error&&error.code!=='23505') return;
    localStorage.setItem(key,'true');
    setMods(p=>p.map(m=>m.id===id?{...m,votes:m.votes+1}:m));
  },[userId]);

  const filtered=useMemo(()=>{
    let list=catF==='ALL'?mods:mods.filter(m=>m.category===catF);
    if(sort==='votes') list=[...list].sort((a,b)=>b.votes-a.votes);
    if(sort==='progress') list=[...list].sort((a,b)=>b.progress_pct-a.progress_pct);
    if(sort==='newest') list=[...list].sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime());
    return list;
  },[mods,catF,sort]);

  const topMod=useMemo(()=>[...mods].sort((a,b)=>b.votes-a.votes)[0],[mods]);

  return (
    <div className="slide-in">
      <div className="mb-6">
        <h2 className="font-orbitron font-black text-2xl tracking-widest mb-1 neon-text-purple">◈ MOD VAULT</h2>
        <p className="text-white/40 text-xs tracking-wider font-bold">GTA 6 ADAPTATION STATUS  -  COMMUNITY UPVOTE SYSTEM</p>
      </div>
      {topMod&&(
        <div className="glass-card-static rounded-xl p-4 mb-6 border border-neonPink/30">
          <div className="flex items-center gap-2 mb-1"><span className="text-yellow-400">👑</span>
            <span className="text-[9px] font-orbitron font-black tracking-widest text-yellow-400">MOST WANTED MOD</span></div>
          <div className="flex items-center justify-between">
            <div><h3 className="text-base font-black text-white">{topMod.title}</h3>
              <p className="text-[10px] text-white/40">{topMod.votes} upvotes - {topMod.progress_pct}% GTA6 ready</p></div>
            <span className="text-3xl">{CATS[topMod.category]?.icon}</span>
          </div>
        </div>
      )}
      <div className="glass-card-static rounded-lg p-4 mb-5 flex flex-col sm:flex-row gap-3 border border-white/[0.05]">
        <div className="flex flex-wrap gap-1.5 flex-1">
          <button onClick={()=>setCatF('ALL')} className={`text-[9px] px-3 py-1 rounded font-orbitron font-black tracking-wider border transition-all ${catF==='ALL'?'border-neonPink/60 bg-neonPink/15 text-neonPink':'border-white/10 text-white/30 hover:border-white/25'}`}>ALL</button>
          {Object.entries(CATS).map(([k,v])=>(
            <button key={k} onClick={()=>setCatF(k as Cat)}
              className={`text-[9px] px-3 py-1 rounded font-orbitron font-black tracking-wider border transition-all ${catF===k?'border text-white':'border-white/10 text-white/30 hover:border-white/25'}`}
              style={catF===k?{borderColor:v.color,background:`${v.color}22`,color:v.color}:{}}>
              {v.icon} {v.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {[{id:'votes',l:'▲ TOP'},{id:'progress',l:'⚡ PROGRESS'},{id:'newest',l:'🕑 NEWEST'}].map(s=>(
            <button key={s.id} onClick={()=>setSort(s.id as any)}
              className={`text-[9px] px-3 py-1 rounded font-orbitron font-black tracking-wider border transition-all ${sort===s.id?'border-neonPurple/60 bg-neonPurple/20 text-neonPurple':'border-white/10 text-white/30'}`}>{s.l}</button>
          ))}
        </div>
      </div>
      {loading?(
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i=><div key={i} className="glass-card-static rounded-xl h-52 animate-pulse border border-white/[0.04]"/>)}
        </div>
      ):(
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(m=><ModCard key={m.id} mod={m} onVote={handleVote} userId={userId}/>)}
          {filtered.length===0&&<div className="col-span-3 text-center py-12 text-white/25 font-orbitron text-xs tracking-widest">NO MODS MATCH YOUR FILTERS</div>}
        </div>
      )}
    </div>
  );
}
