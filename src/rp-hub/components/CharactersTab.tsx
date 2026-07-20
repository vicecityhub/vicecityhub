import React, { useState, useRef, useEffect } from 'react';
import { supa } from '../../lib/SupabaseClient';

type Faction = 'LSPD'|'EMS'|'GOV'|'LAWYER'|'VAGOS'|'BALLAS'|'MARABUNTA'|'KKMC'|'CIVILIAN'|'MECHANIC'|'TRUCKER'|'JOURNALIST';
interface IChar { id?:string; first_name:string; last_name:string; age:number; faction:Faction; bio:string; style_tags:string[]; avatar_url?:string; }
interface IWanted { id:string; alias:string; bounty:number; crimes:string[]; danger_level:number; upvotes:number; created_at:string; character?:IChar; }

const FACS=[{v:'LSPD',l:'🚔 LSPD',c:'#4488ff'},{v:'EMS',l:'🚑 EMS',c:'#00FFFF'},{v:'GOV',l:'🏛️ Gov',c:'#FFE135'},{v:'LAWYER',l:'⚖️ Lawyer',c:'#b44fff'},{v:'VAGOS',l:'💛 Vagos',c:'#FFE000'},{v:'BALLAS',l:'💜 Ballas',c:'#9944ff'},{v:'MARABUNTA',l:'💙 Marabunta',c:'#4466ff'},{v:'KKMC',l:'🖤 KKMC',c:'#888'},{v:'CIVILIAN',l:'🧑 Civilian',c:'#88cc88'},{v:'MECHANIC',l:'🔧 Mechanic',c:'#FFD700'},{v:'TRUCKER',l:'🚛 Trucker',c:'#cc8844'},{v:'JOURNALIST',l:'📺 Press',c:'#FF9900'}];
const STYLES=['Street Hustler','Clean Cut','Old Money','Cartel Adjacent','Off-Duty Cop','Undercover Fed','Yacht Club','Track Suit','Biker','Lawyer Vibes','Tourist Energy','Local Legend'];
const CRIMES=['Grand Theft Auto (classified as "borrowing")','Impersonating a licensed electrician','Started a gang war over a parking spot','Laundered money through a lemonade stand','Hacked the MDT and changed everyone\'s names to "Greg"','Shot down a police helicopter with a fire extinguisher','Declared a public bathroom as sovereign territory','Organized a block party with explosives','Bribed three judges using yacht invitations','Filed 14 false insurance claims in one week'];

function IDCard({char,avatar}:{char:IChar;avatar:string|null}) {
  const fac=FACS.find(f=>f.v===char.faction);
  const id=`VCH-${Date.now().toString(36).toUpperCase().slice(-6)}`;
  return (
    <div className="id-card rounded-xl p-5 w-full max-w-sm mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div><div className="text-[8px] tracking-[0.3em] text-neonCyan/70 font-bold">STATE OF LEONIDA</div>
          <div className="text-[10px] tracking-[0.2em] text-neonPink font-black">VICE CITY HUB</div></div>
        <div className="w-8 h-8 rounded-full border-2 border-neonPink/60 flex items-center justify-center">
          <span className="text-neonPink text-xs font-black">VC</span></div>
      </div>
      <div className="flex gap-4 mb-4">
        <div className="w-20 h-24 rounded-lg border-2 border-neonPurple/60 overflow-hidden bg-neonPurple/10 flex items-center justify-center flex-shrink-0">
          {avatar?<img src={avatar} alt="avatar" className="w-full h-full object-cover"/>:<span className="text-3xl opacity-40">{fac?.l.split(' ')[0]||'👤'}</span>}
        </div>
        <div className="flex-1 space-y-2">
          <div><div className="text-[8px] text-white/30 tracking-widest">FULL NAME</div>
            <div className="text-sm font-black text-white">{char.first_name||'—'} {char.last_name}</div></div>
          <div><div className="text-[8px] text-white/30 tracking-widest">AGE</div>
            <div className="text-xs font-bold text-white/80">{char.age>0?`AGE ${char.age}`:'—'}</div></div>
          <div><div className="text-[8px] text-white/30 tracking-widest">AFFILIATION</div>
            <div className="text-[10px] font-black" style={{color:fac?.c||'#fff'}}>{fac?.l||'—'}</div></div>
        </div>
      </div>
      {char.bio&&<div className="mb-3 p-2 rounded bg-black/30 border border-white/10">
        <p className="text-[10px] text-white/65 leading-relaxed line-clamp-3">{char.bio}</p></div>}
      {char.style_tags.length>0&&<div className="flex flex-wrap gap-1 mb-3">
        {char.style_tags.slice(0,3).map(t=><span key={t} className="text-[8px] px-1.5 py-0.5 rounded bg-neonPink/15 border border-neonPink/30 text-neonPink/80">{t}</span>)}</div>}
      <div className="border-t border-white/10 pt-2 flex justify-between">
        <div><div className="text-[7px] text-white/25">CARD ID</div><div className="text-[9px] font-black text-neonCyan/60">{id}</div></div>
        <div className="text-right"><div className="text-[7px] text-white/25">ISSUED</div><div className="text-[9px] text-white/40">{new Date().toLocaleDateString('en-US')}</div></div>
      </div>
    </div>
  );
}

function CharForm() {
  const [char,setChar]=useState<IChar>({first_name:'',last_name:'',age:25,faction:'CIVILIAN',bio:'',style_tags:[]});
  const [avatar,setAvatar]=useState<string|null>(null);
  const [avatarFile,setAvatarFile]=useState<File|null>(null);
  const [showCard,setShowCard]=useState(false);
  const [saving,setSaving]=useState(false);
  const [saved,setSaved]=useState(false);
  const [nameErr,setNameErr]=useState('');
  const [copied,setCopied]=useState(false);
  const fileRef=useRef<HTMLInputElement>(null);

  const onFile=(e:React.ChangeEvent<HTMLInputElement>)=>{
    const f=e.target.files?.[0]; if(!f) return;
    if(f.size>5*1024*1024){alert('Max 5MB');return;}
    setAvatarFile(f);
    const r=new FileReader(); r.onload=ev=>setAvatar(ev.target?.result as string); r.readAsDataURL(f);
  };

  const toggleTag=(t:string)=>setChar(p=>({...p,style_tags:p.style_tags.includes(t)?p.style_tags.filter(x=>x!==t):p.style_tags.length<5?[...p.style_tags,t]:p.style_tags}));

  const generate=()=>{
    if(!char.first_name||!char.last_name){setNameErr('First AND last name required.');return;}
    setNameErr(''); setShowCard(true);
  };

  const save=async()=>{
    const {data:{session}}=await supa.auth.getSession();
    if(!session){alert('Sign in to save your character.');return;}
    setSaving(true);
    try {
      let avatarUrl=char.avatar_url||null;
      if(avatarFile&&session){
        const ext=avatarFile.name.split('.').pop();
        const path=`avatars/${session.user.id}-${Date.now()}.${ext}`;
        const {data:up}=await supa.storage.from('player-media').upload(path,avatarFile,{upsert:true});
        if(up){const {data:{publicUrl}}=supa.storage.from('player-media').getPublicUrl(up.path);avatarUrl=publicUrl;}
      }
      const {error}=await supa.from('rp_characters').insert({
        user_id:session.user.id, first_name:char.first_name, last_name:char.last_name,
        age:char.age, faction:char.faction, bio:char.bio, style_tags:char.style_tags,
        avatar_url:avatarUrl, is_public:true,
      });
      if(error)throw error;
      setSaved(true);
    } catch(e:any){alert('Save failed: '+e.message);}
    finally{setSaving(false);}
  };

  const share=async()=>{
    const fac=FACS.find(f=>f.v===char.faction);
    await navigator.clipboard.writeText(`🪪 VICE CITY HUB ID\n\n${char.first_name} ${char.last_name}, Age ${char.age}\nFaction: ${fac?.l}\n\n"${char.bio||'No bio on file.'}"\n\nvicecityhub.github.io/vicecityhub/rp.html`);
    setCopied(true); setTimeout(()=>setCopied(false),2000);
  };

  return (
    <div className="flex flex-col xl:flex-row gap-6">
      <div className="flex-1 glass-card-static rounded-xl p-5 border border-neonPink/20">
        <h3 className="text-xs font-black tracking-widest text-neonPink mb-5 border-b border-neonPink/20 pb-3 font-orbitron">◈ IDENTITY REGISTRATION</h3>
        <div className="flex items-center gap-4 mb-5">
          <div className="w-16 h-16 rounded-xl border-2 border-dashed border-neonPink/40 overflow-hidden bg-neonPink/5 flex items-center justify-center cursor-pointer hover:border-neonPink transition-colors"
            onClick={()=>fileRef.current?.click()}>
            {avatar?<img src={avatar} alt="" className="w-full h-full object-cover"/>:<span className="text-2xl opacity-40">📷</span>}
          </div>
          <div>
            <button onClick={()=>fileRef.current?.click()} className="btn-neon btn-neon-sm block mb-1">UPLOAD MUGSHOT</button>
            <p className="text-[9px] text-white/30">JPG/PNG max 5MB</p>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile}/>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[{l:'FIRST NAME',k:'first_name',p:'Tommy'},{l:'LAST NAME',k:'last_name',p:'Versetti'}].map(f=>(
            <div key={f.k}><label className="text-[9px] text-white/40 tracking-widest font-bold block mb-1">{f.l}</label>
              <input type="text" placeholder={f.p} value={(char as any)[f.k]}
                onChange={e=>{setChar(p=>({...p,[f.k]:e.target.value}));setNameErr('');}}
                className="w-full bg-black/40 border border-neonPink/25 rounded px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-neonPink/60"/></div>
          ))}
        </div>
        {nameErr&&<p className="text-[10px] text-neonPink mb-3 font-bold">{nameErr}</p>}
        <div className="mb-4"><label className="text-[9px] text-white/40 tracking-widest font-bold block mb-1">AGE <span className="text-neonPink">{char.age}</span></label>
          <input type="range" min={18} max={75} value={char.age} onChange={e=>setChar(p=>({...p,age:+e.target.value}))} className="w-full accent-pink-500"/></div>
        <div className="mb-4"><label className="text-[9px] text-white/40 tracking-widest font-bold block mb-1">FACTION</label>
          <select value={char.faction} onChange={e=>setChar(p=>({...p,faction:e.target.value as Faction}))}
            className="w-full bg-black/50 border border-neonPink/25 rounded px-3 py-2 text-sm text-white outline-none focus:border-neonPink/60">
            {FACS.map(f=><option key={f.v} value={f.v}>{f.l}</option>)}
          </select></div>
        <div className="mb-4"><label className="text-[9px] text-white/40 tracking-widest font-bold block mb-1">BIO ({char.bio.length}/200)</label>
          <textarea placeholder="Your story in Vice City..." value={char.bio} maxLength={200}
            onChange={e=>setChar(p=>({...p,bio:e.target.value}))} rows={3}
            className="w-full bg-black/40 border border-neonPink/25 rounded px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-neonPink/60 resize-none"/></div>
        <div className="mb-5"><label className="text-[9px] text-white/40 tracking-widest font-bold block mb-2">STYLE (max 5)</label>
          <div className="flex flex-wrap gap-1.5">
            {STYLES.map(t=><button key={t} onClick={()=>toggleTag(t)}
              className={`text-[9px] px-2 py-1 rounded-full font-bold tracking-wide transition-all border ${char.style_tags.includes(t)?'bg-neonPink/25 border-neonPink text-neonPink':'border-white/15 text-white/35 hover:border-white/30'}`}>{t}</button>)}
          </div></div>
        <div className="flex gap-2">
          <button onClick={generate} className="btn-neon flex-1 justify-center">🪪 GENERATE ID</button>
          {showCard&&<button onClick={save} disabled={saving||saved} className="btn-neon btn-neon-cyan px-4">
            {saving?'SAVING..':saved?'✓ SAVED':'SAVE'}</button>}
        </div>
      </div>
      <div className="xl:w-80">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[11px] font-orbitron font-black tracking-widest text-neonPurple">◈ ID CARD PREVIEW</h3>
          {showCard&&<button onClick={share} className="btn-neon btn-neon-cyan btn-neon-sm">{copied?'✓ COPIED':'⊕ SHARE'}</button>}
        </div>
        {showCard?<div className="slide-in"><IDCard char={char} avatar={avatar}/><p className="text-[9px] text-white/25 text-center mt-3">Screenshot and flex on Discord.</p></div>
          :<div className="glass-card rounded-xl p-8 text-center border border-dashed border-white/10"><div className="text-4xl mb-3 opacity-30">🪪</div>
            <p className="text-xs text-white/25 font-bold tracking-wider">Fill the form and hit generate.<br/><span className="text-[10px]">Your ID appears here.</span></p></div>}
      </div>
    </div>
  );
}

function WantedBoard() {
  const [cards,setCards]=useState<IWanted[]>([]);
  const [loading,setLoading]=useState(true);
  const [showForm,setShowForm]=useState(false);
  const [alias,setAlias]=useState('');
  const [bounty,setBounty]=useState(25000);
  const [crimes,setCrimes]=useState<string[]>([]);
  const [danger,setDanger]=useState(3);
  const [submitting,setSubmitting]=useState(false);

  useEffect(()=>{
    (async()=>{
      try {
        const {data}=await supa.from('rp_wanted').select('*, character:rp_characters(first_name,last_name,faction,avatar_url)').order('upvotes',{ascending:false}).order('created_at',{ascending:false}).limit(20);
        if(data?.length) setCards(data as IWanted[]);
      } catch(e){console.error('[WantedBoard]',e);}
      finally{setLoading(false);}
    })();
  },[]);

  const toggleCrime=(c:string)=>setCrimes(p=>p.includes(c)?p.filter(x=>x!==c):p.length<4?[...p,c]:p);

  const submit=async()=>{
    if(!alias||!crimes.length) return;
    setSubmitting(true);
    try {
      const {data:{session}}=await supa.auth.getSession();
      // Create anonymous character if not logged in
      let charId:string|null=null;
      if(session){
        const {data:c}=await supa.from('rp_characters').insert({user_id:session.user.id,first_name:alias.split(' ')[0]||alias,last_name:alias.split(' ')[1]||'',age:0,faction:'CIVILIAN',bio:'',style_tags:[],is_public:true}).select('id').single();
        charId=c?.id||null;
      }
      const payload:any={alias:alias.toUpperCase(),bounty,crimes,danger_level:danger,upvotes:0};
      if(charId) payload.character_id=charId;
      if(session) payload.user_id=session.user.id;
      const {data:w,error}=await supa.from('rp_wanted').insert(payload).select('*, character:rp_characters(first_name,last_name,faction,avatar_url)').single();
      if(error)throw error;
      if(w) setCards(p=>[w as IWanted,...p]);
      setShowForm(false); setAlias(''); setBounty(25000); setCrimes([]); setDanger(3);
    } catch(e:any){alert('Failed: '+e.message);}
    finally{setSubmitting(false);}
  };

  const upvote=async(id:string)=>{
    await supa.from('rp_wanted').update({upvotes:supa.rpc('increment' as any,{})}).eq('id',id);
    setCards(p=>p.map(c=>c.id===id?{...c,upvotes:c.upvotes+1}:c));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div><h3 className="font-orbitron font-black text-lg tracking-widest text-orange-400">◈ WANTED BOARD</h3>
          <p className="text-[10px] text-white/35 tracking-wider">LSPD MOST WANTED — VICE CITY DIVISION</p></div>
        <button onClick={()=>setShowForm(!showForm)} className="px-4 py-2 rounded text-[10px] font-orbitron font-black tracking-widest border border-orange-400/50 text-orange-400 hover:bg-orange-400/10 transition-all">+ POST YOURSELF</button>
      </div>
      {showForm&&(
        <div className="glass-card-static rounded-xl p-5 mb-6 slide-in border border-orange-400/30">
          <h4 className="text-[10px] font-orbitron font-black tracking-widest text-orange-400 mb-4">◈ SELF-REPORT FORM</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div><label className="text-[9px] text-white/40 tracking-widest font-bold block mb-1">STREET ALIAS</label>
              <input type="text" placeholder="THE FIXER" value={alias} onChange={e=>setAlias(e.target.value)}
                className="w-full bg-black/40 border border-orange-400/25 rounded px-3 py-2 text-sm text-white font-bold uppercase outline-none focus:border-orange-400/60"/></div>
            <div><label className="text-[9px] text-white/40 tracking-widest font-bold block mb-1">BOUNTY: <span className="text-orange-300">${bounty.toLocaleString()}</span></label>
              <input type="range" min={5000} max={500000} step={5000} value={bounty} onChange={e=>setBounty(+e.target.value)} className="w-full accent-orange-400 mt-2"/></div>
          </div>
          <div className="mb-4"><label className="text-[9px] text-white/40 tracking-widest font-bold block mb-1">DANGER <span className="text-orange-300">{danger}/5</span></label>
            <input type="range" min={1} max={5} value={danger} onChange={e=>setDanger(+e.target.value)} className="w-full accent-orange-400"/></div>
          <div className="mb-4"><label className="text-[9px] text-white/40 tracking-widest font-bold block mb-2">KNOWN OFFENSES (max 4)</label>
            <div className="grid gap-1.5 max-h-40 overflow-y-auto custom-scrollbar">
              {CRIMES.map(c=><button key={c} onClick={()=>toggleCrime(c)}
                className={`text-left text-[10px] px-3 py-1.5 rounded border transition-all ${crimes.includes(c)?'bg-orange-400/15 border-orange-400/60 text-orange-300':'border-white/10 text-white/40 hover:border-orange-400/30'}`}>
                {crimes.includes(c)&&'✓ '}{c}</button>)}
            </div></div>
          <div className="flex gap-3">
            <button onClick={submit} disabled={!alias||!crimes.length||submitting}
              className={`flex-1 py-2.5 rounded text-xs font-orbitron font-black tracking-widest transition-all border ${alias&&crimes.length&&!submitting?'border-orange-400/60 text-orange-400 hover:bg-orange-400/10':'border-white/10 text-white/25 cursor-not-allowed'}`}>
              {submitting?'POSTING...':'POST TO BOARD'}</button>
            <button onClick={()=>setShowForm(false)} className="px-4 py-2.5 rounded text-xs font-black border border-white/10 text-white/30 hover:text-white/50">CANCEL</button>
          </div>
        </div>
      )}
      {loading?<div className="text-center py-8 text-white/30 font-orbitron text-xs tracking-widest animate-pulse">LOADING INTEL...</div>:(
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map(card=>{
            const dc=['','#44ff88','#aaff44','#ffdd00','#ff8800','#FF2D78'][card.danger_level]||'#FF2D78';
            return (
              <div key={card.id} className="wanted-card rounded-xl p-4 relative">
                <div className="absolute top-2 right-2 rotate-12 opacity-90">
                  <div className="text-[10px] px-2 py-0.5 border-2 border-orange-400/70 text-orange-400/70 rounded font-black tracking-wider uppercase">WANTED</div>
                </div>
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-14 h-16 rounded bg-orange-400/10 border border-orange-400/30 flex items-center justify-center flex-shrink-0 text-2xl overflow-hidden">
                    {card.character?.avatar_url?<img src={card.character.avatar_url} alt="" className="w-full h-full object-cover"/>:'👤'}
                  </div>
                  <div>
                    <div className="text-[8px] text-orange-400/60 tracking-widest mb-0.5">AKA</div>
                    <div className="text-sm text-orange-300 font-black uppercase leading-tight">{card.alias}</div>
                    {card.character&&<div className="text-[10px] text-white/50 mt-1">{card.character.first_name} {card.character.last_name}</div>}
                  </div>
                </div>
                <div className="flex items-center justify-between mb-3 p-2 rounded bg-black/40 border border-orange-400/20">
                  <span className="text-[9px] text-orange-400/60 font-bold tracking-widest">BOUNTY</span>
                  <span className="font-orbitron font-black text-orange-300 text-sm">${card.bounty.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1.5 mb-3">
                  <span className="text-[8px] text-white/30 tracking-wider">DANGER:</span>
                  {[1,2,3,4,5].map(i=><div key={i} className="w-3 h-2 rounded-sm" style={{background:i<=card.danger_level?dc:'rgba(255,255,255,0.1)'}}/>)}
                </div>
                <div className="mb-3"><div className="text-[8px] text-orange-400/50 tracking-widest mb-1.5 font-bold">KNOWN OFFENSES</div>
                  <ul className="space-y-1">{card.crimes.map((c,i)=><li key={i} className="text-[10px] text-white/55 flex gap-1.5"><span className="text-orange-400/60">›</span>{c}</li>)}</ul>
                </div>
                <button onClick={()=>upvote(card.id)} className="w-full text-center text-[9px] font-black text-orange-400/60 hover:text-orange-400 transition-colors">
                  ▲ {card.upvotes} upvotes
                </button>
              </div>
            );
          })}
          {cards.length===0&&<div className="col-span-3 text-center py-12 text-white/25 font-orbitron text-xs tracking-widest">NO WANTED CARDS YET. BE THE FIRST.</div>}
        </div>
      )}
    </div>
  );
}

export default function CharactersTab() {
  const [section,setSection]=useState<'builder'|'wanted'>('builder');
  return (
    <div className="slide-in">
      <div className="mb-6">
        <h2 className="font-orbitron font-black text-2xl tracking-widest mb-1 neon-text-purple">◈ IDENTITY FORGE</h2>
        <p className="text-white/40 text-xs tracking-wider font-bold">CREATE • SAVE • FLEX • GET HUNTED</p>
      </div>
      <div className="flex gap-1 mb-6 p-1 glass-card-static rounded-lg w-fit border border-white/[0.05]">
        {[{id:'builder',l:'🪪 ID FORGE'},{id:'wanted',l:'🔫 WANTED BOARD'}].map(s=>(
          <button key={s.id} onClick={()=>setSection(s.id as any)}
            className={`px-5 py-2 rounded text-[10px] font-orbitron font-black tracking-widest transition-all ${section===s.id?'bg-neonPurple/25 border border-neonPurple text-neonPurple':'text-white/35 hover:text-white/55'}`}>
            {s.l}
          </button>
        ))}
      </div>
      {section==='builder'?<CharForm/>:<WantedBoard/>}
    </div>
  );
}
