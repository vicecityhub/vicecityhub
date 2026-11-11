import React from 'react';
import { CommunityMedia } from '../components/home/CommunityMedia';
import { HeroSection } from '../components/home/HeroSection';
import { InDepthSection } from '../components/home/InDepthSection';
import { MappingSection } from '../components/home/MappingSection';

interface HomeProps {
  onOpenModal: (id: string, tab?: 'login' | 'register') => void;
  session: any;
}

/** Home page: hero (stream trailer banner + countdown), community media, in-depth features and the map. */
export default function Home({ onOpenModal, session }: HomeProps) {
  return (
    <div className="w-full">
      <HeroSection onOpenModal={onOpenModal} />

      <div className="gradient-line" />

      <CommunityMedia session={session} />
      <div className="gradient-line" />

      <InDepthSection />

      <div className="gradient-line" />

      <MappingSection session={session} onOpenModal={onOpenModal} />
    </div>
  );
}
