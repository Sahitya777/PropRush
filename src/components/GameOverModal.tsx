import React, { useEffect } from 'react';
import { fireConfetti } from '../utils/confetti';
import { GameRoom } from '../types/game';
import { MatchStatsAnalyticsModal } from './MatchStatsAnalyticsModal';
import { sounds } from '../utils/audio';

interface GameOverModalProps {
  room: GameRoom;
  myPlayerId: string;
  onPlayAgain: () => void;
  onReturnHome: () => void;
  statsSummary?: {
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
  const winner = room.winner || room.players.find(p => !p.isBankrupt) || room.players[0];
  const isWinner = winner?.id === myPlayerId;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <MatchStatsAnalyticsModal
        room={room}
        myPlayerId={myPlayerId}
        onPlayAgain={onPlayAgain}
        onReturnHome={onReturnHome}
      />
    </div>
  );
};

