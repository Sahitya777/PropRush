import React, { useState } from 'react';
import { BoardTile, GameRoom, Player } from '../types/game';
import { AvatarCharacter } from './AvatarCharacter';
import { useTheme } from '../context/ThemeContext';
import { sounds } from '../utils/audio';

interface AuctionModalProps {
  room: GameRoom;
  tile: BoardTile;
  onPlaceBid: (amount: number) => void;
  onPassAuction: () => void;
  myPlayerId: string;
}

export const AuctionModal: React.FC<AuctionModalProps> = ({
  room,
  tile,
  onPlaceBid,
  onPassAuction,
  myPlayerId
}) => {
  const { isLight } = useTheme();
  const auction = room.auction;
  if (!auction) return null;

  const [customBid, setCustomBid] = useState<string>('');
  const highestBid = auction.highestBid;
  const highestBidder = room.players.find(p => p.id === auction.highestBidderId);
  const myPlayer = room.players.find(p => p.id === myPlayerId);

  const canBid = myPlayer && !myPlayer.isBankrupt && auction.activePlayerIds.includes(myPlayerId);

  const handleBidIncrement = (increment: number) => {
    const newBid = highestBid + increment;
    if (myPlayer && myPlayer.cash >= newBid) {
      sounds.playCashRegister();
      onPlaceBid(newBid);
    }
  };

  const handleCustomBid = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(customBid, 10);
    if (!isNaN(parsed) && parsed > highestBid && myPlayer && myPlayer.cash >= parsed) {
      sounds.playCashRegister();
      onPlaceBid(parsed);
      setCustomBid('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className={`w-full max-w-lg border-2 rounded-2xl shadow-2xl p-4 sm:p-5 overflow-hidden flex flex-col gap-3.5 sm:gap-4 max-h-[90vh] overflow-y-auto ${
        isLight ? 'bg-white border-[#7059e2] text-slate-800' : 'bg-[#19142b] border-[#7059e2] text-white'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between border-b pb-3 ${
          isLight ? 'border-slate-200' : 'border-slate-800'
        }`}>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔨</span>
            <div>
              <h2 className={`font-heading font-black text-base sm:text-lg ${isLight ? 'text-slate-900' : 'text-white'}`}>
                LIVE PROPERTY AUCTION
              </h2>
              <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Bidding for {tile.name}</p>
            </div>
          </div>
          {/* Timer Circle */}
          <div className={`flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-full border-2 font-mono-code font-black text-base sm:text-lg animate-pulse ${
            isLight
              ? 'bg-amber-100 border-amber-500 text-amber-800 shadow-sm'
              : 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.4)]'
          }`}>
            {auction.timer}s
          </div>
        </div>

        {/* Property Showcase Card */}
        <div className={`flex items-center justify-between p-3 rounded-xl border ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#221b3b] border-slate-700'
        }`}>
          <div>
            <div className={`font-bold text-sm ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>{tile.name}</div>
            <div className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Original Value: ${tile.price}</div>
          </div>
          <div className="text-right">
            <div className={`text-[10px] uppercase font-bold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Current Bid</div>
            <div className="text-xl font-black font-mono-code text-emerald-600 dark:text-emerald-400">
              ${highestBid}
            </div>
          </div>
        </div>

        {/* Current High Bidder */}
        <div className={`flex items-center justify-between px-3 py-2 rounded-xl border ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/60 border-slate-800'
        }`}>
          <span className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Highest Bidder:</span>
          {highestBidder ? (
            <div className="flex items-center gap-2">
              <AvatarCharacter avatarId={highestBidder.avatar} size="xs" />
              <span className={`text-xs font-bold ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>{highestBidder.name}</span>
            </div>
          ) : (
            <span className={`text-xs italic ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>No bids yet (Starting at $10)</span>
          )}
        </div>

        {/* Recent Bid Feed */}
        <div className={`h-24 overflow-y-auto rounded-xl p-2 space-y-1 border ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800/80'
        }`}>
          {auction.bidHistory.length === 0 ? (
            <div className={`text-center text-xs py-4 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
              Place a bid to claim this property before timer expires!
            </div>
          ) : (
            auction.bidHistory.slice(-4).reverse().map((bid, i) => {
              const bidder = room.players.find(p => p.id === bid.playerId);
              return (
                <div key={i} className={`flex items-center justify-between text-xs px-2 py-1 rounded ${
                  isLight ? 'bg-white border border-slate-200' : 'bg-slate-900/50'
                }`}>
                  <div className="flex items-center gap-1.5">
                    {bidder && <AvatarCharacter avatarId={bidder.avatar} size="xs" />}
                    <span className={`font-medium ${isLight ? 'text-slate-800' : 'text-slate-300'}`}>{bidder?.name || 'Player'}</span>
                  </div>
                  <span className="font-mono-code font-bold text-emerald-600 dark:text-emerald-400">${bid.amount}</span>
                </div>
              );
            })
          )}
        </div>

        {/* Bidding Controls for Current User */}
        {canBid ? (
          <div className={`flex flex-col gap-2 pt-2 border-t ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
            <div className={`flex items-center justify-between text-xs mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              <span>Your Cash: <strong className="text-emerald-600 dark:text-emerald-400">${myPlayer.cash}</strong></span>
              <span>Next Minimum: <strong className={`font-bold ${isLight ? 'text-amber-700' : 'text-amber-300'}`}>${highestBid + 10}</strong></span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleBidIncrement(10)}
                disabled={myPlayer.cash < highestBid + 10}
                className="py-2 sm:py-2.5 rounded-xl font-bold text-xs bg-[#7059e2] hover:bg-[#5f45d8] disabled:opacity-40 text-white cursor-pointer transition-all shadow-md active:scale-95"
              >
                + $10 (${highestBid + 10})
              </button>
              <button
                onClick={() => handleBidIncrement(50)}
                disabled={myPlayer.cash < highestBid + 50}
                className="py-2 sm:py-2.5 rounded-xl font-bold text-xs bg-[#8b5cf6] hover:bg-[#7c3aed] disabled:opacity-40 text-white cursor-pointer transition-all shadow-md active:scale-95"
              >
                + $50 (${highestBid + 50})
              </button>
              <button
                onClick={() => handleBidIncrement(100)}
                disabled={myPlayer.cash < highestBid + 100}
                className="py-2 sm:py-2.5 rounded-xl font-bold text-xs bg-[#a855f7] hover:bg-[#9333ea] disabled:opacity-40 text-white cursor-pointer transition-all shadow-md active:scale-95"
              >
                + $100 (${highestBid + 100})
              </button>
            </div>

            {/* Custom Bid & Pass */}
            <div className="flex gap-2 mt-1">
              <form onSubmit={handleCustomBid} className="flex-1 flex gap-1">
                <input
                  type="number"
                  placeholder={`$ Min ${highestBid + 1}`}
                  value={customBid}
                  onChange={e => setCustomBid(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border text-xs focus:outline-none focus:border-[#7059e2] ${
                    isLight ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400' : 'bg-slate-900 border-slate-700 text-white placeholder-slate-500'
                  }`}
                />
                <button
                  type="submit"
                  disabled={!customBid || parseInt(customBid, 10) <= highestBid || (myPlayer && myPlayer.cash < parseInt(customBid, 10))}
                  className="px-3 sm:px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white disabled:opacity-40 cursor-pointer"
                >
                  Bid
                </button>
              </form>

              <button
                onClick={onPassAuction}
                className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                  isLight ? 'bg-slate-200 hover:bg-slate-300 text-slate-700' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
              >
                Fold
              </button>
            </div>
          </div>
        ) : (
          <div className={`text-center py-2 text-xs rounded-xl ${
            isLight ? 'text-slate-500 bg-slate-100' : 'text-slate-400 bg-slate-900/50'
          }`}>
            You folded from this auction or lack sufficient funds.
          </div>
        )}
      </div>
    </div>
  );
};
