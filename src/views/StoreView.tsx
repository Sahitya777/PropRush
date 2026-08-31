import React, { useState } from 'react';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import { STORE_ITEMS } from '../data/storeData';
import { AvatarCharacter } from '../components/AvatarCharacter';
import { DiceFaceMini } from '../components/DiceFaceMini';
import { StoreItem } from '../types/user';
import { sounds } from '../utils/audio';

export const StoreView: React.FC = () => {
  const { user, buyStoreItem, buyCoinPack, equipItem, isLoggedIn, openAuthModal } = useUser();
  const { isLight } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [buySuccessMsg, setBuySuccessMsg] = useState<string | null>(null);
  const [buyErrorMsg, setBuyErrorMsg] = useState<string | null>(null);

  const categories = [
    { id: 'all', label: 'All Items', icon: '🏠' },
    { id: 'appearance', label: 'Player Appearance', icon: '👤' },
    { id: 'profile_pictures', label: 'Avatar Frames & FX', icon: '✨' },
    { id: 'maps', label: 'Board Maps', icon: '🗺️' },
    { id: 'upgrades', label: 'Dice Skins & FX', icon: '🎲' },
    { id: 'coins', label: 'PropRush Coins', icon: '🪙' }
  ];

  const filteredItems = STORE_ITEMS.filter(
    item => selectedCategory === 'all' || item.category === selectedCategory
  );

  const isOwned = (item: StoreItem): boolean => {
    if (item.category === 'appearance') return user.inventory.appearances.includes(item.id);
    if (item.category === 'maps') return user.inventory.maps.includes(item.id);
    if (item.category === 'upgrades') return user.inventory.diceSkins.includes(item.id);
    if (item.category === 'profile_pictures') return user.inventory.profilePictures.includes(item.id);
    return false;
  };

  const isEquipped = (item: StoreItem): boolean => {
    if (item.category === 'appearance') return user.avatar === item.id;
    if (item.category === 'profile_pictures') return user.avatarFrame === item.id;
    if (item.category === 'upgrades') return user.diceSkin === item.id;
    if (item.category === 'maps') return user.mapSkin === item.id;
    return false;
  };

  const handlePurchaseItem = (item: StoreItem) => {
    if (!isLoggedIn) {
      openAuthModal('Sign in with Google or Clerk to purchase and equip custom cosmetics.');
      return;
    }

    if (user.coins < item.priceCoins) {
      sounds.playPayRent();
      setBuyErrorMsg(`You need ${item.priceCoins - user.coins} more PropRush Coins! Buy coin packs below or win PropRush matches.`);
      setTimeout(() => setBuyErrorMsg(null), 4000);
      return;
    }

    const ok = buyStoreItem(item.id, item.category, item.priceCoins);
    if (ok) {
      setBuySuccessMsg(`🎉 Successfully purchased & unlocked ${item.name}!`);
      setTimeout(() => setBuySuccessMsg(null), 3000);
    }
  };

  const handleBuyCoins = (pack: { id: string; name: string; coins: number; priceUsd: number }) => {
    if (!isLoggedIn) {
      openAuthModal('Sign in with Google or Clerk to purchase PropRush Coins with real balance.');
      return;
    }

    if (user.walletBalance < pack.priceUsd) {
      sounds.playPayRent();
      setBuyErrorMsg(`Insufficient wallet balance ($${user.walletBalance.toFixed(2)} available). You need $${pack.priceUsd.toFixed(2)} to buy ${pack.name}. Please deposit funds.`);
      setTimeout(() => setBuyErrorMsg(null), 4500);
      return;
    }

    const ok = buyCoinPack(pack.coins, pack.priceUsd);
    if (ok) {
      setBuySuccessMsg(`💰 Successfully bought +${pack.coins} PropRush Coins! $${pack.priceUsd.toFixed(2)} deducted from your account.`);
      setTimeout(() => setBuySuccessMsg(null), 4000);
    }
  };

  const coinPacks = [
    { id: 'coins_100', name: 'Pouch of Coins', coins: 100, priceUsd: 1.99, icon: '🪙' },
    { id: 'coins_350', name: 'Tycoon Chest', coins: 350, priceUsd: 4.99, icon: '💰', popular: true },
    { id: 'coins_1000', name: 'Mogul Vault', coins: 1000, priceUsd: 11.99, icon: '👑' }
  ];

  const getRarityBadge = (rarity?: string) => {
    switch (rarity) {
      case 'legendary':
        return isLight
          ? 'bg-amber-100 text-amber-800 border-amber-300'
          : 'bg-amber-500/20 text-amber-300 border-amber-500/50';
      case 'epic':
        return isLight
          ? 'bg-purple-100 text-purple-800 border-purple-300'
          : 'bg-purple-500/20 text-purple-300 border-purple-500/50';
      case 'rare':
        return isLight
          ? 'bg-blue-100 text-blue-800 border-blue-300'
          : 'bg-blue-500/20 text-blue-300 border-blue-500/50';
      default:
        return isLight
          ? 'bg-slate-200 text-slate-700 border-slate-300'
          : 'bg-slate-700/40 text-slate-300 border-slate-600/50';
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8 animate-fade-in flex flex-col gap-6">
      {/* Title & Live Balances */}
      <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4 ${
        isLight ? 'border-slate-200' : 'border-[#2b2447]'
      }`}>
        <div>
          <h1 className={`font-heading font-black text-2xl sm:text-4xl ${isLight ? 'text-slate-900' : 'text-white'}`}>
            PropRush Store
          </h1>
          <p className={`text-xs sm:text-sm mt-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            Unlock exclusive characters, animated Discord Nitro-style avatar frames, dice skins, and board maps
          </p>
        </div>

        {/* Current Balances Badges */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
          {/* USD Wallet Balance */}
          <div className={`flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-2xl border font-mono-code font-bold text-xs sm:text-base shadow-sm ${
            isLight
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : 'bg-[#131d2e] border-emerald-500/40 text-emerald-300'
          }`}>
            <span>💵</span>
            <span>${user.walletBalance.toFixed(2)}</span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400/80 font-normal uppercase hidden sm:inline">Wallet</span>
          </div>

          {/* PropRush Coins */}
          <div className={`flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-2xl border font-mono-code font-bold text-xs sm:text-base shadow-sm ${
            isLight
              ? 'bg-amber-50 border-amber-300 text-amber-800'
              : 'bg-[#1c1630] border-amber-500/40 text-amber-300'
          }`}>
            <span className="text-base sm:text-lg">🪙</span>
            <span>{user.coins} Coins</span>
          </div>
        </div>
      </div>

      {/* Guest Mode Banner */}
      {!isLoggedIn && (
        <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md ${
          isLight
            ? 'bg-indigo-50 border-indigo-200 text-slate-800'
            : 'bg-gradient-to-r from-[#7059e2]/25 via-[#221a42] to-[#7059e2]/25 border-[#7059e2]/60'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center text-xl shrink-0 ${
              isLight ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'bg-[#7059e2]/30 border-[#7059e2]/50 text-white'
            }`}>
              🔐
            </div>
            <div>
              <div className={`font-heading font-extrabold text-sm ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Guest Mode Active
              </div>
              <div className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                Sign in with Google or Clerk to save purchased items, unlock dice skins, and buy coin packs.
              </div>
            </div>
          </div>
          <button
            onClick={() => openAuthModal('Sign in with Google or Clerk to buy coins and equip cosmetics.')}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#7059e2] hover:bg-[#6047d8] text-white font-heading font-bold text-xs shadow-md transition-all cursor-pointer whitespace-nowrap transform active:scale-95"
          >
            ⚡ Sign In with Google
          </button>
        </div>
      )}

      {/* Notifications */}
      {buySuccessMsg && (
        <div className="p-3.5 bg-emerald-500/20 border border-emerald-500/60 rounded-2xl text-emerald-700 dark:text-emerald-300 text-sm font-bold text-center animate-fade-in shadow-lg">
          {buySuccessMsg}
        </div>
      )}

      {buyErrorMsg && (
        <div className="p-3.5 bg-rose-500/20 border border-rose-500/60 rounded-2xl text-rose-700 dark:text-rose-300 text-sm font-bold text-center animate-fade-in shadow-lg">
          ⚠️ {buyErrorMsg}
        </div>
      )}

      {/* Main Layout with Sidebar Categories & Items Grid */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Categories Selector: Dropdown for Mobile, Sidebar List for Desktop */}
        <div className="w-full lg:w-64 shrink-0 flex flex-col gap-2">
          {/* Mobile Category Dropdown Selector (Visible on screens < lg) */}
          <div className="block lg:hidden">
            <label className="text-xs uppercase font-bold text-slate-500 block mb-1.5 tracking-wider">
              Select Category
            </label>
            <div className="relative">
              <select
                id="select-mobile-category"
                value={selectedCategory}
                onChange={e => {
                  sounds.playClick();
                  setSelectedCategory(e.target.value);
                }}
                className={`w-full py-3.5 pl-4 pr-10 rounded-2xl font-bold text-sm appearance-none border shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#7059e2] cursor-pointer ${
                  isLight
                    ? 'bg-white border-slate-300 text-slate-900 shadow-slate-200'
                    : 'bg-[#19142b] border-[#3b2f66] text-white shadow-black/50'
                }`}
              >
                {categories.map(cat => {
                  const count = STORE_ITEMS.filter(i => cat.id === 'all' || i.category === cat.id).length;
                  return (
                    <option key={cat.id} value={cat.id} className={isLight ? 'bg-white text-slate-900' : 'bg-[#19142b] text-white'}>
                      {cat.icon} {cat.label} {cat.id !== 'coins' ? `(${count})` : ''}
                    </option>
                  );
                })}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-slate-400">
                <span className="text-xs">▼</span>
              </div>
            </div>
          </div>

          {/* Desktop Categories Sidebar (Visible on lg+) */}
          <div className="hidden lg:flex flex-col gap-1.5">
            <div className="text-xs uppercase font-bold text-slate-500 px-3 mb-1 tracking-wider">
              Categories
            </div>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => {
                  sounds.playClick();
                  setSelectedCategory(cat.id);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl font-bold text-sm text-left transition-all cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-[#7059e2] text-white shadow-md'
                    : isLight
                    ? 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-xs'
                    : 'bg-[#19142b]/80 hover:bg-[#231c3d] text-slate-300 border border-slate-800/80'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="text-base shrink-0">{cat.icon}</span>
                  <span className="truncate text-xs font-bold leading-tight">{cat.label}</span>
                </div>
                {cat.id !== 'coins' && (
                  <span className="text-[10px] opacity-80 px-2 py-0.5 rounded bg-black/25 font-mono-code font-bold ml-1.5 shrink-0">
                    {STORE_ITEMS.filter(i => cat.id === 'all' || i.category === cat.id).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Equipped Profile Preview Card */}
          <div className={`mt-4 lg:mt-6 p-4 rounded-2xl border text-xs space-y-3 shadow-md ${
            isLight
              ? 'bg-white border-slate-200 text-slate-600'
              : 'bg-[#181329] border-[#2b2447] text-slate-400'
          }`}>
            <div className={`font-bold flex items-center justify-between ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
              <span>Your Loadout</span>
              <span className="text-[10px] text-[#7059e2] font-mono-code uppercase font-bold">Live Preview</span>
            </div>
            <div className="flex items-center gap-4 py-2">
              <AvatarCharacter avatarId={user.avatar} frameId={user.avatarFrame} size="xl" />
              <div className="space-y-1">
                <div className={`font-heading font-black text-base capitalize ${isLight ? 'text-slate-900' : 'text-white'}`}>{user.avatar}</div>
                <div className={`text-[11px] font-mono-code flex items-center gap-1 ${isLight ? 'text-amber-700' : 'text-amber-300'}`}>
                  <span>Frame:</span>
                  <span className="font-bold capitalize">{user.avatarFrame && user.avatarFrame !== 'none' ? user.avatarFrame.replace('pfp_', '').replace('_', ' ') : 'None'}</span>
                </div>
                <div className={`text-[11px] font-mono-code flex items-center gap-1 ${isLight ? 'text-cyan-700' : 'text-cyan-300'}`}>
                  <span>Dice:</span>
                  <span className="font-bold capitalize">{(user.diceSkin || 'Standard').replace('dice_', '')}</span>
                </div>
                <div className={`text-[11px] font-mono-code flex items-center gap-1 ${isLight ? 'text-emerald-700' : 'text-emerald-300'}`}>
                  <span>Map:</span>
                  <span className="font-bold capitalize">{(user.mapSkin || 'Worldwide').replace('_', ' ')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-w-0 space-y-6 w-full">
          {selectedCategory === 'coins' ? (
            /* PropRush Coins Purchase Packs */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className={`font-heading font-black text-xl ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    PropRush Coin Packs
                  </h2>
                  <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                    PropRush Coins are instantly purchased with your USD account balance and credited to your inventory.
                  </p>
                </div>
                <span className={`text-xs font-mono-code font-bold px-3 py-1 rounded-xl border ${
                  isLight
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    : 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400'
                }`}>
                  Balance: ${user.walletBalance.toFixed(2)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {coinPacks.map(pack => (
                  <div
                    key={pack.id}
                    className={`relative p-5 rounded-2xl border flex flex-col items-center text-center gap-3 transition-all ${
                      pack.popular
                        ? isLight
                          ? 'border-amber-400 bg-amber-50/40 shadow-md'
                          : 'border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.25)] bg-[#19142b]'
                        : isLight
                        ? 'bg-white border-slate-200 shadow-sm hover:border-amber-400'
                        : 'bg-[#19142b] border-slate-800 hover:border-amber-400/80'
                    }`}
                  >
                    {pack.popular && (
                      <span className="absolute -top-3 px-3 py-0.5 rounded-full bg-amber-500 text-slate-950 font-extrabold text-[10px] uppercase shadow-md">
                        Most Popular
                      </span>
                    )}
                    <span className="text-4xl my-2">{pack.icon}</span>
                    <h3 className={`font-heading font-bold text-base ${isLight ? 'text-slate-900' : 'text-white'}`}>{pack.name}</h3>
                    <div className={`font-mono-code font-black text-2xl ${isLight ? 'text-amber-700' : 'text-amber-300'}`}>
                      +{pack.coins} Coins
                    </div>
                    <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      Instantly unlocks animated avatar frames, skins, dice, and maps!
                    </p>
                    <button
                      onClick={() => handleBuyCoins(pack)}
                      className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-heading font-bold text-xs cursor-pointer transition-all shadow-md mt-2 active:scale-95 flex items-center justify-center gap-1"
                    >
                      <span>Buy for ${pack.priceUsd.toFixed(2)} USD</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Store Items Grid matching PropRush */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className={`font-heading font-black text-lg sm:text-xl capitalize ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    {selectedCategory === 'all' 
                      ? 'All PropRush Store Items' 
                      : selectedCategory === 'profile_pictures' 
                        ? 'Animated Avatar Frames (Discord Nitro-Style FX)' 
                        : selectedCategory === 'upgrades'
                          ? 'Dice Skins & Roll FX'
                          : selectedCategory === 'maps'
                            ? 'Board Maps & Landscapes'
                            : 'Player Appearances'}
                  </h2>
                  {selectedCategory === 'profile_pictures' && (
                    <p className={`text-xs mt-0.5 font-medium ${isLight ? 'text-purple-700' : 'text-purple-300'}`}>
                      ✨ Premium animated profile frames featuring continuous moving halos, particle loops, and glow effects.
                    </p>
                  )}
                </div>
                <span className={`text-xs font-mono-code ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  {filteredItems.length} items
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {filteredItems.map(item => {
                  const owned = isOwned(item);
                  const equipped = isEquipped(item);

                  return (
                    <div
                      key={item.id}
                      className={`group p-3.5 sm:p-4 rounded-2xl border transition-all flex flex-col items-center text-center justify-between gap-3 ${
                        equipped
                          ? isLight
                            ? 'border-[#7059e2] bg-indigo-50/70 shadow-md ring-1 ring-[#7059e2]'
                            : 'border-[#7059e2] shadow-[0_0_20px_rgba(112,89,226,0.35)] bg-[#1e1738]'
                          : isLight
                          ? 'bg-white border-slate-200 hover:border-[#7059e2] hover:bg-slate-50 shadow-sm'
                          : 'border-[#2b2447] hover:border-[#7059e2]/60 hover:bg-[#1d1733] bg-[#19142b]'
                      }`}
                    >
                      {/* Item Visual Box */}
                      <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl flex items-center justify-center relative overflow-hidden border ${
                        isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#130f24] border-slate-800/80'
                      }`}>
                        {item.category === 'appearance' ? (
                          <AvatarCharacter avatarId={item.id} frameId={user.avatarFrame} size="lg" />
                        ) : item.category === 'profile_pictures' ? (
                          <AvatarCharacter avatarId={user.avatar} frameId={item.id} size="lg" />
                        ) : item.category === 'maps' ? (
                          <div className="flex flex-col items-center">
                            <span className="text-3xl filter drop-shadow">{item.emoji}</span>
                            <span className="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase mt-1">Map Theme</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1">
                            <DiceFaceMini skinId={item.id} size="md" pips={5} />
                            <span className="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase">Dice Skin</span>
                          </div>
                        )}

                        {item.rarity && (
                          <span className={`absolute top-1 left-1 text-[8px] font-black uppercase px-1.5 py-0.2 rounded border ${getRarityBadge(item.rarity)}`}>
                            {item.rarity}
                          </span>
                        )}

                        {item.isPopular && (
                          <span className="absolute top-1 right-1 text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/40">
                            HOT
                          </span>
                        )}
                      </div>

                      {/* Name & Desc */}
                      <div className="w-full">
                        <h4 className={`font-heading font-bold text-xs sm:text-sm truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
                          {item.name}
                        </h4>
                        <p className={`text-[10px] sm:text-[11px] line-clamp-2 mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                          {item.description}
                        </p>
                      </div>

                      {/* Price / Status */}
                      <div className={`w-full flex items-center justify-center gap-1.5 font-mono-code font-bold text-xs sm:text-sm ${
                        isLight ? 'text-amber-700' : 'text-amber-300'
                      }`}>
                        <span>🪙</span>
                        <span>{item.priceCoins} Coins</span>
                      </div>

                      {/* Action Button */}
                      <div className="w-full">
                        {equipped ? (
                          <button
                            onClick={() => {
                              if (item.category === 'profile_pictures') {
                                equipItem('profile_pictures', item.id);
                              } else if (item.category === 'upgrades') {
                                equipItem('upgrades', item.id);
                              } else if (item.category === 'maps') {
                                equipItem('maps', item.id);
                              }
                            }}
                            className={`w-full py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              item.category === 'profile_pictures' || item.category === 'upgrades' || item.category === 'maps'
                                ? isLight
                                  ? 'bg-purple-100 hover:bg-rose-100 border border-purple-300 text-purple-900 hover:text-rose-900'
                                  : 'bg-[#7059e2]/30 hover:bg-rose-900/40 border border-[#7059e2] text-purple-200 hover:text-rose-200'
                                : isLight
                                ? 'bg-purple-100 border border-purple-300 text-purple-900'
                                : 'bg-[#7059e2]/30 border border-[#7059e2] text-purple-200'
                            }`}
                          >
                            {item.category === 'appearance' ? 'Equipped ✓' : 'Equipped (Unequip)'}
                          </button>
                        ) : owned ? (
                          <button
                            onClick={() => {
                              if (item.category === 'appearance') {
                                equipItem('appearance', item.id);
                              } else if (item.category === 'profile_pictures') {
                                equipItem('profile_pictures', item.id);
                              } else if (item.category === 'upgrades') {
                                equipItem('upgrades', item.id);
                              } else if (item.category === 'maps') {
                                equipItem('maps', item.id);
                              }
                            }}
                            className={`w-full py-2 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-sm ${
                              isLight
                                ? 'bg-slate-100 hover:bg-[#7059e2] text-slate-800 hover:text-white border border-slate-300'
                                : 'bg-slate-800 hover:bg-[#7059e2] text-slate-200 hover:text-white'
                            }`}
                          >
                            Equip {item.category === 'profile_pictures' ? 'Frame' : item.category === 'upgrades' ? 'Dice' : item.category === 'maps' ? 'Map' : 'Skin'}
                          </button>
                        ) : (
                          <button
                            onClick={() => handlePurchaseItem(item)}
                            className="w-full py-2 rounded-xl bg-[#7059e2] hover:bg-[#5f45d8] text-xs font-bold text-white cursor-pointer transition-all shadow-md active:scale-95 flex items-center justify-center gap-1"
                          >
                            <span>Buy for {item.priceCoins} Coins</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
