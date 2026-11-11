import React from 'react';
import YouTubePlayer from '../YouTubePlayer';

const TRAILER_VIDEO_ID = 'qL266kKP5E4';
const TWITCH_URL = 'https://www.twitch.tv/vicecityhub';
const TWITCH_PURPLE = '#9146FF';

/**
 * Full-width stream banner, rendered between the hero text and the countdown.
 * Left: the stream trailer (click-to-play, nothing from YouTube loads until the click).
 * Right: short pitch plus the Twitch button.
 * No "LIVE" badge on purpose: the page cannot know whether the channel is on air right now.
 */
export function StreamBanner() {
  return (
    <section aria-label="Vice City Hub stream" className="relative z-10 w-full max-w-[1280px] mt-6 lg:mt-7 text-left">
      <div className="flex flex-col md:flex-row rounded-xl overflow-hidden bg-black border border-[#9146FF]/50 shadow-[0_0_40px_rgba(145,70,255,0.2)]">
        {/* Trailer side */}
        <div className="w-full md:w-[420px] flex-shrink-0 bg-black">
          <YouTubePlayer videoId={TRAILER_VIDEO_ID} title="Vice City Hub stream trailer" />
        </div>
        {/* Pitch + Twitch button */}
        <div className="flex-1 flex flex-col justify-center px-6 py-6 md:px-8">
          <p className="text-[9px] font-orbitron font-bold uppercase tracking-[0.25em] mb-2" style={{ color: TWITCH_PURPLE }}>
            The Stream
          </p>
          <h2 className="font-orbitron font-extrabold text-xl sm:text-2xl text-white uppercase leading-tight mb-3">
            Vice City Hub <span style={{ color: TWITCH_PURPLE }}>on Twitch</span>
          </h2>
          <p className="text-xs sm:text-sm text-white/60 leading-relaxed mb-5 max-w-xl">
            Watch the trailer, then hit follow. GTA VI news, RP chaos and whatever else goes wrong, streamed live.
            The countdown is right below. No, it won't tick faster if you stare.
          </p>
          <a
            href={TWITCH_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 w-fit font-orbitron font-bold text-xs uppercase tracking-wider text-white rounded border border-[#9146FF] bg-[#9146FF]/10 pl-2 pr-5 py-2 transition-all duration-200 hover:bg-[#9146FF]/30 hover:shadow-[0_0_20px_rgba(145,70,255,0.5)]"
          >
            <img src={`${import.meta.env.BASE_URL}media/twitch-logo.jpeg`} alt="" width={28} height={28} decoding="async" className="w-7 h-7 rounded" />
            Watch on Twitch
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>
      </div>
    </section>
  );
}
