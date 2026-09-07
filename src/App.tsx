import React, { useState, useEffect } from 'react';
import { UserProvider, useUser } from './context/UserContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { HeaderNavbar } from './components/HeaderNavbar';
import { HomeLobbyView } from './views/HomeLobbyView';
import { GameRoomView } from './views/GameRoomView';
import { StoreView } from './views/StoreView';
import { ProfileView } from './views/ProfileView';
import { RankingsLeaguesView } from './views/RankingsLeaguesView';
import { AdminCommandCenterView } from './views/AdminCommandCenterView';
import { NotFoundView } from './views/NotFoundView';
import { WalletModal } from './components/WalletModal';
import { RulesModal } from './components/RulesModal';
import { DynamicAuthModal } from './components/DynamicAuthModal';
import { DynamicUserSync } from './components/DynamicUserSync';
import { useDynamicConfig } from './context/DynamicIntegration';
import { sounds } from './utils/audio';
import { getActiveMatch } from './utils/reconnectStorage';
import { findActiveRoomByCode, findActiveRoomByCodeAsync } from './utils/activeRoomsRegistry';
import { verifyStripeSession } from './utils/stripeClient';
import { fireConfetti } from './utils/confetti';

function getInitialView(): 'home' | 'game' | 'store' | 'profile' | 'rankings' | 'admin' | '404' {
  if (typeof window === 'undefined') return 'home';
  const rawPath = window.location.pathname.toLowerCase();
  // Normalize redundant slashes (e.g. "//" -> "/")
  const path = rawPath.replace(/\/+/g, '/') || '/';
  const params = new URLSearchParams(window.location.search);
  const viewParam = params.get('view')?.toLowerCase();

  // If returning from Stripe Checkout, joining a room, or canceled deposit, route to home
  if (
    params.has('session_id') ||
    params.has('deposit_success') ||
    params.has('deposit_canceled') ||
    params.has('room')
  ) {
    return 'home';
  }

  if (viewParam === '404' || path === '/404') return '404';
  if (viewParam === 'admin' || path === '/admin') return 'admin';
  if (viewParam === 'rankings' || viewParam === 'leaderboard' || path === '/rankings' || path === '/leaderboard') return 'rankings';
  if (viewParam === 'store' || path === '/store') return 'store';
  if (viewParam === 'profile' || path === '/profile') return 'profile';
  if (viewParam === 'home' || path === '/' || path === '/index.html' || path === '') return 'home';

  // If path is a custom unrecognized subpath (and not root or index.html), route to 404
  if (path !== '/' && path !== '/index.html' && !path.startsWith('/api')) {
    return '404';
  }
  return 'home';
}

function AppContent() {
  const { user, deductBuyIn, depositFunds, isBanned } = useUser();
  const { isDynamicConfigured } = useDynamicConfig();
  const { isLight } = useTheme();
  const [currentView, setCurrentView] = useState<'home' | 'game' | 'store' | 'profile' | 'rankings' | 'admin' | '404'>(getInitialView);
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
  const [depositNotification, setDepositNotification] = useState<string | null>(null);

  const navigateTo = (view: 'home' | 'store' | 'profile' | 'rankings' | 'admin' | '404') => {
    sounds.playClick();
    setCurrentView(view);
    try {
      const url = view === 'home' ? '/' : `/?view=${view}`;
      window.history.pushState({ view }, '', url);
    } catch {}
  };

  // Sync on popstate (Back / Forward browser buttons)
  useEffect(() => {
    const handlePopState = () => {
      setCurrentView(getInitialView());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Check URL parameters for active room or Stripe Checkout redirect return
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    
    // Check for Stripe Checkout return
    const sessionId = urlParams.get('session_id');
    const depositSuccess = urlParams.get('deposit_success');
    const depositAmountParam = urlParams.get('amount');
    const depositCanceled = urlParams.get('deposit_canceled');

    if (depositCanceled) {
      setCurrentView('home');
      setDepositNotification('Stripe payment was canceled. No funds were charged.');
      setTimeout(() => setDepositNotification(null), 4000);
      try {
        window.history.replaceState({}, '', '/');
      } catch {}
    } else if (sessionId && depositSuccess === 'true') {
      setCurrentView('home');
      const amountNum = depositAmountParam ? parseFloat(depositAmountParam) : 20;
      
      // Verify payment with server
      verifyStripeSession(sessionId, amountNum).then(res => {
        if (res.success && res.paid) {
          const credited = res.amount > 0 ? res.amount : amountNum;
          depositFunds(credited, 'stripe');
          sounds.playVictory();
          try {
            fireConfetti({
              particleCount: 80,
              spread: 70,
              origin: { y: 0.6 }
            });
          } catch {}
          setDepositNotification(`🎉 Stripe Payment Verified! $${credited.toFixed(2)} USD deposited to your wallet balance.`);
          setTimeout(() => setDepositNotification(null), 5000);
        }
      }).catch(err => {
        console.error('Failed to verify stripe session', err);
      }).finally(() => {
        try {
          window.history.replaceState({}, '', '/');
        } catch {}
      });
    }

    const roomParam = urlParams.get('room');
    if (roomParam) {
      const activeMatch = getActiveMatch();
      if (activeMatch && activeMatch.roomConfig.roomCode.toLowerCase() === roomParam.toLowerCase()) {
        handleJoinRoom(activeMatch.roomConfig);
      } else {
        findActiveRoomByCodeAsync(roomParam).then(found => {
          if (found) {
            handleJoinRoom({
              roomCode: found.code,
              roomName: found.name,
              maxPlayers: found.max,
              betAmount: found.bet,
              initialCash: found.initialCash || 1500,
              turnTimeSeconds: found.turnTime,
              boardTheme: found.map.toLowerCase(),
              fillWithBots: !found.isCustom
            });
          } else {
            // If code is not an active room, route to 404 or clean up parameter
            try {
              window.history.replaceState({}, '', window.location.pathname);
            } catch {}
          }
        });
      }
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
    if (isBanned) {
      sounds.playBankrupt();
      alert('⛔ Account Suspended: Your account has been suspended by PropRush administration. You cannot join game tables.');
      return;
    }

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
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-200 selection:bg-[#7059e2] selection:text-white ${
      isLight ? 'bg-[#f1f5f9] text-slate-900' : 'bg-[#0d0a18] text-slate-100'
    }`}>
      {/* Top Navbar (rendered when not in game room to give 100% space to game board) */}
      {currentView !== 'game' && (
        <HeaderNavbar
          currentView={currentView}
          onNavigate={view => {
            navigateTo(view);
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
            navigateTo('profile');
          }}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          roomCode={activeRoomConfig?.roomCode}
        />
      )}

      {/* Account Suspended Persistent Notice */}
      {isBanned && (
        <div className="w-full bg-red-600 text-white px-4 py-2.5 text-xs sm:text-sm font-heading font-black flex items-center justify-between shadow-lg sticky top-0 z-40 border-b border-red-700">
          <div className="flex items-center gap-2 max-w-5xl mx-auto w-full">
            <span className="text-base">⛔</span>
            <span>
              <strong>ACCOUNT SUSPENDED:</strong> This account has been banned by PropRush administration. Multiplayer match joins, table hosting, and financial deposits are disabled.
            </span>
          </div>
        </div>
      )}

      {/* Stripe Deposit Notification Toast */}
      {depositNotification && (
        <div className="fixed top-18 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-2xl bg-emerald-600 text-white font-heading font-bold text-xs sm:text-sm shadow-2xl flex items-center gap-2 animate-bounce border border-emerald-400">
          <span>{depositNotification}</span>
          <button 
            onClick={() => setDepositNotification(null)}
            className="ml-2 w-5 h-5 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main View Container */}
      <main className="flex-1 flex flex-col min-h-0 w-full overflow-x-hidden">
        {currentView === 'home' && (
          <HomeLobbyView
            onJoinRoom={handleJoinRoom}
            onOpenWallet={() => setIsWalletOpen(true)}
            onOpenStore={() => navigateTo('store')}
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

        {currentView === 'rankings' && (
          <RankingsLeaguesView onNavigateHome={() => navigateTo('home')} />
        )}

        {currentView === 'admin' && (
          <AdminCommandCenterView
            onNavigateHome={() => navigateTo('home')}
          />
        )}

        {currentView === '404' && (
          <NotFoundView
            onNavigateHome={() => navigateTo('home')}
            onNavigateStore={() => navigateTo('store')}
            onNavigateProfile={() => navigateTo('profile')}
            onJoinRoomByCode={(code) => {
              const activeMatch = getActiveMatch();
              if (activeMatch && activeMatch.roomConfig.roomCode.toLowerCase() === code.toLowerCase()) {
                handleJoinRoom(activeMatch.roomConfig);
              } else {
                const found = findActiveRoomByCode(code);
                if (found) {
                  handleJoinRoom({
                    roomCode: found.code,
                    roomName: found.name,
                    maxPlayers: found.max,
                    betAmount: found.bet,
                    initialCash: found.initialCash || 1500,
                    turnTimeSeconds: found.turnTime,
                    boardTheme: found.map.toLowerCase(),
                    fillWithBots: true
                  });
                } else {
                  // Connect directly with default parameters
                  handleJoinRoom({
                    roomCode: code,
                    roomName: `Room ${code}`,
                    maxPlayers: 4,
                    betAmount: 0,
                    initialCash: 1500,
                    turnTimeSeconds: 30,
                    boardTheme: 'classic',
                    fillWithBots: true
                  });
                }
              }
            }}
          />
        )}
      </main>

      {/* Footer sleek minimalism (hidden during active game) */}
      {currentView !== 'game' && (
        <footer className={`w-full border-t py-6 px-4 text-center text-xs transition-colors ${
          isLight ? 'bg-white border-slate-200 text-slate-500' : 'bg-[#100c1e] border-[#2b2447] text-slate-400'
        }`}>
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className={`font-heading font-black ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>PROPRUSH</span>
              <span>• Fast-Paced Multiplayer Real Estate</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-medium">
              <button
                onClick={() => setIsRulesOpen(true)}
                className="hover:text-[#7059e2] cursor-pointer transition-colors"
              >
                How to Play
              </button>
              <button
                onClick={() => setIsWalletOpen(true)}
                className="hover:text-[#7059e2] cursor-pointer transition-colors"
              >
                Wagers & Fees
              </button>
              <button
                onClick={() => navigateTo('rankings')}
                className="hover:text-[#7059e2] cursor-pointer transition-colors font-bold text-purple-400"
              >
                🏆 Leaderboard & Leagues
              </button>
              <button
                onClick={() => navigateTo('store')}
                className="hover:text-[#7059e2] cursor-pointer transition-colors"
              >
                Cosmetics Store
              </button>
              <button
                onClick={() => navigateTo('profile')}
                className="hover:text-[#7059e2] cursor-pointer transition-colors"
              >
                Player Locker
              </button>
              <button
                onClick={() => navigateTo('admin')}
                className="hover:text-purple-400 cursor-pointer transition-colors flex items-center gap-1 font-bold"
                title="Admin Command Center"
              >
                <span>🛡️</span>
                <span>Admin Console</span>
              </button>
              <button
                onClick={() => navigateTo('404')}
                className="hover:text-rose-400 cursor-pointer transition-colors opacity-75 hover:opacity-100 flex items-center gap-1"
                title="Preview 404 Jail page"
              >
                <span>🚨</span>
                <span>404 Jail</span>
              </button>
            </div>
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

      {/* Dynamic Web3 Authentication Modal & Sync Listener */}
      <DynamicUserSync />
      <DynamicAuthModal />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <UserProvider>
        <AppContent />
      </UserProvider>
    </ThemeProvider>
  );
}
