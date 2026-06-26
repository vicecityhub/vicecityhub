import React, { useState } from 'react';
import { Search, Download, BookOpen, User, Flame, Compass, Cpu, FileText, ChevronRight, Check } from 'lucide-react';

interface Chapter {
  id: string;
  num: string;
  title: string;
  category: 'leaks' | 'characters' | 'weapons' | 'world' | 'engine';
  summary: string;
  details: string[];
  image?: string;
}

const DATABASE_CHAPTERS: Chapter[] = [
  {
    id: 'leaks',
    num: 'CH 01',
    title: 'The September 18, 2022 Intelligence Breach',
    category: 'leaks',
    summary: 'The historic event that exposed Grand Theft Auto VI development telemetry to the public sphere.',
    image: 'https://lpglkglhjdqnktybksth.supabase.co/storage/v1/object/public/photos/Vice%20City%20Sign%20_%20Sunset%20Flyover.png',
    details: [
      'HISTORIC BREACH DETAILS: On September 18, 2022, an attacker named teapotuberhacker breached Rockstar\'s internal Confluence servers and Slack channels, downloading 90+ early development videos showcasing active gameplay telemetry.',
      'TWEAKED EUPHORIA PHYSICS: Tweaked Euphoria ragdoll physics engine can be seen active when enemies fall or the playable characters jump down and dynamically ragdoll from elevations, introducing natural skeletal dynamics.',
      'RDR2 LIGHTING & SKYBOX PIPELINES: Lighting and skybox volumetric cloud rendering engines from Red Dead Redemption 2 are present and integrated into the next-generation global lighting subsystem.',
      'HEAVY VOLUMETRIC FOG (Americas 2022-04-06 15-55-26): Leaked video during a police shootout showcases a massive amount of dense volumetric fog. While fog existed in GTA V, this represents a major leap where you can barely see anything beyond a couple of meters.',
      'STORY STAGES DEBUGS: Debug character labels inside the development telemetry are dynamically numbered based on the active stage of the story progression.',
      'WORLD EVENT TRIGGER RULES: Every single open-world event evaluates active player rules. Events display "NotPassing" when conditions are unmet, and "Passing" when conditions are met (marked by green dots in logs). Some rules include "isPlayableCharacter (PlayerLucia or PlayerJason)", "isWantedRule", and dynamic progression scripts.'
    ]
  },
  {
    id: 'characters',
    num: 'CH 02',
    title: 'Protagonist & Community Intelligence Dossiers',
    category: 'characters',
    summary: 'Comprehensive profile assessment of the dual protagonists and key supporting actors in the Leonida underground.',
    image: 'https://lpglkglhjdqnktybksth.supabase.co/storage/v1/object/public/photos/Vice%20City%20Kingpin%20_%20Hero%20Portrait.png',
    details: [
      'LUCIA CAMINOS (Protagonist): Designed as the "Bonnie" of the central romantic duo. burly burglary telemetry suggests a hacker background. Her arc is shown starting paroled from a correctional facility.',
      'JASON DUVAL (Protagonist): The "Clyde" companion in a deep romantic relationship with Lucia, as evidenced by gameplay dialogues and cooperative actions during active diner robberies.',
      'WYMAN: A close associate and friend of Boobie. Wyman acts as a key coordinator, introducing Jason and Lucia to Boobie and getting in touch with a couple of local music artists in the underground scene.',
      'TIT BILLY: A DJ at Dre\'s nightclub and a close friend of Dre. Dossiers show Tit Billy is on extremely thin ice after insulting Dre for not bringing his drinks. Dre tells him this attitude is why "no one likes him" and considers firing him.',
      'KAI & SUPPORTING PLAYERS: Kai is a close associate of Dre seen struggling with relationship conflicts with his partner at the nightclub. Other verified characters include Sam, Zach, RB Shaw, Vicky, Iris, and Shanese (spotted under the moniker "@shaneycee" in Trailer 1).'
    ]
  },
  {
    id: 'weapons',
    num: 'CH 03',
    title: 'Tactical Combat, Weaponry, & Systems Gear',
    category: 'weapons',
    summary: 'Analysis of the expanded tactical combat mechanics, inventory constraints, and verified gear.',
    image: 'https://lpglkglhjdqnktybksth.supabase.co/storage/v1/object/public/photos/Vice%20City%20Pursuit%20_%20Low%20Angle.png',
    details: [
      'AUTO DIALER: A high-tech digital countermeasures item carried by Lucia, used to trigger automatic calls for fraud or network technical disruption during tactical infiltration.',
      'IMMOBILIZER BYPASS: Used to hijack and steal luxury vehicles. Bypassing vehicle immobilizers requires the player to match keycodes using a PDA device, reminiscent of the luxury car mechanics in GTA Chinatown Wars.',
      'TRACKER JAMMER: A specialized electronic counter-GPS device. It prevents GPS tracking devices from receiving or transmitting coordinate telemetries, used to suppress police locator signals.',
      'SLIM JIM: Used for mechanical lock picking. It is physically limited to unlocking older car doors, since it cannot bypass newer vehicles equipped with modern internal defense barrier blocks and lock rod shrouds.',
      'SURVIVAL GEAR: Core recovery inventory includes Painkillers, Trauma Kits, Cigarettes, Food & Drink items, alongside tactical gear like Crowbars, Torches/Flashlights, Binoculars, Pool Cues, Duffle Bags, and Backpacks for active looting.',
      'TACTICAL ACTIONS: Expanded mechanics feature prone crawling (similar to Max Payne 3), Aim Shoulder-Swapping, Buddy-Up cover commands, and dynamic hostage-taking scenarios.'
    ]
  },
  {
    id: 'world',
    num: 'CH 04',
    title: 'Leonida World Geography & Enterable Structures',
    category: 'world',
    summary: 'Comprehensive geographical telemetry of Leonida\'s cities, swamps, and 157+ enterable buildings.',
    image: 'https://lpglkglhjdqnktybksth.supabase.co/storage/v1/object/public/photos/Vice%20City%20Hub%20_%20Neon%20Bar%20Interior.png',
    details: [
      '157+ CONFIRMED ENTERABLE BUILDINGS: Debug files "pedpopulation.cpp (3032)" in the class "CPedPopulation::AddPed(CScenarioSpawnHelper)" verify at least 157 unique enterable interiors (e.g. "/ss15lok_1_gfa_bespoke Room:1/room-Main"), directly linking interiors to expanded theft and robbery loops.',
      'MALIBU CLUB & JACK OF HEARTS: Premium nightlife interiors verified in telemetry logs (such as "Americas_1 2022-08-02 20-20-00") include the legendary Malibu Club and the Jack of Hearts Strip Club.',
      'PORT GELLHORN DELIVERY WORKSHOPS (Americas 2022-05-25 13-29-33): Leaked logs detail a delivery van event near Port Gellhorn industrial warehouses. Garages feature warning signs regarding security cameras, requiring stealth to avoid detection.',
      'DELIVERY/PICKUP & WAREHOUSE EVENTS: World activities include specific Port Gellhorn warehouse deliveries and pickups (GET_SLTH delivery event, Pickup Warehouse event) where players hijack cargo vans.',
      'EXPANDED ROBBERY MECHANICS: Robberies (like the Hank\'s Waffles diner sequence or pawn shop runs) feature detailed interior states (dirtiness on strip club and waffles diner floors). Players can search vehicle trunks, loot cash registers, and break open cargo containers (exclusive to Jason\'s tracking abilities).'
    ]
  },
  {
    id: 'engine',
    num: 'CH 05',
    title: 'Next-Generation RAGE Engine Architecture',
    category: 'engine',
    summary: 'Analysis of the revolutionary software pipelines driving rendering and physics in Leonida.',
    image: 'https://lpglkglhjdqnktybksth.supabase.co/storage/v1/object/public/photos/Coastal%20Skyline%20Overdrive.png',
    details: [
      'GLOBAL REAL-TIME RAY TRACING: Built on Rockstar\'s next-gen proprietary RAGE engine, featuring real-time ray-traced global illumination, reflection pipelines on wet tarmac surfaces, and active light scattering.',
      'VOLUMETRIC CLOUDS & SKYBOX FLUIDS: Uses the highly praised atmospheric simulator from RDR2 but scaled up to support dynamic storms, hurricanes, offshore wind swells, and realistic coastal erosion.',
      'ADVANCED OCEAN HYDRODYNAMICS: Realistic water tide simulations, high-fidelity boat wave hydrodynamics, dynamic sea height variations, and underwater sunbeam light diffusion.',
      'VEHICLE DEFORMATION & TYRE TELEMETRY: Cars feature high-fidelity skeletal structural damage deformation modeling, detailed tire physics telemetry, dynamic engine temperature indices, and realistic exhaust systems.',
      'NPC LONG-TERM MEMORY SCHEMAS: Implementing Take-Two\'s revolutionary AI memory patents, enabling NPCs to recognize player clothes, vehicle models, facial descriptions, and criminal history within specific sectors, altering local police search responses.'
    ]
  }
];

export default function Document() {
  const [activeTab, setActiveTab] = useState<'all' | 'leaks' | 'characters' | 'weapons' | 'world' | 'engine'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);

  const handleDownloadClick = () => {
    // PDF name in root workspace
    const link = document.createElement('a');
    link.href = '/The GTA VI Document (v1.6).pdf';
    link.download = 'The GTA VI Document (v1.6).pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  // Filter Chapters
  const filteredChapters = DATABASE_CHAPTERS.filter(chapter => {
    const matchesTab = activeTab === 'all' || chapter.category === activeTab;
    const matchesSearch = 
      chapter.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      chapter.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      chapter.details.some(d => d.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesTab && matchesSearch;
  });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'leaks': return <FileText size={16} className="text-neonPink" />;
      case 'characters': return <User size={16} className="text-neonCyan" />;
      case 'weapons': return <Flame size={16} className="text-neonOrange" />;
      case 'world': return <Compass size={16} className="text-green-400" />;
      default: return <Cpu size={16} className="text-purple-400" />;
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'leaks': return 'border-neonPink/25 text-neonPink bg-neonPink/5';
      case 'characters': return 'border-neonCyan/25 text-neonCyan bg-neonCyan/5';
      case 'weapons': return 'border-neonOrange/25 text-neonOrange bg-neonOrange/5';
      case 'world': return 'border-green-500/25 text-green-400 bg-green-500/5';
      default: return 'border-purple-500/25 text-purple-400 bg-purple-500/5';
    }
  };

  return (
    <div className="w-full">
      {/* HEADER BANNER */}
      <header className="min-h-[40vh] flex flex-col items-center justify-center text-center px-6 relative overflow-hidden bg-radial-hero py-16">
        <div className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(ellipse_80%_50%_at_50%_85%,rgba(0,229,255,0.06)_0%,transparent_60%)]" />
        
        <div className="relative z-10 flex flex-col items-center max-w-4xl">
          <div className="font-orbitron text-[10px] sm:text-xs font-bold tracking-[0.3em] text-neonCyan uppercase border border-neonCyan/40 px-6 py-2.5 rounded-full bg-neonCyan/5 shadow-[0_0_15px_rgba(0,255,255,0.15)] mb-6 animate-pulse">
            LEONIDA INTELLIGENCE DATABASE &mdash; DECRYPTED DATA
          </div>

          <h1 className="font-orbitron font-black text-4xl sm:text-6xl uppercase tracking-tighter bg-gradient-to-br from-white via-neonCyan to-neonPink bg-clip-text text-transparent filter drop-shadow-2xl">
            THE GTA VI DOCUMENT
          </h1>

          <p className="text-xs sm:text-sm text-gray-400 font-bold max-w-lg mx-auto mt-4 leading-relaxed font-rajdhani uppercase tracking-widest">
            Interactive analytical framework for document version 1.6 detailing leaked structures, weapons matrices, protagonists profiles, and RAGE engine specs.
          </p>
        </div>
      </header>

      <div className="gradient-line" />

      {/* DOWNLOAD BANNER */}
      <section className="py-8 px-6 max-w-[1280px] mx-auto z-10 relative">
        <div className="glass-card p-8 border-neonCyan/30 bg-gradient-to-r from-neonCyan/5 via-transparent to-transparent flex flex-col lg:flex-row justify-between items-center gap-6 shadow-2xl">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-lg bg-neonCyan/10 border border-neonCyan/25 flex items-center justify-center text-neonCyan text-2xl shrink-0 shadow-lg">
              📕
            </div>
            <div>
              <h3 className="font-orbitron font-bold text-lg text-white uppercase tracking-wide">
                Download Official Document PDF
              </h3>
              <p className="text-xs text-gray-400 font-bold font-rajdhani mt-1 max-w-2xl leading-relaxed">
                Unlock the entire, unabridged 150-page "The GTA VI Document (v1.6)" containing full geographical grids, coordinate telemetry charts, and comprehensive fan analysis in high resolution.
              </p>
              <div className="flex flex-wrap gap-4 mt-3 text-[10px] text-gray-500 font-bold uppercase tracking-wider font-orbitron">
                <span>File: The GTA VI Document (v1.6).pdf</span>
                <span>•</span>
                <span>Size: ~51 MB</span>
                <span>•</span>
                <span>Version: v1.6 Decrypted</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleDownloadClick}
            className={`px-8 py-3 rounded font-orbitron text-xs font-bold uppercase tracking-widest transition-all border flex items-center gap-2.5 group shrink-0 ${
              downloadSuccess
                ? 'border-green-500 text-green-400 bg-green-500/10 shadow-[0_0_20px_rgba(0,255,0,0.2)]'
                : 'border-neonCyan text-neonCyan hover:bg-neonCyan hover:text-black hover:scale-105 shadow-[0_0_15px_rgba(0,255,255,0.15)]'
            }`}
          >
            {downloadSuccess ? (
              <>
                <Check size={16} /> Decryption Complete!
              </>
            ) : (
              <>
                <Download size={16} className="group-hover:translate-y-0.5 transition-transform" /> Decrypt &amp; Download PDF
              </>
            )}
          </button>
        </div>
      </section>

      {/* SEARCH AND CHAPTER DISPLAY */}
      <section className="pb-24 px-6 max-w-[1280px] mx-auto z-10 relative">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mt-6 items-start">
          
          {/* Left Navigation and Filter Sidebar */}
          <div className="lg:col-span-1 flex flex-col gap-6 lg:sticky lg:top-[90px]">
            {/* Search inputs */}
            <div className="glass-card p-5 border-white/5 shadow-xl flex flex-col gap-3">
              <label className="text-xs text-gray-400 font-bold uppercase tracking-wider font-orbitron">Database Search</label>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-[#050508]/80 border border-white/10 focus:border-neonCyan outline-none rounded p-2.5 pl-9 text-xs text-white transition-all font-rajdhani placeholder-gray-600 font-bold"
                  placeholder="Query chapters..."
                />
                <Search className="absolute left-3 top-3 text-gray-600" size={14} />
              </div>
            </div>

            {/* Interactive Chapter List */}
            <div className="glass-card p-5 border-white/5 shadow-xl flex flex-col gap-2">
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest font-orbitron mb-2 ml-2">
                Intelligence Chapters
              </span>
              <button
                onClick={() => setActiveTab('all')}
                className={`w-full py-2.5 px-4 rounded text-left text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-between ${
                  activeTab === 'all' ? 'bg-neonCyan/10 text-neonCyan border border-neonCyan/30' : 'text-gray-400 hover:bg-white/5'
                }`}
              >
                <span>Show All Folders</span>
                <BookOpen size={14} />
              </button>

              <div className="h-px bg-white/5 my-2" />

              <button
                onClick={() => setActiveTab('leaks')}
                className={`w-full py-2.5 px-4 rounded text-left text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-between ${
                  activeTab === 'leaks' ? 'bg-neonPink/10 text-neonPink border border-neonPink/30 font-orbitron' : 'text-gray-400 hover:bg-white/5 font-orbitron'
                }`}
              >
                <span>CH 01: Leak Intel</span>
                <ChevronRight size={14} />
              </button>
              <button
                onClick={() => setActiveTab('characters')}
                className={`w-full py-2.5 px-4 rounded text-left text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-between ${
                  activeTab === 'characters' ? 'bg-neonCyan/10 text-neonCyan border border-neonCyan/30 font-orbitron' : 'text-gray-400 hover:bg-white/5 font-orbitron'
                }`}
              >
                <span>CH 02: Character Logs</span>
                <ChevronRight size={14} />
              </button>
              <button
                onClick={() => setActiveTab('weapons')}
                className={`w-full py-2.5 px-4 rounded text-left text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-between ${
                  activeTab === 'weapons' ? 'bg-neonOrange/10 text-neonOrange border border-neonOrange/30 font-orbitron' : 'text-gray-400 hover:bg-white/5 font-orbitron'
                }`}
              >
                <span>CH 03: Weapons Grid</span>
                <ChevronRight size={14} />
              </button>
              <button
                onClick={() => setActiveTab('world')}
                className={`w-full py-2.5 px-4 rounded text-left text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-between ${
                  activeTab === 'world' ? 'bg-green-500/10 text-green-400 border border-green-500/30 font-orbitron' : 'text-gray-400 hover:bg-white/5 font-orbitron'
                }`}
              >
                <span>CH 04: Geography Maps</span>
                <ChevronRight size={14} />
              </button>
              <button
                onClick={() => setActiveTab('engine')}
                className={`w-full py-2.5 px-4 rounded text-left text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-between ${
                  activeTab === 'engine' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30 font-orbitron' : 'text-gray-400 hover:bg-white/5 font-orbitron'
                }`}
              >
                <span>CH 05: RAGE Specs</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* Right Content area */}
          <div className="lg:col-span-3 flex flex-col gap-8">
            {filteredChapters.length === 0 ? (
              <div className="glass-card p-16 text-center border border-white/5">
                <FileText size={40} className="text-neonPink mx-auto mb-4 animate-bounce" />
                <div className="text-white font-orbitron font-extrabold text-lg uppercase tracking-wider">No Chapters Found</div>
                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-2 max-w-sm mx-auto leading-relaxed">
                  No decrypted pages match your current search terms inside the GTA VI Database logs.
                </p>
              </div>
            ) : (
              filteredChapters.map(chapter => (
                <div
                  key={chapter.id}
                  className="glass-card border border-white/5 hover:border-neonCyan transition-all duration-300 p-8 shadow-2xl"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4 mb-6">
                    <div className="flex items-center gap-3">
                      <span className="font-orbitron font-black text-2xl text-neonCyan neon-text-cyan shrink-0">
                        {chapter.num}
                      </span>
                      <h2 className="font-orbitron font-bold text-xl text-white tracking-wide">
                        {chapter.title}
                      </h2>
                    </div>

                    <span className={`border text-[9px] font-extrabold tracking-widest px-3 py-1 uppercase rounded font-orbitron shrink-0 flex items-center gap-1.5 ${getCategoryBadge(chapter.category)}`}>
                      {getCategoryIcon(chapter.category)}
                      {chapter.category}
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-neonOrange tracking-wide font-orbitron uppercase font-bold mb-6">
                    Summary: {chapter.summary}
                  </p>

                  {chapter.image && (
                    <div className="mb-6 relative group overflow-hidden rounded border border-white/5 shadow-2xl aspect-video max-h-[220px]">
                      <img
                        src={chapter.image}
                        alt={chapter.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 scroll-dynamic-img"
                        loading="lazy"
                      />
                    </div>
                  )}

                  <div className="space-y-4">
                    {chapter.details.map((detail, index) => (
                      <div key={index} className="flex items-start gap-3 text-xs sm:text-sm text-gray-300 leading-relaxed font-semibold font-rajdhani border-l-2 border-neonCyan/20 pl-4 hover:border-neonCyan transition-colors">
                        {detail}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

        </div>
      </section>
    </div>
  );
}
