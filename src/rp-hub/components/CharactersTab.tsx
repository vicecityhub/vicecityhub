import React, { useState, useRef, useCallback } from 'react';
import { ICharacter, IWantedCard, CharacterFaction } from '../types';
import { FACTIONS, STYLE_TAGS, CRIME_TEMPLATES, MOCK_WANTED } from '../data/mockData';

// ──────────────────────────────────────────────
// ID CARD COMPONENT
// ──────────────────────────────────────────────
function IDCard({ character, avatarPreview }: { character: ICharacter; avatarPreview: string | null }) {
  const faction = FACTIONS.find(f => f.value === character.faction);
  const cardId = `VCH-${Date.now().toString(36).toUpperCase().slice(-6)}`;
  const issueDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });

  return (
    <div className="id-card rounded-xl p-5 w-full max-w-sm mx-auto scanline">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[8px] tracking-[0.3em] text-[var(--neon-cyan)]/70 font-bold">STATE OF LEONIDA</div>
          <div className="text-[10px] tracking-[0.2em] text-[var(--neon-pink)] font-black">VICE CITY HUB</div>
          <div className="text-[7px] text-white/30 tracking-wider">OFFICIAL RESIDENT ID</div>
        </div>
        <div className="w-8 h-8 rounded-full border-2 border-[var(--neon-pink)]/60 flex items-center justify-center">
          <span className="text-[var(--neon-pink)] text-xs font-black">VC</span>
        </div>
      </div>

      <div className="flex gap-4 mb-4">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <div className="w-20 h-24 rounded-lg border-2 border-[var(--neon-purple)]/60 overflow-hidden bg-[rgba(180,79,255,0.1)] flex items-center justify-center">
            {avatarPreview ? (
              <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="text-center">
                <div className="text-3xl">{faction?.label.split(' ')[0] || '👤'}</div>
              </div>
            )}
          </div>
          <div className="text-[8px] text-center text-[var(--neon-purple)]/60 mt-1 tracking-wider">PHOTO ID</div>
        </div>

        {/* Info */}
        <div className="flex-1 space-y-2">
          <div>
            <div className="text-[8px] text-white/30 tracking-widest">FULL NAME</div>
            <div className="text-sm font-black text-white tracking-wide leading-tight">
              {character.first_name || '—'} {character.last_name || ''}
            </div>
          </div>
          <div>
            <div className="text-[8px] text-white/30 tracking-widest">DATE OF BIRTH</div>
            <div className="text-xs font-bold text-white/80">
              {character.age > 0 ? `AGE ${character.age}` : '—'}
            </div>
          </div>
          <div>
            <div className="text-[8px] text-white/30 tracking-widest">AFFILIATION</div>
            <div className="text-[10px] font-black" style={{ color: faction?.color || '#fff' }}>
              {faction?.label || '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Bio */}
      {character.bio && (
        <div className="mb-3 p-2 rounded bg-[rgba(0,0,0,0.3)] border border-white/10">
          <div className="text-[8px] text-white/30 tracking-widest mb-1">BACKGROUND</div>
          <p className="text-[10px] text-white/65 leading-relaxed line-clamp-3">{character.bio}</p>
        </div>
      )}

      {/* Style Tags */}
      {character.style_tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {character.style_tags.slice(0, 3).map(tag => (
            <span key={tag} className="text-[8px] px-1.5 py-0.5 rounded bg-[rgba(255,45,120,0.15)] border border-[rgba(255,45,120,0.3)] text-[var(--neon-pink)]/80">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-white/10 pt-2 flex justify-between items-end">
        <div>
          <div className="text-[7px] text-white/25 tracking-widest">CARD ID</div>
          <div className="text-[9px] font-black text-[var(--neon-cyan)]/60">{cardId}</div>
        </div>
        <div className="text-right">
          <div className="text-[7px] text-white/25 tracking-widest">ISSUED</div>
          <div className="text-[9px] text-white/40">{issueDate}</div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// WANTED CARD COMPONENT
// ──────────────────────────────────────────────
function WantedCard({ card }: { card: IWantedCard }) {
  const dangerColors = ['', '#44ff88', '#aaff44', '#ffdd00', '#ff8800', '#ff2d78'];
  const color = dangerColors[card.danger_level];

  return (
    <div className="wanted-card rounded-xl p-4 relative overflow-hidden">
      {/* WANTED stamp */}
      <div className="absolute top-2 right-2 rotate-12 opacity-90">
        <div className="wanted-stamp text-[10px] px-2 py-0.5 border-2 border-orange-400/70 text-orange-400/70 rounded">
          WANTED
        </div>
      </div>

      {/* Avatar */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-14 h-16 rounded bg-[rgba(255,140,0,0.1)] border border-orange-400/30 flex items-center justify-center flex-shrink-0 text-2xl overflow-hidden">
          {card.character.avatar_url ? (
            <img src={card.character.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            FACTIONS.find(f => f.value === card.character.faction)?.label.split(' ')[0] || '👤'
          )}
        </div>
        <div>
          <div className="text-[8px] text-orange-400/60 tracking-widest mb-0.5">AKA</div>
          <div className="wanted-stamp text-sm text-orange-300 leading-tight">{card.alias}</div>
          <div className="text-[10px] text-white/50 mt-1">
            {card.character.first_name} {card.character.last_name}, {card.character.age}
          </div>
        </div>
      </div>

      {/* Bounty */}
      <div className="flex items-center justify-between mb-3 p-2 rounded bg-[rgba(0,0,0,0.4)] border border-orange-400/20">
        <span className="text-[9px] text-orange-400/60 tracking-widest font-bold">BOUNTY</span>
        <span className="font-black text-orange-300 text-sm">${card.bounty.toLocaleString()}</span>
      </div>

      {/* Danger */}
      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-[8px] text-white/30 tracking-wider">DANGER:</span>
        {[1,2,3,4,5].map(i => (
          <div key={i} className="w-3 h-2 rounded-sm" style={{ background: i <= card.danger_level ? color : 'rgba(255,255,255,0.1)' }} />
        ))}
      </div>

      {/* Crimes */}
      <div>
        <div className="text-[8px] text-orange-400/50 tracking-widest mb-1.5 font-bold">KNOWN OFFENSES</div>
        <ul className="space-y-1">
          {card.crimes.map((crime, i) => (
            <li key={i} className="text-[10px] text-white/55 flex gap-1.5">
              <span className="text-orange-400/60">›</span>
              {crime}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// CHARACTER FORM
// ──────────────────────────────────────────────
function CharacterForm() {
  const [char, setChar] = useState<ICharacter>({
    first_name: '', last_name: '', age: 25,
    faction: 'CIVILIAN', bio: '', style_tags: [],
  });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [showCard, setShowCard] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [nameError, setNameError] = useState('');
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleAvatarChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Max 5MB homie.'); return; }
    const reader = new FileReader();
    reader.onload = ev => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const validateName = (first: string, last: string) => {
    const nameReg = /^[A-Za-z]+$/;
    if (first && !nameReg.test(first)) return 'First name: letters only';
    if (last && !nameReg.test(last)) return 'Last name: letters only';
    return '';
  };

  const toggleStyleTag = (tag: string) => {
    setChar(prev => ({
      ...prev,
      style_tags: prev.style_tags.includes(tag)
        ? prev.style_tags.filter(t => t !== tag)
        : prev.style_tags.length < 5 ? [...prev.style_tags, tag] : prev.style_tags,
    }));
  };

  const handleGenerate = () => {
    const err = validateName(char.first_name, char.last_name);
    if (err) { setNameError(err); return; }
    if (!char.first_name || !char.last_name) { setNameError('First AND last name required, chief.'); return; }
    setNameError('');
    setShowCard(true);
  };

  const copyCardText = async () => {
    const faction = FACTIONS.find(f => f.value === char.faction);
    const text = `🪪 VICE CITY HUB — RESIDENT ID\n\n${char.first_name} ${char.last_name}, Age ${char.age}\nFaction: ${faction?.label}\n\n"${char.bio || 'No bio on file.'}\n\nvicecityhub.github.io/vicecityhub`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col xl:flex-row gap-6">
      {/* Form */}
      <div className="flex-1">
        <div className="glass-card-pink rounded-xl p-5">
          <h3 className="text-xs font-black tracking-widest text-[var(--neon-pink)] mb-5 border-b border-[rgba(255,45,120,0.2)] pb-3">
            ◈ IDENTITY REGISTRATION FORM
          </h3>

          {/* Avatar Upload */}
          <div className="flex items-center gap-4 mb-5">
            <div
              className="w-16 h-16 rounded-xl border-2 border-dashed border-[rgba(255,45,120,0.4)] overflow-hidden bg-[rgba(255,45,120,0.05)] flex items-center justify-center cursor-pointer hover:border-[var(--neon-pink)] transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              {avatarPreview
                ? <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
                : <span className="text-2xl opacity-40">📷</span>
              }
            </div>
            <div>
              <button
                onClick={() => fileRef.current?.click()}
                className="btn-neon-pink px-3 py-1.5 rounded text-[10px] font-black tracking-wider block mb-1"
              >
                {uploading ? 'UPLOADING...' : 'UPLOAD MUGSHOT'}
              </button>
              <p className="text-[9px] text-white/30">JPG/PNG, max 5MB</p>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>

          {/* Name Row */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { label: 'FIRST NAME', key: 'first_name', placeholder: 'Tommy' },
              { label: 'LAST NAME', key: 'last_name', placeholder: 'Versetti' },
            ].map(field => (
              <div key={field.key}>
                <label className="text-[9px] text-white/40 tracking-widest font-bold block mb-1">{field.label}</label>
                <input
                  type="text"
                  placeholder={field.placeholder}
                  value={(char as any)[field.key]}
                  onChange={e => {
                    setChar(prev => ({ ...prev, [field.key]: e.target.value }));
                    setNameError('');
                  }}
                  className="w-full bg-[rgba(0,0,0,0.4)] border border-[rgba(255,45,120,0.25)] rounded px-3 py-2 text-sm text-white font-bold placeholder-white/20 outline-none focus:border-[var(--neon-pink)] transition-colors"
                />
              </div>
            ))}
          </div>
          {nameError && <p className="text-[10px] text-[var(--neon-pink)] mb-3 font-bold">{nameError}</p>}

          {/* Age */}
          <div className="mb-4">
            <label className="text-[9px] text-white/40 tracking-widest font-bold block mb-1">
              AGE <span className="text-[var(--neon-pink)]">{char.age}</span>
            </label>
            <input
              type="range" min={18} max={75} value={char.age}
              onChange={e => setChar(prev => ({ ...prev, age: parseInt(e.target.value) }))}
              className="w-full accent-pink-500"
            />
            <div className="flex justify-between text-[8px] text-white/25 mt-0.5">
              <span>18</span><span>75</span>
            </div>
          </div>

          {/* Faction */}
          <div className="mb-4">
            <label className="text-[9px] text-white/40 tracking-widest font-bold block mb-1">FACTION / AFFILIATION</label>
            <select
              value={char.faction}
              onChange={e => setChar(prev => ({ ...prev, faction: e.target.value as CharacterFaction }))}
              className="w-full bg-[rgba(0,0,0,0.5)] border border-[rgba(255,45,120,0.25)] rounded px-3 py-2 text-sm text-white font-bold outline-none focus:border-[var(--neon-pink)] transition-colors"
            >
              {FACTIONS.map(f => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>

          {/* Bio */}
          <div className="mb-4">
            <label className="text-[9px] text-white/40 tracking-widest font-bold block mb-1">
              BACKGROUND / BIO
              <span className="text-white/25 ml-2">({char.bio.length}/200)</span>
            </label>
            <textarea
              placeholder="Moved to Vice City in '87. Never looked back. The rest is court records..."
              value={char.bio}
              maxLength={200}
              onChange={e => setChar(prev => ({ ...prev, bio: e.target.value }))}
              rows={3}
              className="w-full bg-[rgba(0,0,0,0.4)] border border-[rgba(255,45,120,0.25)] rounded px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-[var(--neon-pink)] transition-colors resize-none"
            />
          </div>

          {/* Style Tags */}
          <div className="mb-5">
            <label className="text-[9px] text-white/40 tracking-widest font-bold block mb-2">
              STYLE ATTRIBUTES <span className="text-white/25">(pick up to 5)</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {STYLE_TAGS.map(tag => (
                <button
                  key={tag}
                  onClick={() => toggleStyleTag(tag)}
                  className={`text-[9px] px-2 py-1 rounded-full font-bold tracking-wide transition-all border
                    ${char.style_tags.includes(tag)
                      ? 'bg-[rgba(255,45,120,0.25)] border-[var(--neon-pink)] text-[var(--neon-pink)]'
                      : 'border-white/15 text-white/35 hover:border-white/30'}`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            className="btn-neon-pink w-full py-3 rounded-lg text-sm font-black tracking-widest pulse-glow"
          >
            🪪 GENERATE VICE CITY ID
          </button>
        </div>
      </div>

      {/* ID Card Preview */}
      <div className="xl:w-80">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[11px] font-black tracking-widest text-[var(--neon-purple)]">◈ ID CARD PREVIEW</h3>
          {showCard && (
            <button onClick={copyCardText} className="btn-neon-cyan px-3 py-1 rounded text-[9px] font-black tracking-wider">
              {copied ? '✓ COPIED' : '⊕ SHARE'}
            </button>
          )}
        </div>

        {showCard ? (
          <div className="slide-in">
            <IDCard character={char} avatarPreview={avatarPreview} />
            <p className="text-[9px] text-white/25 text-center mt-3">
              Screenshot this bad boy. Flex it on the Discord.
            </p>
          </div>
        ) : (
          <div className="glass-card rounded-xl p-8 text-center border border-dashed border-white/10">
            <div className="text-4xl mb-3 opacity-30">🪪</div>
            <p className="text-xs text-white/25 font-bold tracking-wider">
              Fill in the form and hit generate.<br />
              <span className="text-[10px]">Your ID card will appear here.</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// WANTED BOARD
// ──────────────────────────────────────────────
function WantedBoard() {
  const [wantedList, setWantedList] = useState<IWantedCard[]>(MOCK_WANTED);
  const [showForm, setShowForm] = useState(false);
  const [alias, setAlias] = useState('');
  const [bounty, setBounty] = useState(10000);
  const [selectedCrimes, setSelectedCrimes] = useState<string[]>([]);
  const [dangerLevel, setDangerLevel] = useState<1|2|3|4|5>(3);

  const toggleCrime = (crime: string) => {
    setSelectedCrimes(prev =>
      prev.includes(crime)
        ? prev.filter(c => c !== crime)
        : prev.length < 4 ? [...prev, crime] : prev
    );
  };

  const submitWanted = () => {
    if (!alias || selectedCrimes.length === 0) return;
    const newCard: IWantedCard = {
      id: `w${Date.now()}`,
      character_id: 'user',
      character: {
        first_name: alias.split(' ')[0] || 'Unknown',
        last_name: alias.split(' ')[1] || '',
        age: 0, faction: 'CIVILIAN', bio: '', style_tags: [],
      },
      alias: alias.toUpperCase(),
      bounty,
      crimes: selectedCrimes,
      danger_level: dangerLevel,
      created_at: new Date().toISOString(),
    };
    setWantedList(prev => [newCard, ...prev]);
    setShowForm(false);
    setAlias(''); setBounty(10000); setSelectedCrimes([]); setDangerLevel(3);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-black tracking-widest text-orange-400">◈ WANTED BOARD</h3>
          <p className="text-[10px] text-white/35 tracking-wider">LSPD MOST WANTED — VICE CITY DIVISION</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 rounded text-[10px] font-black tracking-widest border border-orange-400/50 text-orange-400 hover:bg-orange-400/10 transition-all"
        >
          + POST YOURSELF
        </button>
      </div>

      {/* Submit Form */}
      {showForm && (
        <div className="glass-card-pink rounded-xl p-5 mb-6 slide-in border border-orange-400/30">
          <h4 className="text-[10px] font-black tracking-widest text-orange-400 mb-4">◈ SELF-REPORT FORM</h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-[9px] text-white/40 tracking-widest font-bold block mb-1">STREET ALIAS</label>
              <input
                type="text" placeholder="THE FIXER"
                value={alias}
                onChange={e => setAlias(e.target.value)}
                className="w-full bg-[rgba(0,0,0,0.4)] border border-orange-400/25 rounded px-3 py-2 text-sm text-white font-bold placeholder-white/20 outline-none focus:border-orange-400/60 uppercase"
              />
            </div>
            <div>
              <label className="text-[9px] text-white/40 tracking-widest font-bold block mb-1">
                BOUNTY: <span className="text-orange-300">${bounty.toLocaleString()}</span>
              </label>
              <input
                type="range" min={5000} max={500000} step={5000} value={bounty}
                onChange={e => setBounty(parseInt(e.target.value))}
                className="w-full accent-orange-400 mt-2"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="text-[9px] text-white/40 tracking-widest font-bold block mb-1">
              DANGER LEVEL: <span className="text-orange-300">{dangerLevel}/5</span>
            </label>
            <input
              type="range" min={1} max={5} value={dangerLevel}
              onChange={e => setDangerLevel(parseInt(e.target.value) as 1|2|3|4|5)}
              className="w-full accent-orange-400"
            />
          </div>

          <div className="mb-4">
            <label className="text-[9px] text-white/40 tracking-widest font-bold block mb-2">
              KNOWN OFFENSES <span className="text-white/25">(select up to 4)</span>
            </label>
            <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto pr-1">
              {CRIME_TEMPLATES.map(crime => (
                <button
                  key={crime}
                  onClick={() => toggleCrime(crime)}
                  className={`text-left text-[10px] px-3 py-1.5 rounded border transition-all
                    ${selectedCrimes.includes(crime)
                      ? 'bg-orange-400/15 border-orange-400/60 text-orange-300'
                      : 'border-white/10 text-white/40 hover:border-orange-400/30'}`}
                >
                  {selectedCrimes.includes(crime) && '✓ '}{crime}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={submitWanted}
              disabled={!alias || selectedCrimes.length === 0}
              className={`flex-1 py-2.5 rounded text-xs font-black tracking-widest transition-all
                ${alias && selectedCrimes.length > 0
                  ? 'border border-orange-400/60 text-orange-400 hover:bg-orange-400/10'
                  : 'border border-white/10 text-white/25 cursor-not-allowed'}`}
            >
              POST TO BOARD
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2.5 rounded text-xs font-black tracking-widest border border-white/10 text-white/30 hover:text-white/50 transition-all">
              CANCEL
            </button>
          </div>
        </div>
      )}

      {/* Wanted Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {wantedList.map(card => <WantedCard key={card.id} card={card} />)}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// MAIN EXPORT
// ──────────────────────────────────────────────
export default function CharactersTab() {
  const [section, setSection] = useState<'builder' | 'wanted'>('builder');

  return (
    <div className="slide-in">
      <div className="mb-6">
        <h2 className="text-2xl font-black tracking-widest neon-text-purple mb-1">◈ IDENTITY FORGE</h2>
        <p className="text-white/40 text-xs tracking-wider">VICE CITY RESIDENT SERVICES — CREATE, FLEX, GET HUNTED</p>
      </div>

      <div className="flex gap-1 mb-6 p-1 glass-card rounded-lg w-fit">
        {[
          { id: 'builder', label: '🪪 ID FORGE', desc: 'Build your character' },
          { id: 'wanted', label: '🔫 WANTED BOARD', desc: 'Most dangerous residents' },
        ].map(s => (
          <button
            key={s.id}
            onClick={() => setSection(s.id as 'builder' | 'wanted')}
            className={`px-5 py-2 rounded text-[10px] font-black tracking-widest transition-all
              ${section === s.id
                ? 'bg-[rgba(180,79,255,0.25)] border border-[var(--neon-purple)] text-[var(--neon-purple)]'
                : 'text-white/35 hover:text-white/55'}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === 'builder' ? <CharacterForm /> : <WantedBoard />}
    </div>
  );
}
