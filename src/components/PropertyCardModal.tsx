import React from 'react';
import { BoardTile, GameRoom, Player } from '../types/game';
import { GROUP_COLORS } from '../data/boardTiles';
import { AvatarCharacter } from './AvatarCharacter';
import { useTheme } from '../context/ThemeContext';
import { sounds } from '../utils/audio';

interface PropertyCardModalProps {
  tile: BoardTile | null;
  tiles: BoardTile[];
  room: GameRoom;
  myPlayerId: string;
  isMyTurn: boolean;
  onClose: () => void;
  onBuildHouse: (tileId: number) => void;
  onSellHouse: (tileId: number) => void;
  onMortgage: (tileId: number) => void;
  onUnmortgage: (tileId: number) => void;
}

export const PropertyCardModal: React.FC<PropertyCardModalProps> = ({
  tile,
  tiles,
  room,
  myPlayerId,
  isMyTurn,
  onClose,
  onBuildHouse,
  onSellHouse,
  onMortgage,
  onUnmortgage
}) => {
  const { isLight } = useTheme();
  if (!tile) return null;

  const owner = room.players.find(p => p.properties.includes(tile.id));
  const isOwner = owner?.id === myPlayerId;
  const isMortgaged = owner?.mortgaged.includes(tile.id) || false;
  const houseCount = owner ? (owner.houses[tile.id] || 0) : 0;
  const groupStyle = tile.group ? GROUP_COLORS[tile.group] : null;

  // Find all property tiles belonging to the same color group
  const groupTiles = tile.group
    ? tiles.filter(t => t.type === 'property' && t.group === tile.group)
    : [];
  
  const ownedInGroup = owner && tile.group
    ? groupTiles.filter(t => owner.properties.includes(t.id))
    : [];

  const hasMonopoly = groupTiles.length > 0 && ownedInGroup.length === groupTiles.length;
  const isAnyInGroupMortgaged = groupTiles.some(t => owner?.mortgaged.includes(t.id));

  // Even building logic:
  // Can only build on this property if its house count is equal to the minimum house count across all properties in the set
  const groupHouseCounts = groupTiles.map(t => (owner ? owner.houses[t.id] || 0 : 0));
  const minHousesInGroup = groupHouseCounts.length > 0 ? Math.min(...groupHouseCounts) : 0;
  const maxHousesInGroup = groupHouseCounts.length > 0 ? Math.max(...groupHouseCounts) : 0;

  const isEvenForBuilding = houseCount === minHousesInGroup;
  const isEvenForSelling = houseCount === maxHousesInGroup;

  // Any houses currently built in this group?
  const hasHousesInGroup = groupHouseCounts.some(h => h > 0);

  // Validation checks:
  const canBuild = Boolean(
    isOwner &&
    isMyTurn &&
    hasMonopoly &&
    !isAnyInGroupMortgaged &&
    houseCount < 5 &&
    isEvenForBuilding &&
    owner &&
    owner.cash >= (tile.houseCost || 100)
  );

  const canSell = Boolean(
    isOwner &&
    isMyTurn &&
    houseCount > 0 &&
    isEvenForSelling
  );

  const canMortgage = Boolean(
    isOwner &&
    isMyTurn &&
    !isMortgaged &&
    !hasHousesInGroup
  );

  const canUnmortgage = Boolean(
    isOwner &&
    isMyTurn &&
    isMortgaged &&
    owner &&
    owner.cash >= Math.round((tile.mortgageValue || 50) * 1.1)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div className={`w-full max-w-sm border rounded-2xl shadow-2xl p-4 sm:p-5 overflow-hidden flex flex-col gap-3.5 my-auto max-h-[90vh] overflow-y-auto ${
        isLight
          ? 'bg-white border-slate-200 text-slate-800'
          : 'bg-[#18132b] border-[#7059e2]/60 text-white shadow-[0_12px_45px_rgba(0,0,0,0.85)]'
      }`}>
        {/* Title Header with Group Color */}
        <div className="rounded-xl overflow-hidden border border-slate-700 shadow-md">
          {groupStyle && (
            <div className={`${groupStyle.bg} py-2 px-4 text-center font-heading font-black text-white text-sm tracking-widest uppercase`}>
              TITLE DEED {groupStyle.name ? `• ${groupStyle.name}` : ''}
            </div>
          )}
          <div className={`p-3 text-center ${isLight ? 'bg-slate-50' : 'bg-[#221a3d]'}`}>
            <h3 className={`font-heading font-black text-xl ${isLight ? 'text-slate-900' : 'text-white'}`}>
              {tile.name}
            </h3>
            <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              {tile.type.toUpperCase()} {tile.group ? `• ${tile.group.toUpperCase()}` : ''}
            </p>
          </div>
        </div>

        {/* Ownership Status Banner & Monopoly Indicator */}
        <div className={`flex flex-col gap-1.5 px-3 py-2 rounded-xl border ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/90 border-slate-800'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Owner:</span>
            {owner ? (
              <div className="flex items-center gap-2">
                <AvatarCharacter avatarId={owner.avatar} frameId={owner.avatarFrame} size="xs" isAnimated={false} />
                <span className={`text-xs font-bold ${isOwner ? 'text-emerald-600 dark:text-emerald-400' : isLight ? 'text-slate-900' : 'text-slate-200'}`}>
                  {isOwner ? 'You' : owner.name}
                </span>
              </div>
            ) : (
              <span className={`text-xs font-bold ${isLight ? 'text-amber-700' : 'text-amber-400'}`}>Unowned (${tile.price})</span>
            )}
          </div>

          {tile.group && tile.type === 'property' && (
            <div className={`flex items-center justify-between pt-1 border-t text-[11px] ${
              isLight ? 'border-slate-200' : 'border-slate-800/80'
            }`}>
              <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>Set Monopoly:</span>
              <span className={`font-bold ${hasMonopoly ? (isLight ? 'text-emerald-700' : 'text-emerald-400') : (isLight ? 'text-amber-700' : 'text-amber-400')}`}>
                {hasMonopoly ? '✨ Complete Set Owned' : `${ownedInGroup.length}/${groupTiles.length} Owned`}
              </span>
            </div>
          )}
        </div>

        {/* Rent Schedule Matrix for standard properties */}
        {tile.rent && tile.rent.length >= 6 && (
          <div className={`space-y-1.5 text-xs p-3 rounded-xl border ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/70 border-slate-800/90'
          }`}>
            <div className={`flex justify-between ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
              <span>Rent (Base):</span>
              <span className="font-mono-code font-bold">${tile.rent[0]}</span>
            </div>
            <div className={`flex justify-between ${houseCount === 1 ? (isLight ? 'text-emerald-800 font-bold bg-emerald-100 px-1 rounded' : 'text-emerald-300 font-bold bg-emerald-950/40 px-1 rounded') : isLight ? 'text-slate-700' : 'text-slate-300'}`}>
              <span>With 1 House 🏠:</span>
              <span className="font-mono-code font-bold">${tile.rent[1]}</span>
            </div>
            <div className={`flex justify-between ${houseCount === 2 ? (isLight ? 'text-emerald-800 font-bold bg-emerald-100 px-1 rounded' : 'text-emerald-300 font-bold bg-emerald-950/40 px-1 rounded') : isLight ? 'text-slate-700' : 'text-slate-300'}`}>
              <span>With 2 Houses 🏠🏠:</span>
              <span className="font-mono-code font-bold">${tile.rent[2]}</span>
            </div>
            <div className={`flex justify-between ${houseCount === 3 ? (isLight ? 'text-emerald-800 font-bold bg-emerald-100 px-1 rounded' : 'text-emerald-300 font-bold bg-emerald-950/40 px-1 rounded') : isLight ? 'text-slate-700' : 'text-slate-300'}`}>
              <span>With 3 Houses 🏠🏠🏠:</span>
              <span className="font-mono-code font-bold">${tile.rent[3]}</span>
            </div>
            <div className={`flex justify-between ${houseCount === 4 ? (isLight ? 'text-emerald-800 font-bold bg-emerald-100 px-1 rounded' : 'text-emerald-300 font-bold bg-emerald-950/40 px-1 rounded') : isLight ? 'text-slate-700' : 'text-slate-300'}`}>
              <span>With 4 Houses 🏠🏠🏠🏠:</span>
              <span className="font-mono-code font-bold">${tile.rent[4]}</span>
            </div>
            <div className={`flex justify-between border-t pt-1 ${
              isLight ? 'border-slate-200' : 'border-slate-800'
            } ${houseCount === 5 ? (isLight ? 'text-amber-800 font-extrabold bg-amber-100 px-1 rounded' : 'text-amber-300 font-extrabold bg-amber-950/40 px-1 rounded') : isLight ? 'text-amber-700 font-bold' : 'text-amber-300 font-bold'}`}>
              <span>With HOTEL 🏨:</span>
              <span className={`font-mono-code font-bold ${isLight ? 'text-amber-700' : 'text-amber-300'}`}>${tile.rent[5]}</span>
            </div>
          </div>
        )}

        {/* Railroad or Utility special rent info */}
        {tile.type === 'railroad' && (
          <div className={`space-y-1 text-xs p-3 rounded-xl border ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/70 border-slate-800'
          }`}>
            <div className={`mb-1 font-bold ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>Airport Rent Scale:</div>
            <div className={`flex justify-between ${isLight ? 'text-slate-600' : 'text-slate-300'}`}><span>1 Airport:</span><span className="font-mono-code font-bold">$25</span></div>
            <div className={`flex justify-between ${isLight ? 'text-slate-600' : 'text-slate-300'}`}><span>2 Airports:</span><span className="font-mono-code font-bold">$50</span></div>
            <div className={`flex justify-between ${isLight ? 'text-slate-600' : 'text-slate-300'}`}><span>3 Airports:</span><span className="font-mono-code font-bold">$100</span></div>
            <div className={`flex justify-between ${isLight ? 'text-slate-600' : 'text-slate-300'}`}><span>4 Airports:</span><span className="font-mono-code font-bold">$200</span></div>
          </div>
        )}

        {/* Financial info: House cost & Mortgage value */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          {tile.houseCost && (
            <div className={`p-2.5 rounded-xl border text-center ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/80 border-slate-800'
            }`}>
              <div className={`text-[10px] uppercase font-bold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>House Cost</div>
              <div className="font-mono-code font-bold text-emerald-600 dark:text-emerald-300 mt-0.5">${tile.houseCost} each</div>
            </div>
          )}
          {tile.mortgageValue && (
            <div className={`p-2.5 rounded-xl border text-center ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/80 border-slate-800'
            }`}>
              <div className={`text-[10px] uppercase font-bold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Mortgage Value</div>
              <div className={`font-mono-code font-bold mt-0.5 ${isLight ? 'text-amber-700' : 'text-amber-300'}`}>${tile.mortgageValue}</div>
            </div>
          )}
        </div>

        {/* Owner Management Controls & Explanatory Guidance */}
        {isOwner && (
          <div className={`flex flex-col gap-2 pt-2 border-t ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
            {/* Turn & Monopoly Rule Status Alerts */}
            {!isMyTurn && (
              <div className={`text-[11px] px-2.5 py-1.5 rounded-xl text-center font-medium border ${
                isLight ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-amber-950/50 border-amber-500/40 text-amber-300'
              }`}>
                ⏳ Building & mortgaging are only allowed on your turn.
              </div>
            )}

            {isMyTurn && tile.type === 'property' && !hasMonopoly && (
              <div className={`text-[11px] px-2.5 py-1.5 rounded-xl text-center font-medium border ${
                isLight ? 'bg-indigo-50 border-indigo-200 text-indigo-800' : 'bg-indigo-950/60 border-indigo-500/40 text-indigo-200'
              }`}>
                🔒 Own all {groupTiles.length} {tile.group?.toUpperCase()} properties to start building houses ({ownedInGroup.length}/{groupTiles.length} owned).
              </div>
            )}

            {isMyTurn && hasMonopoly && isAnyInGroupMortgaged && (
              <div className={`text-[11px] px-2.5 py-1.5 rounded-xl text-center font-medium border ${
                isLight ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-rose-950/60 border-rose-500/40 text-rose-200'
              }`}>
                ⚠️ All properties in the {tile.group?.toUpperCase()} set must be unmortgaged to build houses.
              </div>
            )}

            {isMyTurn && hasMonopoly && !isAnyInGroupMortgaged && !isEvenForBuilding && houseCount < 5 && (
              <div className={`text-[11px] px-2.5 py-1.5 rounded-xl text-center font-medium border ${
                isLight ? 'bg-cyan-50 border-cyan-200 text-cyan-800' : 'bg-cyan-950/60 border-cyan-500/40 text-cyan-200'
              }`}>
                ⚖️ Even Building: Upgrade properties with {minHousesInGroup} house(s) before adding more here.
              </div>
            )}

            {isMyTurn && houseCount > 0 && !isEvenForSelling && (
              <div className={`text-[11px] px-2.5 py-1.5 rounded-xl text-center font-medium border ${
                isLight ? 'bg-cyan-50 border-cyan-200 text-cyan-800' : 'bg-cyan-950/60 border-cyan-500/40 text-cyan-200'
              }`}>
                ⚖️ Even Demolition: Sell houses from properties with {maxHousesInGroup} houses first.
              </div>
            )}

            {/* Building Controls */}
            {tile.houseCost && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  disabled={!canBuild}
                  onClick={() => {
                    sounds.playBuild();
                    onBuildHouse(tile.id);
                  }}
                  className="py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white cursor-pointer shadow-md transition-all active:scale-95 disabled:cursor-not-allowed"
                >
                  + Build House (${tile.houseCost})
                </button>
                <button
                  disabled={!canSell}
                  onClick={() => {
                    sounds.playCashRegister();
                    onSellHouse(tile.id);
                  }}
                  className="py-2.5 rounded-xl font-bold text-xs bg-rose-700 hover:bg-rose-600 disabled:opacity-40 disabled:hover:bg-rose-700 text-white cursor-pointer shadow-md transition-all active:scale-95 disabled:cursor-not-allowed"
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
                  className="py-2.5 rounded-xl font-bold text-xs bg-amber-700 hover:bg-amber-600 disabled:opacity-40 disabled:hover:bg-amber-700 text-white cursor-pointer col-span-2 shadow-md transition-all active:scale-95 disabled:cursor-not-allowed"
                  title={hasHousesInGroup ? 'Sell all houses in the color group before mortgaging' : 'Mortgage property'}
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
                  className="py-2.5 rounded-xl font-bold text-xs bg-cyan-700 hover:bg-cyan-600 disabled:opacity-40 disabled:hover:bg-cyan-700 text-white cursor-pointer col-span-2 shadow-md transition-all active:scale-95 disabled:cursor-not-allowed"
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
          className={`w-full py-2.5 rounded-xl font-bold text-xs cursor-pointer mt-1 transition-colors ${
            isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
          }`}
        >
          Close
        </button>
      </div>
    </div>
  );
};

