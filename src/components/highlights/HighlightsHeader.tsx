export default function HighlightsHeader({ consoleMode }: { consoleMode: boolean }) {
  return (
    <header className="mb-8 text-center">
      <h1 className="font-orbitron text-3xl md:text-5xl font-black text-white neon-text-cyan mb-3">HIGHLIGHTS</h1>
      <p className="font-rajdhani text-lg md:text-xl text-gray-300 max-w-2xl mx-auto">
        Your best 15 seconds of GTA, minus the 3 hours of falling off a bike. Upload straight from your console, sign in once, brag forever.
      </p>
      {consoleMode && <p className="mt-3 inline-block px-4 py-2 rounded-lg border border-neonYellow/60 text-neonYellow font-rajdhani">Console browser detected. Big buttons mode is on. If the file picker does not open, use the phone code below.</p>}
    </header>
  );
}
