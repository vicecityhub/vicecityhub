import { useEffect, useRef, useState } from 'react';
import { POLL_INTERVAL_MS, codeDeadline } from '../../lib/highlights';
import { pollDeviceLogin, requestDeviceCode } from './deviceLogin';

type DlState = 'idle' | 'waiting' | 'expired' | 'error';

/** Console side of the phone-code login: show a code, poll until the phone approves it, then sign in. */
export function useDeviceLogin() {
  const [dl, setDl] = useState<{ code: string; secret: string } | null>(null);
  const [dlState, setDlState] = useState<DlState>('idle');
  const pollTimer = useRef<number | null>(null);
  const stopPoll = () => { if (pollTimer.current) { window.clearTimeout(pollTimer.current); pollTimer.current = null; } };
  useEffect(() => stopPoll, []);

  const startDeviceLogin = async () => {
    stopPoll(); setDlState('waiting');
    try {
      const j = await requestDeviceCode();
      setDl({ code: j.code, secret: j.secret });
      const deadline = codeDeadline(Date.now(), j.expires_in);
      const schedule = () => { pollTimer.current = window.setTimeout(tick, POLL_INTERVAL_MS); };
      const tick = async () => {
        if (Date.now() > deadline) { setDlState('expired'); return; }
        const outcome = await pollDeviceLogin(j.secret);
        if (outcome === 'retry') return schedule();
        if (outcome === 'approved') { setDl(null); setDlState('idle'); return; }
        setDlState(outcome);
      };
      schedule();
    } catch (_e) { setDlState('error'); }
  };

  return { dl, dlState, startDeviceLogin };
}
