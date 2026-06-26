import React, { useState, useCallback } from 'react';
import { IJob } from '../types';
import { JOBS, QUIZ_QUESTIONS, RP_CLASSES } from '../data/mockData';

const LEGALITY_CONFIG = {
  LEGAL: { label: 'LEGAL', color: 'text-emerald-400 border-emerald-400/50' },
  ILLEGAL: { label: 'ILLEGAL', color: 'text-[var(--neon-pink)] border-[var(--neon-pink)]/50' },
  GRAY_ZONE: { label: 'GRAY ZONE', color: 'text-yellow-400 border-yellow-400/50' },
};

function DifficultyBar({ level }: { level: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className={`w-4 h-1.5 rounded-sm ${i <= level ? 'bg-[var(--neon-pink)]' : 'bg-white/15'}`} />
      ))}
    </div>
  );
}

function JobModal({ job, onClose }: { job: IJob; onClose: () => void }) {
  const legality = LEGALITY_CONFIG[job.legality];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div
        className="glass-card-pink rounded-xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6 slide-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{job.icon}</span>
            <div>
              <h2 className="text-lg font-black text-white tracking-wide">{job.title}</h2>
              <p className="text-[11px] text-white/45 tracking-wider">{job.faction}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl font-black transition-colors">✕</button>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <span className={`text-[10px] font-black px-2 py-0.5 rounded border tracking-widest ${legality.color}`}>
            {legality.label}
          </span>
          <DifficultyBar level={job.difficulty} />
          <span className="text-[10px] text-white/35 ml-auto">RISK LEVEL</span>
        </div>

        <p className="text-white/65 text-sm leading-relaxed mb-4 italic">{job.description}</p>

        <div className="mb-4 p-3 rounded-lg bg-[rgba(255,45,120,0.08)] border border-[rgba(255,45,120,0.2)]">
          <div className="text-[10px] text-white/40 mb-0.5 tracking-widest">ESTIMATED EARNINGS</div>
          <div className="text-[var(--neon-pink)] font-black text-sm">{job.salary_range}</div>
        </div>

        {[
          { title: 'DUTIES', items: job.responsibilities },
          { title: 'REQUIREMENTS', items: job.requirements },
          { title: 'UNIQUE MECHANICS', items: job.unique_mechanics },
        ].map(section => (
          <div key={section.title} className="mb-4">
            <h4 className="text-[10px] font-black tracking-widest text-[var(--neon-cyan)] mb-2 border-b border-[rgba(0,245,255,0.15)] pb-1">
              ◈ {section.title}
            </h4>
            <ul className="space-y-1">
              {section.items.map((item, i) => (
                <li key={i} className="text-xs text-white/60 flex gap-2">
                  <span className="text-[var(--neon-pink)] mt-0.5">›</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuizSection() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [scores, setScores] = useState<Record<string, number>>({});
  const [finished, setFinished] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const q = QUIZ_QUESTIONS[step];

  const selectOption = useCallback((value: string) => setSelected(value), []);

  const advance = () => {
    if (!selected) return;
    const option = q.options.find(o => o.value === selected)!;
    const newScores = { ...scores };
    Object.entries(option.points).forEach(([key, pts]) => {
      newScores[key] = (newScores[key] || 0) + pts;
    });
    setScores(newScores);
    setAnswers({ ...answers, [q.id]: selected });
    setSelected(null);

    if (step + 1 >= QUIZ_QUESTIONS.length) setFinished(true);
    else setStep(step + 1);
  };

  const reset = () => { setStep(0); setAnswers({}); setScores({}); setFinished(false); setSelected(null); };

  const getResult = () => {
    const topId = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] || 'civilian';
    return RP_CLASSES.find(c => c.id === topId) || RP_CLASSES[RP_CLASSES.length - 1];
  };

  const copyResult = async () => {
    const result = getResult();
    const text = `🎮 Vice City Hub RP Test\n\nI'm: ${result.icon} ${result.title}\n"${result.subtitle}"\n\nvicecityhub.github.io/vicecityhub`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (finished) {
    const result = getResult();
    return (
      <div className="glass-card-pink rounded-xl p-6 text-center slide-in" style={{ borderColor: result.color }}>
        <div className="text-5xl mb-3">{result.icon}</div>
        <div className="text-[10px] tracking-widest text-white/40 mb-1">YOUR RP CLASSIFICATION</div>
        <h3 className="text-2xl font-black mb-1" style={{ color: result.color, textShadow: `0 0 15px ${result.color}88` }}>
          {result.title}
        </h3>
        <p className="text-sm text-white/50 mb-4 italic">{result.subtitle}</p>
        <p className="text-white/65 text-sm leading-relaxed mb-6">{result.description}</p>
        <div className="flex gap-3 justify-center">
          <button onClick={copyResult} className="btn-neon-pink px-5 py-2.5 rounded text-xs font-black tracking-widest">
            {copied ? '✓ COPIED' : '⊕ SHARE RESULT'}
          </button>
          <button onClick={reset} className="btn-neon-cyan px-5 py-2.5 rounded text-xs font-black tracking-widest">
            ↺ RETAKE TEST
          </button>
        </div>
      </div>
    );
  }

  const progress = ((step) / QUIZ_QUESTIONS.length) * 100;

  return (
    <div className="glass-card-pink rounded-xl p-5 slide-in">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-black tracking-widest text-[var(--neon-purple)]">◈ RP SUITABILITY TEST</h3>
        <span className="text-[10px] text-white/40">{step + 1} / {QUIZ_QUESTIONS.length}</span>
      </div>

      <div className="w-full h-1 bg-white/10 rounded mb-5">
        <div className="progress-bar-fill h-1 rounded" style={{ width: `${progress}%` }} />
      </div>

      <p className="text-sm font-bold text-white leading-relaxed mb-4">{q.scenario}</p>

      <div className="space-y-2 mb-5">
        {q.options.map(opt => (
          <button
            key={opt.value}
            onClick={() => selectOption(opt.value)}
            className={`quiz-option w-full text-left p-3 rounded-lg text-xs text-white/70 ${selected === opt.value ? 'selected' : ''}`}
          >
            <span className="font-black text-[var(--neon-purple)] mr-2">{opt.value.toUpperCase()}.</span>
            {opt.label}
          </button>
        ))}
      </div>

      <button
        onClick={advance}
        disabled={!selected}
        className={`w-full py-2.5 rounded text-xs font-black tracking-widest transition-all
          ${selected ? 'btn-neon-pink' : 'bg-white/5 border border-white/10 text-white/25 cursor-not-allowed'}`}
      >
        {step + 1 >= QUIZ_QUESTIONS.length ? 'SUBMIT — GET MY CLASS' : 'NEXT SCENARIO ›'}
      </button>
    </div>
  );
}

export default function GlossaryTab() {
  const [selectedJob, setSelectedJob] = useState<IJob | null>(null);

  return (
    <div className="slide-in">
      <div className="mb-6">
        <h2 className="text-2xl font-black tracking-widest neon-text-cyan mb-1">◈ LEONIDA CLASSIFIED FILES</h2>
        <p className="text-white/40 text-xs tracking-wider">OCCUPATIONAL DATABASE — STATE OF LEONIDA, SAN ANDREAS</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Job Grid */}
        <div className="flex-1">
          <p className="text-[11px] text-white/35 tracking-widest mb-4 font-bold">
            SELECT A PROFESSION TO ACCESS CLASSIFIED DOSSIER
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {JOBS.map(job => {
              const legality = LEGALITY_CONFIG[job.legality];
              return (
                <button
                  key={job.id}
                  onClick={() => setSelectedJob(job)}
                  className="glass-card rounded-xl p-4 text-left server-card-hover group"
                >
                  <div className="text-2xl mb-2">{job.icon}</div>
                  <div className="text-xs font-black text-white mb-1 group-hover:text-[var(--neon-pink)] transition-colors">
                    {job.title}
                  </div>
                  <div className={`text-[9px] font-black tracking-widest border px-1.5 py-0.5 rounded inline-block mb-2 ${legality.color}`}>
                    {legality.label}
                  </div>
                  <div className="text-[10px] text-[var(--neon-cyan)]/70 font-bold">{job.salary_range.split('–')[0]}+</div>
                  <div className="mt-2">
                    <DifficultyBar level={job.difficulty} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Quiz Sidebar */}
        <div className="lg:w-72 xl:w-80">
          <div className="mb-3">
            <h3 className="text-[11px] font-black tracking-widest text-[var(--neon-purple)] mb-1">◈ WHAT'S YOUR CLASS?</h3>
            <p className="text-[10px] text-white/35">7 scenarios. One verdict. No appeals.</p>
          </div>
          <QuizSection />
        </div>
      </div>

      {selectedJob && <JobModal job={selectedJob} onClose={() => setSelectedJob(null)} />}
    </div>
  );
}
