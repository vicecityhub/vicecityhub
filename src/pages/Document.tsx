import React, { useState, useMemo } from 'react';

type VClass = 'All'|'Supercar'|'Sports'|'Muscle'|'Sedan'|'SUV'|'Motorcycle'|'Boat'|'Utility'|'Off-Road';
interface IVehicle {
  id: string; name: string; maker: string; cls: VClass; body: string;
  seats: number; realLife: string; status: 'NEW'|'RETURNING'|'CONFIRMED';
  desc: string; wiki: string; year?: string;
}

const VEHICLES: IVehicle[] = [
  { id:'cheetah95', name:"Grotti Cheetah '95", maker:'Grotti', cls:'Supercar', body:'2-door coupe', seats:2, realLife:'Ferrari Testarossa', status:'NEW', year:'1995', desc:'Ultimate Edition bonus. Mid-engine Italian supercar with pop-up headlights. The most talked-about new car in GTA VI.', wiki:'https://gta.fandom.com/wiki/Cheetah' },
  { id:'furia', name:'Grotti Furia', maker:'Grotti', cls:'Supercar', body:'2-door coupe', seats:2, realLife:'Ferrari SF90 Stradale', status:'RETURNING', desc:'The hybrid hypercar from GTA Online returns. One of the fastest cars on Leonida coastal highways.', wiki:'https://gta.fandom.com/wiki/Furia' },
  { id:'pariah', name:'Ocelot Pariah', maker:'Ocelot', cls:'Supercar', body:'2-door coupe', seats:2, realLife:'Jaguar F-Type SVR', status:'RETURNING', desc:'Former king of top speed in GTA Online. Sleek British lines with enough power to outrun anything on the Vice City highway.', wiki:'https://gta.fandom.com/wiki/Pariah' },
  { id:'locust', name:'Ocelot Locust', maker:'Ocelot', cls:'Supercar', body:'2-door coupe', seats:2, realLife:'Lotus Elise', status:'RETURNING', desc:'Featherweight track weapon. Handling so sharp it borders on telepathic. Confirmed returning for Leonida.', wiki:'https://gta.fandom.com/wiki/Locust' },
  { id:'comet', name:'Pfister Comet S2 Cabrio', maker:'Pfister', cls:'Sports', body:'2-door convertible', seats:2, realLife:'Porsche 911 Cabriolet', status:'RETURNING', desc:'Drop-top German engineering. The Cabriolet version of the legendary Comet with extensive customization options.', wiki:'https://gta.fandom.com/wiki/Comet_S2_Cabrio' },
  { id:'elegy', name:'Annis Elegy Retro Custom', maker:'Annis', cls:'Sports', body:'2-door coupe', seats:2, realLife:'Nissan Skyline GT-R R32', status:'RETURNING', desc:'JDM legend. The Retro Custom variant with RWB-style wide-body returns to Leonida with updated liveries.', wiki:'https://gta.fandom.com/wiki/Elegy_Retro_Custom' },
  { id:'drafter', name:'Obey 8F Drafter', maker:'Obey', cls:'Sports', body:'2-door coupe', seats:2, realLife:'Audi RS5 Coupe', status:'RETURNING', desc:'German sports coupe confirmed multiple times in Trailer 2. Reliable, balanced, and fast.', wiki:'https://gta.fandom.com/wiki/8F_Drafter' },
  { id:'sultan', name:'Karin Sultan RS', maker:'Karin', cls:'Sports', body:'4-door sedan', seats:4, realLife:'Subaru Impreza WRX STI', status:'RETURNING', desc:'Fan-favorite rally car with signature widebody returns. AWD and turbocharged for maximum Leonida sideways action.', wiki:'https://gta.fandom.com/wiki/Sultan_RS' },
  { id:'novak', name:'Lampadati Novak', maker:'Lampadati', cls:'Sports', body:'2-door coupe', seats:2, realLife:'Alfa Romeo Giulia GTA', status:'RETURNING', desc:'Italian flair meets Vice City sunshine. Agile sports coupe confirmed in the Extended Look trailer.', wiki:'https://gta.fandom.com/wiki/Novak' },
  { id:'tailgater', name:'Obey Tailgater S', maker:'Obey', cls:'Sports', body:'4-door sedan', seats:4, realLife:'Audi A6 Allroad', status:'RETURNING', desc:'Executive sporty wagon confirmed returning in GTA VI footage.', wiki:'https://gta.fandom.com/wiki/Tailgater_S' },
  { id:'alvino', name:'Principe Alvino V1', maker:'Principe', cls:'Motorcycle', body:'Sport motorcycle', seats:1, realLife:'Ducati Panigale V4', status:'NEW', desc:'Confirmed on the official GTA VI cover art. Italian superbike making its GTA debut. Extremely high top speed.', wiki:'https://gta.fandom.com/wiki/Grand_Theft_Auto_VI' },
  { id:'dominator67', name:"Vapid Dominator '67", maker:'Vapid', cls:'Muscle', body:'2-door convertible', seats:2, realLife:'Ford Mustang (1967)', status:'NEW', year:'1967', desc:'Seen in the Extended Look. Classic American muscle with a drop-top. Type: Muscle car, Body: 2-door convertible, Manufacturer: Vapid, Year: 1967.', wiki:'https://gta.fandom.com/wiki/Dominator' },
  { id:'dominatorbuggy', name:"Vapid Dominator '67 Buggy", maker:'Vapid', cls:'Muscle', body:'2-door buggy', seats:2, realLife:'Ford Mustang Buggy', status:'NEW', year:'1967', desc:'Ultimate Edition exclusive off-road variant of the Dominator. Lifted, roll-caged, and ready for Leonida dirt roads.', wiki:'https://gta.fandom.com/wiki/Dominator' },
  { id:'dominatorgtx', name:'Vapid Dominator GTX', maker:'Vapid', cls:'Muscle', body:'2-door coupe', seats:2, realLife:'Ford Mustang Shelby GT500', status:'RETURNING', desc:'The most powerful factory Dominator. Wide-body kit, supercharged V8, enough tire smoke to block out the Miami sun.', wiki:'https://gta.fandom.com/wiki/Dominator_GTX' },
  { id:'buffalo', name:'Bravado Buffalo STX', maker:'Bravado', cls:'Muscle', body:'4-door sedan', seats:4, realLife:'Dodge Charger Hellcat', status:'RETURNING', desc:'One of the most celebrated confirmations from the trailers. GTA equivalent of the Dodge Charger returns with widebody and supercharged Hellcat engine.', wiki:'https://gta.fandom.com/wiki/Buffalo_STX' },
  { id:'vamos', name:'Declasse Vamos', maker:'Declasse', cls:'Muscle', body:'2-door coupe', seats:2, realLife:'Chevrolet Nova SS', status:'RETURNING', desc:'GTA Online exclusive now returning to story mode. Classic 70s American muscle with one of the most stylish builds in the franchise.', wiki:'https://gta.fandom.com/wiki/Vamos' },
  { id:'sabre', name:'Declasse Sabre Turbo', maker:'Declasse', cls:'Muscle', body:'2-door coupe', seats:2, realLife:'Oldsmobile Cutlass', status:'RETURNING', desc:'GTA classic. The turbocharged coupe with lowrider DNA confirmed for Leonida streets.', wiki:'https://gta.fandom.com/wiki/Sabre_Turbo' },
  { id:'tornado', name:'Declasse Tornado', maker:'Declasse', cls:'Muscle', body:'2-door convertible', seats:2, realLife:'Chevrolet Bel Air', status:'RETURNING', desc:'50s cruiser culture in GTA VI. The classic convertible is a natural fit for Vice City beach boulevards.', wiki:'https://gta.fandom.com/wiki/Tornado' },
  { id:'df8', name:'Imponte DF8-90', maker:'Imponte', cls:'Muscle', body:'2-door coupe', seats:2, realLife:'Pontiac Firebird Trans Am', status:'RETURNING', desc:'The Firebird-inspired coupe returns. V8 power, pop-up headlights, and a hood decal that earns respect.', wiki:'https://gta.fandom.com/wiki/DF8-90' },
  { id:'creado', name:'Vapid Creado', maker:'Vapid', cls:'Muscle', body:'4-door sedan', seats:4, realLife:'Ford (1970s)', status:'NEW', desc:"Jason's personal car and the GTA VI hero vehicle. The first named new vehicle in the game. Expected to be highly customizable.", wiki:'https://gta.fandom.com/wiki/Grand_Theft_Auto_VI' },
  { id:'intruder', name:'Karin Intruder', maker:'Karin', cls:'Sedan', body:'4-door sedan', seats:4, realLife:'Toyota Crown', status:'RETURNING', desc:'Spotted 3 times in Trailer 1 — red with a dancer on the roof, two silver units in Leonida traffic. A true Leonida street staple.', wiki:'https://gta.fandom.com/wiki/Intruder' },
  { id:'stanier55', name:"Vapid Stanier '55", maker:'Vapid', cls:'Sedan', body:'4-door sedan', seats:4, realLife:'Ford (1955)', status:'NEW', year:'1955', desc:"Classic 1950s American full-size confirmed for GTA VI. Police and taxi variants expected. New addition to the Stanier family.", wiki:'https://gta.fandom.com/wiki/Stanier' },
  { id:'emperor', name:'Albany Emperor', maker:'Albany', cls:'Sedan', body:'4-door sedan', seats:5, realLife:'Cadillac DeVille', status:'RETURNING', desc:'Full-size Cadillac-inspired luxury barge spotted in Leonida traffic with various liveries.', wiki:'https://gta.fandom.com/wiki/Emperor' },
  { id:'alpha', name:'Albany Alpha', maker:'Albany', cls:'Sedan', body:'2-door coupe', seats:2, realLife:'Cadillac ATS-V Coupe', status:'RETURNING', desc:'Albany sports coupe confirmed in GTA VI database. Performance-oriented American coupe.', wiki:'https://gta.fandom.com/wiki/Alpha' },
  { id:'schafter', name:'Benefactor Schafter LWB', maker:'Benefactor', cls:'Sedan', body:'4-door sedan', seats:4, realLife:'Mercedes S-Class LWB', status:'RETURNING', desc:'Long wheelbase luxury confirmed for GTA VI. The choice of Leonida crime bosses and business executives.', wiki:'https://gta.fandom.com/wiki/Schafter_LWB' },
  { id:'jubilee', name:'Enus Jubilee', maker:'Enus', cls:'SUV', body:'4-door SUV', seats:4, realLife:'Rolls-Royce Cullinan', status:'RETURNING', desc:'Most expensive civilian SUV confirmed in GTA VI footage. Available with Imani Tech luxury upgrades.', wiki:'https://gta.fandom.com/wiki/Jubilee' },
  { id:'baller', name:'Gallivanter Baller ST', maker:'Gallivanter', cls:'SUV', body:'4-door SUV', seats:4, realLife:'Range Rover Sport', status:'RETURNING', desc:'Vice City status symbol. Range Rover-inspired luxury SUV is what you drive when you want everyone to know you made it.', wiki:'https://gta.fandom.com/wiki/Baller_ST' },
  { id:'aleutian', name:'Vapid Aleutian', maker:'Vapid', cls:'SUV', body:'4-door SUV', seats:4, realLife:'Ford Expedition (4th Gen)', status:'RETURNING', desc:'Full-size American SUV confirmed for GTA VI. The working-class family hauler with truck DNA.', wiki:'https://gta.fandom.com/wiki/Aleutian' },
  { id:'toros', name:'Pegassi Toros', maker:'Pegassi', cls:'SUV', body:'4-door SUV', seats:4, realLife:'Lamborghini Urus', status:'RETURNING', desc:'The super-SUV from GTA Online returns. Italian supercar performance in a body that seats four.', wiki:'https://gta.fandom.com/wiki/Toros' },
  { id:'seminole', name:'Canis Seminole Frontier', maker:'Canis', cls:'SUV', body:'4-door SUV', seats:5, realLife:'Jeep Grand Wagoneer', status:'RETURNING', desc:'Off-road capable SUV confirmed for Leonida. Rugged American four-wheel-drive in wood panel trim.', wiki:'https://gta.fandom.com/wiki/Seminole_Frontier' },
  { id:'nightblade', name:'Western Nightblade', maker:'Western', cls:'Motorcycle', body:'Chopper', seats:1, realLife:'Harley-Davidson Night Rod', status:'RETURNING', desc:'American V-twin cruiser confirmed for GTA VI. Dark-themed chopper with chrome accents.', wiki:'https://gta.fandom.com/wiki/Nightblade' },
  { id:'doublet', name:'Dinka Double-T', maker:'Dinka', cls:'Motorcycle', body:'Sport motorcycle', seats:1, realLife:'Honda CBR1000RR', status:'RETURNING', desc:'The sportbike from GTA V returns. Lightweight Japanese superbike built for lane-splitting through Leonida traffic.', wiki:'https://gta.fandom.com/wiki/Double-T' },
  { id:'sanchez', name:'Maibatsu Sanchez', maker:'Maibatsu', cls:'Motorcycle', body:'Dirt bike', seats:1, realLife:'Yamaha WR450F', status:'RETURNING', desc:'GTA dirt bike legend returns with custom livery variants. Ideal for off-road terrain across Leonida.', wiki:'https://gta.fandom.com/wiki/Sanchez' },
  { id:'enduro', name:'Dinka Enduro', maker:'Dinka', cls:'Motorcycle', body:'Dirt bike', seats:1, realLife:'Honda CRF450R', status:'RETURNING', desc:'Ultimate Edition DLC motorcycle. High-revving off-road specialist with multiple livery options.', wiki:'https://gta.fandom.com/wiki/Enduro' },
  { id:'squalo', name:'Shitzu Squalo', maker:'Shitzu', cls:'Boat', body:'Speedboat', seats:2, realLife:'Mangusta 80', status:'NEW', desc:"Ultimate Edition bonus. The Squalo name returns from GTA IV as a new high-performance speedboat for Vice City's coastal waters.", wiki:'https://gta.fandom.com/wiki/Squalo' },
  { id:'dodo', name:'Mammoth Dodo', maker:'Mammoth', cls:'Boat', body:'Seaplane', seats:4, realLife:'de Havilland Canada DHC-2 Beaver', status:'RETURNING', desc:'The legendary GTA seaplane returns. Land on water, take off from bay. The most versatile vehicle in Leonida.', wiki:'https://gta.fandom.com/wiki/Dodo' },
  { id:'airboat', name:'Airboat', maker:'Various', cls:'Boat', body:'Airboat', seats:2, realLife:'Panther Airboats', status:'RETURNING', desc:'Swamp-ready airboat for the Everglades-inspired regions of Leonida. Seen navigating shallow waterways in Trailer 1.', wiki:'https://gta.fandom.com/wiki/Airboat' },
  { id:'bus', name:'Brute Rental Shuttle Bus', maker:'Brute', cls:'Utility', body:'Minibus', seats:10, realLife:'Chevrolet Express (Airport)', status:'RETURNING', desc:"Ten seats of pure Vice City tourism. Confirmed in GTA VI Trailer 1. Perfect for the world's most memorable airport pickups.", wiki:'https://gta.fandom.com/wiki/Rental_Shuttle_Bus' },
  { id:'towtruck', name:'Vapid Tow Truck', maker:'Vapid', cls:'Utility', body:'Tow truck', seats:2, realLife:'Ford F-Series Tow Truck', status:'RETURNING', desc:'The HD-era utility vehicle returns for GTA VI. Seen across multiple trailer shots.', wiki:'https://gta.fandom.com/wiki/Tow_Truck' },
  { id:'rumpo', name:'Bravado Rumpo Custom', maker:'Bravado', cls:'Utility', body:'Van', seats:2, realLife:'Dodge Ram Van', status:'RETURNING', desc:'Custom panel van confirmed for GTA VI. Classic heist vehicle.', wiki:'https://gta.fandom.com/wiki/Rumpo_Custom' },
  { id:'outlaw', name:'Nagasaki Outlaw', maker:'Nagasaki', cls:'Off-Road', body:'UTV', seats:2, realLife:'Can-Am Maverick X3', status:'RETURNING', desc:'Two-seat off-road UTV confirmed in GTA VI Trailer 1. Spotted at the Thrillbilly Mud Club.', wiki:'https://gta.fandom.com/wiki/Outlaw' },
  { id:'rebel', name:'Karin Rebel', maker:'Karin', cls:'Off-Road', body:'4-door truck', seats:4, realLife:'Toyota Hilux', status:'RETURNING', desc:'Iconic off-road pickup returns. Most versatile vehicle in the franchise and a staple of GTA criminal operations.', wiki:'https://gta.fandom.com/wiki/Rebel' },
  { id:'granger', name:'Declasse Granger', maker:'Declasse', cls:'Off-Road', body:'4-door SUV', seats:6, realLife:'Chevrolet Suburban', status:'RETURNING', desc:'Law enforcement favorite confirmed for civilian use in GTA VI. Six seats and enough American iron to end any police chase.', wiki:'https://gta.fandom.com/wiki/Granger' },
];

const CLASS_CFG: Record<string, { color: string; icon: string }> = {
  All:        { color: '#fff',     icon: '\u25c8' },
  Supercar:   { color: '#FF2D78', icon: '\u2605' },
  Sports:     { color: '#00FFFF', icon: '\u26a1' },
  Muscle:     { color: '#FF9900', icon: '\u2666' },
  Sedan:      { color: '#b44fff', icon: '\u25fb' },
  SUV:        { color: '#44ff88', icon: '\u25a0' },
  Motorcycle: { color: '#FF6622', icon: '\u25c6' },
  Boat:       { color: '#0099ff', icon: '~' },
  Utility:    { color: '#FFE135', icon: '#' },
  'Off-Road': { color: '#8B4513', icon: '*' },
};

const MAKERS = ['All Makers','Albany','Annis','Benefactor','Bravado','Brute','Canis','Declasse','Dinka','Enus','Gallivanter','Grotti','Imponte','Karin','Lampadati','Maibatsu','Mammoth','Nagasaki','Obey','Ocelot','Pegassi','Pfister','Principe','Shitzu','Vapid','Various','Western'];

function VehicleCard({ v, onClick }: { v: IVehicle; onClick: () => void }) {
  const cfg = CLASS_CFG[v.cls];
  const statusClr = v.status === 'NEW' ? '#FF2D78' : v.status === 'CONFIRMED' ? '#00FFFF' : 'rgba(255,255,255,0.4)';
  return (
    <div onClick={onClick} className="glass-card rounded-xl p-4 cursor-pointer group transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.01] flex flex-col">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-base" style={{ color: cfg.color }}>{cfg.icon}</span>
          <div>
            <div className="font-black text-sm text-white leading-tight group-hover:text-neonPink transition-colors">{v.name}</div>
            <div className="text-[10px] text-white/40 font-bold tracking-wider">{v.maker}</div>
          </div>
        </div>
        <span className="text-[9px] font-black px-2 py-0.5 rounded border tracking-widest flex-shrink-0"
          style={{ color: statusClr, borderColor: `${statusClr}50`, background: `${statusClr}12` }}>
          {v.status}
        </span>
      </div>
      <div className="flex items-center justify-between mt-auto pt-2">
        <span className="text-[10px] font-bold tracking-wide" style={{ color: cfg.color }}>{v.cls.toUpperCase()}</span>
        <span className="text-[9px] text-white/30">{v.body}</span>
      </div>
      <div className="text-[9px] text-white/40 mt-1 line-clamp-1">{v.realLife}</div>
    </div>
  );
}

function VehicleModal({ v, onClose }: { v: IVehicle; onClose: () => void }) {
  const cfg = CLASS_CFG[v.cls];
  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-card-static rounded-xl max-w-lg w-full p-6 slide-in border" style={{ borderColor: `${cfg.color}50` }} onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="font-orbitron font-black text-xl text-white">{v.name}</div>
            <div className="text-[11px] text-white/45 tracking-widest">{v.maker.toUpperCase()} - {v.cls.toUpperCase()}</div>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white text-xl font-black ml-4">X</button>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { label: 'CLASS', val: v.cls },
            { label: 'BODY STYLE', val: v.body },
            { label: 'CAPACITY', val: `${v.seats} ${v.seats === 1 ? 'seat' : 'seats'}` },
            { label: 'MANUFACTURER', val: v.maker },
            { label: 'REAL-LIFE BASE', val: v.realLife },
            { label: 'STATUS', val: v.status },
            ...(v.year ? [{ label: 'MODEL YEAR', val: v.year }] : []),
          ].map(r => (
            <div key={r.label} className="p-2 rounded-lg bg-black/30 border border-white/10">
              <div className="text-[9px] text-white/35 tracking-widest font-bold mb-0.5">{r.label}</div>
              <div className="text-xs font-bold text-white">{r.val}</div>
            </div>
          ))}
        </div>
        <p className="text-sm text-white/65 leading-relaxed mb-5">{v.desc}</p>
        <div className="flex gap-3">
          <a href={v.wiki} target="_blank" rel="noreferrer" className="btn-neon flex-1 justify-center text-[10px]">VIEW ON GTA WIKI</a>
          <button onClick={onClose} className="btn-neon btn-neon-sm px-4">CLOSE</button>
        </div>
      </div>
    </div>
  );
}

export default function Document() {
  const [search, setSearch] = useState('');
  const [cls, setCls] = useState<VClass>('All');
  const [maker, setMaker] = useState('All Makers');
  const [status, setStatus] = useState('All');
  const [selected, setSelected] = useState<IVehicle | null>(null);

  const filtered = useMemo(() => VEHICLES.filter(v => {
    const q = search.toLowerCase();
    return (cls === 'All' || v.cls === cls)
      && (maker === 'All Makers' || v.maker === maker)
      && (status === 'All' || v.status === status)
      && (!q || v.name.toLowerCase().includes(q) || v.maker.toLowerCase().includes(q) || v.realLife.toLowerCase().includes(q) || v.cls.toLowerCase().includes(q));
  }), [search, cls, maker, status]);

  const counts = useMemo(() => ({
    total: VEHICLES.length,
    NEW: VEHICLES.filter(v => v.status === 'NEW').length,
    RETURNING: VEHICLES.filter(v => v.status === 'RETURNING').length,
  }), []);

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #05050a 0%, #0a0a18 100%)' }}>
      {selected && <VehicleModal v={selected} onClose={() => setSelected(null)} />}

      {/* HERO */}
      <div className="relative overflow-hidden border-b border-white/[0.07]" style={{ background: 'linear-gradient(135deg, rgba(255,45,120,0.08) 0%, rgba(180,79,255,0.06) 100%)' }}>
        <div className="max-w-7xl mx-auto px-4 py-10 sm:py-14">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <span className="font-orbitron font-black text-[10px] tracking-widest text-neonCyan bg-neonCyan/10 border border-neonCyan/30 px-3 py-1 rounded">GTA VI</span>
            <span className="font-orbitron font-black text-[10px] tracking-widest text-neonPink bg-neonPink/10 border border-neonPink/30 px-3 py-1 rounded">LEONIDA STATE</span>
            <span className="text-[10px] text-white/40 font-bold">UPDATED: SEPT 2026</span>
          </div>
          <h1 className="font-orbitron font-black text-3xl sm:text-4xl tracking-wider mb-3" style={{ background: 'linear-gradient(90deg,#FF2D78,#b44fff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            LEONIDA VEHICLE DATABASE
          </h1>
          <p className="text-white/55 text-sm max-w-2xl leading-relaxed mb-6">
            Every confirmed vehicle in Grand Theft Auto VI, catalogued from official trailers, pre-order packs, and the Extended Look. <span className="text-neonCyan font-bold">{counts.total} vehicles confirmed</span>. Click any vehicle for full stats and its GTA Wiki entry.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { val: `${counts.total}`, label: 'Confirmed Vehicles', color: '#FF2D78' },
              { val: `${counts.NEW}`, label: 'New to Series', color: '#00FFFF' },
              { val: `${counts.RETURNING}`, label: 'Returning', color: '#b44fff' },
              { val: `${Object.keys(CLASS_CFG).length - 1}`, label: 'Vehicle Classes', color: '#FFE135' },
            ].map(s => (
              <div key={s.label} className="glass-card-static rounded-xl p-3 text-center border border-white/[0.05]">
                <div className="font-orbitron font-black text-2xl" style={{ color: s.color, textShadow: `0 0 12px ${s.color}66` }}>{s.val}</div>
                <div className="text-[10px] text-white/40 tracking-wider font-bold mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FEATURES STRIP */}
      <div className="border-b border-white/[0.05] overflow-x-auto">
        <div className="max-w-7xl mx-auto px-4 py-4 flex gap-6">
          {[
            { icon: '+', label: 'FUEL SYSTEM', desc: 'Cars need refueling' },
            { icon: '~', label: 'VEHICLE PHYSICS', desc: 'Heavier handling' },
            { icon: '#', label: 'CAR THEFT TIERS', desc: 'WAINK scanner required' },
            { icon: '*', label: 'PAY & SPRAY', desc: 'Full repaint & repair' },
            { icon: '=', label: 'TRUNK STORAGE', desc: 'Mobile weapon inventory' },
            { icon: '^', label: 'MOD SHOPS', desc: 'Ride Out Customs + more' },
          ].map(f => (
            <div key={f.label} className="flex items-center gap-2 flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity">
              <span className="text-neonPink font-black">{f.icon}</span>
              <div>
                <div className="text-[9px] font-black tracking-widest text-white">{f.label}</div>
                <div className="text-[9px] text-white/40">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FILTERS */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="glass-card-static rounded-xl p-4 mb-5 border border-white/[0.05]">
          <input type="text" placeholder="SEARCH VEHICLES, MANUFACTURERS, REAL-LIFE COUNTERPARTS..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-transparent text-white text-sm font-bold tracking-wider placeholder-white/25 outline-none pb-2 mb-4"
            style={{ borderBottom: '1px solid rgba(255,45,120,0.35)' }} />
          <div className="flex flex-wrap gap-1.5 mb-3">
            {Object.entries(CLASS_CFG).map(([c, cfg]) => (
              <button key={c} onClick={() => setCls(c as VClass)}
                className="text-[9px] px-3 py-1 rounded font-orbitron font-black tracking-wider transition-all border"
                style={{
                  color: cls === c ? cfg.color : 'rgba(255,255,255,0.35)',
                  borderColor: cls === c ? `${cfg.color}70` : 'rgba(255,255,255,0.1)',
                  background: cls === c ? `${cfg.color}18` : 'transparent',
                }}>
                {cfg.icon} {c}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={maker} onChange={e => setMaker(e.target.value)}
              className="bg-black/50 border border-white/20 rounded px-3 py-1.5 text-xs text-white/70 font-bold outline-none">
              {MAKERS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <div className="flex gap-1.5">
              {['All','NEW','RETURNING'].map(s => (
                <button key={s} onClick={() => setStatus(s)}
                  className={`text-[9px] px-3 py-1.5 rounded font-orbitron font-black tracking-wider border transition-all ${status===s?'border-neonPink/60 bg-neonPink/15 text-neonPink':'border-white/10 text-white/35 hover:border-white/25'}`}>
                  {s}
                </button>
              ))}
            </div>
            <div className="text-[10px] text-white/35 self-center ml-auto font-bold">{filtered.length} / {VEHICLES.length} vehicles</div>
          </div>
        </div>

        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map(v => <VehicleCard key={v.id} v={v} onClick={() => setSelected(v)} />)}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="font-orbitron text-sm text-white/25 tracking-widest mb-3">NO VEHICLES MATCH YOUR SEARCH</div>
            <button onClick={() => { setSearch(''); setCls('All'); setMaker('All Makers'); setStatus('All'); }}
              className="text-[10px] text-neonPink/60 hover:text-neonPink transition-colors font-bold">CLEAR ALL FILTERS</button>
          </div>
        )}

        <div className="mt-12 p-5 glass-card-static rounded-xl border border-white/[0.05]">
          <div className="font-orbitron font-black text-[10px] tracking-widest text-neonCyan mb-3">ABOUT THIS DATABASE</div>
          <p className="text-white/45 text-xs leading-relaxed">
            Data sourced from official Rockstar Games trailers, the September 2026 Extended Look, and official pre-order pack descriptions. Vehicle names are community-confirmed from GTA Wiki and GTA Forums.
            GTA VI features <span className="text-white/70">heavier handling physics</span>, a new <span className="text-white/70">fuel system</span>, tiered <span className="text-white/70">car theft mechanics</span> via the WAINK scanner, and <span className="text-white/70">vehicle trunk storage</span>.
            All in-game vehicle brands are parodies of real manufacturers and are the intellectual property of Rockstar Games / Take-Two Interactive.
          </p>
          <div className="flex flex-wrap gap-3 mt-4">
            <a href="https://gta.fandom.com/wiki/Vehicles_in_GTA_VI" target="_blank" rel="noreferrer" className="btn-neon btn-neon-sm btn-neon-cyan">GTA WIKI</a>
            <a href="https://gtaforums.com/" target="_blank" rel="noreferrer" className="btn-neon btn-neon-sm">GTA FORUMS</a>
            <a href="https://www.gtabase.com/gta-6/vehicles/" target="_blank" rel="noreferrer" className="btn-neon btn-neon-sm">GTABASE.COM</a>
          </div>
        </div>
      </div>
    </div>
  );
}
