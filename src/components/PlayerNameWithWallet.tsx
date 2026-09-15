import React, { useState, useRef, useEffect } from 'react';
import { Info, Copy, Check, ExternalLink, Wallet } from 'lucide-react';
import { Player } from '../types/game';

interface PlayerNameWithWalletProps {
  player?: Partial<Player> | {
    id?: string;
    name?: string;
    username?: string;
    firstName?: string;
    lastName?: string;
    walletAddress?: string;
    isBot?: boolean;
    isHost?: boolean;
  };
  name?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  walletAddress?: string;
  isBot?: boolean;
  isHost?: boolean;
  isYou?: boolean;
  showWalletIcon?: boolean;
  className?: string;
  nameClassName?: string;
  maxNameWidthClass?: string;
}

export const PlayerNameWithWallet: React.FC<PlayerNameWithWalletProps> = ({
  player,
  name: directName,
  username: directUsername,
  firstName: directFirstName,
  lastName: directLastName,
  walletAddress: directWalletAddress,
  isBot: directIsBot,
  isHost: directIsHost,
  isYou: directIsYou,
  showWalletIcon = true,
  className = '',
  nameClassName = '',
  maxNameWidthClass = 'max-w-[110px]'
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [copied, setCopied] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close tooltip if clicked outside (for touch/click toggle)
  useEffect(() => {
    if (!showTooltip) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setShowTooltip(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTooltip]);

  const rawName = directName || player?.name || '';
  const rawUsername = directUsername || player?.username || '';
  const firstName = directFirstName || player?.firstName || '';
  const lastName = directLastName || player?.lastName || '';
  const isBot = Boolean(directIsBot ?? player?.isBot);
  const isHost = Boolean(directIsHost ?? player?.isHost);
  const isYou = Boolean(directIsYou);

  // Resolve wallet address
  let wallet = directWalletAddress || player?.walletAddress || '';
  if (!wallet && !isBot && /^0x[a-fA-F0-9]{6,}/i.test(rawName)) {
    wallet = rawName;
  }

  // Resolve best human-readable username
  let displayName = '';
  if (rawUsername && !/^0x[a-fA-F0-9]{10,}/i.test(rawUsername)) {
    displayName = rawUsername;
  } else if (firstName) {
    displayName = `${firstName}${lastName ? ` ${lastName}` : ''}`.trim();
  } else if (rawName && !/^0x[a-fA-F0-9]{10,}/i.test(rawName)) {
    displayName = rawName;
  } else if (wallet) {
    // If only wallet address exists, format cleanly
    displayName = `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
  } else {
    displayName = rawName || 'Player';
  }

  const handleCopyWallet = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!wallet) return;
    try {
      navigator.clipboard.writeText(wallet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy address', err);
    }
  };

  const truncatedWallet = wallet
    ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}`
    : '';

  return (
    <div className={`inline-flex items-center gap-1 min-w-0 ${className}`}>
      {/* Primary Username Display */}
      <span
        className={`font-bold truncate ${maxNameWidthClass} ${nameClassName}`}
        title={displayName}
      >
        {displayName}
      </span>

      {/* (You) Tag */}
      {isYou && (
        <span className="text-[9px] text-[#7059e2] font-mono-code font-bold shrink-0">
          (You)
        </span>
      )}

      {/* Host Tag */}
      {isHost && (
        <span
          className="text-[8px] px-1 py-0.2 bg-amber-500/20 text-amber-400 font-bold rounded border border-amber-500/30 flex items-center gap-0.5 shrink-0"
          title="Room Creator / Host"
        >
          <span>👑</span>
          <span>Host</span>
        </span>
      )}

      {/* Wallet Info Icon & Hover Tooltip */}
      {showWalletIcon && wallet && !isBot && (
        <div
          className="relative inline-flex items-center"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <button
            ref={triggerRef}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowTooltip((prev) => !prev);
            }}
            className="p-0.5 rounded-full text-slate-400 hover:text-amber-400 hover:bg-amber-400/10 transition-colors cursor-pointer shrink-0 focus:outline-none"
            title="View Web3 Wallet Address"
            aria-label="View Web3 Wallet Address"
          >
            <Info className="w-3.5 h-3.5" />
          </button>

          {/* Tooltip Overlay */}
          {showTooltip && (
            <div
              ref={tooltipRef}
              onClick={(e) => e.stopPropagation()}
              className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50 w-52 p-2.5 rounded-xl bg-[#130f26] border border-[#3b2b68] shadow-2xl text-white text-[11px] animate-fade-in pointer-events-auto"
            >
              <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-purple-900/40">
                <div className="flex items-center gap-1 text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                  <Wallet className="w-3 h-3 text-amber-400" />
                  <span>Web3 Wallet</span>
                </div>
                {firstName && (
                  <span className="text-[9px] text-slate-400 truncate max-w-[80px]">
                    {firstName} {lastName}
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="font-mono-code text-[10px] bg-[#0c0919] px-2 py-1 rounded border border-purple-900/50 break-all select-all text-slate-200">
                  {wallet}
                </div>

                <div className="flex items-center justify-between pt-0.5">
                  <span className="text-[9px] text-slate-400 font-mono-code">
                    {truncatedWallet}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyWallet}
                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#7059e2]/30 hover:bg-[#7059e2] text-[#c4b5fd] hover:text-white transition-all text-[9px] font-bold cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="w-2.5 h-2.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-2.5 h-2.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Tooltip Arrow */}
              <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-[#3b2b68]" />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
