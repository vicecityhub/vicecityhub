import React, { useState } from 'react';
import { Check, Copy, Heart } from 'lucide-react';
import { FooterNav } from '../NavGroups';

interface CryptoCard {
  key: string;
  symbol: string;
  name: string;
  address: string;
  hoverBorder: string;
  accent: string;
}

// Real hub wallets. Do not change an address without a direct instruction from the owner (docs/AGENT-HANDOFF.md §5).
const CRYPTO_CARDS: CryptoCard[] = [
  { key: 'btc', symbol: 'BTC', name: 'Bitcoin (BTC)', address: 'bc1qtauw5d569vqmy26w32u6c7076pl5r069xhnsdn', hoverBorder: 'hover:border-neonOrange', accent: 'text-neonOrange' },
  { key: 'eth', symbol: 'ETH', name: 'Ethereum (ETH)', address: '0x04b9d483E4dcc059CC2fb9375De5244C0A7ddce1', hoverBorder: 'hover:border-neonPink', accent: 'text-neonPink' },
  { key: 'sol', symbol: 'SOL', name: 'Solana (SOL)', address: 'Gc75C9QnC59nTVW4f729VbWxcE6fsatGkZBQmQDJqB8b', hoverBorder: 'hover:border-green-500', accent: 'text-green-500' },
  { key: 'trx', symbol: 'TRX', name: 'TRON (TRX / USDT)', address: 'TRyGNvj1NcVM1V6aDJmycNBiSKWumZ4Zhz', hoverBorder: 'hover:border-red-500', accent: 'text-red-500' },
];

const COPIED_RESET_MS = 2000;

function CryptoAddressCard({ card, copied, onCopy }: { card: CryptoCard; copied: boolean; onCopy: () => void }) {
  return (
    <div
      onClick={onCopy}
      className={`glass-card p-5 border-white/5 ${card.hoverBorder} text-left shadow-xl transition-all cursor-pointer flex flex-col justify-between min-h-[120px] relative overflow-hidden`}
    >
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <span className="font-orbitron font-black text-xs">{card.symbol}</span>
          <span className={`font-orbitron font-extrabold ${card.accent} text-xs tracking-wider uppercase`}>{card.name}</span>
        </div>
        {copied ? (
          <span className="text-[9px] text-green-500 font-extrabold font-orbitron bg-green-500/10 border border-green-500/25 px-2 py-0.5 rounded tracking-widest flex items-center gap-1 animate-pulse"><Check size={10} /> Copied</span>
        ) : (
          <Copy size={12} className="text-gray-500" />
        )}
      </div>
      <div className="font-mono text-xs text-gray-300 font-semibold break-all tracking-wider select-all select-none">
        {card.address}
      </div>
    </div>
  );
}

/** Site footer: contact box, donation CTA and the direct crypto donation cards. */
export function SiteFooter({ onOpenKofi }: { onOpenKofi: () => void }) {
  // Crypto Address Copy Indicator (footer donation cards)
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const handleCopyAddress = (address: string, label: string) => {
    navigator.clipboard.writeText(address).then(() => {
      setCopiedAddress(label);
      setTimeout(() => setCopiedAddress(null), COPIED_RESET_MS);
    });
  };

  return (
    <footer className="bg-[#050508]/95 border-t border-white/5 pt-12 pb-28 lg:pb-12 px-6 lg:px-12 flex flex-col items-center text-center font-bold relative z-10">
      <div className="font-orbitron tracking-widest text-xl bg-gradient-to-r from-neonPink to-neonCyan bg-clip-text text-transparent mb-3">
        VICE CITY HUB
      </div>
      <div className="text-xs text-gray-500 tracking-wider mb-1 max-w-[600px]">
        Leonida's definitive intelligence network. Fan-operated community portal — not affiliated with Rockstar Games or Take-Two Interactive Software, Inc.
        <FooterNav />
      </div>
      <div className="text-[10px] text-gray-600 tracking-widest uppercase mb-8">
        Grand Theft Auto VI™ is a registered trademark of Take-Two Interactive Software, Inc.
      </div>

      {/* Contact Links Box */}
      <div className="glass-card max-w-[700px] w-full p-8 flex flex-col items-center gap-4 border border-neonPink/20 shadow-2xl">
        <div className="text-neonPink uppercase tracking-widest font-orbitron text-sm">Contact & Support Operations</div>
        <p className="text-xs text-gray-400 font-bold max-w-[500px]">
          Have leak tips, business collaborations, or server bugs? Send an encrypted dispatch or follow the syndicate below:
        </p>
        <div className="flex flex-wrap justify-center gap-3 mt-2">
          <a href="mailto:vicecityhub@proton.me"
            className="btn-neon btn-neon-cyan !py-2 !px-5 !text-[10px] flex items-center gap-2">
            ✉ E-Mail Us
          </a>
          <a href="https://x.com/vicecity_hub" target="_blank" rel="noopener noreferrer"
            className="btn-neon !py-2 !px-5 !text-[10px] flex items-center gap-2">
            X Follow on X
          </a>
          <a href="https://www.instagram.com/vicecity_hub?igsh=MXV6" target="_blank" rel="noopener noreferrer"
            className="btn-neon btn-neon-orange !py-2 !px-5 !text-[10px] flex items-center gap-2">
            @ Instagram
          </a>
        </div>

        {/* Donation CTA */}
        <div className="w-full border-t border-white/5 mt-4 pt-6 flex flex-col items-center gap-3">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
            Vice City Hub runs on community fuel — no ads, no cookies, no corporate overlords (only anonymous page counts). Donations fuel our AI projects and the open development of AI. Bots may chip in too, with their human's blessing.
          </p>
          <div className="flex items-center gap-3 flex-wrap justify-center">
            <a
              href="https://ud.me/vicecity.hub"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-neon btn-neon-orange !py-2 !px-5 !text-[10px] flex items-center gap-2 font-extrabold"
            >
              <Heart size={13} /> Donate
            </a>
            <button
              onClick={onOpenKofi}
              className="btn-neon btn-neon-kofi !py-2 !px-5 !text-[10px] flex items-center gap-2 font-extrabold"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 3H4v10c0 2.21 1.79 4 4 4h6c2.21 0 4-1.79 4-4v-3h2c1.11 0 2-.89 2-2V5c0-1.11-.89-2-2-2zm0 5h-2V5h2v3zM4 19h16v2H4z"/>
              </svg>
              Buy Us a Coffee
            </button>
          </div>
        </div>
      </div>

      {/* Direct Crypto Donation Addresses */}
      <div className="max-w-[900px] w-full mt-6">
        <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-4 text-center">Or transfer directly to our secure chain dispatches:</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {CRYPTO_CARDS.map(card => (
            <CryptoAddressCard
              key={card.key}
              card={card}
              copied={copiedAddress === card.key}
              onCopy={() => handleCopyAddress(card.address, card.key)}
            />
          ))}
        </div>
      </div>
    </footer>
  );
}
