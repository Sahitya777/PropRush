import React, { useState, useEffect, useCallback } from 'react';
import {
  Trophy,
  Shield,
  Coins,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Loader2,
  Sparkles,
  Share2,
  Copy,
  Check,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { GameRoom, Player } from '../types/game';
import {
  getBaseScanAddressUrl,
  getBaseScanTxUrl,
  formatUsdc,
} from '../contracts/config';
import {
  getWalletClient,
  getWagerPoolState,
  disputeWagerResult,
  finalizeWagerResult,
  claimWagerPayout,
  WagerPoolState,
} from '../contracts/client';
import { useTheme } from '../context/ThemeContext';

interface WagerSettlementModalProps {
  room: GameRoom;
  winner: Player;
  currentUserWallet?: string;
  onClose?: () => void;
}

export const WagerSettlementModal: React.FC<WagerSettlementModalProps> = ({
  room,
  winner,
  currentUserWallet,
  onClose,
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const poolAddress = room.wagerContractAddress;
  const [poolState, setPoolState] = useState<WagerPoolState | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string; txHash?: string } | null>(null);
  const [disputeSecondsLeft, setDisputeSecondsLeft] = useState<number>(0);
  const [copiedTx, setCopiedTx] = useState<boolean>(false);

  const cleanUserWallet = (currentUserWallet || '').toLowerCase();
  const cleanWinnerWallet = (winner.walletAddress || '').toLowerCase();
  const isWinner = Boolean(cleanUserWallet && cleanWinnerWallet && cleanUserWallet === cleanWinnerWallet);

  // Poll on-chain pool status
  const loadPoolState = useCallback(async () => {
    if (!poolAddress || !poolAddress.startsWith('0x')) return;
    try {
      const state = await getWagerPoolState(poolAddress as `0x${string}`);
      setPoolState(state);

      if (state.status === 'Proposed' && state.proposalTime > 0n && state.disputeWindow > 0n) {
        const nowSec = Math.floor(Date.now() / 1000);
        const deadline = Number(state.proposalTime + state.disputeWindow);
        const remaining = Math.max(0, deadline - nowSec);
        setDisputeSecondsLeft(remaining);
      }
    } catch (err) {
      console.warn('Failed to load pool settlement state:', err);
    }
  }, [poolAddress]);

  useEffect(() => {
    loadPoolState();
    const interval = setInterval(loadPoolState, 5000);
    return () => clearInterval(interval);
  }, [loadPoolState]);

  // Countdown timer effect
  useEffect(() => {
    if (disputeSecondsLeft <= 0) return;
    const timer = setInterval(() => {
      setDisputeSecondsLeft(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [disputeSecondsLeft]);

  // Auto trigger keeper proposeResult via backend if not yet proposed
  useEffect(() => {
    const triggerBackendPropose = async () => {
      if (!poolAddress || !winner.walletAddress) return;
      if (poolState && poolState.status !== 'Locked') return;

      try {
        const res = await fetch('/api/wager/propose-result', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomCode: room.code || room.id,
            poolAddress,
            winnerAddress: winner.walletAddress,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setStatusMessage({
            type: 'success',
            text: 'Match winner proposed on Base Sepolia by game server Keeper!',
            txHash: data.txHash,
          });
          loadPoolState();
        }
      } catch {
        // ignore background error
      }
    };

    triggerBackendPropose();
  }, [poolAddress, winner.walletAddress, poolState, room.code, room.id, loadPoolState]);

  // Action: Manual Propose Result (Keeper fallback)
  const handleProposeResult = async () => {
    if (!poolAddress || !winner.walletAddress) return;
    setLoadingAction('propose');
    setStatusMessage({ type: 'info', text: 'Submitting winner proposal transaction to WagerPool...' });
    try {
      const { walletClient } = await getWalletClient();
      const account = walletClient.account;
      if (!account) throw new Error('Account required');

      // Call proposeResult directly
      const hash = await walletClient.writeContract({
        address: poolAddress as `0x${string}`,
        abi: [
          {
            type: 'function',
            name: 'proposeResult',
            inputs: [{ name: '_winner', type: 'address' }],
            outputs: [],
            stateMutability: 'nonpayable',
          },
        ],
        functionName: 'proposeResult',
        args: [winner.walletAddress as `0x${string}`],
        account,
        chain: walletClient.chain,
      });

      setStatusMessage({
        type: 'success',
        text: 'Result proposed! 10-minute dispute window is now active.',
        txHash: hash,
      });
      loadPoolState();
    } catch (err: any) {
      console.error('Propose result failed:', err);
      setStatusMessage({ type: 'error', text: err?.message || 'Propose result failed.' });
    } finally {
      setLoadingAction(null);
    }
  };

  // Action: Dispute Result
  const handleDispute = async () => {
    if (!poolAddress) return;
    setLoadingAction('dispute');
    setStatusMessage({ type: 'info', text: 'Submitting dispute transaction on Base Sepolia...' });
    try {
      const { walletClient } = await getWalletClient();
      const txHash = await disputeWagerResult(walletClient, poolAddress as `0x${string}`);
      setStatusMessage({
        type: 'success',
        text: 'Result disputed! Flagged for platform resolver review.',
        txHash,
      });
      loadPoolState();
    } catch (err: any) {
      console.error('Dispute failed:', err);
      setStatusMessage({ type: 'error', text: err?.message || 'Dispute transaction failed.' });
    } finally {
      setLoadingAction(null);
    }
  };

  // Action: Finalize Result
  const handleFinalize = async () => {
    if (!poolAddress) return;
    setLoadingAction('finalize');
    setStatusMessage({ type: 'info', text: 'Finalizing match result on Base Sepolia...' });
    try {
      const { walletClient } = await getWalletClient();
      const txHash = await finalizeWagerResult(walletClient, poolAddress as `0x${string}`);
      setStatusMessage({
        type: 'success',
        text: 'Result finalized! Winner can now pull payout.',
        txHash,
      });
      loadPoolState();
    } catch (err: any) {
      console.error('Finalize failed:', err);
      setStatusMessage({ type: 'error', text: err?.message || 'Finalize transaction failed.' });
    } finally {
      setLoadingAction(null);
    }
  };

  // Action: Winner Claim Payout
  const handleClaim = async () => {
    if (!poolAddress) return;
    setLoadingAction('claim');
    setStatusMessage({ type: 'info', text: 'Claiming 95% prize pool payout from WagerPool...' });
    try {
      const { walletClient } = await getWalletClient();
      const txHash = await claimWagerPayout(walletClient, poolAddress as `0x${string}`);

      // Fire celebratory confetti!
      try {
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#7059e2', '#10b981', '#f59e0b', '#3b82f6'],
        });
      } catch {}

      setStatusMessage({
        type: 'success',
        text: 'USDC Payout successfully transferred to your wallet on Base Sepolia!',
        txHash,
      });
      loadPoolState();
    } catch (err: any) {
      console.error('Claim failed:', err);
      setStatusMessage({ type: 'error', text: err?.message || 'Claim payout transaction failed.' });
    } finally {
      setLoadingAction(null);
    }
  };

  if (!poolAddress) return null;

  const totalPot = poolState ? formatUsdc(poolState.poolValue) : ((room.betAmount || 5) * room.players.length).toFixed(2);
  const winnerPayout = poolState ? formatUsdc(poolState.payoutAmount) : ((room.betAmount || 5) * room.players.length * 0.95).toFixed(2);
  const platformFee = poolState ? formatUsdc(poolState.feeAmount) : ((room.betAmount || 5) * room.players.length * 0.05).toFixed(2);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      id="wager-settlement-modal"
      className={`rounded-2xl border p-4 sm:p-6 my-4 shadow-xl transition-all relative overflow-hidden ${
        isLight
          ? 'bg-gradient-to-br from-emerald-50/90 via-white to-indigo-50/70 border-emerald-300'
          : 'bg-gradient-to-br from-[#121c27] via-[#101428] to-[#0d0a1d] border-emerald-500/40'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-emerald-500/20">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shadow-sm">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className={`font-heading font-black text-base sm:text-lg ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Base Sepolia On-Chain Settlement
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                STATUS: {poolState?.status?.toUpperCase() || 'LOCKED'}
              </span>
            </div>
            <p className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
              Non-custodial escrow contract settlement on Base Sepolia
            </p>
          </div>
        </div>

        <a
          href={getBaseScanAddressUrl(poolAddress)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-mono text-emerald-400 hover:text-emerald-300 underline flex items-center gap-1 font-bold"
        >
          <span>{poolAddress.slice(0, 6)}...{poolAddress.slice(-4)}</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Prize Breakdown Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4">
        <div className={`p-3 rounded-xl border ${isLight ? 'bg-white/80 border-slate-200' : 'bg-slate-900/60 border-slate-800'}`}>
          <div className="text-[10px] text-slate-400 uppercase font-mono">Winner 95% Payout</div>
          <div className="font-heading font-black text-xl text-emerald-400 flex items-center gap-1.5 mt-0.5">
            <Coins className="w-5 h-5" />
            ${winnerPayout} USDC
          </div>
          <div className="text-[11px] font-mono text-slate-400 truncate mt-1">
            Recipient: {winner.walletAddress ? `${winner.walletAddress.slice(0, 6)}...${winner.walletAddress.slice(-4)}` : winner.name}
          </div>
        </div>

        <div className={`p-3 rounded-xl border ${isLight ? 'bg-white/80 border-slate-200' : 'bg-slate-900/60 border-slate-800'}`}>
          <div className="text-[10px] text-slate-400 uppercase font-mono">Total Escrow Pot</div>
          <div className="font-heading font-black text-lg text-indigo-400 mt-0.5">
            ${totalPot} USDC
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Platform Treasury Fee (5%): ${platformFee}
          </div>
        </div>

        <div className={`p-3 rounded-xl border ${isLight ? 'bg-white/80 border-slate-200' : 'bg-slate-900/60 border-slate-800'}`}>
          <div className="text-[10px] text-slate-400 uppercase font-mono">Dispute Window</div>
          <div className="font-mono font-bold text-lg text-amber-400 flex items-center gap-1.5 mt-0.5">
            <Clock className="w-4 h-4" />
            {disputeSecondsLeft > 0 ? formatTime(disputeSecondsLeft) : poolState?.status === 'Settled' ? 'Passed (Settled)' : '10:00 Window'}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            {disputeSecondsLeft > 0 ? 'Window active — players can dispute' : 'Ready for finalization & payout'}
          </div>
        </div>
      </div>

      {/* Status Feedback */}
      {statusMessage && (
        <div
          className={`p-3 rounded-xl mb-4 text-xs flex items-start gap-2 border animate-fade-in ${
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
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
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
        </div>
      )}

      {/* Interactive Settlement Actions */}
      <div className="flex flex-wrap items-center gap-2.5 pt-2">
        {/* State 1: Locked, needs proposal */}
        {poolState?.status === 'Locked' && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-amber-400 flex items-center gap-1 font-mono">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Keeper server proposing winner {winner.name} ({winner.walletAddress ? `${winner.walletAddress.slice(0, 6)}...${winner.walletAddress.slice(-4)}` : 'No wallet'})...
            </span>
            <button
              onClick={handleProposeResult}
              disabled={loadingAction === 'propose'}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer transition-all"
              title="Manual fallback to propose result if server keeper is offline"
            >
              {loadingAction === 'propose' ? 'Proposing...' : 'Manual Propose Result'}
            </button>
          </div>
        )}

        {/* State 2: Proposed, dispute window active */}
        {poolState?.status === 'Proposed' && (
          <div className="flex items-center gap-2 flex-wrap w-full justify-between">
            <div className="text-xs flex items-center gap-1.5 text-amber-300">
              <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
              <span>
                Dispute window active: <strong>{formatTime(disputeSecondsLeft)}</strong> remaining before payout unlocks.
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleDispute}
                disabled={loadingAction === 'dispute'}
                className="px-3 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 font-bold text-xs border border-rose-700/50 cursor-pointer transition-all flex items-center gap-1"
                title="Challenge this result for neutral resolver review"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Dispute Result</span>
              </button>

              {disputeSecondsLeft <= 0 && (
                <button
                  onClick={handleFinalize}
                  disabled={loadingAction === 'finalize'}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-heading font-black text-xs cursor-pointer transition-all flex items-center gap-1"
                >
                  {loadingAction === 'finalize' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>Finalize Result</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* State 3: Settled - Winner can Claim! */}
        {poolState?.status === 'Settled' && !poolState.claimed && (
          <div className="w-full flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-xs text-emerald-300">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>
                Result finalized! Winner <strong>{winner.name}</strong> can claim <strong>${winnerPayout} USDC</strong>.
              </span>
            </div>

            {isWinner ? (
              <button
                id="btn-claim-wager-payout"
                onClick={handleClaim}
                disabled={loadingAction === 'claim'}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-white font-heading font-black text-sm shadow-[0_0_25px_rgba(16,185,129,0.5)] cursor-pointer transition-all active:scale-95 flex items-center gap-2 animate-pulse"
              >
                {loadingAction === 'claim' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>CLAIM ${winnerPayout} USDC WINNINGS</span>
              </button>
            ) : (
              <span className="text-xs text-slate-400 italic">
                Awaiting winner claim from wallet {winner.walletAddress ? `${winner.walletAddress.slice(0, 6)}...${winner.walletAddress.slice(-4)}` : 'address'}.
              </span>
            )}
          </div>
        )}

        {/* State 4: Already Claimed */}
        {poolState?.claimed && (
          <div className="w-full p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>
                <strong>Claimed!</strong> ${winnerPayout} USDC has been transferred to {winner.name}&apos;s wallet on Base Sepolia.
              </span>
            </div>
            <a
              href={getBaseScanAddressUrl(poolAddress)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs underline font-mono flex items-center gap-1 hover:opacity-80"
            >
              Verify on BaseScan <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
};
