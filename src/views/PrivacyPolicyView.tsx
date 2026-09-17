import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { sounds } from '../utils/audio';

interface PrivacyPolicyViewProps {
  onBack: () => void;
}

export const PrivacyPolicyView: React.FC<PrivacyPolicyViewProps> = ({ onBack }) => {
  const { isLight } = useTheme();

  return (
    <div className={`min-h-screen py-10 px-4 sm:px-6 lg:px-8 transition-colors ${
      isLight ? 'bg-slate-50 text-slate-800' : 'bg-[#0e0a1a] text-slate-200'
    }`}>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={() => {
              sounds.playClick();
              onBack();
            }}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              isLight
                ? 'bg-white border-slate-200 hover:bg-slate-100 text-slate-700 shadow-sm'
                : 'bg-[#18132d] border-[#2f2752] hover:bg-[#231b40] text-slate-200'
            }`}
          >
            <span>←</span>
            <span>Back to Lobby</span>
          </button>
          <span className="text-xs text-slate-400 font-medium">
            Last Updated: September 2026
          </span>
        </div>

        {/* Hero Banner */}
        <div className={`p-6 sm:p-8 rounded-2xl border ${
          isLight
            ? 'bg-white border-slate-200 shadow-sm'
            : 'bg-gradient-to-br from-[#16112c] to-[#120d24] border-[#2c2350]'
        }`}>
          <div className="inline-block px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase bg-purple-500/10 text-purple-400 border border-purple-500/20 mb-3">
            Legal & Compliance
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-black tracking-tight text-white mb-3">
            Privacy Policy
          </h1>
          <p className={`text-sm leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
            Welcome to PropRush ("we", "our", or "us"). We are committed to protecting your privacy and ensuring transparency in how information is handled across our real-time multiplayer real estate gaming platform. This Privacy Policy details the types of information we collect, how it is used, and your rights.
          </p>
        </div>

        {/* Policy Content Sections */}
        <div className={`p-6 sm:p-8 rounded-2xl border space-y-8 ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#15102a] border-[#29204a]'
        }`}>
          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-lg font-heading font-bold text-purple-400 flex items-center gap-2">
              <span>1.</span>
              <span>Information We Collect</span>
            </h2>
            <p className="text-xs sm:text-sm leading-relaxed text-slate-400">
              PropRush is built with a privacy-first approach. We minimize personal data collection and rely primarily on cryptographic authentication and local session state:
            </p>
            <ul className="list-disc list-inside text-xs sm:text-sm space-y-2 text-slate-400 pl-2">
              <li>
                <strong className="text-slate-200">Public Web3 Wallet Address:</strong> When you connect your crypto wallet (via Dynamic.xyz or standard Web3 providers), we store your public Ethereum address to identify your player profile, persist your league points, and authenticate room ownership.
              </li>
              <li>
                <strong className="text-slate-200">Player Profile & Customizations:</strong> Usernames chosen by players, avatar selections, dice styles, match stats, and win/loss records.
              </li>
              <li>
                <strong className="text-slate-200">Gameplay Telemetry:</strong> In-match moves, dice roll outcomes, property trades, auction bids, and match chat messages to facilitate real-time multiplayer synchronization.
              </li>
              <li>
                <strong className="text-slate-200">Referral Attribution:</strong> Unique referral identifiers to automatically credit bonus coins and league points to players and their referrers upon first sign-in.
              </li>
              <li>
                <strong className="text-slate-200">Payment Transaction IDs:</strong> If you purchase cosmetic items or deposit funds via Stripe, payment processing is handled directly by Stripe. We do not store credit card details; we only receive confirmation of successful transactions.
              </li>
            </ul>
          </section>

          <hr className={isLight ? 'border-slate-200' : 'border-slate-800/80'} />

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-lg font-heading font-bold text-purple-400 flex items-center gap-2">
              <span>2.</span>
              <span>How We Use Your Information</span>
            </h2>
            <ul className="list-disc list-inside text-xs sm:text-sm space-y-2 text-slate-400 pl-2">
              <li>To host, operate, and synchronize live multiplayer games and game rooms.</li>
              <li>To maintain global and league leaderboards, player rankings, and achievements.</li>
              <li>To prevent fraudulent activity, bot abuse, and ensure anti-cheat game integrity.</li>
              <li>To attribute referral rewards automatically through unique invite links.</li>
              <li>To store player preferences such as audio mute toggles, board themes, and light/dark mode settings.</li>
            </ul>
          </section>

          <hr className={isLight ? 'border-slate-200' : 'border-slate-800/80'} />

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-lg font-heading font-bold text-purple-400 flex items-center gap-2">
              <span>3.</span>
              <span>Web3 & Blockchain Transparency</span>
            </h2>
            <p className="text-xs sm:text-sm leading-relaxed text-slate-400">
              Please note that public wallet addresses and transactions on blockchain networks are immutable and publicly verifiable by nature. PropRush never asks for, nor stores, your private keys or recovery seed phrases.
            </p>
          </section>

          <hr className={isLight ? 'border-slate-200' : 'border-slate-800/80'} />

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-lg font-heading font-bold text-purple-400 flex items-center gap-2">
              <span>4.</span>
              <span>Cookies & Local Storage</span>
            </h2>
            <p className="text-xs sm:text-sm leading-relaxed text-slate-400">
              We utilize browser LocalStorage and SessionStorage strictly for functional session management:
            </p>
            <ul className="list-disc list-inside text-xs sm:text-sm space-y-1.5 text-slate-400 pl-2">
              <li>Saving active match state for reconnection in case of accidental browser refresh or network interruption.</li>
              <li>Persisting your theme preference, sound effects settings, and player profile.</li>
              <li>Caching public active room lists for low-latency lobby browsing.</li>
            </ul>
          </section>

          <hr className={isLight ? 'border-slate-200' : 'border-slate-800/80'} />

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="text-lg font-heading font-bold text-purple-400 flex items-center gap-2">
              <span>5.</span>
              <span>Third-Party Services</span>
            </h2>
            <p className="text-xs sm:text-sm leading-relaxed text-slate-400">
              We integrate trusted third-party providers who adhere to strict data security standards:
            </p>
            <ul className="list-disc list-inside text-xs sm:text-sm space-y-1.5 text-slate-400 pl-2">
              <li><strong className="text-slate-200">Dynamic.xyz:</strong> For embedded Web3 authentication, social sign-ins, and cryptographic wallet connection.</li>
              <li><strong className="text-slate-200">Stripe:</strong> For optional fiat deposits and secure payment processing.</li>
            </ul>
          </section>

          <hr className={isLight ? 'border-slate-200' : 'border-slate-800/80'} />

          {/* Section 6 */}
          <section className="space-y-3">
            <h2 className="text-lg font-heading font-bold text-purple-400 flex items-center gap-2">
              <span>6.</span>
              <span>Your Rights & Contact</span>
            </h2>
            <p className="text-xs sm:text-sm leading-relaxed text-slate-400">
              You have the right to request access to or deletion of your off-chain profile data at any time. If you have questions regarding this Privacy Policy or wish to request data removal, please contact our support team at <span className="text-purple-300 font-mono">support@proprush.com</span>.
            </p>
          </section>
        </div>

        {/* Footer Back Button */}
        <div className="text-center pt-4">
          <button
            onClick={() => {
              sounds.playClick();
              onBack();
            }}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#7059e2] to-[#8e76f7] hover:from-[#6047d8] hover:to-[#7f63f3] text-white font-heading font-bold text-xs shadow-lg cursor-pointer transition-all"
          >
            Return to PropRush Lobby
          </button>
        </div>
      </div>
    </div>
  );
};
