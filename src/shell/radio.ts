// Leonida FM: the ONE radio of the whole site. Plain TypeScript with an injected environment (audio element, storages,
// document/window, listing fetch), so every rule is testable from Node. It is created once per browser document by the
// persistent shell (src/shell/index.ts) and then lives across page changes:
//
//  * The shell swaps pages without reloading the document (soft navigation), so this <audio> element is never torn
//    down and never needs a new user gesture: the track keeps playing smoothly through every section.
//  * A real page load (typing a URL, a reload, an external link) still creates a fresh document. Then the saved track
//    and position are restored and playback is retried at once and on EVERY user gesture (not just the first one):
//    play() has to run synchronously inside the gesture handler or the browser autoplay policy rejects it.
//  * The track-ended handler lives on the same persistent element, so the next random track starts without a gesture
//    (an <audio> element that was already allowed to play stays allowed when its src changes).
import { parseSavedRadioTime, shouldAutoplayOnMount } from '../lib/radioState.ts';
import { indexOfTrack, parseCachedPlaylist, parseSavedTrackIndex, parseVolume, pickRandomIndex, playlistFromListing } from './playlist.ts';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface RadioEnv {
  audio: HTMLAudioElement;
  /** localStorage: playlist cache, saved track/position, volume. */
  local: StorageLike;
  /** sessionStorage: `radioPlaying` = 'false' means the user muted the radio for this browser session. */
  session: StorageLike;
  /** The document: user gestures and visibility changes. */
  doc: EventTarget & { visibilityState?: string };
  /** The window: pagehide / beforeunload. */
  win: EventTarget;
  /** Resolves with the JSON listing of the muz bucket; rejects when it cannot be fetched. */
  listing: () => Promise<unknown>;
  rand?: () => number;
  warn?: (message: string) => void;
  /** True for the radio toggle button itself: its own click handler decides, the gesture handler stays out of its way. */
  isToggle?: (target: EventTarget | null) => boolean;
}

export type RadioListener = (playing: boolean) => void;

export interface Radio {
  readonly audio: HTMLAudioElement;
  /** Is the music audible right now (the element is not paused). */
  isPlaying(): boolean;
  /** The radio button: pause and remember the mute, or play. */
  toggle(): void;
  /** Called with the new state on every play/pause. Returns the unsubscribe function. */
  subscribe(listener: RadioListener): () => void;
  /** Index of the current track in the playlist (0 when unknown). */
  trackIndex(): number;
  /** Remove every listener and timer (used by tests). */
  dispose(): void;
}

const SAVE_EVERY_MS = 1000;
/** A track that cannot be loaded is skipped, but a broken bucket must not turn into an endless skip loop. */
const MAX_SKIPS_IN_A_ROW = 3;

const GESTURES: [string, AddEventListenerOptions][] = [
  ['click', { capture: true }],
  ['keydown', { capture: true }],
  ['touchstart', { capture: true, passive: true }],
  ['touchend', { capture: true }],
];

/** Old browsers return undefined from play() instead of a promise. */
const isThenable = (p: unknown): p is Promise<void> => !!p && typeof (p as { then?: unknown }).then === 'function';

export function createRadio(env: RadioEnv): Radio {
  const { audio, local, session, doc, win } = env;
  const rand = env.rand || Math.random;
  const warn = env.warn || (() => {});
  const isToggle = env.isToggle || (() => false);

  // localStorage / sessionStorage can throw (private mode, quota): the radio then just works without remembering.
  const read = (storage: StorageLike, key: string): string | null => { try { return storage.getItem(key); } catch { return null; } };
  const write = (storage: StorageLike, key: string, value: string) => { try { storage.setItem(key, value); } catch { /* nothing to do */ } };

  // sessionStorage (not localStorage): a mute only lasts for the current browser session, so closing the tab/browser and
  // coming back later defaults back to "playing", while in-site navigation keeps the choice.
  let want = shouldAutoplayOnMount(read(session, 'radioPlaying'));
  let tracks: string[] = parseCachedPlaylist(read(local, 'radioTracks'));
  let current = -1; // index of the current track in `tracks`, -1 when unknown
  let skips = 0;
  let disposed = false;
  const listeners = new Set<RadioListener>();

  const isPlaying = () => !audio.paused;
  const emit = () => { const on = isPlaying(); listeners.forEach(fn => { try { fn(on); } catch { /* a broken subscriber must not stop the others */ } }); };

  // ---- the playlist ------------------------------------------------------------------------------------------
  let listed = false; // a non-empty listing has answered in this document
  let inflight: Promise<boolean> | null = null;

  /** Fetch the bucket listing once; resolves true when `tracks` now comes from a good listing. */
  function refreshTracks(): Promise<boolean> {
    if (listed) return Promise.resolve(true);
    if (inflight) return inflight;
    inflight = Promise.resolve()
      .then(() => env.listing())
      .then(json => {
        const urls = playlistFromListing(json);
        if (urls.length === 0) {
          warn('[Audio] The muz listing is empty: check the files in the bucket and the muz_public_read policy');
          return false;
        }
        tracks = urls;
        listed = true;
        write(local, 'radioTracks', JSON.stringify(urls));
        return true;
      }, () => false) // offline: keep the remembered playlist
      .then(ok => { inflight = null; return ok; });
    return inflight;
  }

  function setTrack(idx: number) {
    current = idx;
    audio.src = tracks[idx];
    write(local, 'radioTrackIndex', String(idx));
  }

  /** Seeking can throw before the media is seekable; the track then simply stays at 0. */
  function restorePosition(time: number) {
    if (time <= 0) return;
    const forSrc = audio.src;
    const apply = () => {
      if (audio.src !== forSrc) return; // the track was replaced meanwhile: the saved position belongs to another one
      if (audio.duration && time < audio.duration) { try { audio.currentTime = time; } catch { /* stays at 0 */ } }
    };
    if (audio.readyState >= 1) apply();
    else audio.addEventListener('loadedmetadata', apply, { once: true });
  }

  /** Point the audio at the saved track (and position), or at a random one when nothing valid is saved. */
  function startTrack() {
    const saved = parseSavedTrackIndex(read(local, 'radioTrackIndex'), tracks.length);
    if (saved >= 0) {
      current = saved;
      audio.src = tracks[saved];
      restorePosition(parseSavedRadioTime(read(local, 'radioTime')));
    } else {
      setTrack(pickRandomIndex(tracks.length, current, rand));
    }
  }

  // ---- playing -----------------------------------------------------------------------------------------------
  /** play() is rejected by the autoplay policy until the user interacts: expected, not an error. Gestures retry. */
  function tryPlay() {
    if (disposed || !audio.src) return;
    let p: Promise<void> | void;
    try { p = audio.play(); } catch { return; }
    if (isThenable(p)) p.catch(() => { /* blocked: the next gesture or visibility change tries again */ });
  }

  function saveProgress() {
    write(local, 'radioTime', String(audio.currentTime));
    write(local, 'radioTrackIndex', String(current >= 0 ? current : 0));
  }

  /** The track ended (or cannot be played): a random other track, started without any gesture. */
  function next() {
    if (disposed) return;
    const go = () => {
      if (disposed) return;
      if (tracks.length === 0) { emit(); return; }
      setTrack(pickRandomIndex(tracks.length, current, rand));
      write(local, 'radioTime', '0');
      if (want) tryPlay(); else emit();
    };
    if (tracks.length > 0) go();
    else refreshTracks().then(go);
  }

  // ---- audio events ------------------------------------------------------------------------------------------
  const onPlay = () => { emit(); };
  // `play` fires when play() is CALLED, even for a file that then fails to load, so it cannot reset the skip counter:
  // a bucket full of broken files would be skipped forever. `playing` fires only when sound is really coming out.
  const onPlaying = () => { skips = 0; };
  const onPause = () => {
    if (audio.ended) return; // the pause that precedes `ended`: the next track follows, the button must not flicker
    saveProgress();
    emit();
  };
  const onEnded = () => { if (want) next(); else emit(); };
  const onError = () => {
    if (!want || tracks.length < 2 || skips >= MAX_SKIPS_IN_A_ROW) { emit(); return; }
    skips++;
    next();
  };
  audio.addEventListener('play', onPlay);
  audio.addEventListener('playing', onPlaying);
  audio.addEventListener('pause', onPause);
  audio.addEventListener('ended', onEnded);
  audio.addEventListener('error', onError);

  // ---- gestures, visibility, saving --------------------------------------------------------------------------
  /**
   * EVERY gesture while the radio should be playing but is paused: play() runs synchronously inside the handler so the
   * browser still counts it as a response to that gesture. This covers the first visit, a real page load on a phone
   * (no soft navigation) and an interruption (call, lock screen, a tab the browser paused) at any later moment.
   */
  const onGesture = (e: Event) => {
    if (!want || !audio.paused) return;
    if (isToggle(e.target)) return;
    tryPlay();
  };
  GESTURES.forEach(([type, options]) => doc.addEventListener(type, onGesture, options));

  /**
   * Mobile browsers (especially Android Chrome and iOS Safari) often silently pause background audio when the
   * tab/app is backgrounded. When the page becomes visible again, resume unless the user explicitly muted.
   */
  const onVisibility = () => {
    if (doc.visibilityState !== 'visible') return;
    if (want && audio.paused) tryPlay(); // still blocked: the next gesture retries
  };
  doc.addEventListener('visibilitychange', onVisibility);

  const saveIfPlaying = () => { if (!audio.paused) saveProgress(); };
  win.addEventListener('pagehide', saveIfPlaying);
  win.addEventListener('beforeunload', saveIfPlaying);
  const timer = setInterval(saveIfPlaying, SAVE_EVERY_MS);

  // ---- start -------------------------------------------------------------------------------------------------
  audio.loop = false; // no loop: the track must end so that `ended` picks the next one
  audio.preload = want ? 'auto' : 'metadata'; // a muted session does not download whole tracks in advance
  audio.volume = parseVolume(read(local, 'radioVolume'));

  const hadPlaylist = tracks.length > 0;
  if (hadPlaylist) {
    // The remembered playlist makes the track available synchronously: no listing round-trip before it can play.
    startTrack();
    if (want) tryPlay();
  }
  refreshTracks().then(ok => {
    if (!ok || disposed) return;
    if (hadPlaylist) {
      // The listing answered after the track was set from the remembered playlist: keep it if it still exists.
      const now = indexOfTrack(tracks, audio.src);
      if (now >= 0) { current = now; write(local, 'radioTrackIndex', String(now)); return; }
      const wasPlaying = !audio.paused;
      current = -1;
      setTrack(pickRandomIndex(tracks.length, -1, rand));
      write(local, 'radioTime', '0');
      if (wasPlaying) tryPlay();
      return;
    }
    // First visit ever (nothing remembered yet): the track can only be set now.
    startTrack();
    if (want) tryPlay();
  });

  return {
    audio,
    isPlaying,
    toggle() {
      if (!audio.paused) {
        want = false;
        write(session, 'radioPlaying', 'false');
        audio.pause();
        saveProgress();
        emit();
      } else {
        want = true;
        write(session, 'radioPlaying', 'true');
        tryPlay();
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    trackIndex: () => (current >= 0 ? current : 0),
    dispose() {
      disposed = true;
      clearInterval(timer);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      GESTURES.forEach(([type, options]) => doc.removeEventListener(type, onGesture, options));
      doc.removeEventListener('visibilitychange', onVisibility);
      win.removeEventListener('pagehide', saveIfPlaying);
      win.removeEventListener('beforeunload', saveIfPlaying);
      listeners.clear();
    },
  };
}
