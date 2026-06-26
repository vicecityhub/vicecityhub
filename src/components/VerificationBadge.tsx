import React from 'react';
import { ShieldQuestion, ShieldCheck, ShieldHalf } from 'lucide-react';

export type VerificationLevel = 'unverified' | 'screenshot_pending' | 'screenshot_verified' | 'steam_verified';

interface VerificationBadgeProps {
  level: VerificationLevel;
  size?: 'sm' | 'md';
}

/*
  Trust ladder for self-reported game accounts:

  unverified          - gray   - just a text claim, nothing checked
  screenshot_pending   - gray   - screenshot submitted, waiting on a moderator
  screenshot_verified  - cyan   - a moderator manually approved the screenshot
  steam_verified       - orange - real Steam OAuth, auto-verified, highest trust

  NOTE: there is no public Rockstar Social Club or PSN API, so RSC/PSN
  claims can only ever reach "screenshot_verified" at best — never
  fully automated. Steam is the only platform with a real OAuth flow.
*/

const CONFIG: Record<VerificationLevel, { label: string; icon: React.ReactNode; classes: string }> = {
  unverified: {
    label: 'Unverified',
    icon: <ShieldQuestion size={12} />,
    classes: 'bg-white/5 text-gray-400 border-white/10',
  },
  screenshot_pending: {
    label: 'Pending Review',
    icon: <ShieldQuestion size={12} />,
    classes: 'bg-white/5 text-gray-400 border-white/10',
  },
  screenshot_verified: {
    label: 'Verified',
    icon: <ShieldHalf size={12} />,
    classes: 'bg-neonCyan/10 text-neonCyan border-neonCyan/30',
  },
  steam_verified: {
    label: 'Steam Verified',
    icon: <ShieldCheck size={12} />,
    classes: 'bg-neonOrange/10 text-neonOrange border-neonOrange/30',
  },
};

export default function VerificationBadge({ level, size = 'md' }: VerificationBadgeProps) {
  const cfg = CONFIG[level] || CONFIG.unverified;
  const sizeClasses = size === 'sm' ? 'text-[9px] px-1.5 py-0.5 gap-1' : 'text-[10px] px-2.5 py-1 gap-1.5';

  return (
    <span
      className={`inline-flex items-center rounded font-orbitron font-extrabold uppercase tracking-wider border ${cfg.classes} ${sizeClasses}`}
      title={
        level === 'steam_verified'
          ? 'Linked via real Steam OAuth'
          : level === 'screenshot_verified'
          ? 'Manually approved by a moderator'
          : level === 'screenshot_pending'
          ? 'Screenshot submitted, awaiting moderator review'
          : 'Self-reported, not yet checked by anyone'
      }
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}
