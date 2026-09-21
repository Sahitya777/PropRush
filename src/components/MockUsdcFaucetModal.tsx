import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Droplets,
  Coins,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Copy,
  Check,
  Wallet,
  Sparkles,
  RefreshCw,
  PlusCircle,
  HelpCircle,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import {
  MOCK_USDC_ADDRESS,
  getBaseScanAddressUrl,
  getBaseScanTxUrl,
  formatUsdc,
} from '../contracts/config';
import {
  getWalletClient,
  getMockUsdcBalance,
  mintTestUsdc,
} from '../contracts/client';
import { sounds } from '../utils/audio';

interface MockUsdcFaucetModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialAddress?: string;
}

export const MockUsdcFaucetModal: React.FC<MockUsdcFaucetModalProps> = ({
  isOpen,
  onClose,
  initialAddress,
}) => {
  const { isLight } = useTheme();

  const [recipient, setRecipient] = useState<string>('');
  const [amount, setAmount] = useState<number>(50); // Default 50 tokens as requested
  const [balance, setBalance] = useState<string | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [mintMethod, setMintMethod] = useState<'web3' | 'server' | null>(null);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [tokenAddedToWallet, setTokenAddedToWallet] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
    txHash?: string;
  } | null>(null);

  // Initialize recipient from prop or window.ethereum
  useEffect(() => {
    if (initialAddress) {
      setRecipient(initialAddress);
    } else if (typeof window !== 'undefined' && (window as any).ethereum?.selectedAddress) {
      setRecipient((window as any).ethereum.selectedAddress);
    }
  }, [initialAddress, isOpen]);

  // Load USDC balance when recipient changes or modal opens
  const fetchBalance = useCallback(async (addrToFetch?: string) => {
    const targetAddr = addrToFetch || recipient;
    if (!targetAddr || !targetAddr.startsWith('0x') || targetAddr.length < 40) {
      setBalance(null);
      return;
    }

    setIsLoadingBalance(true);
    try {
      const res = await getMockUsdcBalance(targetAddr as `0x${string}`);
      setBalance(res.formatted);
    } catch (err) {
      console.warn('Could not fetch USDC balance:', err);
    } finally {
      setIsLoadingBalance(false);
    }
  }, [recipient]);

  useEffect(() => {
    if (isOpen && recipient) {
      fetchBalance(recipient);
    }
  }, [isOpen, recipient, fetchBalance]);

  if (!isOpen) return null;

  // Copy Contract Address
  const handleCopyContract = () => {
    sounds.playClick();
    navigator.clipboard.writeText(MOCK_USDC_ADDRESS);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  // Add token to MetaMask / Injected Wallet
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

  // 1. Direct Web3 Mint (from user's connected wallet)
  const handleWeb3Mint = async () => {
    if (!recipient || !recipient.startsWith('0x')) {
      setStatusMessage({ type: 'error', text: 'Please enter a valid recipient wallet address (0x...).' });
      sounds.playError();
      return;
    }

    setIsMinting(true);
    setMintMethod('web3');
    setStatusMessage({
      type: 'info',
      text: `Confirming mint of ${amount} Mock USDC to ${recipient.slice(0, 6)}...${recipient.slice(-4)} on Base Sepolia...`,
    });

    try {
      const { walletClient, address } = await getWalletClient();
      const targetAddress = (recipient || address) as `0x${string}`;
      const txHash = await mintTestUsdc(walletClient, targetAddress, amount);

      sounds.playCash();
      setStatusMessage({
        type: 'success',
        text: `Successfully minted ${amount} Mock USDC to ${targetAddress.slice(0, 6)}...${targetAddress.slice(-4)}!`,
        txHash,
      });

      // Refresh balance
      await fetchBalance(targetAddress);
    } catch (err: any) {
      console.error('Direct Web3 mint error:', err);
      sounds.playError();
      const errMsg = err?.message || 'Transaction failed or rejected.';
      if (errMsg.includes('gas') || errMsg.includes('insufficient funds')) {
        setStatusMessage({
          type: 'error',
          text: 'Insufficient Base Sepolia ETH for gas. You can use the "Gasless Server Faucet" button below or get free Base Sepolia ETH.',
        });
      } else {
        setStatusMessage({ type: 'error', text: errMsg });
      }
    } finally {
      setIsMinting(false);
      setMintMethod(null);
    }
  };

  // 2. Server-assisted Gasless Mint (Server Keeper pays the gas)
  const handleServerMint = async () => {
    if (!recipient || !recipient.startsWith('0x')) {
      setStatusMessage({ type: 'error', text: 'Please enter a valid recipient wallet address (0x...).' });
      sounds.playError();
      return;
    }

    setIsMinting(true);
    setMintMethod('server');
    setStatusMessage({
      type: 'info',
      text: `Submitting gasless mint of ${amount} Mock USDC via server keeper to ${recipient.slice(0, 6)}...${recipient.slice(-4)}...`,
    });

    try {
      const res = await fetch('/api/faucet/mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: recipient, amount }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Server faucet mint request failed.');
      }

      sounds.playCash();
      setStatusMessage({
        type: 'success',
        text: `Successfully received ${amount} Mock USDC! Transferred directly to your address.`,
        txHash: data.txHash,
      });

      // Refresh balance
      await fetchBalance(recipient);
    } catch (err: any) {
      console.error('Server faucet mint error:', err);
      sounds.playError();
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Server faucet is unavailable. Please use the Web3 Wallet Mint button.',
      });
    } finally {
      setIsMinting(false);
      setMintMethod(null);
    }
  };

  return (
    <div
      id="modal-mock-usdc-faucet"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isMinting) {
          sounds.playClick();
          onClose();
        }
      }}
    >
      <div
        className={`w-full max-w-lg rounded-3xl shadow-2xl border flex flex-col overflow-hidden transition-all ${
          isLight
            ? 'bg-white border-slate-200 text-slate-900'
            : 'bg-[#18132b] border-[#342a54] text-white shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)]'
        }`}
      >
        {/* Modal Header */}
        <div
          className={`p-5 sm:p-6 border-b flex items-start justify-between gap-4 ${
            isLight
              ? 'bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-white border-slate-200'
              : 'bg-gradient-to-r from-blue-950/40 via-purple-950/30 to-[#18132b] border-[#2d234d]'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30 shrink-0">
              <Droplets className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-black tracking-tight">
                  Base Sepolia Faucet
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono-code font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  Chain 84532
                </span>
              </div>
              <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                Mint free testnet <strong>Mock USDC ($mUSDC)</strong> to wager in live escrow rooms.
              </p>
            </div>
          </div>

          <button
            id="btn-close-faucet-modal"
            type="button"
            disabled={isMinting}
            onClick={() => {
              sounds.playClick();
              onClose();
            }}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              isLight
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200'
                : 'bg-slate-800/80 hover:bg-slate-750 text-slate-300 border-slate-700/60'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Token Contract Reference Banner */}
          <div
            className={`p-3 sm:p-3.5 rounded-2xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
              isLight
                ? 'bg-slate-50 border-slate-200'
                : 'bg-[#1f1839]/70 border-[#322754]'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-base">🪙</span>
              <div className="min-w-0">
                <div className="font-bold flex items-center gap-1.5">
                  <span>MockUSDC (mUSDC)</span>
                  <span className="text-[10px] opacity-70 font-mono-code">(6 Decimals)</span>
                </div>
                <div className="font-mono-code text-[11px] opacity-75 truncate">
                  {MOCK_USDC_ADDRESS}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
              <button
                type="button"
                onClick={handleCopyContract}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] flex items-center gap-1 border transition-all cursor-pointer ${
                  copiedAddress
                    ? 'bg-emerald-500 text-white border-emerald-600'
                    : isLight
                    ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                }`}
                title="Copy Token Contract Address"
              >
                {copiedAddress ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copiedAddress ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                type="button"
                onClick={handleAddTokenToWallet}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] flex items-center gap-1 border transition-all cursor-pointer ${
                  tokenAddedToWallet
                    ? 'bg-emerald-500 text-white border-emerald-600'
                    : isLight
                    ? 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200'
                    : 'bg-blue-950/40 hover:bg-blue-900/50 text-blue-300 border-blue-500/30'
                }`}
                title="Add mUSDC Token to your MetaMask or Web3 Wallet"
              >
                <PlusCircle className="w-3 h-3" />
                <span>{tokenAddedToWallet ? 'Added' : 'Add to Wallet'}</span>
              </button>

              <a
                href={getBaseScanAddressUrl(MOCK_USDC_ADDRESS)}
                target="_blank"
                rel="noreferrer"
                className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                  isLight
                    ? 'bg-white hover:bg-slate-100 text-slate-600 border-slate-300'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}
                title="View on BaseScan"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Recipient Address Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 opacity-80">
                <Wallet className="w-3.5 h-3.5 text-blue-400" />
                <span>Recipient Wallet Address</span>
              </label>

              {/* Current USDC Balance Badge */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="opacity-70">Balance:</span>
                {isLoadingBalance ? (
                  <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                ) : (
                  <span className="font-mono-code font-bold text-emerald-400">
                    {balance !== null ? `$${balance} mUSDC` : '--'}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => fetchBalance()}
                  className="p-1 hover:opacity-75 transition-opacity cursor-pointer"
                  title="Refresh Balance"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="relative">
              <input
                id="input-faucet-recipient"
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value.trim())}
                placeholder="0x..."
                disabled={isMinting}
                className={`w-full px-3.5 py-2.5 rounded-xl font-mono-code text-xs sm:text-sm border transition-all outline-hidden ${
                  isLight
                    ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-500 focus:bg-white'
                    : 'bg-[#120d22] border-[#362959] text-white focus:border-blue-500 focus:bg-[#1a1330]'
                }`}
              />
            </div>
            <p className={`text-[11px] mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Enter any Ethereum address or use your connected Base Sepolia wallet.
            </p>
          </div>

          {/* Amount Selection */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider block mb-1.5 opacity-80">
              Claim Amount ($mUSDC)
            </label>

            <div className="grid grid-cols-4 gap-2 mb-2">
              {[25, 50, 100, 250].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    setAmount(amt);
                  }}
                  disabled={isMinting}
                  className={`py-2 rounded-xl text-xs font-mono-code font-bold border transition-all cursor-pointer ${
                    amount === amt
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-400 shadow-md scale-[1.02]'
                      : isLight
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                      : 'bg-[#1f1839] hover:bg-[#281f4a] text-slate-300 border-[#382b5f]'
                  }`}
                >
                  {amt === 50 ? '⭐ ' : ''}${amt}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs opacity-70">Custom:</span>
              <input
                type="number"
                min="1"
                max="1000"
                value={amount}
                onChange={(e) => setAmount(Math.max(1, Math.min(1000, Number(e.target.value) || 1)))}
                disabled={isMinting}
                className={`w-28 px-2.5 py-1 rounded-lg font-mono-code text-xs border outline-hidden ${
                  isLight
                    ? 'bg-slate-50 border-slate-300 text-slate-900'
                    : 'bg-[#120d22] border-[#362959] text-white'
                }`}
              />
              <span className="text-xs font-mono-code text-blue-400 font-bold">mUSDC</span>
            </div>
          </div>

          {/* Status / Error / Success Message */}
          {statusMessage && (
            <div
              className={`p-3.5 rounded-2xl border text-xs animate-fade-in ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : statusMessage.type === 'error'
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {statusMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : statusMessage.type === 'error' ? (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                ) : (
                  <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <div>{statusMessage.text}</div>
                  {statusMessage.txHash && (
                    <a
                      href={getBaseScanTxUrl(statusMessage.txHash)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-blue-400 hover:underline font-mono-code font-bold text-[11px]"
                    >
                      <span>View Transaction on BaseScan</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Mint Buttons */}
          <div className="space-y-2 pt-2">
            {/* Direct Web3 Mint Button */}
            <button
              id="btn-faucet-web3-mint"
              type="button"
              disabled={isMinting || !recipient}
              onClick={handleWeb3Mint}
              className={`w-full py-3 px-4 rounded-2xl font-black text-sm text-white flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                mintMethod === 'web3'
                  ? 'bg-blue-600'
                  : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 shadow-blue-500/25 active:scale-[0.99]'
              }`}
            >
              {mintMethod === 'web3' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Minting via Web3 Wallet...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Claim {amount} Mock USDC (Web3 Wallet)</span>
                </>
              )}
            </button>

            {/* Server-assisted Gasless Faucet Button */}
            <button
              id="btn-faucet-server-mint"
              type="button"
              disabled={isMinting || !recipient}
              onClick={handleServerMint}
              className={`w-full py-2.5 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                mintMethod === 'server'
                  ? 'bg-purple-900/40 text-purple-200 border-purple-500/50'
                  : isLight
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                  : 'bg-[#221a3d] hover:bg-[#2c2250] text-purple-200 border-purple-500/30'
              }`}
            >
              {mintMethod === 'server' ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Submitting Gasless Mint...</span>
                </>
              ) : (
                <>
                  <Coins className="w-3.5 h-3.5 text-purple-400" />
                  <span>⚡ Instant Gasless Claim ({amount} USDC via Server)</span>
                </>
              )}
            </button>
          </div>

          {/* Testnet Gas Notice */}
          <div
            className={`p-3 rounded-xl border text-[11px] flex items-center justify-between gap-2 ${
              isLight
                ? 'bg-slate-50 border-slate-200 text-slate-600'
                : 'bg-[#151026] border-[#292044] text-slate-400'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span>Need Base Sepolia ETH for gas?</span>
            </div>
            <a
              href="https://faucets.chain.link/base-sepolia"
              target="_blank"
              rel="noreferrer"
              className="font-bold text-blue-400 hover:underline flex items-center gap-0.5 shrink-0"
            >
              <span>Get Testnet ETH</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
