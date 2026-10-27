import React from 'react';
import { ArcadePromo } from '../components/community/ArcadePromo';
import { CommunityHeader } from '../components/community/CommunityHeader';
import { FeedList } from '../components/community/FeedList';
import { SortTabs, SubhubFilter } from '../components/community/FeedControls';
import { LegacyComposerModal } from '../components/community/LegacyComposerModal';
import { PostComposerModal } from '../components/community/PostComposerModal';
import { UndergroundForum } from '../components/community/UndergroundForum';
import { YouTubeBanner } from '../components/community/YouTubeBanner';
import { useFeed } from '../components/community/useFeed';
import { useLegacyForum } from '../components/community/useLegacyForum';
import { usePostComposer } from '../components/community/usePostComposer';
import { useSubhubs } from '../components/community/useSubhubs';

interface CommunityProps {
  onOpenModal: (id: string, tab?: 'login' | 'register') => void;
  session: any;
}

export default function Community({ onOpenModal, session }: CommunityProps) {
  const isLoggedIn = !!session?.user;
  const currentUserId: string | null = session?.user?.id || null;
  const requireAuth = () => onOpenModal('auth', 'login');

  // The composer's sub-hub is also defaulted to the first sub-hub when the list arrives.
  const [composerSubhubId, setComposerSubhubId] = React.useState<number | null>(null);
  const subhubs = useSubhubs((rows) => {
    if (rows.length > 0) setComposerSubhubId(rows[0].id);
  });

  const feed = useFeed(session, subhubs);
  const composer = usePostComposer({
    session,
    isLoggedIn,
    requireAuth,
    subhubs,
    subhubId: composerSubhubId,
    setSubhubId: setComposerSubhubId,
    refetch: feed.fetchPosts,
  });
  const forum = useLegacyForum({ session, isLoggedIn, requireAuth });

  const handleOpenPost = (id: number) => {
    window.location.href = `./post.html?id=${id}`;
  };

  return (
    <div className="max-w-5xl mx-auto px-4 lg:px-6 py-10">
      <CommunityHeader onNewPost={() => (isLoggedIn ? composer.openCreate() : requireAuth())} />

      <YouTubeBanner />

      <SubhubFilter subhubs={subhubs} active={feed.activeSubhub} onSelect={feed.setActiveSubhub} />
      <SortTabs mode={feed.sortMode} onChange={feed.setSortMode} />

      <div className="gradient-line mb-2" />

      <FeedList
        loading={feed.loading}
        posts={feed.posts}
        feedRef={feed.feedRef}
        isLoggedIn={isLoggedIn}
        currentUserId={currentUserId}
        onRequireAuth={requireAuth}
        onOpenPost={handleOpenPost}
        onEdit={composer.openEdit}
        onDelete={feed.deletePost}
      />

      {/* Legacy Forum — migrated from the old Home page "Underground" section, still fully active */}
      <div className="gradient-line mt-4 mb-6" />

      <UndergroundForum forum={forum} currentUserId={currentUserId} />

      <ArcadePromo />

      <LegacyComposerModal forum={forum} />
      <PostComposerModal composer={composer} subhubs={subhubs} />
    </div>
  );
}
