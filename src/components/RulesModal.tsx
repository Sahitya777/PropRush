import React from 'react';
import { useTheme } from '../context/ThemeContext';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
  const { isLight } = useTheme();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className={`w-full max-w-xl border-2 rounded-3xl shadow-2xl p-4 sm:p-6 flex flex-col gap-4 max-h-[85vh] overflow-y-auto ${
        isLight ? 'bg-white border-[#7059e2] text-slate-800' : 'bg-[#181329] border-[#7059e2] text-white'
      }`}>
        <div className={`flex items-center justify-between border-b pb-3 ${
          isLight ? 'border-slate-200' : 'border-slate-800'
        }`}>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎲</span>
            <div>
              <h2 className={`font-heading font-black text-base sm:text-lg ${isLight ? 'text-slate-900' : 'text-white'}`}>
                HOW TO PLAY PROPRUSH
              </h2>
              <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Fast-paced digital real estate monopoly</p>
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

        <div className={`space-y-3.5 text-xs ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
          {/* Section 1 */}
          <div className={`p-3.5 rounded-2xl border space-y-1.5 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/70 border-slate-800'
          }`}>
            <h4 className="font-bold text-sm flex items-center gap-2 text-[#7059e2]">
              <span>1.</span> Objective & Gameplay
            </h4>
            <p className="leading-relaxed">
              Roll the dice, traverse the 40-tile board, acquire properties, build houses and hotels, and bankrupt all opposing players through hefty rental collections!
            </p>
          </div>

          {/* Section 2 */}
          <div className={`p-3.5 rounded-2xl border space-y-1.5 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/70 border-slate-800'
          }`}>
            <h4 className={`font-bold text-sm flex items-center gap-2 ${isLight ? 'text-amber-700' : 'text-amber-300'}`}>
              <span>2.</span> Rolling & Doubles
            </h4>
            <p className="leading-relaxed">
              If you roll <strong>doubles</strong> (matching dice values), you get an immediate free bonus roll! However, rolling doubles 3 times in a single turn will send you straight to Prison for speeding.
            </p>
          </div>

          {/* Section 3 */}
          <div className={`p-3.5 rounded-2xl border space-y-1.5 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/70 border-slate-800'
          }`}>
            <h4 className={`font-bold text-sm flex items-center gap-2 ${isLight ? 'text-rose-700' : 'text-rose-300'}`}>
              <span>3.</span> Prison & Bail
            </h4>
            <p className="leading-relaxed">
              While in prison, you cannot collect rent until you escape. Escape by rolling doubles, paying $50 bail, or using a "Get Out of Jail Free" card.
            </p>
          </div>

          {/* Section 4 */}
          <div className={`p-3.5 rounded-2xl border space-y-1.5 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/70 border-slate-800'
          }`}>
            <h4 className={`font-bold text-sm flex items-center gap-2 ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
              <span>4.</span> Auctions & Trading
            </h4>
            <p className="leading-relaxed">
              If a player lands on an unowned property and declines to purchase it, the property goes to a <strong>live speed auction</strong> starting at $10. Any player can bid! You can also trade properties and cash with players anytime during your turn.
            </p>
          </div>

          {/* Section 5 */}
          <div className={`p-3.5 rounded-2xl border space-y-1.5 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/70 border-slate-800'
          }`}>
            <h4 className={`font-bold text-sm flex items-center gap-2 ${isLight ? 'text-yellow-700' : 'text-yellow-400'}`}>
              <span>5.</span> Vacation / Resort Jackpot
            </h4>
            <p className="leading-relaxed">
              All taxes, luxury fees, and jail fines paid during the game accumulate in the <strong>Resort Jackpot</strong>. The first player to land on Vacation scoops the entire cash pool!
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-[#7059e2] hover:bg-[#5f45d8] text-white font-bold text-xs cursor-pointer shadow-lg mt-2 transition-all active:scale-98"
        >
          Got it, Let's Play!
        </button>
      </div>
    </div>
  );
};
