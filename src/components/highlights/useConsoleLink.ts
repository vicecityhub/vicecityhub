import { useEffect, useState } from 'react';
import type { HlMessage, HlUser } from '../../lib/highlights';
import { callDeviceLogin } from './deviceLogin';

/** Phone side: type the code shown on the console, check who is asking, approve. Also scrolls to the block for `#link`. */
export function useConsoleLink(user: HlUser | null) {
  const [linkCode, setLinkCode] = useState('');
  const [linkInfo, setLinkInfo] = useState<{ device: string; ago: number } | null>(null);
  const [linkMsg, setLinkMsg] = useState<HlMessage | null>(null);

  const inspectCode = async () => {
    setLinkMsg(null); setLinkInfo(null);
    const r = await callDeviceLogin('/inspect', { code: linkCode });
    if (r.status !== 200) return setLinkMsg({ ok: false, text: r.body.error || 'Could not check that code.' });
    setLinkInfo({ device: r.body.device, ago: r.body.requested_ago_s });
  };

  const approveCode = async () => {
    const r = await callDeviceLogin('/approve', { code: linkCode });
    if (r.status !== 200) return setLinkMsg({ ok: false, text: r.body.error || 'Could not approve.' });
    setLinkInfo(null); setLinkCode('');
    setLinkMsg({ ok: true, text: 'Done. The console is signed in as you. Go play, then go upload.' });
  };

  const editCode = (value: string) => { setLinkCode(value); setLinkInfo(null); setLinkMsg(null); };
  const cancel = () => { setLinkInfo(null); setLinkCode(''); };

  useEffect(() => {
    if (window.location.hash === '#link') setTimeout(() => document.getElementById('link')?.scrollIntoView(), 300);
  }, [user]);

  return { linkCode, linkInfo, linkMsg, inspectCode, approveCode, editCode, cancel };
}
