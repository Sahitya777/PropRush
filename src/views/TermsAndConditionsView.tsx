import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { sounds } from '../utils/audio';

interface TermsAndConditionsViewProps {
  onBack: () => void;
}

export const TermsAndConditionsView: React.FC<TermsAndConditionsViewProps> = ({ onBack }) => {
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
          <div className="inline-block px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-3">
            Legal & Compliance
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-black tracking-tight text-white mb-3">
            Terms & Conditions
          </h1>
          <p className={`text-sm leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
            Please read these Terms & Conditions ("Terms") carefully before using PropRush. By accessing or playing PropRush, creating rooms, wagering coins, or connecting your Web3 wallet, you agree to be bound by these Terms and our Privacy Policy.
          </p>
        </div>

        {/* Terms Content Sections */}
        <div className={`p-6 sm:p-8 rounded-2xl border space-y-8 ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#15102a] border-[#29204a]'
        }`}>
          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-lg font-heading font-bold text-amber-400 flex items-center gap-2">
              <span>1.</span>
              <span>Acceptance & Eligibility</span>
            </h2>
            <p className="text-xs sm:text-sm leading-relaxed text-slate-400">
              By accessing PropRush, you confirm that you are of legal age in your jurisdiction (at least 18 years old or the age of legal majority) and possess the legal capacity to enter into binding agreements. If you participate in skill-based tournaments or wager matches, you certify that such activities are lawful in your state or country of residence.
            </p>
          </section>

          <hr className={isLight ? 'border-slate-200' : 'border-slate-800/80'} />

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-lg font-heading font-bold text-amber-400 flex items-center gap-2">
              <span>2.</span>
              <span>Game Rules, Fair Play & Anti-Cheat</span>
            </h2>
            <p className="text-xs sm:text-sm leading-relaxed text-slate-400">
              PropRush is a competitive real estate economy and turn-based board game. To ensure fun and fair play for everyone, all users must abide by the following standards:
            </p>
            <ul className="list-disc list-inside text-xs sm:text-sm space-y-2 text-slate-400 pl-2">
              <li>
                <strong className="text-slate-200">Anti-Collusion:</strong> Players must not engage in match-fixing, intentional multi-accounting in the same match, or fraudulent asset transfers between coordinated accounts.
              </li>
              <li>
                <strong className="text-slate-200">No Unauthorized Automation:</strong> Exploiting software bugs, manipulating websocket network packets, or using unapproved third-party bots to gain an unfair advantage is strictly prohibited.
              </li>
              <li>
                <strong className="text-slate-200">Chat & Sportsmanship:</strong> Harassment, hate speech, spamming, or fraudulent impersonation in match chat or profile names will result in immediate mute or ban.
              </li>
            </ul>
          </section>

          <hr className={isLight ? 'border-slate-200' : 'border-slate-800/80'} />

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-lg font-heading font-bold text-amber-400 flex items-center gap-2">
              <span>3.</span>
              <span>Virtual Currency, Coins & League Points</span>
            </h2>
            <p className="text-xs sm:text-sm leading-relaxed text-slate-400">
              PropRush features virtual in-game currencies including PropRush Coins and League Points (LP):
            </p>
            <ul className="list-disc list-inside text-xs sm:text-sm space-y-2 text-slate-400 pl-2">
              <li>Virtual currencies and cosmetics (dice skins, board themes, avatars) are digital items used exclusively for gameplay and status within the platform.</li>
              <li>Virtual currency does not constitute personal property, has no direct legal entitlement, and cannot be redeemed for fiat currency except through officially supported platform mechanics where explicitly stated.</li>
              <li>We reserve the right to regulate, adjust, or rebalance game economics, point multipliers, and cosmetic costs to preserve competitive balance.</li>
            </ul>
          </section>

          <hr className={isLight ? 'border-slate-200' : 'border-slate-800/80'} />

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-lg font-heading font-bold text-amber-400 flex items-center gap-2">
              <span>4.</span>
              <span>Room Stakes, Match Wagers & Rake</span>
            </h2>
            <p className="text-xs sm:text-sm leading-relaxed text-slate-400">
              When creating or joining wagered rooms, players commit the specified buy-in before the match begins. The winner of the match claims the prize pool minus a standard platform operational maintenance fee (rake) displayed prior to joining. In the event of an unresolvable match disconnect or server error, buy-ins are subject to rollback or refund in accordance with our match reconnect policy.
            </p>
          </section>

          <hr className={isLight ? 'border-slate-200' : 'border-slate-800/80'} />

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="text-lg font-heading font-bold text-amber-400 flex items-center gap-2">
              <span>5.</span>
              <span>Account Suspension & Banning Policy</span>
            </h2>
            <p className="text-xs sm:text-sm leading-relaxed text-slate-400">
              PropRush administrators and automated anti-cheat systems reserve the right to issue warnings, temporary timeouts, rank resets, or permanent account bans for any violations of these Terms. Banned players lose access to matchmaking, custom rooms, and leaderboard visibility.
            </p>
          </section>

          <hr className={isLight ? 'border-slate-200' : 'border-slate-800/80'} />

          {/* Section 6 */}
          <section className="space-y-3">
            <h2 className="text-lg font-heading font-bold text-amber-400 flex items-center gap-2">
              <span>6.</span>
              <span>Intellectual Property</span>
            </h2>
            <p className="text-xs sm:text-sm leading-relaxed text-slate-400">
              All visual assets, code, audio, 3D animations, custom boards, and branding associated with PropRush are the proprietary property of PropRush Studios. You may not duplicate, reverse engineer, or commercially exploit platform assets without prior written consent.
            </p>
          </section>

          <hr className={isLight ? 'border-slate-200' : 'border-slate-800/80'} />

          {/* Section 7 */}
          <section className="space-y-3">
            <h2 className="text-lg font-heading font-bold text-amber-400 flex items-center gap-2">
              <span>7.</span>
              <span>Disclaimer of Warranties & Limitation of Liability</span>
            </h2>
            <p className="text-xs sm:text-sm leading-relaxed text-slate-400">
              PropRush is provided on an "AS IS" and "AS AVAILABLE" basis without warranties of any kind. We do not guarantee uninterrupted, bug-free, or zero-latency service. Under no circumstances shall PropRush or its developers be liable for indirect, incidental, or consequential damages resulting from gameplay or network downtime.
            </p>
          </section>

          <hr className={isLight ? 'border-slate-200' : 'border-slate-800/80'} />

          {/* Section 8 */}
          <section className="space-y-3">
            <h2 className="text-lg font-heading font-bold text-amber-400 flex items-center gap-2">
              <span>8.</span>
              <span>Modifications & Contact</span>
            </h2>
            <p className="text-xs sm:text-sm leading-relaxed text-slate-400">
              We may update these Terms periodically. Continued use of the platform constitutes agreement to the modified terms. For inquiries regarding our terms of service, reach out to <span className="text-amber-300 font-mono">legal@proprush.com</span>.
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
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-heading font-black text-xs shadow-lg cursor-pointer transition-all"
          >
            Return to PropRush Lobby
          </button>
        </div>
      </div>
    </div>
  );
};
