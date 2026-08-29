import React, { useState, useEffect } from 'react';
import { UserProvider, useUser } from './context/UserContext';
import { HeaderNavbar } from './components/HeaderNavbar';
import { HomeLobbyView } from './views/HomeLobbyView';
import { GameRoomView } from './views/GameRoomView';
import { StoreView } from './views/StoreView';
import { ProfileView } from './views/ProfileView';
import { WalletModal } from './components/WalletModal';
import { RulesModal } from './components/RulesModal';
import { ClerkAuthModal } from './components/ClerkAuthModal';
import { sounds } from './utils/audio';
import { getActiveMatch } from './utils/reconnectStorage';

function AppContent() {
  const { user, deductBuyIn } = useUser();
  const [currentView, setCurrentView] = useState<'home' | 'game' | 'store' | 'profile'>('home');
  const [activeRoomConfig, setActiveRoomConfig] = useState<{
    roomCode: string;
    roomName: string;
    maxPlayers: number;
    betAmount: number;
    initialCash: number;
    turnTimeSeconds: number;
    boardTheme: string;
    fillWithBots: boolean;
  } | null>(null);

  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Check URL parameter for ?room=lnu17 or /room/lnu17
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
      handleJoinRoom({
        roomCode: roomParam,
        roomName: `Room ${roomParam.toUpperCase()}`,
        maxPlayers: 4,
        betAmount: 10,
        initialCash: 1500,
        turnTimeSeconds: 15,
        boardTheme: 'classic',
        fillWithBots: true
      });
    }
  }, []);

  const handleJoinRoom = (config: {
    roomCode: string;
    roomName: string;
    maxPlayers: number;
    betAmount: number;
    initialCash: number;
    turnTimeSeconds: number;
    boardTheme: string;
    fillWithBots: boolean;
  }) => {
    // Check if player is reconnecting to an active unexpired match
    const existingSaved = getActiveMatch();
    const isReconnecting = Boolean(
      existingSaved &&
      existingSaved.roomConfig.roomCode.toLowerCase() === config.roomCode.toLowerCase()
    );

    // If room requires a buy-in / wager, verify wallet balance & deduct (only on first join, not reconnect)
    if (config.betAmount > 0 && !isReconnecting) {
      if (user.walletBalance < config.betAmount) {
        sounds.playPayRent();
        alert(`⚠️ Insufficient wallet balance ($${user.walletBalance.toFixed(2)}). You need $${config.betAmount.toFixed(2)} buy-in to join "${config.roomName}". Please deposit funds.`);
        setIsWalletOpen(true);
        return;
      }
      // Deduct buy-in
      const deducted = deductBuyIn(config.betAmount);
      if (!deducted) {
        alert('Failed to process buy-in payment. Please check your wallet.');
        setIsWalletOpen(true);
        return;
      }
    }

    sounds.playCashRegister();
    setActiveRoomConfig(config);
    setCurrentView('game');
    // Update browser URL quietly
    try {
      const newUrl = `${window.location.pathname}?room=${config.roomCode}`;
      window.history.pushState({ path: newUrl }, '', newUrl);
    } catch {
      // Ignore pushState issues in sandboxed iframes
    }
  };

  const handleLeaveRoom = () => {
    setActiveRoomConfig(null);
    setCurrentView('home');
    try {
      const newUrl = window.location.pathname;
      window.history.pushState({ path: newUrl }, '', newUrl);
    } catch {
      // Ignore pushState issues in sandboxed iframes
    }
  };

  const handleToggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    sounds.setMuted(nextMute);
  };

  return (
    <div className="min-h-screen bg-[#0d0a18] text-slate-100 flex flex-col font-sans selection:bg-[#7059e2] selection:text-white">
      {/* Top Navbar (rendered when not in game room to give 100% space to game board) */}
      {currentView !== 'game' && (
        <HeaderNavbar
          currentView={currentView}
          onNavigate={view => {
            sounds.playClick();
            setCurrentView(view);
          }}
          onOpenWallet={() => {
            sounds.playClick();
            setIsWalletOpen(true);
          }}
          onOpenRules={() => {
            sounds.playClick();
            setIsRulesOpen(true);
          }}
          onOpenAuth={() => {
            sounds.playClick();
            setCurrentView('profile');
          }}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
        />
      )}

      {/* Main View Container */}
      <main className="flex-1 flex flex-col min-h-0">
        {currentView === 'home' && (
          <HomeLobbyView
            onJoinRoom={handleJoinRoom}
            onOpenWallet={() => setIsWalletOpen(true)}
            onOpenStore={() => setCurrentView('store')}
          />
        )}

        {currentView === 'game' && activeRoomConfig && (
          <GameRoomView
            roomConfig={activeRoomConfig}
            onLeaveRoom={handleLeaveRoom}
            isMuted={isMuted}
            onToggleMute={handleToggleMute}
            onOpenRules={() => setIsRulesOpen(true)}
          />
        )}

        {currentView === 'store' && <StoreView />}

        {currentView === 'profile' && <ProfileView />}
      </main>

      {/* Footer sleek minimalism (hidden during active game) */}
      {currentView !== 'game' && (
        <footer className="w-full border-t border-[#2b2447] py-6 px-4 bg-[#100c1e] text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-3 max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <span className="font-heading font-black text-slate-300">PROPRUSH</span>
            <span>• Fast-Paced Multiplayer Real Estate</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsRulesOpen(true)}
              className="hover:text-slate-300 cursor-pointer transition-colors"
            >
              How to Play
            </button>
            <button
              onClick={() => setIsWalletOpen(true)}
              className="hover:text-slate-300 cursor-pointer transition-colors"
            >
              Wagers & Fees
            </button>
            <button
              onClick={() => setCurrentView('store')}
              className="hover:text-slate-300 cursor-pointer transition-colors"
            >
              Custom Cosmetics
            </button>
            <button
              onClick={() => setCurrentView('profile')}
              className="hover:text-slate-300 cursor-pointer transition-colors"
            >
              Rankings & Stats
            </button>
          </div>
        </footer>
      )}

      {/* Wallet Modal */}
      <WalletModal
        isOpen={isWalletOpen}
        onClose={() => setIsWalletOpen(false)}
      />

      {/* Rules Modal */}
      <RulesModal
        isOpen={isRulesOpen}
        onClose={() => setIsRulesOpen(false)}
      />

      {/* Clerk Authentication Modal */}
      <ClerkAuthModal />
    </div>
  );
}

export default function App() {
  return (
    <UserProvider>
      <AppContent />
    </UserProvider>
  );
}
