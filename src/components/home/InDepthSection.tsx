import React from 'react';
import { ExternalLink } from 'lucide-react';

interface Article {
  image: string;
  imageAlt: string;
  /** Image on the right and text on the left from md up (articles 1 and 3). */
  imageRight: boolean;
  /** Direction of the fade from the image into the text column. */
  fade: 'r' | 'l';
  badgeClass: string;
  badge: string;
  readTime: string;
  title: React.ReactNode;
  body: React.ReactNode;
  source: string;
  link: string;
}

const PHOTO_BASE = 'https://lpglkglhjdqnktybksth.supabase.co/storage/v1/object/public/photos/';

const ARTICLES: Article[] = [
  // Article 1: Leonida State Map
  {
    image: `${PHOTO_BASE}Lucia_Caminos.jpg`,
    imageAlt: 'Lucia Caminos in Vice City',
    imageRight: true,
    fade: 'r',
    badgeClass: 'border-neonPink text-neonPink',
    badge: 'World Building',
    readTime: '5 Min Read',
    title: 'Leonida State: How Big Is the GTA VI Map?',
    body: (
      <>
        <p>When Rockstar Games unveiled the state of <strong>Leonida</strong> in GTA VI's first trailer, the gaming world immediately began measuring every frame. Speculative mapping projects based on leaked development materials and South Florida satellite telemetry indicate an open world size that dwarfs any previous Rockstar creation.</p>
        <p>The map is anchored by the neon-drenched metropolis of Vice City, featuring bustling high-density downtown blocks, beach strips, and marina clubs. However, the playable environment extends deep into wild marshlands, offshore island keys, industrial docks, and dense coastal highways.</p>
        <p>Triangulations suggest an active, traversable canvas spanning over 150 square kilometers, utilizing modern loading pipelines to make almost every residential and commercial interior fully accessible.</p>
      </>
    ),
    source: 'Source: Rockstar Games / Speculative Mapping Syndicate',
    link: 'https://www.rockstargames.com/VI',
  },
  // Article 2: Dual Protagonists Story
  {
    image: `${PHOTO_BASE}Jason.jpg`,
    imageAlt: 'Jason Duval in GTA VI',
    imageRight: false,
    fade: 'l',
    badgeClass: 'border-neonCyan text-neonCyan',
    badge: 'Characters',
    readTime: '4 Min Read',
    title: <>Lucia &amp; Jason: The Narrative Behind GTA VI's Dual Protagonists</>,
    body: (
      <>
        <p><strong>Lucia Caminos</strong> — the Grand Theft Auto series' first true female protagonist in the HD universe — and her accomplice <strong>Jason Duval</strong> represent Rockstar's most intimate storytelling effort to date.</p>
        <p>Anchored in a high-stakes, Bonnie-and-Clyde style relationship, the dual protagonist system allows players to experience the criminal syndicate from two distinct perspectives. Rather than the separate, sprawling stories of GTA V, Lucia and Jason's narrative is deeply interconnected, testing their loyalty, trust, and resolve against the corporate and street-level syndicates of Leonida.</p>
        <p>Development analysis confirms players will be able to swap between both characters dynamically during open-world roaming, with co-op tactical commands available during heist setups.</p>
      </>
    ),
    source: 'Source: Rockstar Games Syndicate',
    link: 'https://www.rockstargames.com/VI',
  },
  // Article 3: TTWO Investor Forecast
  {
    image: `${PHOTO_BASE}Vice_City_Club.jpg`,
    imageAlt: 'Vice City Club Take-Two Interactive',
    imageRight: true,
    fade: 'r',
    badgeClass: 'border-neonOrange text-neonOrange',
    badge: 'Investor Analysis',
    readTime: '6 Min Read',
    title: "Take-Two's $8B+ Revenue Forecast and What GTA VI Means for TTWO",
    body: (
      <>
        <p>Take-Two Interactive's fiscal future is intrinsically tied to the launch pipeline of Grand Theft Auto VI. With an estimated development and marketing budget exceeding $1.5 billion, the stakes have never been higher for the gaming industry giant.</p>
        <p>Analyst forecasts project that the initial 12 months of GTA VI's launch could push Take-Two's net bookings past the historic $8 billion mark, driving significant share price valuation shifts for NASDAQ:TTWO. Reinvestments into standard GTA Online engine expansions will establish a multi-decade recurring income stream.</p>
        <p className="text-xs text-gray-500 italic uppercase">
          Disclaimer: This article is for fan research purposes only and does not constitute official investment advice.
        </p>
      </>
    ),
    source: 'Source: Take-Two Interactive IR Operations',
    link: 'https://ir.take2games.com',
  },
];

function ArticleCard({ article: a }: { article: Article }) {
  return (
    <article className="glass-card border border-white/5 hover:border-neonCyan transition-all duration-300 min-h-[500px] overflow-hidden flex flex-col md:flex-row relative">
      <div className={`w-full md:w-1/2 min-h-[300px] md:min-h-full relative overflow-hidden${a.imageRight ? ' order-1 md:order-2' : ''}`}>
        <img src={a.image} alt={a.imageAlt} className="w-full h-full object-cover object-center absolute inset-0 hover:scale-105 transition-transform duration-700 scroll-dynamic-img" />
        <div className={`absolute inset-0 bg-gradient-to-t ${a.fade === 'r' ? 'md:bg-gradient-to-r' : 'md:bg-gradient-to-l'} from-[#0a0a0f] via-[#0a0a0f]/80 to-transparent`} />
      </div>
      <div className={`w-full md:w-1/2 p-8 lg:p-12 z-10 relative flex flex-col justify-between${a.imageRight ? ' order-2 md:order-1' : ''}`}>
        <div>
          <div className="flex gap-3 items-center mb-6">
            <span className={`border ${a.badgeClass} text-[9px] font-bold tracking-widest px-2.5 py-1 uppercase rounded`}>{a.badge}</span>
            <span className="text-[10px] text-gray-500 font-bold tracking-wider uppercase">{a.readTime}</span>
          </div>
          <h3 className="font-orbitron font-bold text-3xl text-white tracking-wide leading-snug mb-6">
            {a.title}
          </h3>
          <div className="text-sm text-gray-300 leading-relaxed space-y-4 font-semibold">
            {a.body}
          </div>
        </div>
        <div className="flex justify-between items-center border-t border-white/5 pt-6 mt-8">
          <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">{a.source}</span>
          <a href={a.link} target="_blank" rel="noopener noreferrer" className="text-neonCyan hover:underline text-xs font-bold uppercase tracking-widest flex items-center gap-1.5 font-orbitron">Read Source <ExternalLink size={12} /></a>
        </div>
      </div>
    </article>
  );
}

/** "03 · In Depth": three long-form feature cards. */
export function InDepthSection() {
  return (
    <section className="py-20 px-6 max-w-[1280px] mx-auto">
      <div className="flex items-baseline gap-3 border-b border-white/5 pb-5 mb-12">
        <span className="font-orbitron text-xs text-neonPink font-extrabold tracking-widest">03</span>
        <h2 className="font-orbitron font-extrabold text-3xl tracking-widest uppercase">
          In <span className="text-neonCyan">Depth</span>
        </h2>
        <span className="text-[10px] font-bold text-gray-500 tracking-widest uppercase ml-auto">
          Analysis &amp; Features
        </span>
      </div>

      <div className="flex flex-col gap-12">
        {ARTICLES.map(a => <ArticleCard key={a.badge} article={a} />)}
      </div>
    </section>
  );
}
