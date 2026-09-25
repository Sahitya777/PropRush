import React, { useState, useEffect, useCallback } from 'react';
import {
  ExternalLink,
  Shield,
  Coins,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  ArrowRight,
  LogOut,
  RefreshCw,
  Wallet,
  X,
} from 'lucide-react';
import { GameRoom } from '../types/game';
import {
  FACTORY_ADDRESS,
  MOCK_USDC_ADDRESS,
  getBaseScanAddressUrl,
  getBaseScanTxUrl,
  formatUsdc,
  parseUsdc,
} from '../contracts/config';
import {
  getWalletClient,
  getMockUsdcBalance,
  getMockUsdcAllowance,
  approveMockUsdc,
  createWagerPoolOnChain,
  joinWagerPool,
  leaveWagerPool,
  refundWagerPool,
  startWagerPool,
  getWagerPoolState,
  WagerPoolState,
} from '../contracts/client';
import { useTheme } from '../context/ThemeContext';
import { useSafeDynamic } from '../context/DynamicIntegration';

interface WagerPoolLobbyCardProps {
  room: GameRoom;
  isHost: boolean;
  currentUserWallet?: string;
  onPoolUpdated: (poolAddress: string, poolState?: WagerPoolState) => void;
  onPoolStartedOnChain?: () => void;
  onClose?: () => void;
}

export const WagerPoolLobbyCard: React.FC<WagerPoolLobbyCardProps> = ({
  room,
  isHost,
  currentUserWallet,
  onPoolUpdated,
  onPoolStartedOnChain,
  onClose,
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const { primaryWallet } = useSafeDynamic();

  const [poolAddress, setPoolAddress] = useState<string>(room.wagerContractAddress || '');
  const [poolState, setPoolState] = useState<WagerPoolState | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<string>('0.00');
  const [allowance, setAllowance] = useState<bigint>(0n);
  const [isJoinedOnChain, setIsJoinedOnChain] = useState<boolean>(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string; txHash?: string } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const buyInDollars = room.betAmount || 5;
  const buyInWei = parseUsdc(buyInDollars);

  // Sync poolAddress when room updates
  useEffect(() => {
    if (room.wagerContractAddress && room.wagerContractAddress !== poolAddress) {
      setPoolAddress(room.wagerContractAddress);
    }
  }, [room.wagerContractAddress]);

  // Load pool state & user balances
  const refreshOnChainData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // 1. Balance & allowance check
      if (currentUserWallet && currentUserWallet.startsWith('0x')) {
        const bal = await getMockUsdcBalance(currentUserWallet as `0x${string}`);
        setUsdcBalance(bal.formatted);

        if (poolAddress && poolAddress.startsWith('0x')) {
          const allow = await getMockUsdcAllowance(
            currentUserWallet as `0x${string}`,
            poolAddress as `0x${string}`
          );
          setAllowance(allow);
        }
      }

      // 2. Pool State check
      if (poolAddress && poolAddress.startsWith('0x')) {
        const pState = await getWagerPoolState(poolAddress as `0x${string}`);
        setPoolState(pState);

        if (currentUserWallet) {
          const lowerUser = currentUserWallet.toLowerCase();
          const hasJoined = pState.players.some(p => p.toLowerCase() === lowerUser);
          setIsJoinedOnChain(hasJoined);
        }
      }
    } catch (err) {
      console.warn('Error refreshing on-chain pool data:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [poolAddress, currentUserWallet]);

  useEffect(() => {
    refreshOnChainData();
    const interval = setInterval(refreshOnChainData, 6000);
    return () => clearInterval(interval);
  }, [refreshOnChainData]);

  // Action: Deploy WagerPool on Base Sepolia (Host only)
  const handleDeployPool = async () => {
    setLoadingAction('deploy');
    setStatusMessage({ type: 'info', text: 'Confirm transaction in your wallet to deploy the WagerPool escrow contract...' });
    try {
      const { walletClient } = await getWalletClient(primaryWallet || { address: currentUserWallet });
      const result = await createWagerPoolOnChain(
        walletClient,
        buyInDollars,
        room.maxPlayers || 4,
        500 // 5% platform fee
      );

      setPoolAddress(result.poolAddress);
      setStatusMessage({
        type: 'success',
        text: `WagerPool deployed on Base Sepolia at ${result.poolAddress.slice(0, 8)}...${result.poolAddress.slice(-6)}!`,
        txHash: result.txHash,
      });

      onPoolUpdated(result.poolAddress);
      await refreshOnChainData();
    } catch (err: any) {
      console.error('Failed to deploy pool:', err);
      setStatusMessage({ type: 'error', text: err?.message || 'Deployment cancelled or failed' });
    } finally {
      setLoadingAction(null);
    }
  };

  // Action: Approve USDC spending
  const handleApprove = async () => {
    if (!poolAddress) return;
    setLoadingAction('approve');
    setStatusMessage({ type: 'info', text: `Approving ${buyInDollars} USDC for the WagerPool escrow...` });
    try {
      const { walletClient } = await getWalletClient(primaryWallet);
      const txHash = await approveMockUsdc(walletClient, poolAddress as `0x${string}`, buyInWei);
      setStatusMessage({
        type: 'success',
        text: `Approval confirmed! You can now deposit and join the escrow.`,
        txHash,
      });
      await refreshOnChainData();
    } catch (err: any) {
      console.error('Approve failed:', err);
      setStatusMessage({ type: 'error', text: err?.message || 'Token approval failed.' });
    } finally {
      setLoadingAction(null);
    }
  };

  // Action: Deposit & Join Pool
  const handleJoinPool = async () => {
    if (!poolAddress) return;
    setLoadingAction('join');
    setStatusMessage({ type: 'info', text: `Depositing ${buyInDollars} USDC into on-chain escrow...` });
    try {
      const { walletClient } = await getWalletClient(primaryWallet);
      const txHash = await joinWagerPool(walletClient, poolAddress as `0x${string}`);
      setStatusMessage({
        type: 'success',
        text: `Successfully joined escrow with ${buyInDollars} USDC! Waiting for match start.`,
        txHash,
      });
      setIsJoinedOnChain(true);
      await refreshOnChainData();
    } catch (err: any) {
      console.error('Join pool failed:', err);
      setStatusMessage({ type: 'error', text: err?.message || 'Failed to join pool.' });
    } finally {
      setLoadingAction(null);
    }
  };

  // Action: Leave Pool & Refund (Lobby only)
  const handleLeavePool = async () => {
    if (!poolAddress) return;
    setLoadingAction('leave');
    setStatusMessage({ type: 'info', text: 'Refunding buy-in and leaving on-chain pool...' });
    try {
      const { walletClient } = await getWalletClient(primaryWallet);
      const txHash = await leaveWagerPool(walletClient, poolAddress as `0x${string}`);
      setStatusMessage({
        type: 'success',
        text: `Refund processed! Your ${buyInDollars} USDC has been returned to your wallet.`,
        txHash,
      });
      setIsJoinedOnChain(false);
      await refreshOnChainData();
    } catch (err: any) {
      console.error('Leave pool failed:', err);
      setStatusMessage({ type: 'error', text: err?.message || 'Failed to leave pool.' });
    } finally {
      setLoadingAction(null);
    }
  };

  // Action: Host cancels & refunds all players
  const handleRefundAll = async () => {
    if (!poolAddress) return;
    setLoadingAction('refundAll');
    setStatusMessage({ type: 'info', text: 'Cancelling lobby and refunding all escrowed players...' });
    try {
      const { walletClient } = await getWalletClient(primaryWallet);
      const txHash = await refundWagerPool(walletClient, poolAddress as `0x${string}`);
      setStatusMessage({
        type: 'success',
        text: 'All players have been refunded on-chain.',
        txHash,
      });
      await refreshOnChainData();
    } catch (err: any) {
      console.error('Refund all failed:', err);
      setStatusMessage({ type: 'error', text: err?.message || 'Failed to refund all.' });
    } finally {
      setLoadingAction(null);
    }
  };

  // Action: Host locks escrow & starts match
  const handleStartOnChain = async () => {
    if (!poolAddress) return;
    setLoadingAction('start');
    setStatusMessage({ type: 'info', text: 'Locking escrow funds on Base Sepolia and starting match...' });
    try {
      const { walletClient } = await getWalletClient(primaryWallet);
      const txHash = await startWagerPool(walletClient, poolAddress as `0x${string}`);
      setStatusMessage({
        type: 'success',
        text: 'Escrow locked! Match is now officially committed on-chain.',
        txHash,
      });
      if (onPoolStartedOnChain) {
        onPoolStartedOnChain();
      }
      await refreshOnChainData();
    } catch (err: any) {
      console.error('Start pool failed:', err);
      setStatusMessage({ type: 'error', text: err?.message || 'Failed to lock escrow.' });
    } finally {
      setLoadingAction(null);
    }
  };

  const poolPlayerCount = poolState?.playerCount || 0;
  const totalPotUsdc = (buyInDollars * poolPlayerCount).toFixed(2);
  const winnerPrizeUsdc = (buyInDollars * poolPlayerCount * 0.95).toFixed(2);
  const platformFeeUsdc = (buyInDollars * poolPlayerCount * 0.05).toFixed(2);
  const needsApproval = allowance < buyInWei;
  const isPoolReadyToStart = poolPlayerCount >= 2;

  return (
    <div
      id="wager-pool-escrow-card"
      className={`rounded-2xl border p-4 sm:p-5 transition-all shadow-md relative overflow-hidden ${
        isLight
          ? 'bg-gradient-to-br from-indigo-50/80 via-white to-blue-50/50 border-indigo-200'
          : 'bg-gradient-to-br from-[#1b1536] via-[#16112c] to-[#0f0b20] border-[#433575]'
      }`}
    >
      {/* Top Header Badge */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-indigo-500/20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-blue-400">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className={`font-heading font-black text-sm sm:text-base ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Base Sepolia Escrow Smart Contract
              </h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                CHAIN 84532
              </span>
            </div>
            <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Non-custodial escrow: Buy-ins locked until match conclusion, 95% paid to winner.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={refreshOnChainData}
            disabled={isRefreshing}
            className={`p-1.5 rounded-lg border text-xs cursor-pointer transition-all ${
              isLight
                ? 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
            title="Refresh on-chain state"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className={`p-1.5 rounded-lg border text-xs cursor-pointer transition-all ${
                isLight
                  ? 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
              title="Close modal and view board"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Contract & Status Pill Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-3.5 text-xs">
        <div className={`p-2.5 rounded-xl border ${isLight ? 'bg-white/80 border-slate-200' : 'bg-slate-900/60 border-slate-800'}`}>
          <div className="text-[10px] text-slate-400 uppercase font-mono">Buy-in per Player</div>
          <div className="font-heading font-black text-sm text-emerald-500 flex items-center gap-1 mt-0.5">
            <Coins className="w-3.5 h-3.5" />
            ${buyInDollars} USDC
          </div>
        </div>

        <div className={`p-2.5 rounded-xl border ${isLight ? 'bg-white/80 border-slate-200' : 'bg-slate-900/60 border-slate-800'}`}>
          <div className="text-[10px] text-slate-400 uppercase font-mono">Total Escrow Pot</div>
          <div className="font-heading font-black text-sm text-indigo-400 mt-0.5">
            ${totalPotUsdc} USDC
          </div>
          <div className="text-[9px] text-slate-400">95% Winner (${winnerPrizeUsdc})</div>
        </div>

        <div className={`p-2.5 rounded-xl border ${isLight ? 'bg-white/80 border-slate-200' : 'bg-slate-900/60 border-slate-800'}`}>
          <div className="text-[10px] text-slate-400 uppercase font-mono">Escrow State</div>
          <div className="font-mono font-bold text-xs mt-0.5 flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                poolState?.status === 'Locked'
                  ? 'bg-amber-400 animate-pulse'
                  : poolState?.status === 'Settled'
                  ? 'bg-emerald-400'
                  : poolState
                  ? 'bg-blue-400'
                  : 'bg-slate-500'
              }`}
            />
            {poolState ? poolState.status : poolAddress ? 'Connecting...' : 'Not Deployed'}
          </div>
        </div>

        <div className={`p-2.5 rounded-xl border ${isLight ? 'bg-white/80 border-slate-200' : 'bg-slate-900/60 border-slate-800'}`}>
          <div className="text-[10px] text-slate-400 uppercase font-mono">Your mUSDC Balance</div>
          <div className="font-mono font-bold text-xs text-emerald-400 mt-0.5">
            ${usdcBalance}
          </div>
        </div>
      </div>

      {/* Contract Links Bar */}
      <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-slate-400 mb-3.5">
        {poolAddress ? (
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Pool:</span>
            <a
              href={getBaseScanAddressUrl(poolAddress)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline flex items-center gap-1 font-bold"
            >
              {poolAddress.slice(0, 6)}...{poolAddress.slice(-4)}
              <ExternalLink className="w-3 h-3 inline" />
            </a>
          </div>
        ) : (
          <span className="text-amber-400 font-sans text-xs">
            ⚠️ No on-chain pool created yet for this room.
          </span>
        )}

        <div className="flex items-center gap-1.5">
          <span className="text-slate-500">Token:</span>
          <a
            href={getBaseScanAddressUrl(MOCK_USDC_ADDRESS)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-300 hover:text-white underline flex items-center gap-1"
          >
            MockUSDC ({MOCK_USDC_ADDRESS.slice(0, 6)}...{MOCK_USDC_ADDRESS.slice(-4)})
            <ExternalLink className="w-3 h-3 inline" />
          </a>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-slate-500">Factory:</span>
          <a
            href={getBaseScanAddressUrl(FACTORY_ADDRESS)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-300 hover:text-white underline flex items-center gap-1"
          >
            Factory ({FACTORY_ADDRESS.slice(0, 6)}...{FACTORY_ADDRESS.slice(-4)})
            <ExternalLink className="w-3 h-3 inline" />
          </a>
        </div>
      </div>

      {/* Notification / Status Feedback */}
      {statusMessage && (
        <div
          className={`p-3 rounded-xl mb-3.5 text-xs flex items-start gap-2 border animate-fade-in ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
              : statusMessage.type === 'error'
              ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
              : 'bg-blue-500/15 border-blue-500/40 text-blue-300'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-400" />
          ) : statusMessage.type === 'error' ? (
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
          ) : (
            <Loader2 className="w-4 h-4 flex-shrink-0 mt-0.5 animate-spin text-blue-400" />
          )}
          <div className="flex-1">
            <p>{statusMessage.text}</p>
            {statusMessage.txHash && (
              <a
                href={getBaseScanTxUrl(statusMessage.txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-mono underline font-bold mt-1 text-inherit hover:opacity-80"
              >
                View on BaseScan: {statusMessage.txHash.slice(0, 10)}...{statusMessage.txHash.slice(-8)}
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
          {statusMessage.type !== 'info' && (
            <button
              onClick={() => setStatusMessage(null)}
              className="text-slate-400 hover:text-white p-0.5 rounded cursor-pointer ml-1"
              title="Dismiss notification"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* Players Escrow Status Table */}
      <div className={`p-3 rounded-xl border mb-3.5 ${isLight ? 'bg-white/60 border-slate-200' : 'bg-slate-900/40 border-slate-800'}`}>
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
          <span>Lobby Escrow Funding Status ({poolPlayerCount} of {room.players.length} players joined)</span>
          <span className="text-[10px] font-mono text-emerald-400 font-bold">
            Pot: ${totalPotUsdc} USDC
          </span>
        </div>

        <div className="space-y-1.5">
          {room.players.map(p => {
            const playerWallet = (p.walletAddress || '').toLowerCase();
            const hasJoinedEscrow = poolState?.players?.some(addr => addr.toLowerCase() === playerWallet);

            return (
              <div
                key={p.id}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs border ${
                  hasJoinedEscrow
                    ? isLight
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                      : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
                    : isLight
                    ? 'bg-slate-50 border-slate-200 text-slate-700'
                    : 'bg-slate-800/40 border-slate-700/50 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{p.avatar === 'apple' ? '🍏' : p.avatar === 'fire' ? '🔥' : '🎩'}</span>
                  <div>
                    <span className="font-bold">{p.name}</span>
                    {p.isHost && (
                      <span className="ml-1.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-400">
                        HOST
                      </span>
                    )}
                    <div className="text-[10px] font-mono text-slate-400">
                      {p.walletAddress ? `${p.walletAddress.slice(0, 6)}...${p.walletAddress.slice(-4)}` : 'No wallet linked'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {hasJoinedEscrow ? (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Deposited (${buyInDollars} USDC)
                    </span>
                  ) : (
                    <span className="text-[11px] text-amber-400 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Deposit Pending
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {/* Case 1: Host needs to deploy pool */}
        {!poolAddress && isHost && (
          <button
            id="btn-deploy-wager-pool"
            onClick={handleDeployPool}
            disabled={loadingAction === 'deploy'}
            className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-heading font-black text-xs cursor-pointer shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            {loadingAction === 'deploy' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            <span>DEPLOY WAGERPOOL CONTRACT (BASE SEPOLIA)</span>
          </button>
        )}

        {/* Case 2: Pool exists, current player hasn't joined escrow yet */}
        {poolAddress && !isJoinedOnChain && (
          <>
            {needsApproval ? (
              <button
                id="btn-approve-usdc"
                onClick={handleApprove}
                disabled={loadingAction === 'approve'}
                className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white font-heading font-black text-xs cursor-pointer shadow-md transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                {loadingAction === 'approve' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
                <span>1. APPROVE ${buyInDollars} USDC</span>
              </button>
            ) : (
              <button
                id="btn-join-wager-pool"
                onClick={handleJoinPool}
                disabled={loadingAction === 'join'}
                className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-heading font-black text-xs cursor-pointer shadow-md transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                {loadingAction === 'join' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Coins className="w-4 h-4" />}
                <span>2. DEPOSIT ${buyInDollars} USDC & JOIN ESCROW</span>
              </button>
            )}
          </>
        )}

        {/* Case 3: Current player already deposited and is joined */}
        {poolAddress && isJoinedOnChain && poolState?.status === 'Open' && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="px-3 py-2 rounded-xl bg-emerald-500/20 text-emerald-300 font-bold text-xs flex items-center gap-1.5 border border-emerald-500/30">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>You have deposited ${buyInDollars} USDC</span>
            </div>

            {!isHost && (
              <button
                id="btn-leave-wager-pool"
                onClick={handleLeavePool}
                disabled={loadingAction === 'leave'}
                className="px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold text-xs border border-rose-500/40 cursor-pointer transition-all flex items-center gap-1.5"
                title="Leave table and refund your buy-in back to your wallet"
              >
                {loadingAction === 'leave' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
                <span>Withdraw & Leave Pool</span>
              </button>
            )}
          </div>
        )}

        {/* Case 4: Host controls to lock & start or refund all */}
        {poolAddress && isHost && poolState?.status === 'Open' && (
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <button
              id="btn-lock-and-start-pool"
              onClick={handleStartOnChain}
              disabled={loadingAction === 'start' || !isPoolReadyToStart}
              className={`px-4 py-2.5 rounded-xl font-heading font-black text-xs shadow-md transition-all flex items-center gap-2 ${
                isPoolReadyToStart
                  ? 'bg-gradient-to-r from-[#7059e2] to-[#8e76f7] hover:from-[#5e46d0] hover:to-[#7b61f0] text-white cursor-pointer active:scale-95'
                  : 'bg-slate-700 text-slate-400 cursor-not-allowed'
              }`}
              title={isPoolReadyToStart ? 'Lock on-chain escrow and start match' : 'Need at least 2 players deposited to lock escrow'}
            >
              {loadingAction === 'start' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>LOCK ESCROW & START MATCH ({poolPlayerCount} DEPOSITED)</span>
            </button>

            <button
              id="btn-refund-all-pool"
              onClick={handleRefundAll}
              disabled={loadingAction === 'refundAll'}
              className="px-3 py-2.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 font-bold text-xs border border-rose-700/50 cursor-pointer transition-all"
              title="Cancel lobby and refund everyone's buy-in on-chain"
            >
              {loadingAction === 'refundAll' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Cancel & Refund All'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
