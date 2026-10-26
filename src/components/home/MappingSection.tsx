import React from 'react';
import { useMapComments } from './useMapComments';

interface MappingSectionProps {
  session: any;
  onOpenModal: (id: string, tab?: 'login' | 'register') => void;
}

const MAP_URL = 'https://map.stateofleonida.net/?lang=en';

/** "04 · Mapping Project": the embedded interactive map with its comment thread. */
export function MappingSection({ session, onOpenModal }: MappingSectionProps) {
  const { comments, drafts, setDraft, submit } = useMapComments(session, onOpenModal);

  return (
    <section className="py-20 px-6 max-w-[1280px] mx-auto" id="mapping">
      <div className="flex items-baseline gap-3 border-b border-white/5 pb-5 mb-10">
        <span className="font-orbitron text-xs text-neonPink font-extrabold tracking-widest">04</span>
        <h2 className="font-orbitron font-extrabold text-3xl tracking-widest uppercase">
          Mapping <span className="text-neonCyan">Project</span>
        </h2>
        <span className="text-[10px] font-bold text-gray-500 tracking-widest uppercase ml-auto">
          Leonida speculate cartography
        </span>
      </div>

      <p className="text-xs sm:text-sm text-gray-400 font-bold leading-relaxed max-w-2xl mb-8">
        Stitched speculated mapping overlays created by the GTA cartography mapping Discord, derived directly from 2022 raw development leak coordinates, trailer frames, and South Florida geographical topology.
      </p>

      <div className="flex flex-col gap-10">
        {/* Map Item 1 */}
        <div className="glass-card overflow-hidden border border-white/5 hover:border-neonCyan shadow-2xl flex flex-col">
          <div className="w-full h-[550px] relative overflow-hidden bg-black/80">
            <iframe
              src={MAP_URL}
              title="Interactive Speculative Leonida Map"
              className="w-full h-full border-none"
              loading="lazy"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            />
          </div>
          <div className="p-8 flex flex-col justify-between flex-grow">
            <div>
              <h3 className="font-bold text-2xl text-white font-orbitron tracking-wide mb-3">State of Leonida — Speculative Interactive Map</h3>
              <p className="text-xs text-gray-400 leading-relaxed font-bold max-w-4xl">
                Built dynamically by the GTA Speculative Mapping Syndicate, this frame holds over 120 pins representing locations found in both official trailers, Port Gellhorn coordinates, smuggling airstrips, and residential keys.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-between border-t border-white/5 pt-6 mt-6 gap-4">
              <a href={MAP_URL} target="_blank" rel="noopener noreferrer" className="border border-neonCyan/30 text-neonCyan text-xs font-bold font-orbitron uppercase tracking-widest px-6 py-2.5 rounded hover:bg-neonCyan hover:text-black transition-all">Open Direct View ↗</a>
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider font-orbitron">Updated Realtime</span>
            </div>

            {/* Map Comments Block */}
            <div className="mt-8 pt-6 border-t border-white/5">
              <span className="text-[10px] text-gray-500 uppercase tracking-widest font-extrabold font-orbitron mb-4 block">Speculate Map Intelligence Comments</span>
              <div className="flex flex-col gap-3 max-h-[220px] overflow-y-auto pr-2 no-scrollbar">
                {comments.map1?.length === 0 ? (
                  <div className="text-[10px] text-gray-600 uppercase tracking-widest font-bold font-orbitron py-2">No dispatches logged on Speculate Map A.</div>
                ) : (
                  comments.map1?.map((c: any) => (
                    <div key={c.id} className="bg-[#050508]/60 p-3 rounded border border-white/5 text-xs">
                      <div className="flex justify-between items-center mb-1 text-[9px] font-extrabold font-orbitron uppercase tracking-widest">
                        <span className="text-neonCyan">{c.author_name}</span>
                        <span className="text-gray-600">{new Date(c.created_at).toLocaleDateString()}</span>
                      </div>
                      <p className="text-gray-400 font-bold font-rajdhani">{c.body}</p>
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-2 mt-4">
                <input
                  type="text"
                  value={drafts.map1}
                  onChange={e => setDraft('map1', e.target.value)}
                  placeholder={session ? "Transmit speculate intel..." : "Log in to transmit speculate intel dispatches"}
                  disabled={!session}
                  className="flex-grow bg-[#050508] border border-white/10 rounded px-4 py-2 text-xs font-bold text-white focus:border-neonCyan outline-none disabled:opacity-50"
                />
                <button
                  onClick={() => submit('map1')}
                  disabled={!session || !drafts.map1.trim()}
                  className="btn-neon btn-neon-cyan !py-2 !px-5 !text-[10px] font-orbitron tracking-widest font-bold uppercase disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-neonCyan disabled:hover:shadow-none"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
