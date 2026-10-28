// Background photo behind each RP Hub tab, and the CSS for the tab body. Pure, so it can be tested from Node.
import type { TabId } from '../rp-hub/components/TabNavigation'

const SUPABASE_STORE = 'https://lpglkglhjdqnktybksth.supabase.co/storage/v1/object/public/design%20photos'

export const BG_IMAGES: Record<TabId, string> = {
  servers:    `${SUPABASE_STORE}/Wheelie%20Chase.jpg`,
  glossary:   `${SUPABASE_STORE}/Lucia%20_%20Jason%20_%20Halftone%20Wash.jpg`,
  characters: `${SUPABASE_STORE}/Poolside%20Boss%20_%20Bold%20Ink.jpg`,
  mods:       `${SUPABASE_STORE}/Halftone%20Wash.jpg`,
  store:      'https://lpglkglhjdqnktybksth.supabase.co/storage/v1/object/public/design%20photos/Yacht%20Captain%20_%20Halftone%20Wash.png',
  community:  'https://lpglkglhjdqnktybksth.supabase.co/storage/v1/object/public/design%20photos/Pegassi%20Supercar%20v2.jpg',
}

/** Inline style of the tab body: a dark gradient laid over the active tab's photo. */
export function tabBodyStyle(tab: TabId) {
  return {
    backgroundImage: `linear-gradient(to bottom,
            rgba(5,5,8,0.90) 0%,
            rgba(5,5,8,0.78) 20%,
            rgba(5,5,8,0.82) 80%,
            rgba(5,5,8,0.95) 100%
          ), url('${BG_IMAGES[tab]}')`,
    backgroundSize: 'cover',
    backgroundPosition: 'center 20%',
    backgroundAttachment: 'fixed',
    transition: 'background-image 0.5s ease',
  }
}
