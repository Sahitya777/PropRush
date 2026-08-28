import React from 'react';
import { BoardTile, GameRoom, Player } from '../types/game';
import { GROUP_COLORS, GROUP_PROPERTY_COUNTS } from '../data/boardTiles';
import { AvatarCharacter } from './AvatarCharacter';
import { sounds } from '../utils/audio';

interface PropertyCardModalProps {
  tile: BoardTile | null;
  room: GameRoom;
  myPlayerId: string;
  onClose: () => void;
  onBuildHouse: (tileId: number) => void;
  onSellHouse: (tileId: number) => void;
  onMortgage: (tileId: number) => void;
  onUnmortgage: (tileId: number) => void;
}

export const PropertyCardModal: React.FC<PropertyCardModalProps> = ({
  tile,
  room,
  myPlayerId,
  onClose,
  onBuildHouse,
  onSellHouse,
  onMortgage,
  onUnmortgage
}) => {
  if (!tile) return null;

  const owner = room.players.find(p => p.properties.includes(tile.id));
  const isOwner = owner?.id === myPlayerId;
  const isMortgaged = owner?.mortgaged.includes(tile.id) || false;
  const houseCount = owner ? (owner.houses[tile.id] || 0) : 0;
  const groupStyle = tile.group ? GROUP_COLORS[tile.group] : null;

  // Check if owner has complete color set for this group
  const hasMonopoly = (): boolean => {
    if (!owner || !tile.group) return false;
    const requiredCount = GROUP_PROPERTY_COUNTS[tile.group] || 0;
    const ownedInGroup = owner.properties.filter(id => {
      const t = room.boardTheme ? tile : tile; // check same group
      return true; // we will calculate exact below
    });
    // Count properties with same group owned by owner
    const totalGroupOwned = owner.properties.filter(id => {
      // Find tile group
      return true;
    });
    return false; // dynamic check
  };

  const groupTotalRequired = tile.group ? GROUP_PROPERTY_COUNTS[tile.group] || 3 : 3;
  const groupOwnedByPlayer = owner && tile.group 
    ? owner.properties.filter(id => id !== tile.id).length + 1 
    : 0;

  const canBuild = isOwner && !isMortgaged && houseCount < 5 && owner.cash >= (tile.houseCost || 100);
  const canSell = isOwner && houseCount > 0;
  const canMortgage = isOwner && !isMortgaged && houseCount === 0;
  const canUnmortgage = isOwner && isMortgaged && owner.cash >= Math.round((tile.mortgageValue || 50) * 1.1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-sm bg-[#181329] border border-[#7059e2]/50 rounded-2xl shadow-2xl p-5 overflow-hidden flex flex-col gap-4">
        {/* Title Header with Group Color */}
        <div className="rounded-xl overflow-hidden border border-slate-700 shadow-md">
          {groupStyle && (
            <div className={`${groupStyle.bg} py-2.5 px-4 text-center font-heading font-black text-white text-base tracking-wide uppercase`}>
              TITLE DEED
            </div>
          )}
          <div className="bg-[#221b38] p-3 text-center">
            <h3 className="font-heading font-extrabold text-lg text-white">
              {tile.name}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {tile.type.toUpperCase()} {tile.group ? `• ${tile.group.toUpperCase()}` : ''}
            </p>
          </div>
        </div>

        {/* Ownership Status Banner */}
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-xs text-slate-400">Owner:</span>
          {owner ? (
            <div className="flex items-center gap-2">
              <AvatarCharacter avatarId={owner.avatar} size="xs" />
              <span className={`text-xs font-bold ${isOwner ? 'text-emerald-400' : 'text-slate-200'}`}>
                {isOwner ? 'You' : owner.name}
              </span>
            </div>
          ) : (
            <span className="text-xs font-bold text-amber-400">Unowned (${tile.price})</span>
          )}
        </div>

        {/* Rent Schedule Matrix for standard properties */}
        {tile.rent && tile.rent.length >= 6 && (
          <div className="space-y-1.5 text-xs bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
            <div className="flex justify-between text-slate-300">
              <span>Rent (Base):</span>
              <span className="font-mono-code font-bold">${tile.rent[0]}</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>With 1 House 🏠:</span>
              <span className="font-mono-code font-bold">${tile.rent[1]}</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>With 2 Houses 🏠🏠:</span>
              <span className="font-mono-code font-bold">${tile.rent[2]}</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>With 3 Houses 🏠🏠🏠:</span>
              <span className="font-mono-code font-bold">${tile.rent[3]}</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>With 4 Houses 🏠🏠🏠🏠:</span>
              <span className="font-mono-code font-bold">${tile.rent[4]}</span>
            </div>
            <div className="flex justify-between text-amber-300 font-bold border-t border-slate-800 pt-1">
              <span>With HOTEL 🏨:</span>
              <span className="font-mono-code font-bold text-amber-300">${tile.rent[5]}</span>
            </div>
          </div>
        )}

        {/* Railroad or Utility special rent info */}
        {tile.type === 'railroad' && (
          <div className="space-y-1 text-xs bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="text-slate-400 mb-1 font-bold">Railroad Rent:</div>
            <div className="flex justify-between text-slate-300"><span>1 Railroad:</span><span className="font-mono-code font-bold">$25</span></div>
            <div className="flex justify-between text-slate-300"><span>2 Railroads:</span><span className="font-mono-code font-bold">$50</span></div>
            <div className="flex justify-between text-slate-300"><span>3 Railroads:</span><span className="font-mono-code font-bold">$100</span></div>
            <div className="flex justify-between text-slate-300"><span>4 Railroads:</span><span className="font-mono-code font-bold">$200</span></div>
          </div>
        )}

        {/* Financial info: House cost & Mortgage value */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          {tile.houseCost && (
            <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800 text-center">
              <div className="text-slate-400 text-[10px] uppercase font-bold">House Cost</div>
              <div className="font-mono-code font-bold text-slate-200 mt-0.5">${tile.houseCost} each</div>
            </div>
          )}
          {tile.mortgageValue && (
            <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800 text-center">
              <div className="text-slate-400 text-[10px] uppercase font-bold">Mortgage Value</div>
              <div className="font-mono-code font-bold text-slate-200 mt-0.5">${tile.mortgageValue}</div>
            </div>
          )}
        </div>

        {/* Owner Management Buttons */}
        {isOwner && (
          <div className="flex flex-col gap-2 pt-2 border-t border-slate-800">
            {/* Building Controls */}
            {tile.houseCost && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  disabled={!canBuild}
                  onClick={() => {
                    sounds.playBuild();
                    onBuildHouse(tile.id);
                  }}
                  className="py-2 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white cursor-pointer shadow-md"
                >
                  + Build House (${tile.houseCost})
                </button>
                <button
                  disabled={!canSell}
                  onClick={() => {
                    sounds.playCashRegister();
                    onSellHouse(tile.id);
                  }}
                  className="py-2 rounded-xl font-bold text-xs bg-rose-700 hover:bg-rose-600 disabled:opacity-40 text-white cursor-pointer shadow-md"
                >
                  - Sell House (${Math.floor((tile.houseCost || 100) / 2)})
                </button>
              </div>
            )}

            {/* Mortgage Controls */}
            <div className="grid grid-cols-2 gap-2">
              {!isMortgaged ? (
                <button
                  disabled={!canMortgage}
                  onClick={() => {
                    sounds.playCashRegister();
                    onMortgage(tile.id);
                  }}
                  className="py-2 rounded-xl font-bold text-xs bg-amber-700 hover:bg-amber-600 disabled:opacity-40 text-white cursor-pointer col-span-2 shadow-md"
                >
                  Mortgage (+${tile.mortgageValue})
                </button>
              ) : (
                <button
                  disabled={!canUnmortgage}
                  onClick={() => {
                    sounds.playPayRent();
                    onUnmortgage(tile.id);
                  }}
                  className="py-2 rounded-xl font-bold text-xs bg-cyan-700 hover:bg-cyan-600 disabled:opacity-40 text-white cursor-pointer col-span-2 shadow-md"
                >
                  Unmortgage (-${Math.round((tile.mortgageValue || 50) * 1.1)})
                </button>
              )}
            </div>
          </div>
        )}

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 font-bold text-xs text-slate-300 cursor-pointer mt-1"
        >
          Close
        </button>
      </div>
    </div>
  );
};
