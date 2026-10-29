/** Static how-to: getting a capture off a PS5 and onto the board. */
export default function PlatformGuide() {
  return (
    <section className="glass-card p-6 md:p-8 mb-8" aria-labelledby="hl-how">
      <h2 id="hl-how" className="font-orbitron text-xl text-neonCyan mb-3">Getting a clip off your PS5</h2>
      <ol className="font-rajdhani text-lg text-gray-300 list-decimal pl-6 space-y-2">
        <li>Capture it: press Create, or hold it to save the last few minutes. Trim it in Media Gallery.</li>
        <li><strong className="text-white">On the console browser:</strong> open this page, sign in with the phone code, press &quot;Choose screenshot or clip&quot;. If your console browser offers a file picker, you are done in three clicks.</li>
        <li><strong className="text-white">If the console will not open a picker</strong> (some console browsers will not): send the capture to your phone through the PlayStation App captures, save it to your camera roll, open this page on the phone and upload there. Same account, same board.</li>
      </ol>
    </section>
  );
}
