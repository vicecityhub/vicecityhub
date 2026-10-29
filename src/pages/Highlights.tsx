import { isConsole } from '../lib/highlights';
import Gallery from '../components/highlights/Gallery';
import HighlightsHeader from '../components/highlights/HighlightsHeader';
import LinkPanel from '../components/highlights/LinkPanel';
import PlatformGuide from '../components/highlights/PlatformGuide';
import SignInPanel from '../components/highlights/SignInPanel';
import UploadPanel from '../components/highlights/UploadPanel';
import { useConsoleLink } from '../components/highlights/useConsoleLink';
import { useDeviceLogin } from '../components/highlights/useDeviceLogin';
import { useGallery } from '../components/highlights/useGallery';
import { useUpload } from '../components/highlights/useUpload';

// Highlights board: screenshots and short clips from the console (PS5 first), uploaded by signed-in players.
// Console-friendly on purpose: big buttons, visible focus rings, no drag-and-drop, no hover-only controls,
// and a "log in with your phone" code flow so nobody has to type a password with a D-pad.
// Docs: docs/HIGHLIGHTS.md. This file only composes; state lives in components/highlights/use*.ts,
// pure rules in lib/highlights.ts.

interface Props { session: any; onOpenModal: (id: string, tab?: 'login' | 'register') => void }

export default function Highlights({ session, onOpenModal }: Props) {
  const user = session?.user || null;
  const gallery = useGallery(user, onOpenModal);
  const form = useUpload(user, gallery.showFreshest);
  const login = useDeviceLogin();
  const link = useConsoleLink(user);

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <style>{`.hl-btn:focus,.hl-btn:focus-visible,.hl-card button:focus-visible{outline:3px solid #FFE135;outline-offset:3px}`}</style>

      <HighlightsHeader consoleMode={isConsole()} />
      {!user && <SignInPanel login={login} onOpenModal={onOpenModal} />}
      <UploadPanel user={user} form={form} />
      <PlatformGuide />
      <LinkPanel user={user} link={link} onOpenModal={onOpenModal} />
      <Gallery user={user} gallery={gallery} />
    </div>
  );
}
