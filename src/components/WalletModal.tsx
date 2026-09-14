import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import { sounds } from '../utils/audio';
import { fetchStripeStatus, createStripeCheckoutSession, StripeStatus } from '../utils/stripeClient';
import { fireConfetti } from '../utils/confetti';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose }) => {
  const { user, depositFunds, withdrawFunds, isLoggedIn, openAuthModal } = useUser();
  const { isLight } = useTheme();
  const [tab, setTab] = useState<'deposit' | 'withdraw' | 'wager_info' | 'stripe_info'>('deposit');
  const [depositAmount, setDepositAmount] = useState<number>(20);
  const [withdrawAmount, setWithdrawAmount] = useState<number>(10);
  const [paymentMethod, setPaymentMethod] = useState<string>('stripe');
  const [withdrawMethod, setWithdrawMethod] = useState<string>('paypal');
  const [withdrawAddress, setWithdrawAddress] = useState<string>('sahi@gmail.com');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoadingCheckout, setIsLoadingCheckout] = useState(false);
  const [stripeStatus, setStripeStatus] = useState<StripeStatus | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchStripeStatus().then(setStripeStatus);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (depositAmount <= 0) {
      setErrorMsg('Please enter a valid deposit amount.');
      return;
    }

    if (!isLoggedIn) {
      openAuthModal('Log in or connect with Dynamic to deposit funds into your secure wallet.');
      return;
    }

    setIsLoadingCheckout(true);

    try {
      // Call backend Stripe Checkout session API
      const result = await createStripeCheckoutSession({
        amount: depositAmount,
        userId: user.id,
        username: user.username,
        userEmail: user.email || undefined,
        returnUrl: window.location.origin,
      });

      if (!result.success) {
        throw new Error(result.error || 'Unable to initiate payment session');
      }

      if (result.mode === 'stripe' && result.url) {
        // Redirect to real Stripe Checkout hosted payment page
        window.location.href = result.url;
        return;
      }

      // Sandbox / Instant test deposit
      depositFunds(depositAmount, 'stripe_sandbox');
      sounds.playVictory();
      try {
        fireConfetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 }
        });
      } catch {}
      setSuccessMsg(`Deposited $${depositAmount.toFixed(2)} USD to your balance! (Stripe Test/Sandbox)`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error('Checkout error:', err);
      setErrorMsg(err.message || 'Payment initiation failed. Please try again.');
    } finally {
      setIsLoadingCheckout(false);
    }
  };

  const handleWithdraw = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!isLoggedIn) {
      openAuthModal('Log in or connect with Dynamic to withdraw balance to your payment method.');
      return;
    }
    if (withdrawAmount <= 0 || withdrawAmount > user.walletBalance) {
      setErrorMsg('Invalid withdrawal amount. Exceeds available balance.');
      return;
    }
    const ok = withdrawFunds(withdrawAmount);
    if (ok) {
      setSuccessMsg(`Withdrawal of $${withdrawAmount.toFixed(2)} initiated to ${withdrawAddress}!`);
      setTimeout(() => setSuccessMsg(null), 3500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className={`w-full max-w-lg border-2 rounded-3xl shadow-2xl p-4 sm:p-6 flex flex-col gap-4 sm:gap-5 max-h-[90vh] overflow-y-auto ${
        isLight
          ? 'bg-white border-emerald-500 text-slate-800'
          : 'bg-[#181329] border-emerald-500/50 text-white'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between border-b pb-3 ${
          isLight ? 'border-slate-200' : 'border-slate-800'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center text-xl ${
              isLight ? 'bg-emerald-100 border-emerald-300 text-emerald-800' : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
            }`}>
              💵
            </div>
            <div>
              <h2 className={`font-heading font-black text-base sm:text-lg ${isLight ? 'text-slate-900' : 'text-white'}`}>
                WAGER & PAYMENTS WALLET
              </h2>
              <div className="flex items-center gap-1.5 text-xs">
                <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>Real-money prize pools</span>
                <span className="text-slate-500">•</span>
                <span className="inline-flex items-center gap-1 font-bold text-[#635BFF]">
                  <span>💳</span> Stripe Enabled
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-colors ${
              isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-600' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
          >
            ✕
          </button>
        </div>

        {/* Current Balance Card */}
        <div className={`p-4 rounded-2xl border flex items-center justify-between ${
          isLight
            ? 'bg-emerald-50/80 border-emerald-300 text-slate-900'
            : 'bg-gradient-to-r from-emerald-950/60 via-slate-900 to-emerald-950/60 border-emerald-500/30 text-white'
        }`}>
          <div>
            <div className={`text-xs uppercase font-bold tracking-wider ${isLight ? 'text-emerald-800' : 'text-emerald-400/80'}`}>
              Available Wallet Balance
            </div>
            <div className={`font-mono-code font-black text-2xl sm:text-3xl mt-0.5 ${isLight ? 'text-emerald-700' : 'text-emerald-300'}`}>
              ${user.walletBalance.toFixed(2)} <span className={`text-sm font-normal ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>USD</span>
            </div>
          </div>
          <div className={`text-right text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            <div className="flex items-center justify-end gap-1 font-bold text-emerald-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Instant Payouts</span>
            </div>
            <div className={`font-medium ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
              {stripeStatus?.configured 
                ? (stripeStatus.mode === 'live' ? '🔒 Stripe Live' : '🧪 Stripe Test') 
                : '🛡️ Stripe Sandbox'}
            </div>
          </div>
        </div>

        {/* Success Alert */}
        {successMsg && (
          <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-700 dark:text-emerald-300 text-xs font-bold text-center">
            🎉 {successMsg}
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-bold text-center">
            ⚠️ {errorMsg}
          </div>
        )}

        {/* Tabs */}
        <div className={`grid grid-cols-4 gap-1 sm:gap-1.5 p-1 rounded-xl border text-xs font-bold ${
          isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-900/80 border-slate-800'
        }`}>
          <button
            onClick={() => setTab('deposit')}
            className={`py-2 rounded-lg transition-all cursor-pointer text-center text-xs truncate ${
              tab === 'deposit'
                ? 'bg-emerald-600 text-white shadow-md'
                : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
            }`}
          >
            + Deposit
          </button>
          <button
            onClick={() => setTab('withdraw')}
            className={`py-2 rounded-lg transition-all cursor-pointer text-center text-xs truncate ${
              tab === 'withdraw'
                ? 'bg-emerald-600 text-white shadow-md'
                : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
            }`}
          >
            ↗ Withdraw
          </button>
          <button
            onClick={() => setTab('stripe_info')}
            className={`py-2 rounded-lg transition-all cursor-pointer text-center text-xs truncate ${
              tab === 'stripe_info'
                ? 'bg-[#635BFF] text-white shadow-md'
                : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
            }`}
          >
            💳 Stripe
          </button>
          <button
            onClick={() => setTab('wager_info')}
            className={`py-2 rounded-lg transition-all cursor-pointer text-center text-xs truncate ${
              tab === 'wager_info'
                ? 'bg-[#7059e2] text-white shadow-md'
                : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
            }`}
          >
            ℹ️ Rules
          </button>
        </div>

        {/* Deposit Tab */}
        {tab === 'deposit' && (
          <form onSubmit={handleDeposit} className="space-y-4">
            <div>
              <label className={`block text-xs font-bold mb-1.5 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                Select Deposit Amount ($ USD)
              </label>
              <div className="grid grid-cols-4 gap-2 mb-2">
                {[10, 20, 50, 100].map(amt => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setDepositAmount(amt)}
                    className={`py-2 rounded-xl text-xs font-mono-code font-bold border transition-all cursor-pointer ${
                      depositAmount === amt
                        ? 'bg-emerald-600 text-white border-emerald-400 shadow-md'
                        : isLight
                        ? 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    ${amt}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min="1"
                value={depositAmount || ''}
                onChange={e => setDepositAmount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className={`w-full px-3 py-2 rounded-xl border text-sm font-mono-code focus:outline-none focus:border-emerald-500 ${
                  isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-slate-900 border-slate-700 text-white'
                }`}
                placeholder="Custom Amount (Enter any amount, e.g. $250, $1000...)"
              />
            </div>

            <div>
              <label className={`block text-xs font-bold mb-1.5 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                Payment Gateway & Method
              </label>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {[
                  { id: 'stripe', name: 'Stripe Card', icon: '💳' },
                  { id: 'apple', name: 'Apple / Google', icon: '📱' },
                  { id: 'crypto', name: 'Crypto Web3', icon: '🪙' }
                ].map(meth => (
                  <button
                    key={meth.id}
                    type="button"
                    onClick={() => setPaymentMethod(meth.id)}
                    className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 cursor-pointer transition-all ${
                      paymentMethod === meth.id
                        ? isLight
                          ? 'bg-emerald-100 border-emerald-500 text-emerald-900 font-bold'
                          : 'bg-emerald-950/60 border-emerald-500 text-white font-bold'
                        : isLight
                        ? 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <span>{meth.icon}</span>
                    <span className="truncate">{meth.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoadingCheckout}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#635BFF] via-[#7059e2] to-emerald-600 hover:brightness-110 text-white font-heading font-black text-sm cursor-pointer shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoadingCheckout ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Connecting to Stripe...</span>
                </>
              ) : (
                <>
                  <span>🔒</span>
                  <span>Pay ${depositAmount.toFixed(2)} with Stripe Checkout</span>
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 text-center">
              <span>💳 Powered by Stripe Payments</span>
              <span>•</span>
              <span>256-bit SSL Encrypted</span>
            </div>
          </form>
        )}

        {/* Stripe Info & Setup Tab */}
        {tab === 'stripe_info' && (
          <div className="space-y-3 text-xs">
            <div className={`p-4 rounded-2xl border space-y-3 ${
              isLight ? 'bg-indigo-50/70 border-indigo-200 text-slate-800' : 'bg-indigo-950/40 border-indigo-500/30 text-slate-200'
            }`}>
              <div className="flex items-center justify-between">
                <div className="font-bold flex items-center gap-2 text-sm text-[#635BFF] dark:text-[#8e76f7]">
                  <span>💳</span> Stripe Integration Status
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono-code font-bold ${
                  stripeStatus?.configured 
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                }`}>
                  {stripeStatus?.configured ? 'Active (API Key Connected)' : 'Sandbox Mode Ready'}
                </span>
              </div>

              <p className="leading-relaxed text-[11px]">
                PropRush uses Stripe Checkout to process credit/debit card wagers and deposits with full 3D-Secure authentication.
              </p>

              <div className={`p-3 rounded-xl border space-y-1.5 font-mono-code text-[11px] ${
                isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
              }`}>
                <div className="font-bold text-slate-600 dark:text-slate-400">Environment Variables:</div>
                <div className="flex items-center justify-between text-slate-800 dark:text-slate-200">
                  <span>STRIPE_SECRET_KEY:</span>
                  <span className="font-bold text-emerald-500">
                    {stripeStatus?.configured ? 'sk_... (Configured)' : 'Pending (.env.example)'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-800 dark:text-slate-200">
                  <span>VITE_STRIPE_PUBLISHABLE_KEY:</span>
                  <span className="font-bold text-emerald-500">
                    {stripeStatus?.publishableKey ? 'pk_... (Configured)' : 'Optional'}
                  </span>
                </div>
              </div>

              <div className="text-[11px] space-y-1 text-slate-600 dark:text-slate-400">
                <p className="font-bold text-slate-800 dark:text-slate-200">💡 How to supply your Stripe Keys:</p>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>Get your test key from <span className="underline font-mono-code">dashboard.stripe.com/apikeys</span></li>
                  <li>In AI Studio Settings / Secrets, set <span className="font-mono-code font-bold text-[#635BFF]">STRIPE_SECRET_KEY</span> to <span className="font-mono-code">sk_test_...</span></li>
                  <li>You can test card deposits immediately using Stripe's 4242 4242 4242 4242 test card!</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* Withdraw Tab */}
        {tab === 'withdraw' && (
          <form onSubmit={handleWithdraw} className="space-y-4">
            <div>
              <label className={`block text-xs font-bold mb-1.5 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                Withdraw Amount (Max: ${user.walletBalance.toFixed(2)})
              </label>
              <input
                type="number"
                min="5"
                max={user.walletBalance}
                value={withdrawAmount || ''}
                onChange={e => setWithdrawAmount(Math.min(user.walletBalance, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                className={`w-full px-3 py-2 rounded-xl border text-sm font-mono-code focus:outline-none focus:border-emerald-500 ${
                  isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-slate-900 border-slate-700 text-white'
                }`}
              />
            </div>

            <div>
              <label className={`block text-xs font-bold mb-1.5 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                Payout Method & Account
              </label>
              <div className="flex gap-2 mb-2">
                {['paypal', 'crypto', 'bank'].map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setWithdrawMethod(m)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase border transition-all cursor-pointer ${
                      withdrawMethod === m
                        ? 'bg-emerald-600 text-white border-emerald-400'
                        : isLight
                        ? 'bg-slate-50 border-slate-300 text-slate-600'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={withdrawAddress}
                onChange={e => setWithdrawAddress(e.target.value)}
                placeholder="Email or Bank IBAN / Wallet Address"
                className={`w-full px-3 py-2 rounded-xl border text-xs focus:outline-none focus:border-emerald-500 ${
                  isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-slate-900 border-slate-700 text-white'
                }`}
              />
            </div>

            <button
              type="submit"
              disabled={withdrawAmount <= 0 || withdrawAmount > user.walletBalance}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-heading font-black text-sm cursor-pointer shadow-lg active:scale-95 transition-all"
            >
              Withdraw ${withdrawAmount.toFixed(2)} USD
            </button>
          </form>
        )}

        {/* Wager Info Tab */}
        {tab === 'wager_info' && (
          <div className="space-y-3 text-xs p-1">
            <div className={`p-3 rounded-xl border space-y-2 ${
              isLight ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-slate-900/80 border-slate-800 text-slate-300'
            }`}>
              <div className={`font-bold flex items-center gap-1.5 ${isLight ? 'text-amber-800' : 'text-amber-300'}`}>
                <span>🎯</span> How Room Wagers Work:
              </div>
              <p className="leading-relaxed">
                When you create or join a wager room (e.g. $10 buy-in), all 4 players contribute $10 to the pot ($40 total).
              </p>
              <div className={`p-2.5 rounded-lg border font-mono-code text-xs space-y-1 ${
                isLight ? 'bg-emerald-50 border-emerald-300' : 'bg-emerald-950/40 border-emerald-500/30'
              }`}>
                <div className={`flex justify-between ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                  <span>Total Pot (4 x $10):</span>
                  <span className="font-bold">$40.00</span>
                </div>
                <div className={`flex justify-between font-bold ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                  <span>Winner Payout (95%):</span>
                  <span>+$38.00</span>
                </div>
                <div className={`flex justify-between text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  <span>Platform Fee (5%):</span>
                  <span>$2.00</span>
                </div>
              </div>
              <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Winnings are instantly deposited to your wallet balance the moment a player bankrups rivals or dominates the economy!
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
