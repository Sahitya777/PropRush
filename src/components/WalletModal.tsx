import React, { useState } from 'react';
import { useUser } from '../context/UserContext';
import { sounds } from '../utils/audio';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose }) => {
  const { user, depositFunds, withdrawFunds, isLoggedIn, openAuthModal, requireAuth } = useUser();
  const [tab, setTab] = useState<'deposit' | 'withdraw' | 'wager_info'>('deposit');
  const [depositAmount, setDepositAmount] = useState<number>(20);
  const [withdrawAmount, setWithdrawAmount] = useState<number>(10);
  const [paymentMethod, setPaymentMethod] = useState<string>('card');
  const [withdrawMethod, setWithdrawMethod] = useState<string>('paypal');
  const [withdrawAddress, setWithdrawAddress] = useState<string>('sahi@gmail.com');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    if (depositAmount <= 0) return;

    if (!isLoggedIn) {
      openAuthModal('Sign in with Google or Clerk to deposit funds into your secure wallet.');
      return;
    }

    const ok = depositFunds(depositAmount, paymentMethod);
    if (ok) {
      setSuccessMsg(`Successfully deposited $${depositAmount.toFixed(2)} to your balance!`);
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  const handleWithdraw = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn) {
      openAuthModal('Sign in with Google or Clerk to withdraw balance to your payment method.');
      return;
    }
    if (withdrawAmount <= 0 || withdrawAmount > user.walletBalance) {
      alert('Invalid withdrawal amount');
      return;
    }
    const ok = withdrawFunds(withdrawAmount);
    if (ok) {
      setSuccessMsg(`Withdrawal of $${withdrawAmount.toFixed(2)} initiated to ${withdrawAddress}!`);
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-[#181329] border-2 border-emerald-500/50 rounded-3xl shadow-2xl p-6 flex flex-col gap-5 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-xl text-emerald-400">
              💵
            </div>
            <div>
              <h2 className="font-heading font-black text-lg text-white">
                WAGER & PAYMENTS WALLET
              </h2>
              <p className="text-xs text-slate-400">Real-money competitive prize pools</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Current Balance Card */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/60 via-slate-900 to-emerald-950/60 border border-emerald-500/30 flex items-center justify-between">
          <div>
            <div className="text-xs text-emerald-400/80 uppercase font-bold tracking-wider">
              Available Wallet Balance
            </div>
            <div className="font-mono-code font-black text-3xl text-emerald-300 mt-0.5">
              ${user.walletBalance.toFixed(2)} <span className="text-sm font-normal text-slate-400">USD</span>
            </div>
          </div>
          <div className="text-right text-xs text-slate-400">
            <div>Instant Payouts</div>
            <div className="text-emerald-400 font-bold">100% Secured</div>
          </div>
        </div>

        {/* Success Alert */}
        {successMsg && (
          <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-bold text-center animate-bounce">
            🎉 {successMsg}
          </div>
        )}

        {/* Tabs */}
        <div className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-slate-900/80 border border-slate-800 text-xs font-bold">
          <button
            onClick={() => setTab('deposit')}
            className={`py-2 rounded-lg transition-all cursor-pointer ${
              tab === 'deposit' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            + Deposit Funds
          </button>
          <button
            onClick={() => setTab('withdraw')}
            className={`py-2 rounded-lg transition-all cursor-pointer ${
              tab === 'withdraw' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            ↗ Withdraw
          </button>
          <button
            onClick={() => setTab('wager_info')}
            className={`py-2 rounded-lg transition-all cursor-pointer ${
              tab === 'wager_info' ? 'bg-[#7059e2] text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            ℹ️ Wager Rules
          </button>
        </div>

        {/* Deposit Tab */}
        {tab === 'deposit' && (
          <form onSubmit={handleDeposit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
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
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    ${amt}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min="5"
                max="500"
                value={depositAmount || ''}
                onChange={e => setDepositAmount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm font-mono-code text-white focus:outline-none focus:border-emerald-500"
                placeholder="Custom Amount"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Payment Gateway
              </label>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {[
                  { id: 'card', name: 'Credit Card', icon: '💳' },
                  { id: 'apple', name: 'Apple / Google', icon: '📱' },
                  { id: 'crypto', name: 'Crypto (USDC)', icon: '🪙' }
                ].map(meth => (
                  <button
                    key={meth.id}
                    type="button"
                    onClick={() => setPaymentMethod(meth.id)}
                    className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 cursor-pointer transition-all ${
                      paymentMethod === meth.id
                        ? 'bg-emerald-950/60 border-emerald-500 text-white font-bold'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <span>{meth.icon}</span>
                    <span>{meth.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-heading font-black text-sm cursor-pointer shadow-lg active:scale-95 transition-all"
            >
              Add ${depositAmount.toFixed(2)} to Wallet (Instant)
            </button>
          </form>
        )}

        {/* Withdraw Tab */}
        {tab === 'withdraw' && (
          <form onSubmit={handleWithdraw} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Withdraw Amount (Max: ${user.walletBalance.toFixed(2)})
              </label>
              <input
                type="number"
                min="5"
                max={user.walletBalance}
                value={withdrawAmount || ''}
                onChange={e => setWithdrawAmount(Math.min(user.walletBalance, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm font-mono-code text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
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
                placeholder="Email or Wallet Address"
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
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
          <div className="space-y-3 text-xs text-slate-300 p-2">
            <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 space-y-2">
              <div className="font-bold text-amber-300 flex items-center gap-1.5">
                <span>🎯</span> How Room Wagers Work:
              </div>
              <p className="leading-relaxed">
                When you create or join a wager room (e.g. $10 buy-in), all 4 players contribute $10 to the pot ($40 total).
              </p>
              <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 font-mono-code text-xs space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>Total Pot (4 x $10):</span>
                  <span className="font-bold text-white">$40.00</span>
                </div>
                <div className="flex justify-between text-emerald-400 font-bold">
                  <span>Winner Payout (95%):</span>
                  <span>+$38.00</span>
                </div>
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>Platform Fee (5%):</span>
                  <span>$2.00</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400">
                Winnings are instantly deposited to your wallet balance the moment a player bankrups rivals or dominates the economy!
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
