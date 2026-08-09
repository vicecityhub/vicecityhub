const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwZ2xrZ2xoamRxbmt0eWJrc3RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMTYzMjUsImV4cCI6MjA5MTU5MjMyNX0.fMZo0fjEfPSf20w-rRQh25zPj7xPVOpU6lO2lon3EEk';
const FALLBACK = [
  'https://lpglkglhjdqnktybksth.supabase.co/storage/v1/object/public/muz/1.ogg',
  'https://lpglkglhjdqnktybksth.supabase.co/storage/v1/object/public/muz/2.ogg',
];
let globalAudio: HTMLAudioElement | null = null;
let allTracks: string[] = FALLBACK;
let tracksReady = false;
let lastIdx = -1;

async function fetchTracks(): Promise<string[]> {
  if (tracksReady) return allTracks;
  try {
    const res = await fetch('https://lpglkglhjdqnktybksth.supabase.co/storage/v1/object/list/muz', {
      method: 'POST',
      headers: { apikey: ANON, Authorization: 'Bearer ' + ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix: '', limit: 100, offset: 0 }),
    });
    if (!res.ok) return FALLBACK;
    const files: { name: string }[] = await res.json();
    const urls = files.filter(f => f.name && /\.(ogg|mp3|wav|flac)$/i.test(f.name))
      .map(f => 'https://lpglkglhjdqnktybksth.supabase.co/storage/v1/object/public/muz/' + encodeURIComponent(f.name));
    if (urls.length > 0) { allTracks = urls; tracksReady = true; }
  } catch { /* use fallback */ }
  return allTracks;
}

function nextRandom(): number {
  if (allTracks.length === 1) return 0;
  let idx = lastIdx;
  while (idx === lastIdx) idx = Math.floor(Math.random() * allTracks.length);
  lastIdx = idx;
  return idx;
}

function playNext() {
  if (!globalAudio) return;
  fetchTracks().then(tracks => {
    const idx = nextRandom();
    console.log('[Audio] Next track ' + (idx + 1) + '/' + tracks.length);
    globalAudio!.src = tracks[idx];
    localStorage.setItem('radioTrackIndex', String(idx));
    globalAudio!.play().catch(() => {});
  });
}

export function getOrCreateAudio(): HTMLAudioElement {
  if (globalAudio) return globalAudio;
  globalAudio = new Audio();
  globalAudio.preload = 'auto';
  globalAudio.loop = false;
  globalAudio.volume = parseFloat(localStorage.getItem('radioVolume') || '0.25');
  globalAudio.addEventListener('ended', playNext);
  fetchTracks().then(tracks => {
    const saved = parseInt(localStorage.getItem('radioTrackIndex') || '-1');
    const startIdx = (saved >= 0 && saved < tracks.length) ? saved : nextRandom();
    lastIdx = startIdx;
    console.log('[Audio] Init: ' + tracks.length + ' tracks, start #' + (startIdx + 1));
    globalAudio!.src = tracks[startIdx];
    const sp = sessionStorage.getItem('radioPlaying');
    if (sp === null || sp === 'true') globalAudio!.play().catch(() => {});
  });
  return globalAudio;
}

export function getAudio(): HTMLAudioElement | null { return globalAudio; }
