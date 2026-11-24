import React from 'react';
import { Play, Youtube } from 'lucide-react';

/**
 * "GTA 6 STORY MODE // Full Walkthrough & Gameplay (Let's Play)": the playlist on the VICE CITY HUB YouTube channel.
 * The share link carried a `si=` parameter; it only identifies who shared the link, so it is left out.
 * To point the banner at another playlist, change this one line.
 */
const WALKTHROUGH_URL = 'https://www.youtube.com/playlist?list=PLChbuGXLVT8w';

/** Buildings of the skyline: [x, width, height]. The base line of the city is y = 250. */
const SKYLINE: ReadonlyArray<readonly [number, number, number]> = [
  [0, 42, 40], [42, 30, 66], [72, 38, 34], [110, 26, 58], [136, 44, 30],
  [464, 40, 32], [504, 28, 60], [532, 36, 36], [568, 30, 70], [598, 42, 44],
];

/** Stripes cut out of the sun: [y, height]; they grow towards the horizon, like every synthwave sun. */
const SUN_STRIPES: ReadonlyArray<readonly [number, number]> = [[190, 3], [202, 4], [215, 6], [229, 8], [244, 10]];

const HORIZON = 250;
const GRID_ROWS = [1, 2, 3, 4, 5, 6].map((j) => HORIZON + 110 * (j / 6) ** 2);
const GRID_COLUMNS = Array.from({ length: 19 }, (_, k) => 320 + (k - 9) * 80);

/**
 * The poster: plain SVG (a sunset over a neon grid, a skyline and two palms). Nothing is requested from YouTube or anywhere
 * else for it, so the banner costs no extra requests and shares nothing about the visitor until the link is clicked.
 */
function WalkthroughArt() {
  return (
    <svg viewBox="0 0 640 360" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="wb-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0a0018" />
          <stop offset="0.5" stopColor="#2b0a63" />
          <stop offset="0.8" stopColor="#b3126f" />
          <stop offset="1" stopColor="#ff6b35" />
        </linearGradient>
        <linearGradient id="wb-sun" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe135" />
          <stop offset="1" stopColor="#ff2fa0" />
        </linearGradient>
        <linearGradient id="wb-floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a0a5c" />
          <stop offset="1" stopColor="#0a0018" />
        </linearGradient>
        <mask id="wb-sun-cut">
          <rect width="640" height="360" fill="#fff" />
          {SUN_STRIPES.map(([y, h]) => <rect key={y} x="200" y={y} width="240" height={h} fill="#000" />)}
        </mask>
        <g id="wb-palm" fill="#06000f">
          <path d="M-3 130 C-7 90 5 45 0 2 L7 2 C11 45 1 90 4 130 Z" />
          <g id="wb-fronds">
            <path d="M0 0 C26 -26 66 -22 96 12 C68 -4 30 -8 2 8 Z" />
            <path d="M0 0 C14 -34 44 -52 78 -46 C52 -40 28 -26 4 4 Z" />
            <path d="M3 0 C-1 -30 11 -58 33 -74 C23 -52 17 -30 9 2 Z" />
          </g>
          <use href="#wb-fronds" transform="translate(3 0) scale(-1 1) translate(-3 0)" />
        </g>
      </defs>

      <rect width="640" height="360" fill="url(#wb-sky)" />
      {[[60, 30], [150, 62], [236, 24], [410, 40], [498, 78], [590, 28], [338, 54]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="1.3" fill="#fff" opacity="0.8" />
      ))}
      <circle cx="320" cy="185" r="95" fill="url(#wb-sun)" mask="url(#wb-sun-cut)" />

      {/* skyline, a few windows lit */}
      <g fill="#16042e">
        {SKYLINE.map(([x, w, h]) => <rect key={x} x={x} y={HORIZON - h} width={w} height={h} />)}
      </g>
      {SKYLINE.flatMap(([x, w, h], i) => {
        const windows = [];
        for (let r = 0; r < Math.floor(h / 12); r++) {
          for (let c = 0; c < Math.floor(w / 10); c++) {
            if ((i + r * 3 + c * 5) % 4 === 0) {
              windows.push(<rect key={`${i}-${r}-${c}`} x={x + 4 + c * 10} y={HORIZON - h + 6 + r * 12} width="3" height="4" fill={(i + r) % 2 ? '#00ffff' : '#ff2fa0'} opacity="0.85" />);
            }
          }
        }
        return windows;
      })}

      {/* neon grid floor */}
      <rect y={HORIZON} width="640" height={360 - HORIZON} fill="url(#wb-floor)" />
      <g stroke="#00ffff" strokeOpacity="0.5" strokeWidth="1">
        {GRID_ROWS.map((y) => <line key={y} x1="0" x2="640" y1={y} y2={y} />)}
        {GRID_COLUMNS.map((x) => <line key={x} x1="320" y1={HORIZON} x2={x} y2="360" />)}
      </g>
      <line x1="0" x2="640" y1={HORIZON} y2={HORIZON} stroke="#ff7ad9" strokeOpacity="0.85" strokeWidth="1.5" />

      <use href="#wb-palm" transform="translate(70 120)" />
      <use href="#wb-palm" transform="translate(574 138) scale(0.8)" />
    </svg>
  );
}

/**
 * Full-width banner for the story-mode walkthrough, rendered in the hero between the intro text and the call-to-action buttons.
 * Left: the poster (a link). Right: short pitch plus the button. Both go to the playlist in a new tab.
 * No iframe and no thumbnail from YouTube on purpose: the page loads nothing third-party until the visitor clicks.
 */
export function WalkthroughBanner() {
  return (
    <section aria-label="GTA 6 story mode full walkthrough" className="group relative z-10 w-full max-w-[1280px] mt-6 lg:mt-7 text-left">
      <div className="flex flex-col md:flex-row rounded-xl overflow-hidden bg-black/70 backdrop-blur-md border border-neonPink/50 shadow-[0_0_40px_rgba(255,0,255,0.2)] transition-shadow duration-300 group-hover:shadow-[0_0_60px_rgba(255,0,255,0.4)]">
        {/* Poster side. Keyboard and screen-reader users get the button on the right instead of a second, identical link. */}
        <a
          href={WALKTHROUGH_URL}
          target="_blank"
          rel="noopener noreferrer"
          tabIndex={-1}
          aria-hidden="true"
          className="relative block w-full md:w-[420px] flex-shrink-0 aspect-video overflow-hidden bg-[#0a0018]"
        >
          <WalkthroughArt />
          <span className="absolute left-3 top-3 rounded border border-neonCyan/40 bg-black/60 px-2 py-1 font-orbitron text-[9px] font-bold uppercase tracking-[0.2em] text-neonCyan backdrop-blur">
            Story Mode
          </span>
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="relative flex items-center justify-center">
              <span className="absolute inline-flex h-16 w-16 rounded-full bg-neonPink/40 animate-ping motion-reduce:animate-none" />
              <span className="relative flex h-16 w-16 items-center justify-center rounded-full border border-white/30 bg-black/60 backdrop-blur transition-all duration-300 group-hover:scale-110 group-hover:border-neonCyan group-hover:shadow-[0_0_25px_rgba(0,255,255,0.6)]">
                <Play size={26} className="ml-1 text-white" fill="currentColor" />
              </span>
            </span>
          </span>
        </a>

        {/* Pitch + button */}
        <div className="flex-1 flex flex-col justify-center px-6 py-6 md:px-8">
          <p className="mb-2 font-orbitron text-[9px] font-bold uppercase tracking-[0.25em] text-neonPink">
            The Walkthrough
          </p>
          <h2 className="mb-3 font-orbitron text-xl font-extrabold uppercase leading-tight text-white sm:text-2xl">
            GTA 6 Story Mode <span className="text-neonCyan">Full Walkthrough</span>
          </h2>
          <p className="mb-5 max-w-xl text-xs leading-relaxed text-white/60 sm:text-sm">
            Start to finish. No skipped cutscenes, no &ldquo;trust me bro&rdquo; summaries, and yes, we crash a lot.
            Watch us suffer so you don&rsquo;t have to.
          </p>
          <a
            href={WALKTHROUGH_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-neon inline-flex w-fit items-center gap-3 text-xs"
          >
            <Youtube size={18} aria-hidden="true" />
            Watch the Playlist
            <span className="sr-only"> (opens YouTube in a new tab)</span>
          </a>
          <p className="mt-3 text-[11px] text-white/40">
            Free on YouTube. No paywall, no battle pass, no crypto broker.
          </p>
        </div>
      </div>
    </section>
  );
}
