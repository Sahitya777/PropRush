import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import { useSafeDynamic } from '../context/DynamicIntegration';
import { sounds } from '../utils/audio';
import { fireConfetti } from '../utils/confetti';
import {
  MOCK_USDC_ADDRESS,
  getBaseScanAddressUrl,
  getBaseScanTxUrl,
} from '../contracts/config';
import {
  getWalletClient,
  getMockUsdcBalance,
  mintTestUsdc,
  getInjectedProvider,
} from '../contracts/client';
import {
  Coins,
  Droplets,
  ExternalLink,
  Sparkles,
  ArrowRightLeft,
  Wallet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Copy,
  Check,
  PlusCircle,
  Send,
  HelpCircle,
} from 'lucide-react';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenFaucet?: () => void;
}

export const WalletModal: React.FC<WalletModalProps> = ({
  isOpen,
  onClose,
  onOpenFaucet,
}) => {
  const {
    user,
    depositFunds,
    withdrawFunds,
    exchangeUsdcForCoins,
    refreshOnChainUsdcBalance,
    isLoggedIn,
    openAuthModal,
  } = useUser();
  const { isLight } = useTheme();
  const { primaryWallet } = useSafeDynamic();

  const [tab, setTab] = useState<'exchange' | 'faucet' | 'deposit' | 'withdraw' | 'wager_info'>('exchange');

  // Exchange state
  const [selectedExchangePack, setSelectedExchangePack] = useState<number>(10);
  const [customUsdcAmount, setCustomUsdcAmount] = useState<number>(10);
  const [isExchanging, setIsExchanging] = useState(false);

  // Faucet state (embedded directly so user has full control)
  const [isMintingFaucet, setIsMintingFaucet] = useState(false);
  const [faucetStatus, setFaucetStatus] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
    txHash?: string;
  } | null>(null);

  // General alert messages
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isRefreshingBalance, setIsRefreshingBalance] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);

  // Withdraw state
  const [withdrawAmount, setWithdrawAmount] = useState<number>(10);
  const [withdrawAddress, setWithdrawAddress] = useState<string>('');

  // Active address
  const activeAddress = (
    primaryWallet?.address ||
    (user?.walletAddress && user.walletAddress.startsWith('0x') ? user.walletAddress : '') ||
    (typeof window !== 'undefined' && (window as any).ethereum?.selectedAddress ? (window as any).ethereum.selectedAddress : '')
  ) as string;

  // Refresh balance on open
  useEffect(() => {
    if (isOpen && activeAddress) {
      refreshOnChainUsdcBalance(activeAddress);
    }
  }, [isOpen, activeAddress, refreshOnChainUsdcBalance]);

  if (!isOpen) return null;

  const currentUsdcBalance = Number(user.walletBalance) || 0;

  // Exchange Rate Helper
  const getCoinsForUsdc = (usdc: number): number => {
    if (usdc <= 0) return 0;
    if (usdc >= 50) return Math.floor(usdc * 140); // 40% bonus
    if (usdc >= 20) return Math.floor(usdc * 125); // 25% bonus
    if (usdc >= 10) return Math.floor(usdc * 120); // 20% bonus
    return Math.floor(usdc * 100);
  };

  const exchangePacks = [
    { usdc: 5, coins: 500, label: 'Starter Pack', bonus: '' },
    { usdc: 10, coins: 1200, label: 'Popular', bonus: '+20% Bonus' },
    { usdc: 20, coins: 2500, label: 'Tycoon Pack', bonus: '+25% Bonus' },
    { usdc: 50, coins: 7000, label: 'Best Value', bonus: '+40% Bonus', highlight: true },
  ];

  // Action: Convert USDC to PropRush Coins
  const handleExchange = () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const neededUsdc = customUsdcAmount;
    if (neededUsdc <= 0) {
      setErrorMsg('Please select or enter a valid USDC amount to exchange.');
      return;
    }

    if (currentUsdcBalance < neededUsdc) {
      sounds.playPayRent();
      setErrorMsg(
        `Insufficient USDC balance ($${currentUsdcBalance.toFixed(2)} available). You need $${neededUsdc.toFixed(2)} USDC. Claim free USDC from the Faucet below!`
      );
      return;
    }

    const coinsToReceive = getCoinsForUsdc(neededUsdc);
    setIsExchanging(true);

    try {
      const ok = exchangeUsdcForCoins(neededUsdc, coinsToReceive);
      if (ok) {
        sounds.playVictory();
        try {
          fireConfetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
        } catch {}
        setSuccessMsg(
          `🎉 Successfully exchanged ${neededUsdc} USDC for +${coinsToReceive.toLocaleString()} PropRush Coins!`
        );
        setTimeout(() => setSuccessMsg(null), 5000);
      } else {
        setErrorMsg('Exchange failed. Please check your available balance.');
      }
    } catch (err: any) {
      console.error('Exchange error:', err);
      setErrorMsg(err.message || 'Failed to exchange USDC for coins.');
    } finally {
      setIsExchanging(false);
    }
  };

  // Action: Quick Faucet Claim (Fixed 50 mUSDC to connected wallet)
  const handleQuickFaucetMint = async () => {
    setFaucetStatus(null);
    setErrorMsg(null);

    if (!activeAddress) {
      setFaucetStatus({
        type: 'error',
        text: 'Please connect your Web3 wallet (MetaMask) first to claim 50 Mock USDC.',
      });
      sounds.playError();
      return;
    }

    setIsMintingFaucet(true);
    setFaucetStatus({
      type: 'info',
      text: 'Please confirm the 50 mUSDC mint transaction in your wallet popup window...',
    });

    try {
      const { walletClient, address } = await getWalletClient(primaryWallet);
      const targetAddress = (activeAddress || address) as `0x${string}`;

      const txHash = await mintTestUsdc(walletClient, targetAddress, 50);

      sounds.playCash();
      depositFunds(50, 'mock_usdc_faucet');

      setFaucetStatus({
        type: 'success',
        text: `Successfully claimed 50 Mock USDC to ${targetAddress.slice(0, 6)}...${targetAddress.slice(-4)}!`,
        txHash,
      });

      // Refresh on-chain balance
      await refreshOnChainUsdcBalance(targetAddress);
      window.dispatchEvent(
        new CustomEvent('proprush_usdc_updated', {
          detail: { address: targetAddress, amount: 50, txHash },
        })
      );
    } catch (err: any) {
      console.error('Faucet mint error:', err);
      sounds.playError();
      const errMsg = (err?.message || '').toLowerCase();
      if (errMsg.includes('user rejected') || errMsg.includes('denied') || err?.code === 4001) {
        setFaucetStatus({
          type: 'error',
          text: 'Transaction was cancelled in your wallet.',
        });
      } else if (errMsg.includes('disabled') || errMsg.includes('unauthorized') || err?.code === 4100) {
        setFaucetStatus({
          type: 'error',
          text: 'MetaMask dApp interaction is disabled. Reconnect MetaMask to approve.',
        });
      } else if (errMsg.includes('gas') || errMsg.includes('insufficient funds')) {
        setFaucetStatus({
          type: 'error',
          text: 'Insufficient Base Sepolia ETH for transaction gas.',
        });
      } else {
        setFaucetStatus({
          type: 'error',
          text: err?.message || 'Failed to claim Mock USDC from faucet.',
        });
      }
    } finally {
      setIsMintingFaucet(false);
    }
  };

  // Add mUSDC token to MetaMask
  const handleAddTokenToMetaMask = async () => {
    try {
      const ethereum = getInjectedProvider();
      if (!ethereum?.request) {
        throw new Error('MetaMask or Web3 wallet extension not detected.');
      }
      sounds.playClick();
      await ethereum.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: MOCK_USDC_ADDRESS,
            symbol: 'mUSDC',
            decimals: 6,
          },
        },
      });
      setSuccessMsg('mUSDC token added to your MetaMask wallet token list!');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.warn('Watch asset error:', err);
    }
  };

  // Refresh On-Chain Balance
  const handleManualRefresh = async () => {
    setIsRefreshingBalance(true);
    sounds.playClick();
    await refreshOnChainUsdcBalance(activeAddress);
    setTimeout(() => setIsRefreshingBalance(false), 600);
  };

  // Action: Withdraw
  const handleWithdraw = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (withdrawAmount <= 0 || withdrawAmount > currentUsdcBalance) {
      setErrorMsg('Invalid withdrawal amount. Exceeds available USDC balance.');
      return;
    }
    const ok = withdrawFunds(withdrawAmount);
    if (ok) {
      sounds.playCash();
      setSuccessMsg(
        `Withdrawal of $${withdrawAmount.toFixed(2)} USDC initiated to ${withdrawAddress || activeAddress || 'connected wallet'}!`
      );
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  };

  return (
    <div
      id="modal-unified-wallet"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isMintingFaucet && !isExchanging) {
          onClose();
        }
      }}
    >
      <div
        className={`w-full max-w-lg border-2 rounded-3xl shadow-2xl p-4 sm:p-6 flex flex-col gap-4 max-h-[92vh] overflow-y-auto ${
          isLight
            ? 'bg-white border-blue-500 text-slate-800'
            : 'bg-[#151128] border-blue-500/40 text-white shadow-blue-950/50'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between border-b pb-3 ${
            isLight ? 'border-slate-200' : 'border-slate-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`w-10 h-10 rounded-2xl border flex items-center justify-center text-xl shadow-inner ${
                isLight
                  ? 'bg-blue-100 border-blue-300 text-blue-800'
                  : 'bg-blue-500/20 border-blue-500/40 text-blue-400'
              }`}
            >
              💎
            </div>
            <div>
              <h2
                className={`font-heading font-black text-base sm:text-lg flex items-center gap-2 ${
                  isLight ? 'text-slate-900' : 'text-white'
                }`}
              >
                <span>USDC & COINS WALLET</span>
              </h2>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="inline-flex items-center gap-1 font-mono-code font-bold text-blue-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                  Base Sepolia (84532)
                </span>
                <span className="text-slate-500">•</span>
                <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>
                  Mock USDC (mUSDC)
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-colors ${
              isLight
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
          >
            ✕
          </button>
        </div>

        {/* Balance Display Dual Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Web3 USDC Balance */}
          <div
            className={`p-3.5 rounded-2xl border flex flex-col justify-between transition-all ${
              isLight
                ? 'bg-gradient-to-br from-blue-50 via-indigo-50/50 to-white border-blue-200 text-slate-900'
                : 'bg-gradient-to-br from-blue-950/40 via-slate-900 to-indigo-950/30 border-blue-500/30 text-white'
            }`}
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider text-[11px] flex items-center gap-1">
                <span>💎</span> USDC Balance
              </span>
              <button
                type="button"
                onClick={handleManualRefresh}
                disabled={isRefreshingBalance}
                className="p-1 rounded-lg hover:bg-blue-500/20 text-blue-500 cursor-pointer transition-transform active:scale-90"
                title="Refresh on-chain balance"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${
                    isRefreshingBalance ? 'animate-spin' : ''
                  }`}
                />
              </button>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="font-mono-code font-black text-2xl text-blue-600 dark:text-blue-300">
                ${currentUsdcBalance.toFixed(2)}
              </span>
              <span className="text-xs font-bold text-blue-500">USDC</span>
            </div>
            <div className="mt-2 pt-2 border-t border-blue-500/10 flex items-center justify-between text-[11px]">
              {activeAddress ? (
                <div className="flex items-center gap-1 font-mono-code text-slate-400">
                  <span>
                    {activeAddress.slice(0, 6)}...{activeAddress.slice(-4)}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(activeAddress);
                      setCopiedAddress(true);
                      setTimeout(() => setCopiedAddress(false), 2000);
                    }}
                    className="p-0.5 hover:text-white cursor-pointer"
                    title="Copy wallet address"
                  >
                    {copiedAddress ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              ) : (
                <span className="text-amber-500">Wallet not connected</span>
              )}
              <button
                type="button"
                onClick={() => setTab('faucet')}
                className="text-blue-500 dark:text-blue-400 font-bold hover:underline cursor-pointer flex items-center gap-0.5 text-[11px]"
              >
                <span>💧 +50 Faucet</span>
              </button>
            </div>
          </div>

          {/* PropRush Game Coins */}
          <div
            className={`p-3.5 rounded-2xl border flex flex-col justify-between transition-all ${
              isLight
                ? 'bg-gradient-to-br from-amber-50 via-yellow-50/50 to-white border-amber-200 text-slate-900'
                : 'bg-gradient-to-br from-amber-950/30 via-slate-900 to-yellow-950/20 border-amber-500/30 text-white'
            }`}
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider text-[11px] flex items-center gap-1">
                <span>🪙</span> PropRush Coins
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30">
                In-Game Currency
              </span>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="font-mono-code font-black text-2xl text-amber-600 dark:text-amber-300">
                {user.coins.toLocaleString()}
              </span>
              <span className="text-xs font-bold text-amber-500">Coins</span>
            </div>
            <div className="mt-2 pt-2 border-t border-amber-500/10 flex items-center justify-between text-[11px]">
              <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>
                Used for skins & maps
              </span>
              <button
                type="button"
                onClick={() => setTab('exchange')}
                className="text-amber-600 dark:text-amber-400 font-bold hover:underline cursor-pointer flex items-center gap-0.5 text-[11px]"
              >
                <span>🪙 Get Coins</span>
              </button>
            </div>
          </div>
        </div>

        {/* Global Notifications */}
        {successMsg && (
          <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-700 dark:text-emerald-300 text-xs font-bold text-center animate-fade-in flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-bold text-center animate-fade-in flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Tabs */}
        <div
          className={`grid grid-cols-4 gap-1 p-1 rounded-xl border text-xs font-bold ${
            isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-900/80 border-slate-800'
          }`}
        >
          <button
            onClick={() => setTab('exchange')}
            className={`py-2 px-1 rounded-lg transition-all cursor-pointer text-center text-xs truncate flex items-center justify-center gap-1 ${
              tab === 'exchange'
                ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md font-black'
                : isLight
                ? 'text-slate-600 hover:text-slate-900'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>🪙</span>
            <span>Get Coins</span>
          </button>
          <button
            onClick={() => setTab('faucet')}
            className={`py-2 px-1 rounded-lg transition-all cursor-pointer text-center text-xs truncate flex items-center justify-center gap-1 ${
              tab === 'faucet'
                ? 'bg-blue-600 text-white shadow-md font-black'
                : isLight
                ? 'text-slate-600 hover:text-slate-900'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>💧</span>
            <span>USDC Faucet</span>
          </button>
          <button
            onClick={() => setTab('deposit')}
            className={`py-2 px-1 rounded-lg transition-all cursor-pointer text-center text-xs truncate flex items-center justify-center gap-1 ${
              tab === 'deposit'
                ? 'bg-indigo-600 text-white shadow-md font-black'
                : isLight
                ? 'text-slate-600 hover:text-slate-900'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>+</span>
            <span>Deposit</span>
          </button>
          <button
            onClick={() => setTab('withdraw')}
            className={`py-2 px-1 rounded-lg transition-all cursor-pointer text-center text-xs truncate flex items-center justify-center gap-1 ${
              tab === 'withdraw'
                ? 'bg-purple-600 text-white shadow-md font-black'
                : isLight
                ? 'text-slate-600 hover:text-slate-900'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>↗</span>
            <span>Withdraw</span>
          </button>
        </div>

        {/* TAB 1: CONVERT USDC TO COINS (User's primary requested flow) */}
        {tab === 'exchange' && (
          <div className="space-y-4 animate-fade-in">
            <div
              className={`p-3 rounded-2xl border text-xs flex items-center justify-between ${
                isLight ? 'bg-amber-50/70 border-amber-200' : 'bg-amber-950/20 border-amber-500/30'
              }`}
            >
              <div>
                <div className="font-bold text-amber-500 flex items-center gap-1.5 text-xs">
                  <Coins className="w-4 h-4" />
                  <span>Exchange Rate: 1 USDC = 100 PropRush Coins</span>
                </div>
                <div className={`text-[11px] mt-0.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  Convert your Base Sepolia USDC to buy skins, dice skins, maps & avatar frames!
                </div>
              </div>
            </div>

            {/* Pre-set Exchange Packs */}
            <div>
              <label
                className={`block text-xs font-bold mb-1.5 ${
                  isLight ? 'text-slate-700' : 'text-slate-300'
                }`}
              >
                Select Coin Exchange Pack
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {exchangePacks.map((pack) => {
                  const isSelected = selectedExchangePack === pack.usdc;
                  return (
                    <button
                      key={pack.usdc}
                      type="button"
                      onClick={() => {
                        sounds.playClick();
                        setSelectedExchangePack(pack.usdc);
                        setCustomUsdcAmount(pack.usdc);
                      }}
                      className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer relative overflow-hidden ${
                        isSelected
                          ? 'bg-gradient-to-b from-amber-500/20 to-orange-500/20 border-amber-500 shadow-md ring-1 ring-amber-500'
                          : isLight
                          ? 'bg-slate-50 border-slate-200 hover:border-amber-300 text-slate-700'
                          : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      {pack.bonus && (
                        <span className="absolute top-1 right-1 text-[9px] font-black px-1 rounded bg-amber-500 text-slate-950">
                          {pack.bonus}
                        </span>
                      )}
                      <div>
                        <span className="text-[11px] font-bold block opacity-70">
                          {pack.label}
                        </span>
                        <span className="font-mono-code font-black text-sm text-blue-500 block">
                          ${pack.usdc} USDC
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-1 font-mono-code font-black text-xs text-amber-500">
                        <span>🪙</span>
                        <span>+{pack.coins.toLocaleString()}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom USDC Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  className={`text-xs font-bold ${
                    isLight ? 'text-slate-700' : 'text-slate-300'
                  }`}
                >
                  Or Enter Custom USDC Amount
                </label>
                <span className="text-[11px] font-mono-code text-amber-500 font-bold">
                  Yields: +{getCoinsForUsdc(customUsdcAmount).toLocaleString()} Coins
                </span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={customUsdcAmount || ''}
                  onChange={(e) => {
                    const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                    setCustomUsdcAmount(val);
                    setSelectedExchangePack(val);
                  }}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono-code focus:outline-none focus:border-amber-500 ${
                    isLight
                      ? 'bg-slate-50 border-slate-300 text-slate-900'
                      : 'bg-slate-900 border-slate-700 text-white'
                  }`}
                  placeholder="Enter USDC (e.g. 5, 25, 50...)"
                />
                <span className="absolute right-3.5 top-2.5 text-xs font-bold text-blue-400">
                  USDC
                </span>
              </div>
            </div>

            {/* Action Button: Exchange or Claim Faucet */}
            <div>
              {currentUsdcBalance >= customUsdcAmount && customUsdcAmount > 0 ? (
                <button
                  id="btn-exchange-coins"
                  type="button"
                  disabled={isExchanging}
                  onClick={handleExchange}
                  className="w-full py-3.5 rounded-2xl font-black text-sm text-white flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-95 transition-all bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 hover:from-amber-500 hover:to-orange-500 shadow-amber-500/25 disabled:opacity-50"
                >
                  {isExchanging ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Exchanging USDC for Coins...</span>
                    </>
                  ) : (
                    <>
                      <Coins className="w-4 h-4" />
                      <span>
                        Exchange {customUsdcAmount} USDC for +{getCoinsForUsdc(customUsdcAmount).toLocaleString()} Coins
                      </span>
                    </>
                  )}
                </button>
              ) : (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      setTab('faucet');
                    }}
                    className="w-full py-3.5 rounded-2xl font-black text-sm text-white flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-95 transition-all bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 shadow-blue-500/25"
                  >
                    <Droplets className="w-4 h-4 text-cyan-300" />
                    <span>Claim 50 Free USDC from Faucet First</span>
                  </button>
                  <p className="text-center text-[11px] text-slate-400">
                    Your balance is ${currentUsdcBalance.toFixed(2)} USDC. Claim free testnet USDC to convert into coins!
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: BASE SEPOLIA FAUCET (Claim 50 Mock USDC) */}
        {tab === 'faucet' && (
          <div className="space-y-4 animate-fade-in">
            <div
              className={`p-3.5 rounded-2xl border text-xs ${
                isLight ? 'bg-blue-50 border-blue-200' : 'bg-blue-950/30 border-blue-500/30'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-blue-500 text-sm">
                <Droplets className="w-4 h-4" />
                <span>Base Sepolia Mock USDC Faucet</span>
              </div>
              <p className={`mt-1 text-[11px] leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                Mint 50 free Mock USDC (mUSDC) directly to your connected Web3 wallet. Use it to wager in multiplayer lobbies or convert to PropRush Coins.
              </p>
            </div>

            {/* Fixed Allocation Card */}
            <div
              className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-slate-800'
              }`}
            >
              <div>
                <span className="text-xs font-bold block">Claim Allocation</span>
                <span className="text-[11px] text-slate-400">Fixed testnet mint per claim</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-500/20 border border-blue-500/30 font-mono-code font-black text-blue-400">
                <span>50.00 mUSDC</span>
              </div>
            </div>

            {/* Faucet Status Message */}
            {faucetStatus && (
              <div
                className={`p-3.5 rounded-2xl border text-xs animate-fade-in ${
                  faucetStatus.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : faucetStatus.type === 'error'
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                    : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {faucetStatus.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : faucetStatus.type === 'error' ? (
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  ) : (
                    <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <div>{faucetStatus.text}</div>
                    {faucetStatus.txHash && (
                      <a
                        href={getBaseScanTxUrl(faucetStatus.txHash)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-blue-400 hover:underline font-mono-code font-bold text-[11px]"
                      >
                        <span>View on BaseScan</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Claim 50 USDC Button */}
            <button
              id="btn-modal-faucet-mint"
              type="button"
              disabled={isMintingFaucet || !activeAddress}
              onClick={handleQuickFaucetMint}
              className="w-full py-3.5 rounded-2xl font-black text-sm text-white flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-95 transition-all bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 shadow-blue-500/25 disabled:opacity-50"
            >
              {isMintingFaucet ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Confirming in Wallet Popup...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Claim 50 Mock USDC to Wallet</span>
                </>
              )}
            </button>

            {/* Secondary actions: Add to MetaMask & Contract info */}
            <div className="flex flex-col sm:flex-row items-center gap-2 pt-1 text-xs">
              <button
                type="button"
                onClick={handleAddTokenToMetaMask}
                className={`w-full sm:w-auto flex-1 py-2 px-3 rounded-xl border flex items-center justify-center gap-1.5 font-bold cursor-pointer transition-all ${
                  isLight
                    ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                    : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
                }`}
              >
                <span>🦊</span>
                <span>Add mUSDC to MetaMask</span>
              </button>
              <a
                href={getBaseScanAddressUrl(MOCK_USDC_ADDRESS)}
                target="_blank"
                rel="noreferrer"
                className={`w-full sm:w-auto flex-1 py-2 px-3 rounded-xl border flex items-center justify-center gap-1.5 font-bold cursor-pointer transition-all ${
                  isLight
                    ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                    : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
                }`}
              >
                <span>🔍</span>
                <span>Contract on BaseScan</span>
                <ExternalLink className="w-3 h-3 opacity-60" />
              </a>
            </div>
          </div>
        )}

        {/* TAB 3: DEPOSIT (Web3 USDC & Info) */}
        {tab === 'deposit' && (
          <div className="space-y-4 animate-fade-in">
            <div
              className={`p-4 rounded-2xl border text-xs space-y-2 ${
                isLight ? 'bg-indigo-50/70 border-indigo-200 text-slate-800' : 'bg-indigo-950/30 border-indigo-500/30 text-slate-200'
              }`}
            >
              <div className="font-bold flex items-center gap-2 text-sm text-indigo-400">
                <Wallet className="w-4 h-4" />
                <span>Web3 Wallet Deposit (Base Sepolia)</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Your PropRush balance is automatically synced with your connected Base Sepolia wallet. To top up your balance, simply claim from the Faucet or transfer MockUSDC to your connected address.
              </p>
            </div>

            {/* Connected Wallet Info */}
            <div
              className={`p-3.5 rounded-2xl border space-y-2 text-xs ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-slate-800'
              }`}
            >
              <div className="font-bold text-slate-400 uppercase text-[10px] tracking-wider">
                Your Connected Base Sepolia Address
              </div>
              <div className="flex items-center justify-between font-mono-code font-bold text-xs">
                <span className="text-blue-400 truncate">
                  {activeAddress || 'No Web3 wallet connected'}
                </span>
                {activeAddress && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(activeAddress);
                      setCopiedAddress(true);
                      setTimeout(() => setCopiedAddress(false), 2000);
                    }}
                    className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 cursor-pointer transition-all"
                    title="Copy Address"
                  >
                    {copiedAddress ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Quick Faucet Link */}
            <button
              type="button"
              onClick={() => setTab('faucet')}
              className="w-full py-3 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-500 text-white cursor-pointer shadow-md transition-all flex items-center justify-center gap-2"
            >
              <Droplets className="w-4 h-4" />
              <span>Claim Free 50 USDC from Faucet</span>
            </button>
          </div>
        )}

        {/* TAB 4: WITHDRAW */}
        {tab === 'withdraw' && (
          <form onSubmit={handleWithdraw} className="space-y-4 animate-fade-in">
            <div>
              <label
                className={`block text-xs font-bold mb-1.5 ${
                  isLight ? 'text-slate-700' : 'text-slate-300'
                }`}
              >
                Withdraw Amount (Max: ${currentUsdcBalance.toFixed(2)} USDC)
              </label>
              <input
                type="number"
                min="1"
                max={currentUsdcBalance}
                value={withdrawAmount || ''}
                onChange={(e) =>
                  setWithdrawAmount(
                    Math.min(
                      currentUsdcBalance,
                      Math.max(0, parseInt(e.target.value, 10) || 0)
                    )
                  )
                }
                className={`w-full px-3 py-2.5 rounded-xl border text-sm font-mono-code focus:outline-none focus:border-purple-500 ${
                  isLight
                    ? 'bg-slate-50 border-slate-300 text-slate-900'
                    : 'bg-slate-900 border-slate-700 text-white'
                }`}
              />
            </div>

            <div>
              <label
                className={`block text-xs font-bold mb-1.5 ${
                  isLight ? 'text-slate-700' : 'text-slate-300'
                }`}
              >
                Destination Wallet Address (Base Sepolia)
              </label>
              <input
                type="text"
                value={withdrawAddress}
                onChange={(e) => setWithdrawAddress(e.target.value)}
                placeholder={activeAddress || '0x... (Recipient Address)'}
                className={`w-full px-3 py-2.5 rounded-xl border text-xs font-mono-code focus:outline-none focus:border-purple-500 ${
                  isLight
                    ? 'bg-slate-50 border-slate-300 text-slate-900'
                    : 'bg-slate-900 border-slate-700 text-white'
                }`}
              />
            </div>

            <button
              type="submit"
              disabled={withdrawAmount <= 0 || withdrawAmount > currentUsdcBalance}
              className="w-full py-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-heading font-black text-sm cursor-pointer shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>Withdraw ${withdrawAmount.toFixed(2)} USDC</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
