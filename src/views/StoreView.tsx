import React, { useState } from 'react';
import { useUser } from '../context/UserContext';
import { STORE_ITEMS } from '../data/storeData';
import { AvatarCharacter } from '../components/AvatarCharacter';
import { DiceFaceMini } from '../components/DiceFaceMini';
import { StoreItem } from '../types/user';
import { sounds } from '../utils/audio';

export const StoreView: React.FC = () => {
  const { user, buyStoreItem, buyCoinPack, equipItem, isLoggedIn, openAuthModal, requireAuth } = useUser();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [buySuccessMsg, setBuySuccessMsg] = useState<string | null>(null);
  const [buyErrorMsg, setBuyErrorMsg] = useState<string | null>(null);

  const categories = [
    { id: 'all', label: 'All Items', icon: '🏠' },
    { id: 'appearance', label: 'Player Appearance', icon: '👤' },
    { id: 'profile_pictures', label: 'Avatar Frames (Nitro FX)', icon: '✨' },
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
        return 'bg-amber-500/20 text-amber-300 border-amber-500/50';
      case 'epic':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/50';
      case 'rare':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/50';
      default:
        return 'bg-slate-700/40 text-slate-300 border-slate-600/50';
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 sm:py-8 animate-fade-in flex flex-col gap-6">
      {/* Title & Live Balances */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#2b2447] pb-4">
        <div>
          <h1 className="font-heading font-black text-3xl sm:text-4xl text-white">
            PropRush Store
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Unlock exclusive characters, animated Discord Nitro-style avatar frames, dice skins, and board maps
          </p>
        </div>

        {/* Current Balances Badges */}
        <div className="flex items-center gap-3">
          {/* USD Wallet Balance */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#131d2e] border border-emerald-500/40 text-emerald-300 font-mono-code font-bold text-sm sm:text-base shadow-lg">
            <span>💵</span>
            <span>${user.walletBalance.toFixed(2)}</span>
            <span className="text-[10px] text-emerald-400/80 font-normal uppercase hidden sm:inline">Wallet</span>
          </div>

          {/* PropRush Coins */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#1c1630] border border-amber-500/40 text-amber-300 font-mono-code font-bold text-sm sm:text-base shadow-lg">
            <span className="text-lg">🪙</span>
            <span>{user.coins} PropRush Coins</span>
          </div>
        </div>
      </div>

      {/* Guest Mode Banner */}
      {!isLoggedIn && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-[#7059e2]/25 via-[#221a42] to-[#7059e2]/25 border border-[#7059e2]/60 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#7059e2]/30 border border-[#7059e2]/50 flex items-center justify-center text-xl text-white">
              🔐
            </div>
            <div>
              <div className="font-heading font-extrabold text-sm text-white">
                Guest Mode Active
              </div>
              <div className="text-xs text-slate-300">
                Sign in with Google or Clerk to save purchased items, unlock dice skins, and buy coin packs.
              </div>
            </div>
          </div>
          <button
            onClick={() => openAuthModal('Sign in with Google or Clerk to buy coins and equip cosmetics.')}
            className="px-5 py-2 rounded-xl bg-[#7059e2] hover:bg-[#6047d8] text-white font-heading font-bold text-xs shadow-md transition-all cursor-pointer whitespace-nowrap transform active:scale-95"
          >
            ⚡ Sign In with Google
          </button>
        </div>
      )}

      {/* Notifications */}
      {buySuccessMsg && (
        <div className="p-3.5 bg-emerald-500/20 border border-emerald-500/60 rounded-2xl text-emerald-300 text-sm font-bold text-center animate-fade-in shadow-lg">
          {buySuccessMsg}
        </div>
      )}

      {buyErrorMsg && (
        <div className="p-3.5 bg-rose-500/20 border border-rose-500/60 rounded-2xl text-rose-300 text-sm font-bold text-center animate-fade-in shadow-lg">
          ⚠️ {buyErrorMsg}
        </div>
      )}

      {/* Main Layout with Sidebar Categories & Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Categories Sidebar */}
        <div className="md:col-span-1 flex flex-col gap-1.5">
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
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-bold text-sm text-left transition-all cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-[#7059e2] text-white shadow-lg'
                  : 'bg-[#19142b]/80 hover:bg-[#231c3d] text-slate-300 border border-slate-800/80'
              }`}
            >
              <div className="flex items-center gap-3">
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </div>
              {cat.id !== 'coins' && (
                <span className="text-[10px] opacity-70 px-1.5 py-0.5 rounded bg-black/30 font-mono-code">
                  {STORE_ITEMS.filter(i => cat.id === 'all' || i.category === cat.id).length}
                </span>
              )}
            </button>
          ))}

          {/* Equipped Profile Preview Card */}
          <div className="mt-6 p-4 rounded-2xl bg-[#181329] border border-[#2b2447] text-xs text-slate-400 space-y-3 shadow-xl">
            <div className="font-bold text-slate-200 flex items-center justify-between">
              <span>Your Character Loadout</span>
              <span className="text-[10px] text-[#8e76f7] font-mono-code uppercase">Live Preview</span>
            </div>
            <div className="flex items-center gap-4 py-2">
              <AvatarCharacter avatarId={user.avatar} frameId={user.avatarFrame} size="xl" />
              <div className="space-y-1">
                <div className="font-heading font-black text-base text-white capitalize">{user.avatar}</div>
                <div className="text-[11px] text-amber-300 font-mono-code flex items-center gap-1">
                  <span>Frame:</span>
                  <span className="font-bold capitalize">{user.avatarFrame && user.avatarFrame !== 'none' ? user.avatarFrame.replace('pfp_', '').replace('_', ' ') : 'None'}</span>
                </div>
                <div className="text-[11px] text-cyan-300 font-mono-code flex items-center gap-1">
                  <span>Dice:</span>
                  <span className="font-bold capitalize">{(user.diceSkin || 'Standard').replace('dice_', '')}</span>
                </div>
                <div className="text-[11px] text-emerald-300 font-mono-code flex items-center gap-1">
                  <span>Map:</span>
                  <span className="font-bold capitalize">{(user.mapSkin || 'Worldwide').replace('_', ' ')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="md:col-span-3 space-y-6">
          {selectedCategory === 'coins' ? (
            /* PropRush Coins Purchase Packs */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-heading font-black text-xl text-white">
                    PropRush Coin Packs
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    PropRush Coins are instantly purchased with your USD account balance and credited to your inventory.
                  </p>
                </div>
                <span className="text-xs font-mono-code text-emerald-400 font-bold bg-emerald-950/40 px-3 py-1 rounded-xl border border-emerald-500/30">
                  Balance: ${user.walletBalance.toFixed(2)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {coinPacks.map(pack => (
                  <div
                    key={pack.id}
                    className={`relative p-5 rounded-2xl bg-[#19142b] border ${
                      pack.popular ? 'border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.25)]' : 'border-slate-800'
                    } flex flex-col items-center text-center gap-3 transition-all hover:border-amber-400/80`}
                  >
                    {pack.popular && (
                      <span className="absolute -top-3 px-3 py-0.5 rounded-full bg-amber-500 text-slate-950 font-extrabold text-[10px] uppercase shadow-md">
                        Most Popular
                      </span>
                    )}
                    <span className="text-4xl my-2">{pack.icon}</span>
                    <h3 className="font-heading font-bold text-base text-white">{pack.name}</h3>
                    <div className="font-mono-code font-black text-2xl text-amber-300">
                      +{pack.coins} Coins
                    </div>
                    <p className="text-[11px] text-slate-400">
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
                  <h2 className="font-heading font-black text-xl text-white capitalize">
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
                    <p className="text-xs text-purple-300 mt-0.5 font-medium">
                      ✨ Premium animated profile frames featuring continuous moving halos, particle loops, and glow effects.
                    </p>
                  )}
                </div>
                <span className="text-xs text-slate-400 font-mono-code">
                  {filteredItems.length} items
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredItems.map(item => {
                  const owned = isOwned(item);
                  const equipped = isEquipped(item);

                  return (
                    <div
                      key={item.id}
                      className={`group p-4 rounded-2xl bg-[#19142b] border transition-all flex flex-col items-center text-center justify-between gap-3 ${
                        equipped
                          ? 'border-[#7059e2] shadow-[0_0_20px_rgba(112,89,226,0.35)] bg-[#1e1738]'
                          : 'border-[#2b2447] hover:border-[#7059e2]/60 hover:bg-[#1d1733]'
                      }`}
                    >
                      {/* Item Visual Box */}
                      <div className="w-24 h-24 rounded-2xl bg-[#130f24] flex items-center justify-center relative overflow-hidden border border-slate-800/80">
                        {item.category === 'appearance' ? (
                          <AvatarCharacter avatarId={item.id} frameId={user.avatarFrame} size="lg" />
                        ) : item.category === 'profile_pictures' ? (
                          <AvatarCharacter avatarId={user.avatar} frameId={item.id} size="lg" />
                        ) : item.category === 'maps' ? (
                          <div className="flex flex-col items-center">
                            <span className="text-3xl filter drop-shadow">{item.emoji}</span>
                            <span className="text-[9px] text-slate-400 font-bold uppercase mt-1">Map Theme</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1">
                            <DiceFaceMini skinId={item.id} size="md" pips={5} />
                            <span className="text-[9px] text-slate-400 font-bold uppercase">Dice Skin</span>
                          </div>
                        )}

                        {item.rarity && (
                          <span className={`absolute top-1 left-1 text-[8px] font-black uppercase px-1.5 py-0.2 rounded border ${getRarityBadge(item.rarity)}`}>
                            {item.rarity}
                          </span>
                        )}

                        {item.isPopular && (
                          <span className="absolute top-1 right-1 text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            HOT
                          </span>
                        )}
                      </div>

                      {/* Name & Desc */}
                      <div className="w-full">
                        <h4 className="font-heading font-bold text-sm sm:text-base text-white truncate">
                          {item.name}
                        </h4>
                        <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">
                          {item.description}
                        </p>
                      </div>

                      {/* Price / Status */}
                      <div className="w-full flex items-center justify-center gap-1.5 font-mono-code font-bold text-amber-300 text-sm">
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
                                ? 'bg-[#7059e2]/30 hover:bg-rose-900/40 border border-[#7059e2] text-purple-200 hover:text-rose-200'
                                : 'bg-[#7059e2]/30 border border-[#7059e2] text-purple-200'
                            }`}
                          >
                            {item.category === 'appearance' ? 'Equipped ✓' : 'Equipped (Click to Unequip)'}
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
                            className="w-full py-2 rounded-xl bg-slate-800 hover:bg-[#7059e2] text-xs font-bold text-slate-200 hover:text-white cursor-pointer transition-all shadow-sm"
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
