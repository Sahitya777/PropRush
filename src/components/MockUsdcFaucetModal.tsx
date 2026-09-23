import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Droplets,
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
  LogIn,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';
import { useSafeDynamic } from '../context/DynamicIntegration';
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
  const { user, openAuthModal } = useUser();
  const { primaryWallet, setShowAuthFlow } = useSafeDynamic();

  // Fixed 50 mUSDC allocation
  const CLAIM_AMOUNT = 50;

  // Determine connected wallet address
  const connectedAddress = (
    primaryWallet?.address ||
    (user?.walletAddress && user.walletAddress.startsWith('0x') ? user.walletAddress : '') ||
    initialAddress ||
    (typeof window !== 'undefined' && (window as any).ethereum?.selectedAddress ? (window as any).ethereum.selectedAddress : '')
  ) as string;

  const hasConnectedWallet = Boolean(
    connectedAddress && connectedAddress.startsWith('0x') && connectedAddress.length >= 40
  );

  const [balance, setBalance] = useState<string | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [copiedContract, setCopiedContract] = useState(false);
  const [copiedWallet, setCopiedWallet] = useState(false);
  const [tokenAddedToWallet, setTokenAddedToWallet] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
    txHash?: string;
  } | null>(null);

  // Load USDC balance when connectedAddress changes or modal opens
  const fetchBalance = useCallback(async (addrToFetch?: string) => {
    const targetAddr = addrToFetch || connectedAddress;
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
  }, [connectedAddress]);

  useEffect(() => {
    if (isOpen && connectedAddress) {
      fetchBalance(connectedAddress);
    }
  }, [isOpen, connectedAddress, fetchBalance]);

  if (!isOpen) return null;

  // Copy Contract Address
  const handleCopyContract = () => {
    sounds.playClick();
    navigator.clipboard.writeText(MOCK_USDC_ADDRESS);
    setCopiedContract(true);
    setTimeout(() => setCopiedContract(false), 2000);
  };

  // Copy Connected Wallet Address
  const handleCopyWallet = () => {
    if (!connectedAddress) return;
    sounds.playClick();
    navigator.clipboard.writeText(connectedAddress);
    setCopiedWallet(true);
    setTimeout(() => setCopiedWallet(false), 2000);
  };

  // Connect Wallet Trigger
  const handleConnectWallet = () => {
    sounds.playClick();
    try {
      setShowAuthFlow(true);
    } catch {
      openAuthModal('Connect your Web3 wallet to claim 50 Mock USDC from the faucet.');
    }
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

  // Explicit Reconnect for MetaMask / Injected Provider
  const handleReconnectWallet = async () => {
    sounds.playClick();
    setIsMinting(true);
    setStatusMessage({
      type: 'info',
      text: 'Opening MetaMask connection prompt... Please approve the connection request.',
    });

    try {
      const ethereum = getInjectedProvider();
      if (!ethereum?.request) {
        throw new Error('MetaMask or Web3 wallet extension not detected.');
      }

      await ethereum.request({
        method: 'wallet_requestPermissions',
        params: [{ eth_accounts: {} }],
      });

      setStatusMessage({
        type: 'info',
        text: 'Wallet reconnected! Preparing transaction popup...',
      });

      // Automatically retry mint
      setTimeout(() => {
        handleWeb3Mint();
      }, 500);
    } catch (err: any) {
      console.warn('Reconnect error:', err);
      setIsMinting(false);
      setStatusMessage({
        type: 'error',
        text: err?.message?.includes('rejected')
          ? 'Reconnection was cancelled. Please click the fox icon in MetaMask to enable connection.'
          : (err?.message || 'Failed to reconnect wallet.'),
      });
    }
  };

  // Direct Web3 Mint to Connected Wallet
  const handleWeb3Mint = async () => {
    if (!hasConnectedWallet) {
      setStatusMessage({
        type: 'error',
        text: 'Please connect your Web3 wallet first to claim 50 Mock USDC.',
      });
      sounds.playError();
      return;
    }

    setIsMinting(true);
    setStatusMessage({
      type: 'info',
      text: `Waiting for signature in your wallet... Please check the MetaMask popup to confirm the transaction.`,
    });

    try {
      const { walletClient, address } = await getWalletClient(primaryWallet);
      const targetAddress = (connectedAddress || address) as `0x${string}`;

      setStatusMessage({
        type: 'info',
        text: `Please sign & confirm the 50 mUSDC mint transaction in your MetaMask popup window...`,
      });

      const txHash = await mintTestUsdc(walletClient, targetAddress, CLAIM_AMOUNT);

      sounds.playCash();
      setStatusMessage({
        type: 'success',
        text: `Successfully minted ${CLAIM_AMOUNT} Mock USDC to ${targetAddress.slice(0, 6)}...${targetAddress.slice(-4)}!`,
        txHash,
      });

      // Refresh balance
      await fetchBalance(targetAddress);
    } catch (err: any) {
      console.error('Direct Web3 mint error:', err);
      sounds.playError();
      const errMsg = (err?.message || '').toLowerCase();
      if (errMsg.includes('user rejected') || errMsg.includes('denied') || err?.code === 4001) {
        setStatusMessage({
          type: 'error',
          text: 'Transaction was cancelled in your wallet.',
        });
      } else if (errMsg.includes('disabled') || errMsg.includes('unauthorized') || err?.code === 4100) {
        setStatusMessage({
          type: 'error',
          text: 'DApp interaction is disabled or disconnected in MetaMask. Click "Reconnect MetaMask" below to re-authorize.',
        });
      } else if (errMsg.includes('gas') || errMsg.includes('insufficient funds')) {
        setStatusMessage({
          type: 'error',
          text: 'Insufficient Base Sepolia ETH for gas. Get free Base Sepolia ETH from the faucet link below.',
        });
      } else {
        setStatusMessage({ type: 'error', text: err?.message || 'Transaction failed or rejected.' });
      }
    } finally {
      setIsMinting(false);
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
                  copiedContract
                    ? 'bg-emerald-500 text-white border-emerald-600'
                    : isLight
                    ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                }`}
                title="Copy Token Contract Address"
              >
                {copiedContract ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copiedContract ? 'Copied' : 'Copy'}</span>
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

          {/* Connected Account Wallet Card (Direct Recipient) */}
          <div
            className={`p-4 rounded-2xl border transition-all ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#120d22] border-[#2f244e]'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    hasConnectedWallet
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-amber-500/20 text-amber-400'
                  }`}
                >
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider block">
                    Connected Account Wallet
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {hasConnectedWallet ? 'Direct Faucet Recipient' : 'No wallet connected'}
                  </span>
                </div>
              </div>

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
                {hasConnectedWallet && (
                  <button
                    type="button"
                    onClick={() => fetchBalance()}
                    className="p-1 hover:opacity-75 transition-opacity cursor-pointer text-slate-400 hover:text-white"
                    title="Refresh Balance"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {hasConnectedWallet ? (
              <div
                className={`flex items-center justify-between p-2.5 rounded-xl border font-mono-code text-xs ${
                  isLight
                    ? 'bg-white border-slate-300 text-slate-800'
                    : 'bg-[#18122c] border-[#3a2c61] text-emerald-300'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <span className="truncate font-semibold">{connectedAddress}</span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyWallet}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 shrink-0 ml-2 transition-all cursor-pointer ${
                    copiedWallet
                      ? 'bg-emerald-500 text-white'
                      : isLight
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                  }`}
                  title="Copy Connected Address"
                >
                  {copiedWallet ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedWallet ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            ) : (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleConnectWallet}
                  className="w-full py-2.5 px-3 rounded-xl font-bold text-xs bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all active:scale-[0.99]"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Connect Wallet / Log In to Claim</span>
                </button>
              </div>
            )}
          </div>

          {/* Fixed Claim Amount Display */}
          <div
            className={`p-4 rounded-2xl border flex items-center justify-between ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#120d22] border-[#2f244e]'
            }`}
          >
            <div>
              <span className="text-xs font-bold uppercase tracking-wider block opacity-80">
                Claim Amount
              </span>
              <span className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Fixed testnet allocation per claim
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30">
              <span className="text-base font-black font-mono-code text-blue-400">
                50 mUSDC
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/30 text-blue-300">
                $50.00
              </span>
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
                  {statusMessage.type === 'error' && statusMessage.text.includes('disabled') && (
                    <button
                      type="button"
                      onClick={handleReconnectWallet}
                      disabled={isMinting}
                      className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] cursor-pointer shadow-sm transition-all active:scale-95 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${isMinting ? 'animate-spin' : ''}`} />
                      <span>Reconnect MetaMask Now</span>
                    </button>
                  )}
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

          {/* Mint Action Button */}
          <div className="pt-1">
            {hasConnectedWallet ? (
              <button
                id="btn-faucet-web3-mint"
                type="button"
                disabled={isMinting || !hasConnectedWallet}
                onClick={handleWeb3Mint}
                className="w-full py-3.5 px-4 rounded-2xl font-black text-sm text-white flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 shadow-blue-500/25 active:scale-[0.99]"
              >
                {isMinting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Minting 50 Mock USDC to Wallet...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Claim 50 Mock USDC (Web3 Wallet)</span>
                  </>
                )}
              </button>
            ) : (
              <button
                id="btn-faucet-connect-wallet"
                type="button"
                onClick={handleConnectWallet}
                className="w-full py-3.5 px-4 rounded-2xl font-black text-sm text-white flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 shadow-blue-500/25 active:scale-[0.99]"
              >
                <LogIn className="w-4 h-4 text-white" />
                <span>Connect Wallet to Claim 50 Mock USDC</span>
              </button>
            )}
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

