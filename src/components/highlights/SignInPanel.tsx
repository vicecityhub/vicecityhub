import { ghost, primary } from './styles';
import type { useDeviceLogin } from './useDeviceLogin';

type Props = {
  login: ReturnType<typeof useDeviceLogin>;
  onOpenModal: (id: string, tab?: 'login' | 'register') => void;
};

/** Sign-in for people on a console: phone code (easy) or email and password (hard). Shown to signed-out visitors only. */
export default function SignInPanel({ login, onOpenModal }: Props) {
  const { dl, dlState, startDeviceLogin } = login;
  return (
    <section className="glass-card p-6 md:p-8 mb-8" aria-labelledby="hl-login">
      <h2 id="hl-login" className="font-orbitron text-xl text-neonPink mb-2">1. Sign in</h2>
      <p className="font-rajdhani text-gray-300 mb-5">Typing a password with a D-pad is a crime. Pick your pain level:</p>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-white/10 p-5">
          <h3 className="font-orbitron text-sm text-neonCyan mb-2">Easy: use your phone</h3>
          <p className="font-rajdhani text-gray-400 mb-4">Get a code here, type it on your phone (where you are already signed in), done. No passwords on the console.</p>
          {dlState === 'waiting' && dl ? (
            <div>
              <div className="font-orbitron text-4xl md:text-5xl tracking-[0.2em] text-neonYellow text-center py-4" aria-live="polite">{dl.code}</div>
              <p className="font-rajdhani text-gray-300 text-center">On your phone open <strong className="text-white">vicecityhub.github.io/vicecityhub/highlights.html#link</strong>, sign in, and enter this code. Waiting...</p>
            </div>
          ) : (
            <button className={primary} onClick={startDeviceLogin}>Get a phone code</button>
          )}
          {dlState === 'expired' && <p className="mt-3 font-rajdhani text-neonOrange">Code expired. Get a new one.</p>}
          {dlState === 'error' && <p className="mt-3 font-rajdhani text-neonOrange">Something broke on our side. Try again in a minute.</p>}
        </div>
        <div className="rounded-lg border border-white/10 p-5">
          <h3 className="font-orbitron text-sm text-neonCyan mb-2">Hard: email and password</h3>
          <p className="font-rajdhani text-gray-400 mb-4">Works everywhere. On a console it takes about as long as a GTA Online loading screen.</p>
          <div className="flex gap-3 flex-wrap">
            <button className={ghost} onClick={() => onOpenModal('auth', 'login')}>Log in</button>
            <button className={ghost} onClick={() => onOpenModal('auth', 'register')}>Create account</button>
          </div>
        </div>
      </div>
    </section>
  );
}
