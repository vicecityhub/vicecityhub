import React, { useState } from 'react'
import TabNavigation, { TabId } from '../rp-hub/components/TabNavigation'
import ServersTab    from '../rp-hub/components/ServersTab'
import GlossaryTab   from '../rp-hub/components/GlossaryTab'
import CharactersTab from '../rp-hub/components/CharactersTab'
import ModsTab       from '../rp-hub/components/ModsTab'
import StoreTab      from '../rp-hub/components/StoreTab'
import CommunityTab  from '../rp-hub/components/CommunityTab'
import RpHeader from '../rp-hub/components/RpHeader'
import RpHero from '../rp-hub/components/RpHero'
import RpFooter from '../rp-hub/components/RpFooter'
import { useRpRadio } from '../rp-hub/useRpRadio'
import { tabBodyStyle } from '../lib/rpTabs'

/** Which component fills the page body for each tab. */
const TAB_VIEWS: Record<TabId, React.ComponentType> = {
  servers:    ServersTab,
  glossary:   GlossaryTab,
  characters: CharactersTab,
  mods:       ModsTab,
  store:      StoreTab,
  community:  CommunityTab,
}

export default function RPHub() {
  const [activeTab, setActiveTab] = useState<TabId>('servers')
  const { isPlaying, toggle } = useRpRadio()
  const ActiveView = TAB_VIEWS[activeTab]

  return (
    <div className="min-h-screen vibe-bg scanlines">
      <RpHeader isPlaying={isPlaying} onToggle={toggle} />
      <RpHero />
      <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="relative min-h-screen" style={tabBodyStyle(activeTab)}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-7">
          <ActiveView />
        </div>
      </div>

      <RpFooter />
    </div>
  )
}
