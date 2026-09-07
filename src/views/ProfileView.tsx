import React, { useState } from 'react';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import { useClerkConfig, useSafeClerkUser, useSafeClerk } from '../context/ClerkIntegration';
import { BADGES_LIST, LEAGUE_TIERS_INFO, STORE_ITEMS } from '../data/storeData';
import { AvatarCharacter } from '../components/AvatarCharacter';
import { DiceFaceMini } from '../components/DiceFaceMini';
import { LeagueTier } from '../types/user';
import { sounds } from '../utils/audio';

export const ProfileView: React.FC = () => {
  const { user, updateUsername, claimDailyReward, lastDailyClaim, equipItem, isLoggedIn, openAuthModal, logoutUser } = useUser();
  const { isLight } = useTheme();
  const { isClerkAvailable } = useClerkConfig();
  const { isLoaded: isClerkLoaded, isSignedIn: isClerkSignedIn, user: clerkUser } = useSafeClerkUser();
  const clerk = useSafeClerk();

  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(user.username);
  const [dailyClaimMsg, setDailyClaimMsg] = useState<string | null>(null);

  const effectiveIsLoggedIn = isLoggedIn || (isClerkAvailable && isClerkLoaded && !!isClerkSignedIn);
  const effectiveUsername = (isClerkSignedIn && (clerkUser?.fullName || clerkUser?.username || clerkUser?.firstName)) || user.username;
  const effectiveProfilePic = (isClerkSignedIn && clerkUser?.imageUrl) || user.profilePictureUrl;
  const effectiveEmail = (isClerkSignedIn && clerkUser?.primaryEmailAddress?.emailAddress) || user.email;

  const tierInfo = LEAGUE_TIERS_INFO[user.leagueTier];
  const winRate = user.stats.gamesPlayed > 0 
    ? Math.round((user.stats.gamesWon / user.stats.gamesPlayed) * 100) 
    : 0;

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempName.trim()) {
      updateUsername(tempName.trim());
      setIsEditingName(false);
    }
  };

  const handleSignOut = async () => {
    sounds.playClick();
    if (isClerkAvailable && clerk) {
      try {
        await clerk.signOut();
      } catch (e) {
        console.error('Clerk sign out error', e);
      }
    }
    logoutUser();
  };

  const handleClaimDaily = () => {
    const coins = claimDailyReward();
    if (coins) {
      setDailyClaimMsg(`+${coins} Coins Claimed!`);
      setTimeout(() => setDailyClaimMsg(null), 3000);
    } else {
      alert('You have already claimed your daily reward today. Come back tomorrow!');
    }
  };

  const canClaimToday = lastDailyClaim !== new Date().toDateString();

  return (
    <div className="w-full max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-8 animate-fade-in flex flex-col gap-6">
      {/* Top Banner: Avatar, Username, Level & Daily Reward */}
      <div className={`p-4 sm:p-6 rounded-3xl border shadow-lg flex flex-col md:flex-row items-center justify-between gap-6 ${
        isLight ? 'bg-white border-slate-200' : 'bg-[#19142b] border-[#2b2447]'
      }`}>
        <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left w-full md:w-auto">
          {/* Avatar with Frame */}
          <div className="relative shrink-0">
            <AvatarCharacter
              avatarId={user.avatar}
              frameId={user.avatarFrame}
              profilePictureUrl={effectiveProfilePic}
              size="xl"
            />
            <div className={`absolute -bottom-2 -right-2 px-2.5 py-0.5 rounded-full bg-[#7059e2] text-white font-mono-code font-black text-xs border-2 shadow-md z-30 ${
              isLight ? 'border-white' : 'border-[#19142b]'
            }`}>
              LV {user.level}
            </div>
          </div>

          {/* Name & Title */}
          <div className="flex-1 min-w-0">
            {isEditingName ? (
              <form onSubmit={handleSaveName} className="flex items-center gap-2 justify-center sm:justify-start">
                <input
                  type="text"
                  value={tempName}
                  onChange={e => setTempName(e.target.value)}
                  className={`px-3 py-1.5 rounded-xl border text-base font-bold focus:outline-none ${
                    isLight ? 'bg-slate-50 border-[#7059e2] text-slate-900' : 'bg-slate-900 border-[#7059e2] text-white'
                  }`}
                  autoFocus
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white cursor-pointer"
                >
                  Save
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <h1 className={`font-heading font-black text-xl sm:text-3xl truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  {effectiveUsername}
                </h1>
                <button
                  onClick={() => setIsEditingName(true)}
                  className={`text-xs cursor-pointer p-1 ${isLight ? 'text-slate-500 hover:text-slate-800' : 'text-slate-400 hover:text-white'}`}
                  title="Edit Username"
                >
                  ✏️
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 mt-1 justify-center sm:justify-start">
              <span className={`text-xs font-semibold ${isLight ? 'text-purple-700' : 'text-[#8e76f7]'}`}>{user.title}</span>
              <span className="text-xs text-slate-400">•</span>
              <span className={`text-xs font-mono-code ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>{effectiveEmail}</span>
              {effectiveIsLoggedIn ? (
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono-code font-bold flex items-center gap-1 border ${
                  isLight ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                }`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Google Verified
                </span>
              ) : (
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono-code font-bold flex items-center gap-1 border ${
                  isLight ? 'bg-amber-50 text-amber-800 border-amber-300' : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                }`}>
                  Guest Account
                </span>
              )}
            </div>

            {/* Level XP Bar */}
            <div className="mt-3 w-full max-w-[240px] sm:max-w-xs mx-auto sm:mx-0">
              <div className={`flex justify-between text-[10px] font-mono-code mb-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                <span>XP Progress</span>
                <span>{user.xp} / {user.maxXp} XP</span>
              </div>
              <div className={`w-full h-2 rounded-full overflow-hidden border ${isLight ? 'bg-slate-200 border-slate-300' : 'bg-slate-900 border-slate-800'}`}>
                <div
                  className="h-full bg-gradient-to-r from-[#7059e2] to-[#38bdf8] transition-all"
                  style={{ width: `${Math.min(100, (user.xp / user.maxXp) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Daily Reward Claim Card & Auth Actions */}
        <div className="flex flex-col sm:flex-row md:flex-col items-center md:items-end gap-3 text-center sm:text-right w-full md:w-auto">
          <div className={`p-4 rounded-2xl border flex flex-col items-center gap-2 shadow-sm w-full sm:w-auto ${
            isLight ? 'bg-amber-50/60 border-amber-300' : 'bg-[#221b38] border-amber-500/30'
          }`}>
            <div className={`text-xs font-bold flex items-center gap-1.5 ${isLight ? 'text-amber-800' : 'text-amber-300'}`}>
              <span>🎁</span> Daily Tycoon Bonus
            </div>
            <button
              onClick={handleClaimDaily}
              disabled={!canClaimToday}
              className={`w-full px-5 py-2 rounded-xl font-heading font-bold text-xs transition-all cursor-pointer ${
                canClaimToday
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 shadow-md animate-pulse'
                  : isLight
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              {canClaimToday ? 'Claim 15 Coins 🪙' : 'Claimed Today ✓'}
            </button>
            {dailyClaimMsg && (
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 animate-bounce">{dailyClaimMsg}</span>
            )}
          </div>

          {/* Account Authentication Control */}
          {!effectiveIsLoggedIn ? (
            <button
              onClick={() => openAuthModal('Sign in with Google or Clerk to protect your balance and items.')}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-[#7059e2] to-[#8e76f7] hover:from-[#6047d8] hover:to-[#7d64f0] text-white font-heading font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span>⚡</span>
              <span>Sign In with Google</span>
            </button>
          ) : (
            <button
              onClick={handleSignOut}
              className={`w-full sm:w-auto px-4 py-1.5 rounded-xl border font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                isLight
                  ? 'bg-slate-100 hover:bg-rose-50 border-slate-300 hover:border-rose-300 text-slate-600 hover:text-rose-700'
                  : 'bg-slate-900/80 hover:bg-rose-950/60 border-slate-800 hover:border-rose-500/40 text-slate-400 hover:text-rose-300'
              }`}
            >
              <span>🚪</span>
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </div>

      {/* Locker: Customization for Appearances and Avatar Frames */}
      <div className={`p-4 sm:p-6 rounded-3xl border shadow-lg flex flex-col gap-5 ${
        isLight ? 'bg-white border-slate-200' : 'bg-[#19142b] border-[#2b2447]'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className={`font-heading font-black text-lg sm:text-xl flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
              <span>🎭</span> Player Locker & Wardrobe
            </h2>
            <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              Equip your unlocked skins and glowing avatar frames
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {/* Avatar Skins Locker */}
          <div className={`p-4 rounded-2xl border space-y-3 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#141024] border-slate-800'
          }`}>
            <div className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
              Unlocked Appearances ({user.inventory.appearances.length})
            </div>
            <div className="flex flex-wrap gap-2.5 sm:gap-3">
              {user.inventory.appearances.map(skinId => {
                const isCurrent = user.avatar === skinId;
                return (
                  <button
                    key={skinId}
                    onClick={() => equipItem('appearance', skinId)}
                    className={`p-2 rounded-2xl border transition-all flex flex-col items-center gap-1 cursor-pointer ${
                      isCurrent
                        ? isLight
                          ? 'border-[#7059e2] bg-purple-100 ring-2 ring-[#7059e2]'
                          : 'border-[#7059e2] bg-[#7059e2]/20 ring-2 ring-[#7059e2]'
                        : isLight
                        ? 'border-slate-200 bg-white hover:border-slate-300'
                        : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                    }`}
                  >
                    <AvatarCharacter avatarId={skinId} size="md" />
                    <span className={`text-[10px] font-bold capitalize ${isLight ? 'text-slate-800' : 'text-slate-300'}`}>{skinId}</span>
                    <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.2 rounded ${
                      isCurrent ? 'bg-[#7059e2] text-white' : 'text-slate-400'
                    }`}>
                      {isCurrent ? 'Equipped' : 'Equip'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Avatar Frames Locker */}
          <div className={`p-4 rounded-2xl border space-y-3 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#141024] border-slate-800'
          }`}>
            <div className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
              Unlocked Frames ({user.inventory.profilePictures.length})
            </div>
            <div className="flex flex-wrap gap-2.5 sm:gap-3">
              {/* No Frame Option */}
              <button
                onClick={() => equipItem('profile_pictures', 'none')}
                className={`p-2 rounded-2xl border transition-all flex flex-col items-center gap-1 cursor-pointer ${
                  !user.avatarFrame || user.avatarFrame === 'none'
                    ? isLight
                      ? 'border-[#7059e2] bg-purple-100 ring-2 ring-[#7059e2]'
                      : 'border-[#7059e2] bg-[#7059e2]/20 ring-2 ring-[#7059e2]'
                    : isLight
                    ? 'border-slate-200 bg-white hover:border-slate-300'
                    : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                }`}
              >
                <div className={`w-12 h-12 rounded-full border border-dashed flex items-center justify-center text-xs ${
                  isLight ? 'border-slate-300 text-slate-400' : 'border-slate-700 text-slate-500'
                }`}>
                  None
                </div>
                <span className={`text-[10px] font-bold ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Default</span>
                <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.2 rounded ${
                  !user.avatarFrame || user.avatarFrame === 'none' ? 'bg-[#7059e2] text-white' : 'text-slate-400'
                }`}>
                  {!user.avatarFrame || user.avatarFrame === 'none' ? 'Equipped' : 'Select'}
                </span>
              </button>

              {user.inventory.profilePictures.map(frameId => {
                const isCurrent = user.avatarFrame === frameId;
                const frameItem = STORE_ITEMS.find(i => i.id === frameId);

                return (
                  <button
                    key={frameId}
                    onClick={() => equipItem('profile_pictures', frameId)}
                    className={`p-2 rounded-2xl border transition-all flex flex-col items-center gap-1 cursor-pointer ${
                      isCurrent
                        ? isLight
                          ? 'border-[#7059e2] bg-purple-100 ring-2 ring-[#7059e2]'
                          : 'border-[#7059e2] bg-[#7059e2]/20 ring-2 ring-[#7059e2]'
                        : isLight
                        ? 'border-slate-200 bg-white hover:border-slate-300'
                        : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                    }`}
                  >
                    <AvatarCharacter avatarId={user.avatar} frameId={frameId} size="md" />
                    <span className={`text-[10px] font-bold truncate max-w-[70px] ${isLight ? 'text-slate-800' : 'text-slate-300'}`}>
                      {frameItem?.name.replace(' Frame', '') || frameId}
                    </span>
                    <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.2 rounded ${
                      isCurrent ? 'bg-[#7059e2] text-white' : 'text-slate-400'
                    }`}>
                      {isCurrent ? 'Equipped' : 'Equip'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dice Skins Locker */}
          <div className={`p-4 rounded-2xl border space-y-3 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#141024] border-slate-800'
          }`}>
            <div className="text-xs font-bold uppercase tracking-wider flex items-center justify-between">
              <span className={isLight ? 'text-slate-700' : 'text-slate-300'}>Unlocked Dice Skins ({(user.inventory.diceSkins || []).length})</span>
              <span className={`text-[10px] font-mono-code ${isLight ? 'text-purple-700' : 'text-purple-300'}`}>
                Equipped: {(user.diceSkin || 'Standard').replace('dice_', '').replace('_', ' ')}
              </span>
            </div>
            <div className="flex flex-wrap gap-2.5 sm:gap-3">
              {(user.inventory.diceSkins || ['dice_golden', 'dice_neon']).map(diceId => {
                const isCurrent = user.diceSkin === diceId;
                const diceItem = STORE_ITEMS.find(i => i.id === diceId);
                return (
                  <button
                    key={diceId}
                    onClick={() => equipItem('dice_skins', diceId)}
                    className={`p-3 rounded-2xl border transition-all flex flex-col items-center gap-2 cursor-pointer ${
                      isCurrent
                        ? isLight
                          ? 'border-[#7059e2] bg-purple-100 ring-2 ring-[#7059e2] shadow-sm'
                          : 'border-[#7059e2] bg-[#7059e2]/25 ring-2 ring-[#7059e2] shadow-[0_0_15px_rgba(112,89,226,0.4)]'
                        : isLight
                        ? 'border-slate-200 bg-white hover:border-slate-300'
                        : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                    }`}
                  >
                    <DiceFaceMini skinId={diceId} size="md" pips={5} />
                    <span className={`text-[10px] font-bold truncate max-w-[85px] text-center ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                      {diceItem?.name.replace(' Dice', '') || diceId.replace('dice_', '')}
                    </span>
                    <span className={`text-[8px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                      isCurrent ? 'bg-[#7059e2] text-white shadow-sm' : isLight ? 'bg-slate-200 text-slate-600' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {isCurrent ? 'Equipped ✓' : 'Equip'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Map Themes Locker */}
          <div className={`p-4 rounded-2xl border space-y-3 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#141024] border-slate-800'
          }`}>
            <div className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
              Unlocked Maps ({(user.inventory.maps || []).length})
            </div>
            <div className="flex flex-wrap gap-2.5 sm:gap-3">
              {(user.inventory.maps || ['map_classic']).map(mapId => {
                const isCurrent = user.mapSkin === mapId;
                const mapItem = STORE_ITEMS.find(i => i.id === mapId);
                return (
                  <button
                    key={mapId}
                    onClick={() => equipItem('maps', mapId)}
                    className={`p-2.5 rounded-2xl border transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
                      isCurrent
                        ? isLight
                          ? 'border-[#7059e2] bg-purple-100 ring-2 ring-[#7059e2]'
                          : 'border-[#7059e2] bg-[#7059e2]/20 ring-2 ring-[#7059e2]'
                        : isLight
                        ? 'border-slate-200 bg-white hover:border-slate-300'
                        : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${
                      isLight ? 'bg-slate-200' : 'bg-slate-800'
                    }`}>
                      {mapItem?.emoji || '🗺️'}
                    </div>
                    <span className={`text-[10px] font-bold truncate max-w-[80px] ${isLight ? 'text-slate-800' : 'text-slate-300'}`}>
                      {mapItem?.name || mapId}
                    </span>
                    <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.2 rounded ${
                      isCurrent ? 'bg-[#7059e2] text-white' : 'text-slate-400'
                    }`}>
                      {isCurrent ? 'Equipped' : 'Equip'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Competitive League Tier Progress */}
      <div className={`p-4 sm:p-6 rounded-3xl border shadow-lg flex flex-col gap-4 ${
        isLight ? 'bg-white border-slate-200' : 'bg-[#19142b] border-[#2b2447]'
      }`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <h2 className={`font-heading font-black text-lg sm:text-xl flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
              <span>{tierInfo.icon}</span>
              <span>{user.leagueTier} League Tier</span>
            </h2>
            <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              Compete in ranked rooms to earn League Points (LP) and promote to higher divisions
            </p>
          </div>
          <div className={`px-4 py-1.5 rounded-xl border font-mono-code font-bold text-sm ${
            isLight ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-slate-900 border-slate-700 text-amber-300'
          }`}>
            {user.leaguePoints} LP
          </div>
        </div>

        {/* Tier Range Steps */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 pt-2">
          {(['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master', 'Tycoon'] as LeagueTier[]).map(tier => {
            const info = LEAGUE_TIERS_INFO[tier];
            const isCurrent = user.leagueTier === tier;
            const isPassed = user.leaguePoints >= info.minLp;

            return (
              <div
                key={tier}
                className={`p-3 rounded-xl border text-center transition-all ${
                  isCurrent
                    ? `${info.badge} scale-105 shadow-md`
                    : isPassed
                    ? isLight
                      ? 'bg-slate-50 border-slate-200 text-slate-700'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300'
                    : isLight
                    ? 'bg-slate-100 border-slate-200 text-slate-400 opacity-60'
                    : 'bg-slate-950/40 border-slate-900/80 text-slate-600 opacity-60'
                }`}
              >
                <div className="text-2xl mb-1">{info.icon}</div>
                <div className="font-heading font-bold text-xs">{tier}</div>
                <div className="text-[10px] font-mono-code mt-0.5 opacity-80">
                  {info.minLp}+ LP
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats Matrix */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className={`p-4 rounded-2xl border text-center ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#19142b] border-slate-800'
        }`}>
          <div className={`text-[10px] uppercase font-bold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Games Played</div>
          <div className={`font-mono-code font-black text-2xl mt-1 ${isLight ? 'text-slate-900' : 'text-white'}`}>
            {user.stats.gamesPlayed}
          </div>
        </div>
        <div className={`p-4 rounded-2xl border text-center ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#19142b] border-slate-800'
        }`}>
          <div className={`text-[10px] uppercase font-bold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Win Rate</div>
          <div className="font-mono-code font-black text-2xl text-emerald-600 dark:text-emerald-400 mt-1">
            {winRate}% ({user.stats.gamesWon}W)
          </div>
        </div>
        <div className={`p-4 rounded-2xl border text-center ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#19142b] border-slate-800'
        }`}>
          <div className={`text-[10px] uppercase font-bold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Net Wager Profits</div>
          <div className="font-mono-code font-black text-2xl text-emerald-600 dark:text-emerald-300 mt-1">
            +${user.stats.totalEarningsUsd.toFixed(2)}
          </div>
        </div>
        <div className={`p-4 rounded-2xl border text-center ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#19142b] border-slate-800'
        }`}>
          <div className={`text-[10px] uppercase font-bold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Best Win Streak</div>
          <div className="font-mono-code font-black text-2xl text-amber-600 dark:text-amber-300 mt-1 flex items-center justify-center gap-1">
            <span>🔥</span> {user.stats.bestWinStreak}
          </div>
        </div>
      </div>

      {/* Badges Showcase */}
      <div className={`p-4 sm:p-6 rounded-3xl border shadow-lg flex flex-col gap-4 ${
        isLight ? 'bg-white border-slate-200' : 'bg-[#19142b] border-[#2b2447]'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className={`font-heading font-black text-lg sm:text-xl ${isLight ? 'text-slate-900' : 'text-white'}`}>
              Badges & Achievements
            </h2>
            <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              Unlock special accolades by ruling games and completing milestones
            </p>
          </div>
          <div className={`text-xs font-mono-code font-bold ${isLight ? 'text-amber-800' : 'text-amber-300'}`}>
            {user.badges.length} / {BADGES_LIST.length} Unlocked
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {BADGES_LIST.map(badge => {
            const unlocked = user.badges.some(b => b.id === badge.id);

            return (
              <div
                key={badge.id}
                className={`p-3.5 rounded-2xl border transition-all flex items-start gap-3 ${
                  unlocked
                    ? isLight
                      ? 'bg-amber-50/50 border-amber-300 shadow-xs'
                      : 'bg-[#221b38] border-amber-400/40 shadow-md'
                    : isLight
                    ? 'bg-slate-100 border-slate-200 text-slate-400 opacity-60'
                    : 'bg-slate-950/40 border-slate-900 text-slate-600 opacity-50'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 ${
                  unlocked
                    ? isLight ? 'bg-amber-100 border border-amber-300' : 'bg-amber-500/20 border border-amber-400/50'
                    : isLight ? 'bg-slate-200 border border-slate-300' : 'bg-slate-900 border border-slate-800'
                }`}>
                  {badge.icon}
                </div>
                <div>
                  <div className={`font-heading font-bold text-xs ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    {badge.name}
                  </div>
                  <p className={`text-[10px] mt-0.5 leading-snug ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                    {badge.description}
                  </p>
                  <div className="mt-1">
                    {unlocked ? (
                      <span className="text-[9px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase">
                        ✓ Unlocked
                      </span>
                    ) : (
                      <span className="text-[9px] text-slate-400 uppercase">
                        Locked
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Match History Table */}
      <div className={`p-4 sm:p-6 rounded-3xl border shadow-lg flex flex-col gap-4 ${
        isLight ? 'bg-white border-slate-200' : 'bg-[#19142b] border-[#2b2447]'
      }`}>
        <h2 className={`font-heading font-black text-lg sm:text-xl ${isLight ? 'text-slate-900' : 'text-white'}`}>
          Recent Match History
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[500px]">
            <thead>
              <tr className={`border-b font-bold uppercase text-[10px] ${isLight ? 'border-slate-200 text-slate-500' : 'border-slate-800 text-slate-400'}`}>
                <th className="pb-3">Room / Match</th>
                <th className="pb-3">Placement</th>
                <th className="pb-3">Wager / Payout</th>
                <th className="pb-3">Final Net Worth</th>
                <th className="pb-3">LP Change</th>
                <th className="pb-3 text-right">Date</th>
              </tr>
            </thead>
            <tbody className={`divide-y font-medium ${isLight ? 'divide-slate-200' : 'divide-slate-800/60'}`}>
              {user.matchHistory.map(match => (
                <tr key={match.id} className={`transition-colors ${isLight ? 'hover:bg-slate-50' : 'hover:bg-slate-900/40'}`}>
                  <td className={`py-3 font-bold ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>
                    {match.roomName}
                  </td>
                  <td className="py-3">
                    <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                      match.placement === 1
                        ? isLight
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                        : match.placement === 2
                        ? isLight
                          ? 'bg-slate-200 text-slate-700'
                          : 'bg-slate-700/40 text-slate-300'
                        : isLight
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-rose-950/40 text-rose-300'
                    }`}>
                      #{match.placement} of {match.totalPlayers}
                    </span>
                  </td>
                  <td className="py-3 font-mono-code font-bold">
                    {match.betAmount > 0 ? (
                      <span className={match.payout > 0 ? 'text-emerald-600 dark:text-emerald-400' : isLight ? 'text-slate-600' : 'text-slate-400'}>
                        ${match.betAmount} bet → ${match.payout}
                      </span>
                    ) : (
                      <span className={isLight ? 'text-slate-400' : 'text-slate-500'}>Casual (Free)</span>
                    )}
                  </td>
                  <td className={`py-3 font-mono-code ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                    ${match.netWorth}
                  </td>
                  <td className="py-3 font-mono-code font-bold">
                    <span className={match.lpChange >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                      {match.lpChange >= 0 ? `+${match.lpChange}` : match.lpChange} LP
                    </span>
                  </td>
                  <td className={`py-3 text-right ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                    {match.date}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
