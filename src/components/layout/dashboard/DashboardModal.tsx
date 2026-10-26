import React from 'react';
import { Radio, X } from 'lucide-react';
import { MyPostsTab } from './MyPostsTab';
import { MyProfileTab } from './MyProfileTab';
import { OverviewTab } from './OverviewTab';
import { SubmitDomainTab, SubmitForumTab, SubmitNewsTab, SubmitPodcastTab, SubmitStreamTab } from './SubmitTabs';
import type { DashboardController, DashTab } from './useDashboard';

const SIDEBAR_ACCOUNT: { tab: DashTab; label: string }[] = [
  { tab: 'overview', label: 'Overview' },
  { tab: 'myposts', label: 'My Posts & Assets' },
  { tab: 'myprofile', label: 'My Profile' },
];

const SIDEBAR_SUBMIT: { tab: DashTab; label: string }[] = [
  { tab: 'news', label: 'Submit News' },
  { tab: 'forum', label: 'Submit Forum Post' },
  { tab: 'stream', label: 'Submit Streamer' },
  { tab: 'podcast', label: 'Submit Podcast' },
  { tab: 'domain', label: 'List Web3 Domain' },
];

function SidebarButtons({ items, active, onSelect }: { items: typeof SIDEBAR_ACCOUNT; active: DashTab; onSelect: (tab: DashTab) => void }) {
  return (
    <>
      {items.map(({ tab, label }) => (
        <button key={tab} onClick={() => onSelect(tab)} className={`w-full py-2.5 px-4 text-left text-xs font-bold uppercase tracking-wider rounded transition-all ${active === tab ? 'bg-neonCyan/10 text-neonCyan border border-neonCyan/30' : 'text-gray-400 hover:bg-white/5'}`}>{label}</button>
      ))}
    </>
  );
}

function DashboardPanel({ dashboard }: { dashboard: DashboardController }) {
  const { tab, userPosts, posts, submits, player } = dashboard;
  const { forms, updateForm, submit } = submits;
  switch (tab) {
    case 'overview': return <OverviewTab userPosts={userPosts} />;
    case 'myposts': return <MyPostsTab userPosts={userPosts} manager={posts} />;
    case 'myprofile': return <MyProfileTab player={player} />;
    case 'news': return <SubmitNewsTab form={forms.news} onChange={p => updateForm('news', p)} onSubmit={() => submit('news')} />;
    case 'forum': return <SubmitForumTab form={forms.forum} onChange={p => updateForm('forum', p)} onSubmit={() => submit('forum')} />;
    case 'stream': return <SubmitStreamTab form={forms.stream} onChange={p => updateForm('stream', p)} onSubmit={() => submit('stream')} />;
    case 'podcast': return <SubmitPodcastTab form={forms.podcast} onChange={p => updateForm('podcast', p)} onSubmit={() => submit('podcast')} />;
    case 'domain': return <SubmitDomainTab form={forms.domain} onChange={p => updateForm('domain', p)} onSubmit={() => submit('domain')} />;
    default: return null;
  }
}

/** Wide user dashboard modal: sidebar navigation + the active tab. */
export function DashboardModal({ dashboard, username }: { dashboard: DashboardController; username: string }) {
  const { tab, setTab, close } = dashboard;
  return (
    <div className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass-card max-w-5xl w-full h-[85vh] flex flex-col md:flex-row relative border border-neonCyan shadow-[0_0_55px_rgba(0,255,255,0.15)] overflow-hidden">
        <button onClick={close} className="absolute top-4 right-4 text-gray-500 hover:text-neonPink transition-colors z-[1001]">
          <X size={20} />
        </button>

        {/* Sidebar Navigation */}
        <div className="w-full md:w-[250px] border-r border-white/5 bg-[#050508]/85 p-6 flex flex-col gap-1.5 flex-shrink-0">
          <div className="font-orbitron font-extrabold text-2xl text-neonCyan neon-text-cyan mb-2 uppercase tracking-widest flex items-center gap-2">
            <Radio size={20} className="text-neonCyan animate-pulse" /> HUB
          </div>
          <div className="text-[10px] text-gray-500 tracking-widest uppercase mb-6 font-bold">Agent: {username}</div>

          <SidebarButtons items={SIDEBAR_ACCOUNT} active={tab} onSelect={setTab} />
          <div className="h-px bg-white/5 my-4" />
          <div className="text-[9px] text-gray-600 uppercase tracking-widest font-extrabold mb-2 ml-4">Submit Operations</div>
          <SidebarButtons items={SIDEBAR_SUBMIT} active={tab} onSelect={setTab} />
        </div>

        {/* Main Tab Content Panel */}
        <div className="flex-grow p-8 overflow-y-auto bg-[#0a0a0f]/50">
          <DashboardPanel dashboard={dashboard} />
        </div>
      </div>
    </div>
  );
}
