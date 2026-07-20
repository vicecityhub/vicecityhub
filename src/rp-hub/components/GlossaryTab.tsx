import React, { useState, useCallback, useEffect } from 'react';
import { supa } from '../../lib/SupabaseClient';

interface IJob {
  id: string; title: string; icon: string; faction: string;
  legality: 'LEGAL'|'ILLEGAL'|'GRAY_ZONE'; salary_range: string; description: string;
  responsibilities: string[]; requirements: string[]; unique_mechanics: string[]; difficulty: number;
}
interface IQuestion {
  id: string; question: string; options: { text: string; type: string }[]; sort_order: number;
}
interface IRPClass { id: string; title: string; subtitle: string; description: string; icon: string; color: string; }

const LEG = {
  LEGAL:     { label:'LEGAL',     cls:'text-emerald-400 border-emerald-400/50' },
  ILLEGAL:   { label:'ILLEGAL',   cls:'text-neonPink border-neonPink/50' },
  GRAY_ZONE: { label:'GRAY ZONE', cls:'text-yellow-400 border-yellow-400/50' },
};

const RP_CLASSES: IRPClass[] = [
  { id:'cop',        title:'The Badge',       subtitle:'Sworn Protector of the Peace (Kinda)', icon:'🚔', color:'#4488ff',
    description:'You live for procedure. Radio chatter, the chase, the paperwork. Probably the most stressful legal job on the server.' },
  { id:'dealer',     title:'The Operator',    subtitle:'Unlicensed Pharmaceutical Distribution', icon:'💊', color:'#FF2D78',
    description:'The streets are your boardroom. High risk, high reward. You have better lawyers than the police chief.' },
  { id:'lawyer',     title:'The Counselor',   subtitle:'Making Crime Legally Defensible', icon:'⚖️', color:'#b44fff',
    description:'You don\'t break laws — you interpret them creatively. Three attempted murderers off on technicalities this week alone.' },
  { id:'ems',        title:'The Medic',       subtitle:'Keeping the Body Count Manageable', icon:'🚑', color:'#00FFFF',
    description:'The unsung hero. You show up after every shootout and get zero respect. You are why the death count stays in double digits.' },
  { id:'mechanic',   title:'The Wrench',      subtitle:'Certified Vehicle Specialist (No Questions Asked)', icon:'🔧', color:'#FFE135',
    description:'Both sides pay well. You have no political opinions. You never saw anything.' },
  { id:'journalist', title:'The Correspondent', subtitle:'Monetizing Other People\'s Disasters', icon:'📺', color:'#FF9900',
    description:'Your press pass has stopped exactly zero bullets. You wear it everywhere. The stream numbers don\'t lie.' },
  { id:'civilian',   title:'The Civilian',    subtitle:'Innocent Bystander (Allegedly)', icon:'🧑', color:'#88cc88',
    description:'You run your little businesses, avoid the drama, and somehow get caught in the crossfire anyway.' },
  { id:'gangster',   title:'The Associate',   subtitle:'Community Organizer (Unauthorized)', icon:'🔫', color:'#FF6622',
    description:'Loyalty, territory, business. In that order. The economy runs on your product. Everyone knows it. Nobody talks about it.' },
];

function DiffBar({ level }: { level: number }) {
  return <div className="flex gap-0.5">{[1,2,3,4,5].map(i=><div key={i} className={`w-4 h-1.5 rounded-sm ${i<=level?'bg-neonPink':'bg-white/15'}`}/>)}</div>;
}

function JobModal({ job, onClose }: { job: IJob; onClose: () => void }) {
  const leg = LEG[job.legality] || LEG.LEGAL;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-card-static rounded-xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6 slide-in border border-neonPink/30"
        onClick={e=>e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{job.icon}</span>
            <div>
              <h2 className="text-lg font-black text-white tracking-wide">{job.title}</h2>
              <p className="text-[11px] text-white/45 tracking-wider">{job.faction}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl font-black">✕</button>
        </div>
        <div className="flex items-center gap-3 mb-4">
          <span className={`text-[10px] font-black px-2 py-0.5 rounded border tracking-widest ${leg.cls}`}>{leg.label}</span>
          <DiffBar level={job.difficulty||3}/>
        </div>
        <p className="text-white/65 text-sm leading-relaxed mb-4 italic">{job.description}</p>
        <div className="mb-4 p-3 rounded-lg bg-neonPink/8 border border-neonPink/20">
          <div className="text-[10px] text-white/40 mb-0.5 tracking-widest">ESTIMATED EARNINGS</div>
          <div className="text-neonPink font-black text-sm">{job.salary_range}</div>
        </div>
        {[{title:'DUTIES',items:job.responsibilities},{title:'REQUIREMENTS',items:job.requirements},{title:'UNIQUE MECHANICS',items:job.unique_mechanics}].map(s=>(
          s.items?.length ? (
            <div key={s.title} className="mb-4">
              <h4 className="text-[10px] font-black tracking-widest text-neonCyan mb-2 border-b border-neonCyan/15 pb-1">◈ {s.title}</h4>
              <ul className="space-y-1">{s.items.map((item,i)=><li key={i} className="text-xs text-white/60 flex gap-2"><span className="text-neonPink mt-0.5">›</span>{item}</li>)}</ul>
            </div>
          ) : null
        ))}
      </div>
    </div>
  );
}

function QuizSection({ questions }: { questions: IQuestion[] }) {
  const [step, setStep] = useState(0);
  const [scores, setScores] = useState<Record<string,number>>({});
  const [selected, setSelected] = useState<string|null>(null);
  const [finished, setFinished] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!questions.length) return <div className="glass-card-static rounded-xl p-5 text-center text-white/30 text-xs">Loading quiz...</div>;
  const q = questions[step];

  const advance = () => {
    if (!selected) return;
    const opt = q.options.find((o:any) => o.text === selected);
    const ns = { ...scores };
    if (opt?.type) ns[opt.type] = (ns[opt.type]||0) + 1;
    setScores(ns);
    setSelected(null);
    if (step+1 >= questions.length) setFinished(true);
    else setStep(step+1);
  };

  const reset = () => { setStep(0); setScores({}); setSelected(null); setFinished(false); };

  if (finished) {
    const topId = Object.entries(scores).sort((a,b)=>b[1]-a[1])[0]?.[0] || 'civilian';
    const result = RP_CLASSES.find(c=>c.id===topId) || RP_CLASSES[6];
    const copyResult = async () => {
      await navigator.clipboard.writeText(`🎮 Vice City Hub RP Test\n\nI'm: ${result.icon} ${result.title}\n"${result.subtitle}"\n\nvicecityhub.github.io/vicecityhub`);
      setCopied(true); setTimeout(()=>setCopied(false),2000);
    };
    return (
      <div className="glass-card-static rounded-xl p-6 text-center slide-in border" style={{borderColor:result.color}}>
        <div className="text-5xl mb-3">{result.icon}</div>
        <div className="text-[10px] tracking-widest text-white/40 mb-1">YOUR RP CLASSIFICATION</div>
        <h3 className="text-2xl font-black mb-1" style={{color:result.color,textShadow:`0 0 15px ${result.color}88`}}>{result.title}</h3>
        <p className="text-sm text-white/50 mb-4 italic">{result.subtitle}</p>
        <p className="text-white/65 text-sm leading-relaxed mb-6">{result.description}</p>
        <div className="flex gap-3 justify-center">
          <button onClick={copyResult} className="btn-neon px-5 py-2.5 rounded text-xs font-black tracking-widest">{copied?'✓ COPIED':'⊕ SHARE RESULT'}</button>
          <button onClick={reset} className="btn-neon btn-neon-cyan px-5 py-2.5 rounded text-xs font-black tracking-widest">↺ RETAKE</button>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card-static rounded-xl p-5 slide-in border border-neonPink/20">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-black tracking-widest text-neonPurple font-orbitron">◈ RP SUITABILITY TEST</h3>
        <span className="text-[10px] text-white/40">{step+1} / {questions.length}</span>
      </div>
      <div className="w-full h-1 bg-white/10 rounded mb-5">
        <div className="progress-bar-fill h-1 rounded" style={{width:`${(step/questions.length)*100}%`}} />
      </div>
      <p className="text-sm font-bold text-white leading-relaxed mb-4">{q.question}</p>
      <div className="space-y-2 mb-5">
        {(q.options||[]).map((opt:any,i:number) => (
          <button key={i} onClick={() => setSelected(opt.text)}
            className={`quiz-option w-full text-left p-3 rounded-lg text-xs text-white/70 ${selected===opt.text?'selected':''}`}>
            <span className="font-black text-neonPurple mr-2">{String.fromCharCode(65+i)}.</span>{opt.text}
          </button>
        ))}
      </div>
      <button onClick={advance} disabled={!selected}
        className={`w-full py-2.5 rounded text-xs font-black tracking-widest transition-all ${selected?'btn-neon':'bg-white/5 border border-white/10 text-white/25 cursor-not-allowed'}`}>
        {step+1>=questions.length?'SUBMIT — GET MY CLASS':'NEXT SCENARIO ›'}
      </button>
    </div>
  );
}

export default function GlossaryTab() {
  const [jobs, setJobs] = useState<IJob[]>([]);
  const [questions, setQuestions] = useState<IQuestion[]>([]);
  const [selectedJob, setSelectedJob] = useState<IJob|null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [{ data: j }, { data: q }] = await Promise.all([
          supa.from('rp_jobs').select('*').order('sort_order').order('created_at'),
          supa.from('quiz_questions').select('*').order('sort_order').order('created_at'),
        ]);
        if (j?.length) setJobs(j as IJob[]);
        if (q?.length) setQuestions(q as IQuestion[]);
      } catch(e) { console.error('[GlossaryTab]', e); }
      finally { setLoading(false); }
    })();
  }, []);

  return (
    <div className="slide-in">
      <div className="mb-6">
        <h2 className="font-orbitron font-black text-2xl tracking-widest mb-1 neon-text-cyan">◈ LEONIDA CLASSIFIED FILES</h2>
        <p className="text-white/40 text-xs tracking-wider font-bold">OCCUPATIONAL DATABASE — STATE OF LEONIDA, SAN ANDREAS</p>
      </div>
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1">
          <p className="text-[11px] text-white/35 tracking-widest mb-4 font-bold">SELECT A PROFESSION TO ACCESS CLASSIFIED DOSSIER</p>
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[1,2,3,4,5,6].map(i=><div key={i} className="glass-card-static rounded-xl p-4 border border-white/[0.04] h-28 animate-pulse"/>)}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {jobs.map(job => {
                const leg = LEG[job.legality] || LEG.LEGAL;
                return (
                  <button key={job.id} onClick={() => setSelectedJob(job)}
                    className="glass-card rounded-xl p-4 text-left group hover:border-neonPink/40 transition-all">
                    <div className="text-2xl mb-2">{job.icon||'💼'}</div>
                    <div className="text-xs font-black text-white mb-1 group-hover:text-neonPink transition-colors">{job.title}</div>
                    <div className={`text-[9px] font-black tracking-widest border px-1.5 py-0.5 rounded inline-block mb-2 ${leg.cls}`}>{leg.label}</div>
                    <div className="text-[10px] text-neonCyan/70 font-bold">{(job.salary_range||'').split('–')[0]}+</div>
                    <div className="mt-2"><DiffBar level={job.difficulty||3}/></div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="lg:w-72 xl:w-80">
          <div className="mb-3">
            <h3 className="text-[11px] font-orbitron font-black tracking-widest text-neonPurple mb-1">◈ WHAT'S YOUR CLASS?</h3>
            <p className="text-[10px] text-white/35">{questions.length} scenarios. One verdict. No appeals.</p>
          </div>
          <QuizSection questions={questions}/>
        </div>
      </div>
      {selectedJob && <JobModal job={selectedJob} onClose={() => setSelectedJob(null)}/>}
    </div>
  );
}
