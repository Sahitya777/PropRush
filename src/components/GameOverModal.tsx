import React, { useEffect } from 'react';
import { fireConfetti } from '../utils/confetti';
import { GameRoom, Player } from '../types/game';
import { AvatarCharacter } from './AvatarCharacter';
import { useTheme } from '../context/ThemeContext';
import { sounds } from '../utils/audio';

interface GameOverModalProps {
  room: GameRoom;
  myPlayerId: string;
  onPlayAgain: () => void;
  onReturnHome: () => void;
  statsSummary: {
    lpChange: number;
    coinsEarned: number;
    newBadges: { id: string; name: string; icon: string }[];
  } | null;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  room,
  myPlayerId,
  onPlayAgain,
  onReturnHome,
  statsSummary
}) => {
  const { isLight } = useTheme();
  const winner = room.winner || room.players.find(p => !p.isBankrupt) || room.players[0];
  const isWinner = winner?.id === myPlayerId;
  const myPlayer = room.players.find(p => p.id === myPlayerId);

  // Sorted leaderboard by net worth
  const rankedPlayers = [...room.players].sort((a, b) => {
    if (a.isBankrupt && !b.isBankrupt) return 1;
    if (!a.isBankrupt && b.isBankrupt) return -1;
    return b.netWorth - a.netWorth;
  });

  const myPlacement = rankedPlayers.findIndex(p => p.id === myPlayerId) + 1;
  const winnerPayout = room.betAmount > 0 
    ? Math.round(room.totalPrizePool * (1 - room.platformFeeRate) * 100) / 100 
    : 0;

  useEffect(() => {
    if (isWinner) {
      sounds.playVictory();
      fireConfetti({
        particleCount: 120,
        spread: 90,
        origin: { y: 0.6 }
      });
      const timer = setTimeout(() => {
        fireConfetti({
          particleCount: 80,
          angle: 60,
          spread: 55,
          origin: { x: 0 }
        });
        fireConfetti({
          particleCount: 80,
          angle: 120,
          spread: 55,
          origin: { x: 1 }
        });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isWinner]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className={`w-full max-w-xl border-2 rounded-3xl shadow-2xl p-4 sm:p-6 flex flex-col gap-4 sm:gap-5 text-center my-auto ${
        isLight
          ? 'bg-white border-amber-400 text-slate-800'
          : 'bg-[#181329] border-amber-400/80 text-white shadow-[0_0_50px_rgba(251,191,36,0.3)]'
      }`}>
        {/* Crown & Title Banner */}
        <div>
          <div className="text-3xl sm:text-5xl animate-bounce mb-1">👑</div>
          <h1 className="font-heading font-black text-xl sm:text-3xl text-transparent bg-clip-text bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 uppercase tracking-wide">
            {isWinner ? 'YOU ARE THE TYCOON!' : `${winner?.name} WON THE GAME!`}
          </h1>
          <p className={`text-xs sm:text-sm mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Economy match concluded • Final standings & financial report
          </p>
        </div>

        {/* Winner Highlight Box */}
        <div className={`p-3.5 sm:p-4 rounded-2xl border shadow-xl flex items-center justify-between flex-wrap gap-3 ${
          isLight
            ? 'bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50 border-amber-300'
            : 'bg-gradient-to-r from-[#2a1f49] via-[#322359] to-[#2a1f49] border-amber-400/40'
        }`}>
          <div className="flex items-center gap-3 text-left">
            <AvatarCharacter avatarId={winner?.avatar || 'navy'} size="md" />
            <div>
              <div className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-amber-700' : 'text-amber-400'}`}>
                1st Place Champion
              </div>
              <div className={`font-heading font-black text-base sm:text-lg ${isLight ? 'text-slate-900' : 'text-white'}`}>
                {winner?.name}
              </div>
              <div className={`text-xs font-mono-code ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                Final Net Worth: <strong className="text-emerald-600 dark:text-emerald-400">${winner?.netWorth}</strong>
              </div>
            </div>
          </div>

          {/* Wager Prize Banner */}
          {room.betAmount > 0 && (
            <div className={`text-right px-3 sm:px-4 py-2 rounded-xl border ${
              isLight ? 'bg-emerald-50 border-emerald-300' : 'bg-emerald-950/70 border-emerald-500/50'
            }`}>
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase">
                Prize Payout (95%)
              </div>
              <div className="text-lg sm:text-2xl font-black font-mono-code text-emerald-600 dark:text-emerald-300">
                +${winnerPayout}
              </div>
              <div className={`text-[9px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                (5% platform fee deducted)
              </div>
            </div>
          )}
        </div>

        {/* User Match Rewards / LP summary */}
        {statsSummary && (
          <div className={`grid grid-cols-3 gap-2 p-3 rounded-2xl border ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/80 border-slate-800'
          }`}>
            <div className="text-center">
              <div className={`text-[10px] uppercase font-bold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Your Rank</div>
              <div className={`text-sm sm:text-base font-extrabold ${isLight ? 'text-amber-700' : 'text-amber-300'}`}>
                #{myPlacement} of {room.players.length}
              </div>
            </div>
            <div className="text-center">
              <div className={`text-[10px] uppercase font-bold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>League Points</div>
              <div className={`text-sm sm:text-base font-extrabold font-mono-code ${statsSummary.lpChange >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {statsSummary.lpChange >= 0 ? `+${statsSummary.lpChange}` : statsSummary.lpChange} LP
              </div>
            </div>
            <div className="text-center">
              <div className={`text-[10px] uppercase font-bold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>RichUp Coins</div>
              <div className={`text-sm sm:text-base font-extrabold flex items-center justify-center gap-1 ${isLight ? 'text-amber-700' : 'text-yellow-400'}`}>
                <span>🪙</span> +{statsSummary.coinsEarned}
              </div>
            </div>
          </div>
        )}

        {/* Badges Unlocked Alert */}
        {statsSummary?.newBadges && statsSummary.newBadges.length > 0 && (
          <div className={`p-3 rounded-xl text-left flex items-center gap-3 border ${
            isLight ? 'bg-amber-50 border-amber-300' : 'bg-amber-500/10 border-amber-500/30'
          }`}>
            <span className="text-2xl">🎖️</span>
            <div>
              <div className={`text-xs font-bold ${isLight ? 'text-amber-800' : 'text-amber-300'}`}>New Badge Unlocked!</div>
              <div className={`text-xs ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
                {statsSummary.newBadges.map(b => `${b.icon} ${b.name}`).join(', ')}
              </div>
            </div>
          </div>
        )}

        {/* Full Leaderboard Table */}
        <div className="space-y-1.5 text-left max-h-44 overflow-y-auto pr-1">
          <div className={`text-xs font-bold uppercase px-2 mb-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Player Standings & Net Worth
          </div>
          {rankedPlayers.map((player, idx) => (
            <div
              key={player.id}
              className={`flex items-center justify-between p-2.5 rounded-xl text-xs border ${
                player.id === myPlayerId
                  ? isLight ? 'bg-[#7059e2]/10 border-[#7059e2]' : 'bg-[#7059e2]/20 border-[#7059e2]'
                  : isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/60 border-slate-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className={`font-heading font-black text-xs w-4 ${isLight ? 'text-amber-700' : 'text-amber-400'}`}>
                  #{idx + 1}
                </span>
                <AvatarCharacter avatarId={player.avatar} size="xs" />
                <span className={`font-bold ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>
                  {player.name} {player.id === myPlayerId && '(You)'}
                </span>
                {player.isBankrupt && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-900/60 text-rose-300 border border-rose-700">
                    Bankrupt
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 font-mono-code">
                <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>
                  {player.properties.length} Props
                </span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                  ${player.netWorth}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={onReturnHome}
            className={`py-3 rounded-xl font-heading font-bold text-xs cursor-pointer transition-colors ${
              isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
            }`}
          >
            ← Return to Lobby
          </button>
          <button
            onClick={onPlayAgain}
            className="py-3 rounded-xl bg-gradient-to-r from-[#7059e2] to-[#8e76f7] hover:from-[#6047d8] hover:to-[#7f63f3] font-heading font-black text-xs text-white cursor-pointer shadow-lg active:scale-95 transition-all"
          >
            Play Again 🚀
          </button>
        </div>
      </div>
    </div>
  );
};
