import { isCodeComplete, requestAge } from '../../lib/highlights';
import type { HlUser } from '../../lib/highlights';
import { field, ghost, pink, primary } from './styles';
import type { useConsoleLink } from './useConsoleLink';

type Props = {
  user: HlUser | null;
  link: ReturnType<typeof useConsoleLink>;
  onOpenModal: (id: string, tab?: 'login' | 'register') => void;
};

/** "Is that code on YOUR screen?" confirmation, shown once the code has been checked. */
function ApprovalPrompt({ link }: { link: Props['link'] }) {
  const { linkInfo, approveCode, cancel } = link;
  if (!linkInfo) return null;
  return (
    <div className="rounded-lg border border-neonOrange/60 p-4">
      <p className="font-rajdhani text-lg text-white mb-2">Request from: <strong>{linkInfo.device}</strong>, {requestAge(linkInfo.ago)} ago.</p>
      <p className="font-rajdhani text-neonOrange mb-4">Only approve if that code is on YOUR screen, right now. Anyone who shows you a code and asks you to enter it is asking for the keys to your account.</p>
      <div className="flex gap-3 flex-wrap">
        <button className={pink} onClick={approveCode}>Yes, sign my console in</button>
        <button className={ghost} onClick={cancel}>Cancel</button>
      </div>
    </div>
  );
}

function LinkForm({ link }: { link: Props['link'] }) {
  const { linkCode, linkInfo, linkMsg, inspectCode, editCode } = link;
  return (
    <div className="grid gap-4 max-w-md">
      <p className="font-rajdhani text-gray-300">Enter the code from your console&apos;s screen.</p>
      <input className={`${field} font-orbitron tracking-widest uppercase`} value={linkCode} maxLength={9} placeholder="ABCD-2345" aria-label="Console code" onChange={(e) => editCode(e.target.value)} />
      {!linkInfo && <div><button className={primary} onClick={inspectCode} disabled={!isCodeComplete(linkCode)}>Check code</button></div>}
      <ApprovalPrompt link={link} />
      {linkMsg && <p role="status" className={`font-rajdhani text-lg ${linkMsg.ok ? 'text-green-400' : 'text-neonOrange'}`}>{linkMsg.text}</p>}
    </div>
  );
}

/** Phone side: approve the code a console is showing. The block the console tells you to open (`#link`). */
export default function LinkPanel({ user, link, onOpenModal }: Props) {
  return (
    <section id="link" className="glass-card p-6 md:p-8 mb-10" aria-labelledby="hl-link">
      <h2 id="hl-link" className="font-orbitron text-xl text-neonYellow mb-2">Link a console to your account</h2>
      {user ? (
        <LinkForm link={link} />
      ) : (
        <div>
          <p className="font-rajdhani text-gray-300 mb-4">Your console is showing a code? Sign in on this device first, then enter it here.</p>
          <button className={primary} onClick={() => onOpenModal('auth', 'login')}>Log in</button>
        </div>
      )}
    </section>
  );
}
