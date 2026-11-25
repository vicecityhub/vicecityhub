import React, { useState } from 'react';
import { Play, Youtube } from 'lucide-react';

/**
 * "GTA 6 STORY MODE // Full Walkthrough & Gameplay (Let's Play)": the playlist on the VICE CITY HUB YouTube channel.
 * The share link carried a `si=` parameter; it only identifies who shared the link, so it is left out.
 * To point the banner at another playlist, change this one line.
 */
const WALKTHROUGH_URL = 'https://www.youtube.com/playlist?list=PLChbuGXLVT8w';

/**
 * The poster: the owner's screenshot in the project's own Supabase Storage (public bucket "design photos"; the page already talks
 * to this host for its data). To change the picture, upload another file under the same name or change this one line.
 * The address must be a PUBLIC one (`/object/public/`): a signed address carries a token (a credential) and expires.
 */
const POSTER_URL = 'https://lpglkglhjdqnktybksth.supabase.co/storage/v1/object/public/design%20photos/Screenshot%202026-11-25%2000-24-19.png';

/**
 * Full-width banner for the story-mode walkthrough, rendered in the hero between the intro text and the call-to-action buttons.
 * Left: the poster, a screenshot with an iridescent film of neon colors flowing over it and a light streak sweeping across now and
 * then (`.vch-holo` / `.vch-sheen`, animations in tailwind.config.js, switched off by reduced motion). Right: short pitch and the button.
 *
 * The WHOLE banner is one click target (new tab): an empty overlay link covers it and is hidden from the keyboard and screen readers,
 * the button stays above it as the one real, named link. If the picture cannot be loaded, the gradient behind it stays, so the banner
 * still looks intended. No iframe and no thumbnail from YouTube on purpose: nothing from YouTube loads until the visitor clicks.
 */
export function WalkthroughBanner() {
  const [posterFailed, setPosterFailed] = useState(false);

  return (
    <section aria-label="GTA 6 story mode full walkthrough" className="group relative z-10 w-full max-w-[1280px] mt-6 lg:mt-7 text-left">
      <div className="relative flex flex-col md:flex-row rounded-xl overflow-hidden bg-black/70 backdrop-blur-md border border-neonPink/50 shadow-[0_0_40px_rgba(255,0,255,0.2)] transition-shadow duration-300 group-hover:shadow-[0_0_60px_rgba(255,0,255,0.4)] group-focus-within:shadow-[0_0_60px_rgba(0,255,255,0.45)]">
        {/* Click target for the whole banner (poster, text, empty space). Keyboard and screen-reader users get the button instead. */}
        <a
          href={WALKTHROUGH_URL}
          target="_blank"
          rel="noopener noreferrer"
          tabIndex={-1}
          aria-hidden="true"
          className="absolute inset-0 z-10"
        />

        {/* Poster. `isolate` keeps the blend of the film inside this box. The gradient is what shows while the picture loads or if it fails. */}
        <div className="relative isolate w-full md:w-[420px] flex-shrink-0 aspect-video overflow-hidden bg-gradient-to-br from-[#2b0a63] via-[#b3126f] to-[#ff6b35]">
          {!posterFailed && (
            <img
              src={POSTER_URL}
              alt=""
              width={1280}
              height={720}
              decoding="async"
              onError={() => setPosterFailed(true)}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            />
          )}

          {/* Iridescence: neon colors flowing over the picture ... */}
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden mix-blend-overlay opacity-60 transition-opacity duration-300 group-hover:opacity-90">
            <span className="vch-holo absolute inset-y-0 left-0 w-[200%] will-change-transform animate-vch-holo motion-reduce:animate-none" />
          </span>
          {/* ... and a light streak that sweeps across, then rests off the poster */}
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
            <span className="vch-sheen absolute -inset-y-2 left-0 w-1/3 will-change-transform animate-vch-sheen motion-reduce:animate-none" />
          </span>

          <span className="absolute left-3 top-3 rounded border border-neonCyan/40 bg-black/60 px-2 py-1 font-orbitron text-[9px] font-bold uppercase tracking-[0.2em] text-neonCyan backdrop-blur">
            Story Mode
          </span>
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="relative flex items-center justify-center">
              <span className="absolute inline-flex h-16 w-16 rounded-full bg-neonPink/40 animate-ping motion-reduce:animate-none" />
              <span className="relative flex h-16 w-16 items-center justify-center rounded-full border border-white/30 bg-black/60 backdrop-blur transition-all duration-300 group-hover:scale-110 group-hover:border-neonCyan group-hover:shadow-[0_0_25px_rgba(0,255,255,0.6)]">
                <Play size={26} aria-hidden="true" className="ml-1 text-white" fill="currentColor" />
              </span>
            </span>
          </span>
        </div>

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
          {/* The one real link: above the overlay, and it lights up when the pointer is anywhere on the banner */}
          <a
            href={WALKTHROUGH_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-neon relative z-20 inline-flex w-fit items-center gap-3 text-xs group-hover:bg-neonPink group-hover:text-black group-hover:shadow-[0_0_30px_#FF00FF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neonCyan"
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
