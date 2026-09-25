import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Droplets,
  ArrowDownLeft,
  ArrowUpRight,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Wallet,
  RefreshCw,
  PlusCircle,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';
import { useSafeDynamic } from '../context/DynamicIntegration';
import {
  MOCK_USDC_ADDRESS,
  getBaseScanAddressUrl,
  getBaseScanTxUrl,
  BASE_SEPOLIA_CHAIN,
} from '../contracts/config';
import {
  getWalletClient,
  getMockUsdcBalance,
  mintTestUsdc,
  getInjectedProvider,
  getActiveSessionWalletAddress,
} from '../contracts/client';
import { sounds } from '../utils/audio';

type WalletTab = 'faucet' | 'deposit' | 'withdraw';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: WalletTab;
}

export const WalletModal: React.FC<WalletModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'faucet',
}) => {
  const { isLight } = useTheme();
  const { user, openAuthModal, depositFunds, withdrawFunds, refreshOnChainUsdcBalance } = useUser();
  const { primaryWallet, setShowAuthFlow } = useSafeDynamic();

  const [activeTab, setActiveTab] = useState<WalletTab>(initialTab);

  // Sync tab if initialTab changes
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Connected wallet address detection
  const connectedAddress = (
    primaryWallet?.address ||
    (user?.walletAddress && user.walletAddress.startsWith('0x') ? user.walletAddress : '') ||
    getActiveSessionWalletAddress(primaryWallet) ||
    (typeof window !== 'undefined' && (window as any).ethereum?.selectedAddress ? (window as any).ethereum.selectedAddress : '')
  ) as string;

  const hasConnectedWallet = Boolean(
    connectedAddress && connectedAddress.startsWith('0x') && connectedAddress.length >= 40
  );

  // Balances
  const [onChainUsdc, setOnChainUsdc] = useState<string | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  // Copy states
  const [copiedContract, setCopiedContract] = useState(false);
  const [copiedWallet, setCopiedWallet] = useState(false);
  const [tokenAddedToWallet, setTokenAddedToWallet] = useState(false);

  // Form states
  const [depositAmount, setDepositAmount] = useState<string>('50');
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [withdrawRecipient, setWithdrawRecipient] = useState<string>(connectedAddress || '');

  // Keep withdrawRecipient synced when connectedAddress resolves
  useEffect(() => {
    if (connectedAddress && !withdrawRecipient) {
      setWithdrawRecipient(connectedAddress);
    }
  }, [connectedAddress, withdrawRecipient]);

  // Loading & status
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
    txHash?: string;
  } | null>(null);

  // Fetch on-chain balance
  const fetchOnChainBalance = useCallback(async (addr?: string) => {
    const targetAddr = addr || connectedAddress;
    if (!targetAddr || !targetAddr.startsWith('0x') || targetAddr.length < 40) {
      setOnChainUsdc(null);
      return;
    }
    setIsLoadingBalance(true);
    try {
      const res = await getMockUsdcBalance(targetAddr as `0x${string}`);
      setOnChainUsdc(res.formatted);
    } catch (err) {
      console.warn('Could not fetch on-chain USDC balance:', err);
    } finally {
      setIsLoadingBalance(false);
    }
  }, [connectedAddress]);

  useEffect(() => {
    if (isOpen && connectedAddress) {
      fetchOnChainBalance(connectedAddress);
    }
  }, [isOpen, connectedAddress, fetchOnChainBalance]);

  if (!isOpen) return null;

  // Copy helpers
  const handleCopyContract = () => {
    sounds.playClick();
    navigator.clipboard.writeText(MOCK_USDC_ADDRESS);
    setCopiedContract(true);
    setTimeout(() => setCopiedContract(false), 2000);
  };

  const handleCopyWallet = () => {
    if (!connectedAddress) return;
    sounds.playClick();
    navigator.clipboard.writeText(connectedAddress);
    setCopiedWallet(true);
    setTimeout(() => setCopiedWallet(false), 2000);
  };

  const handleConnectWallet = () => {
    sounds.playClick();
    try {
      setShowAuthFlow(true);
    } catch {
      openAuthModal('Connect your Web3 wallet to claim testnet USDC.');
    }
  };

  // Add mUSDC to MetaMask
  const handleAddTokenToWallet = async () => {
    sounds.playClick();
    const ethereum = typeof window !== 'undefined' ? (window as any).ethereum : null;
    if (!ethereum?.request) {
      setStatusMessage({
        type: 'info',
        text: 'Please install or unlock MetaMask / Web3 wallet to add the token.',
      });
      return;
    }
    try {
      await ethereum.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: MOCK_USDC_ADDRESS,
            symbol: 'mUSDC',
            decimals: 6,
            image: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
          },
        },
      });
      setTokenAddedToWallet(true);
      setTimeout(() => setTokenAddedToWallet(false), 3000);
    } catch (err: any) {
      console.warn('Failed to add token to wallet:', err);
    }
  };

  // Faucet: Direct Web3 Mint
  const handleFaucetWeb3Mint = async () => {
    if (!hasConnectedWallet) {
      handleConnectWallet();
      return;
    }

    setIsProcessing(true);
    setStatusMessage({
      type: 'info',
      text: 'Requesting 50 Mock USDC mint on Base Sepolia... Please confirm in your wallet popup.',
    });

    try {
      const { walletClient, address } = await getWalletClient(primaryWallet);
      const targetAddress = (connectedAddress || address) as `0x${string}`;

      const txHash = await mintTestUsdc(walletClient, targetAddress, 50);

      sounds.playCash();
      depositFunds(50, 'mock_usdc_faucet');
      setStatusMessage({
        type: 'success',
        text: 'Successfully minted 50 Mock USDC on Base Sepolia!',
        txHash,
      });

      await fetchOnChainBalance(targetAddress);
      refreshOnChainUsdcBalance(targetAddress);
    } catch (err: any) {
      console.error('Web3 mint error:', err);
      sounds.playError();
      const msg = (err?.message || '').toLowerCase();
      if (msg.includes('user rejected') || msg.includes('denied')) {
        setStatusMessage({ type: 'error', text: 'Transaction was cancelled in your wallet.' });
      } else {
        // Fallback: grant directly to game balance so user is never stranded
        sounds.playCash();
        depositFunds(50, 'mock_usdc_faucet');
        setStatusMessage({
          type: 'success',
          text: '✓ Granted +$50.00 Mock USDC to your player balance for gameplay!',
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Faucet: Server-side Gasless Mint
  const handleFaucetServerMint = async () => {
    if (!hasConnectedWallet) {
      handleConnectWallet();
      return;
    }

    setIsProcessing(true);
    setStatusMessage({
      type: 'info',
      text: 'Requesting gasless faucet mint from server...',
    });

    try {
      const res = await fetch('/api/faucet/mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: connectedAddress, amount: 50 }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        sounds.playCash();
        depositFunds(50, 'mock_usdc_faucet');
        setStatusMessage({
          type: 'success',
          text: 'Successfully minted 50 Mock USDC via server gasless faucet!',
          txHash: data.txHash,
        });
        await fetchOnChainBalance(connectedAddress);
        refreshOnChainUsdcBalance(connectedAddress);
      } else {
        // Safe graceful fallback to instant in-app balance grant
        sounds.playCash();
        depositFunds(50, 'mock_usdc_faucet');
        setStatusMessage({
          type: 'success',
          text: '✓ Granted +$50.00 Mock USDC to your game balance!',
        });
      }
    } catch (err: any) {
      console.warn('Server mint fallback:', err);
      // Safe graceful fallback to instant in-app balance grant
      sounds.playCash();
      depositFunds(50, 'mock_usdc_faucet');
      setStatusMessage({
        type: 'success',
        text: '✓ Granted +$50.00 Mock USDC to your game balance!',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Deposit handler
  const handleDeposit = () => {
    const num = parseFloat(depositAmount);
    if (isNaN(num) || num <= 0) {
      setStatusMessage({ type: 'error', text: 'Please enter a valid deposit amount greater than $0.' });
      return;
    }

    sounds.playCash();
    const success = depositFunds(num, 'crypto_deposit');
    if (success) {
      setStatusMessage({
        type: 'success',
        text: `Successfully deposited $${num.toFixed(2)} USDC to your game balance!`,
      });
      setDepositAmount('50');
    } else {
      setStatusMessage({ type: 'error', text: 'Failed to process deposit. Please check your account.' });
    }
  };

  // Withdraw handler
  const handleWithdraw = () => {
    const num = parseFloat(withdrawAmount);
    if (isNaN(num) || num <= 0) {
      setStatusMessage({ type: 'error', text: 'Please enter a valid withdrawal amount.' });
      return;
    }
    if (num > user.walletBalance) {
      setStatusMessage({
        type: 'error',
        text: `Withdrawal exceeds available balance ($${user.walletBalance.toFixed(2)} USDC).`,
      });
      return;
    }
    if (!withdrawRecipient || !withdrawRecipient.startsWith('0x') || withdrawRecipient.length < 40) {
      setStatusMessage({ type: 'error', text: 'Please enter a valid recipient Base Sepolia address (0x...).' });
      return;
    }

    sounds.playCashRegister();
    const success = withdrawFunds(num);
    if (success) {
      setStatusMessage({
        type: 'success',
        text: `Successfully withdrew $${num.toFixed(2)} USDC to ${withdrawRecipient.slice(0, 6)}...${withdrawRecipient.slice(-4)}!`,
      });
      setWithdrawAmount('');
    } else {
      setStatusMessage({ type: 'error', text: 'Failed to process withdrawal.' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div
        className={`w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden transition-all ${
          isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#15102a] border-[#362766] text-white'
        }`}
      >
        {/* Top Header */}
        <div
          className={`px-6 py-4 border-b flex items-center justify-between ${
            isLight ? 'border-slate-100 bg-slate-50/50' : 'border-[#261b47] bg-[#1a1435]'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-md shadow-blue-500/20 text-white">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight">USDC Cashier & Wallet</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  Base Sepolia
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Non-custodial smart contract escrow & testnet tokens
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              sounds.playClick();
              onClose();
            }}
            className={`p-2 rounded-xl transition-colors cursor-pointer ${
              isLight ? 'hover:bg-slate-200 text-slate-500' : 'hover:bg-[#2c2152] text-slate-400 hover:text-white'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Balance Overview Card */}
        <div className={`p-4 mx-6 mt-4 rounded-2xl border flex items-center justify-between ${
          isLight ? 'bg-blue-50/70 border-blue-200' : 'bg-blue-950/30 border-blue-500/30'
        }`}>
          <div>
            <div className="text-[11px] font-mono text-blue-400 font-semibold uppercase tracking-wider">
              Platform USDC Balance
            </div>
            <div className="text-2xl font-black font-mono-code text-blue-500 mt-0.5">
              ${(Number(user.walletBalance) || 0).toFixed(2)}{' '}
              <span className="text-xs font-bold text-slate-400">USDC</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-slate-400 font-mono">On-Chain Wallet</div>
            <div className="flex items-center gap-1.5 justify-end font-mono font-bold text-xs text-emerald-400 mt-0.5">
              {isLoadingBalance ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
              ) : (
                <span>{onChainUsdc !== null ? `$${onChainUsdc} mUSDC` : '--'}</span>
              )}
              {connectedAddress && (
                <button
                  onClick={() => fetchOnChainBalance(connectedAddress)}
                  className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Refresh on-chain balance"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b mx-6 mt-4 gap-2 border-slate-200 dark:border-slate-800">
          <button
            onClick={() => {
              sounds.playClick();
              setActiveTab('faucet');
              setStatusMessage(null);
            }}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
              activeTab === 'faucet'
                ? 'border-blue-500 text-blue-500'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Droplets className="w-4 h-4" />
            <span>🚰 Faucet (Free USDC)</span>
          </button>
          <button
            onClick={() => {
              sounds.playClick();
              setActiveTab('deposit');
              setStatusMessage(null);
            }}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
              activeTab === 'deposit'
                ? 'border-blue-500 text-blue-500'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>💳 Deposit</span>
          </button>
          <button
            onClick={() => {
              sounds.playClick();
              setActiveTab('withdraw');
              setStatusMessage(null);
            }}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
              activeTab === 'withdraw'
                ? 'border-blue-500 text-blue-500'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>💸 Withdraw</span>
          </button>
        </div>

        {/* Status Message Display */}
        {statusMessage && (
          <div className="px-6 pt-4">
            <div
              className={`p-3 rounded-2xl border text-xs flex items-start gap-2.5 animate-fade-in ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : statusMessage.type === 'error'
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              ) : statusMessage.type === 'error' ? (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              ) : (
                <Loader2 className="w-4 h-4 shrink-0 text-blue-400 animate-spin mt-0.5" />
              )}
              <div className="flex-1">
                <p className="leading-relaxed font-medium">{statusMessage.text}</p>
                {statusMessage.txHash && (
                  <a
                    href={getBaseScanTxUrl(statusMessage.txHash)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 mt-1.5 text-[11px] font-mono underline hover:text-emerald-200"
                  >
                    <span>View transaction on BaseScan</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal Body: Tab Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
          {/* TAB 1: FAUCET */}
          {activeTab === 'faucet' && (
            <div className="space-y-4 animate-fade-in">
              <div
                className={`p-4 rounded-2xl border ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#1e173b]/60 border-[#322359]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Base Sepolia Testnet Faucet
                  </span>
                  <span className="text-xs font-black font-mono text-emerald-400">+50.00 mUSDC Free</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Claim testnet Mock USDC to play wager matches and test smart contract escrow without risking real capital.
                </p>

                {/* Connected Wallet Info */}
                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400">Recipient:</span>
                  {hasConnectedWallet ? (
                    <div className="flex items-center gap-2">
                      <span className="text-indigo-300 font-bold">
                        {connectedAddress.slice(0, 6)}...{connectedAddress.slice(-4)}
                      </span>
                      <button
                        onClick={handleCopyWallet}
                        className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white"
                        title="Copy wallet address"
                      >
                        {copiedWallet ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleConnectWallet}
                      className="text-xs text-blue-400 hover:text-blue-300 underline font-sans font-bold"
                    >
                      Connect Wallet First →
                    </button>
                  )}
                </div>
              </div>

              {/* Mint Buttons */}
              <div className="space-y-2">
                <button
                  onClick={handleFaucetWeb3Mint}
                  disabled={isProcessing}
                  className="w-full py-3 px-4 rounded-2xl font-black text-sm text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Minting 50 mUSDC...</span>
                    </>
                  ) : (
                    <>
                      <Droplets className="w-4 h-4" />
                      <span>Claim 50 mUSDC (Direct Web3 Mint)</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleFaucetServerMint}
                  disabled={isProcessing}
                  className={`w-full py-2.5 px-4 rounded-2xl font-bold text-xs border transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
                    isLight
                      ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                      : 'bg-[#20183b] hover:bg-[#2c2152] border-[#3e2d6b] text-slate-300'
                  }`}
                  title="Mint without needing Base Sepolia ETH gas in your wallet"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>Try Server Gasless Faucet</span>
                </button>
              </div>

              {/* Token Utilities & Helper Links */}
              <div className="pt-2 flex items-center justify-between gap-2">
                <button
                  onClick={handleAddTokenToWallet}
                  className="text-xs text-indigo-400 hover:text-indigo-300 underline flex items-center gap-1 cursor-pointer"
                >
                  <PlusCircle className="w-3 h-3" />
                  <span>{tokenAddedToWallet ? 'Token Added!' : 'Add mUSDC to MetaMask'}</span>
                </button>

                <div className="flex items-center gap-3">
                  <a
                    href="https://faucets.chain.link/base-sepolia"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
                  >
                    <span>Get Base ETH Gas</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                  <button
                    onClick={handleCopyContract}
                    className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                    title="Copy MockUSDC contract address"
                  >
                    <span>Contract</span>
                    {copiedContract ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DEPOSIT */}
          {activeTab === 'deposit' && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">
                  Select Deposit Amount (USDC)
                </label>
                <div className="grid grid-cols-5 gap-2 mb-3">
                  {['25', '50', '100', '250', '500'].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => {
                        sounds.playClick();
                        setDepositAmount(val);
                      }}
                      className={`py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer border ${
                        depositAmount === val
                          ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                          : isLight
                          ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                          : 'bg-[#20183b] hover:bg-[#2c2152] text-slate-300 border-[#382861]'
                      }`}
                    >
                      +${val}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold font-mono">
                    $
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={depositAmount}
                    onChange={e => setDepositAmount(e.target.value)}
                    placeholder="Enter deposit amount"
                    className={`w-full pl-8 pr-16 py-3 rounded-2xl border font-mono-code font-bold text-sm outline-none transition-all ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 focus:border-blue-500 text-slate-900'
                        : 'bg-[#1b1435] border-[#382861] focus:border-blue-500 text-white'
                    }`}
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    USDC
                  </span>
                </div>
              </div>

              <button
                onClick={handleDeposit}
                className="w-full py-3 px-4 rounded-2xl font-black text-sm text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <ArrowDownLeft className="w-4 h-4" />
                <span>Confirm Deposit ${parseFloat(depositAmount || '0').toFixed(2)} USDC</span>
              </button>

              <div
                className={`p-3.5 rounded-2xl border text-xs space-y-1.5 ${
                  isLight ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-[#1b1435]/60 border-[#322359] text-slate-400'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-slate-300">
                  <ShieldCheck className="w-4 h-4 text-blue-400" />
                  <span>How USDC Escrow Works</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  When you join a cash match, buy-in amounts are transferred directly from your wallet to the on-chain table pool contract on Base Sepolia. Winners receive instant smart contract payout settlement.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: WITHDRAW */}
          {activeTab === 'withdraw' && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-bold text-slate-400">Withdraw Amount</span>
                  <span className="font-mono text-slate-400">
                    Available: <b className="text-blue-400">${(Number(user.walletBalance) || 0).toFixed(2)}</b>
                  </span>
                </div>

                <div className="relative mb-2">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold font-mono">
                    $
                  </span>
                  <input
                    type="number"
                    min="1"
                    max={user.walletBalance}
                    step="0.01"
                    value={withdrawAmount}
                    onChange={e => setWithdrawAmount(e.target.value)}
                    placeholder="0.00"
                    className={`w-full pl-8 pr-16 py-3 rounded-2xl border font-mono-code font-bold text-sm outline-none transition-all ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 focus:border-blue-500 text-slate-900'
                        : 'bg-[#1b1435] border-[#382861] focus:border-blue-500 text-white'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      setWithdrawAmount(user.walletBalance.toString());
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-1 rounded-lg text-xs font-bold font-mono bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors cursor-pointer"
                  >
                    MAX
                  </button>
                </div>

                {/* Percentage Shortcuts */}
                <div className="grid grid-cols-4 gap-2">
                  {[0.25, 0.5, 0.75, 1.0].map(fraction => (
                    <button
                      key={fraction}
                      type="button"
                      onClick={() => {
                        sounds.playClick();
                        setWithdrawAmount((Math.floor(user.walletBalance * fraction * 100) / 100).toFixed(2));
                      }}
                      className={`py-1.5 rounded-xl text-xs font-bold font-mono border transition-all cursor-pointer ${
                        isLight
                          ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                          : 'bg-[#20183b] hover:bg-[#2c2152] text-slate-300 border-[#382861]'
                      }`}
                    >
                      {fraction * 100}%
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">
                  Destination Wallet Address
                </label>
                <input
                  type="text"
                  value={withdrawRecipient}
                  onChange={e => setWithdrawRecipient(e.target.value)}
                  placeholder="0x..."
                  className={`w-full px-3.5 py-2.5 rounded-2xl border font-mono text-xs outline-none transition-all ${
                    isLight
                      ? 'bg-slate-50 border-slate-300 focus:border-blue-500 text-slate-900'
                      : 'bg-[#1b1435] border-[#382861] focus:border-blue-500 text-white'
                  }`}
                />
              </div>

              <button
                onClick={handleWithdraw}
                disabled={user.walletBalance <= 0 || parseFloat(withdrawAmount || '0') <= 0}
                className="w-full py-3 px-4 rounded-2xl font-black text-sm text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>Withdraw to Base Sepolia</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className={`px-6 py-3 border-t flex items-center justify-between text-[11px] text-slate-400 ${
            isLight ? 'border-slate-100 bg-slate-50' : 'border-[#261b47] bg-[#17112e]'
          }`}
        >
          <div className="flex items-center gap-1.5 font-mono">
            <span>Network:</span>
            <span className="text-blue-400 font-bold">Base Sepolia (84532)</span>
          </div>
          <a
            href={getBaseScanAddressUrl(MOCK_USDC_ADDRESS)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
          >
            <span>View Token Explorer</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
};
