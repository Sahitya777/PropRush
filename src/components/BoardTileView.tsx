import React from 'react';
import { BoardTile, Player } from '../types/game';
import { GROUP_COLORS } from '../data/boardTiles';
import { AvatarCharacter } from './AvatarCharacter';

interface BoardTileViewProps {
  tile: BoardTile;
  owner?: Player;
  isMortgaged?: boolean;
  housesCount?: number; // 1-4: houses, 5: hotel
  playersOnTile: Player[];
  isActiveTile?: boolean;
  onClick: () => void;
  orientation?: 'top' | 'right' | 'bottom' | 'left' | 'corner';
}

export const BoardTileView: React.FC<BoardTileViewProps> = ({
  tile,
  owner,
  isMortgaged = false,
  housesCount = 0,
  playersOnTile,
  isActiveTile = false,
  onClick
}) => {
  const isCorner = tile.id % 10 === 0;
  const groupStyle = tile.group ? GROUP_COLORS[tile.group] : null;

  // Corner Tiles Rendering (START, IN PRISON, VACATION, GO TO PRISON)
  if (isCorner) {
    return (
      <div
        id={`tile-${tile.id}`}
        onClick={onClick}
        className={`relative w-full h-full select-none cursor-pointer transition-all duration-150 flex flex-col items-center justify-between p-1 sm:p-1.5 rounded-lg sm:rounded-xl border border-[#2b2447] bg-[#161228] hover:bg-[#201a38] overflow-hidden ${
          isActiveTile ? 'ring-2 ring-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.6)] z-30' : ''
        }`}
      >
        {tile.id === 0 && (
          // START TILE (Top-Left)
          <div className="w-full h-full flex flex-col items-center justify-between py-0.5 text-center">
            <div className="flex items-center justify-center gap-0.5 text-emerald-400 font-black font-heading text-[9px] sm:text-xs tracking-wider">
              <span>START</span>
              <span className="text-xs">»</span>
            </div>
            <div className="text-xl sm:text-2xl filter drop-shadow-md">🚀</div>
            <div className="text-[8px] sm:text-[9.5px] text-emerald-300 font-mono-code font-bold">
              +$200
            </div>
          </div>
        )}

        {tile.id === 10 && (
          // PRISON TILE (Top-Right)
          <div className="w-full h-full flex flex-col items-center justify-between py-0.5 text-center">
            <div className="text-[7.5px] sm:text-[9px] text-slate-400 font-medium leading-none">
              Visiting
            </div>
            <div className="w-7 sm:w-9 h-5 sm:h-6 bg-slate-900/90 border border-slate-700/80 rounded flex items-center justify-evenly px-0.5 relative overflow-hidden">
              <div className="w-0.5 h-full bg-slate-600" />
              <div className="w-0.5 h-full bg-slate-600" />
              <div className="w-0.5 h-full bg-slate-600" />
            </div>
            <div className="text-[7.5px] sm:text-[9px] text-slate-300 font-bold leading-none">
              In Prison
            </div>
          </div>
        )}

        {tile.id === 20 && (
          // VACATION TILE (Bottom-Right)
          <div className="w-full h-full flex flex-col items-center justify-between py-0.5 text-center">
            <div className="text-lg sm:text-xl">🏖️</div>
            <div className="text-[8px] sm:text-[10px] font-heading font-black text-amber-300 uppercase leading-tight">
              Vacation
            </div>
            <div className="text-[7.5px] sm:text-[8.5px] text-amber-400 font-mono-code font-bold">
              Resort Pool
            </div>
          </div>
        )}

        {tile.id === 30 && (
          // GO TO PRISON TILE (Bottom-Left)
          <div className="w-full h-full flex flex-col items-center justify-between py-0.5 text-center">
            <div className="text-lg sm:text-xl">☠️</div>
            <div className="text-[7.5px] sm:text-[9px] font-heading font-black text-rose-400 uppercase leading-tight">
              Go to prison
            </div>
            <div className="text-[7.5px] sm:text-[8.5px] text-slate-500 font-mono-code">
              Lockup
            </div>
          </div>
        )}

        {/* Floating Players Badge on Corner Tile */}
        {playersOnTile.length > 0 && (
          <div className="absolute inset-x-0 bottom-0.5 flex items-center justify-center flex-wrap gap-0.5 p-0.5 z-20 pointer-events-none">
            {playersOnTile.map(p => (
              <div
                key={p.id}
                className="transform scale-75 sm:scale-90 transition-transform duration-200 animate-bounce drop-shadow-md"
                title={`${p.name} ($${p.cash})`}
              >
                <AvatarCharacter avatarId={p.avatar} frameId={p.avatarFrame} size="xs" isAnimated={false} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Regular Tile Rendering (Top row, Bottom row, Left col, Right col)
  const isSpecial = tile.type === 'chest' || tile.type === 'chance' || tile.type === 'tax';
  const isUtilityOrAirport = tile.type === 'utility' || tile.type === 'railroad';

  const headerBgColor = owner
    ? owner.color
    : groupStyle?.badge || (isUtilityOrAirport ? '#334155' : '#1e1838');

  return (
    <div
      id={`tile-${tile.id}`}
      onClick={onClick}
      className={`relative w-full h-full select-none cursor-pointer transition-all duration-150 flex flex-col justify-between rounded-lg sm:rounded-xl border border-[#2b2447] bg-[#141024] hover:bg-[#1f1935] overflow-hidden ${
        isActiveTile ? 'ring-2 ring-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.6)] z-30' : ''
      } ${isMortgaged ? 'opacity-50 grayscale' : ''}`}
    >
      {/* 1. TOP HEADER STRIP: Property Color / Owner Color Banner with Price */}
      {tile.type === 'property' && (
        <div
          className="w-full h-3.5 sm:h-4.5 transition-colors duration-300 flex items-center justify-between px-1 flex-shrink-0"
          style={{
            backgroundColor: headerBgColor
          }}
        >
          {!owner ? (
            <span className="w-full text-center text-[7.5px] sm:text-[9px] font-mono-code font-bold text-white drop-shadow-sm leading-none">
              ${tile.price}
            </span>
          ) : (
            <div className="w-full flex items-center justify-between gap-0.5 leading-none">
              {/* House/Hotel or Owner Tag */}
              {housesCount > 0 ? (
                <div className="flex gap-0.5 items-center">
                  {housesCount === 5 ? (
                    <span className="text-[7px] text-white font-extrabold bg-red-700 px-0.5 rounded leading-none">
                      🏨
                    </span>
                  ) : (
                    <span className="text-[7.5px] font-bold text-emerald-200 leading-none">
                      🏠x{housesCount}
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-[7px] font-bold text-white uppercase tracking-tight truncate drop-shadow-sm max-w-[45%]">
                  {owner.name.substring(0, 4)}
                </span>
              )}
              <span className="text-[7.5px] sm:text-[8.5px] font-mono-code text-white font-bold ml-auto leading-none">
                ${tile.price}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Airport / Utility Header */}
      {isUtilityOrAirport && (
        <div
          className="w-full h-3.5 sm:h-4.5 transition-colors duration-300 flex items-center justify-center px-1 flex-shrink-0"
          style={{
            backgroundColor: owner ? owner.color : '#334155'
          }}
        >
          <span className="text-[7.5px] sm:text-[8.5px] font-mono-code font-bold text-white drop-shadow-sm truncate leading-none">
            {owner ? `${owner.name.substring(0, 4)} • $${tile.price}` : `$${tile.price}`}
          </span>
        </div>
      )}

      {/* Special Tiles (Treasure, Surprise, Tax) Top Bar */}
      {isSpecial && (
        <div className="w-full h-3 sm:h-3.5 bg-slate-900/70 flex items-center justify-center flex-shrink-0">
          {tile.type === 'tax' ? (
            <span className="text-[7px] sm:text-[8px] text-rose-300 font-mono-code font-bold leading-none">
              {tile.taxAmount ? `$${tile.taxAmount}` : '10%'}
            </span>
          ) : (
            <span className="text-[7px] sm:text-[8px] text-amber-300 font-bold leading-none">
              {tile.type === 'chest' ? 'Treasure' : 'Surprise'}
            </span>
          )}
        </div>
      )}

      {/* 2. MIDDLE SECTION: Property / Tile Name & Icon */}
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-0.5 py-0.5 text-center overflow-hidden">
        {tile.type === 'chest' && (
          <div className="text-xs sm:text-base filter drop-shadow leading-none mb-0.5">🎁</div>
        )}
        {tile.type === 'chance' && (
          <div className="text-xs sm:text-base filter drop-shadow leading-none mb-0.5">❓</div>
        )}
        {tile.type === 'tax' && (
          <div className="text-xs sm:text-base filter drop-shadow leading-none mb-0.5">💸</div>
        )}
        {tile.type === 'railroad' && (
          <div className="text-xs sm:text-base filter drop-shadow leading-none mb-0.5">✈️</div>
        )}
        {tile.type === 'utility' && (
          <div className="text-xs sm:text-base filter drop-shadow leading-none mb-0.5">
            {tile.icon || (tile.name.includes('Water') ? '💧' : '⚡')}
          </div>
        )}

        {/* Name Text */}
        <span
          className={`font-heading font-bold text-[7.5px] sm:text-[8.5px] md:text-[9.5px] leading-[1.05] text-slate-100 line-clamp-2 px-0.5 break-words ${
            isSpecial ? 'text-[7px] sm:text-[8px] text-slate-300' : ''
          }`}
        >
          {tile.name}
        </span>
      </div>

      {/* 3. BOTTOM SECTION: Country Flag or Indicator */}
      <div className="w-full pb-0.5 flex items-center justify-center flex-shrink-0">
        {tile.flag ? (
          <span className="text-[10px] sm:text-xs leading-none drop-shadow-sm">
            {tile.flag}
          </span>
        ) : tile.type === 'property' && groupStyle ? (
          <div
            className="w-2 h-0.5 rounded-full"
            style={{ backgroundColor: groupStyle.badge }}
          />
        ) : (
          <div className="h-0.5" />
        )}
      </div>

      {/* Mortgaged Overlay Tag */}
      {isMortgaged && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10 pointer-events-none">
          <span className="px-1 py-0.2 rounded bg-rose-900/90 text-rose-200 text-[6.5px] font-extrabold font-mono-code border border-rose-500">
            MORTGAGED
          </span>
        </div>
      )}

      {/* 4. PLAYER AVATARS SITTING ON THIS TILE (Compact floating overlay) */}
      {playersOnTile.length > 0 && (
        <div className="absolute inset-x-0 bottom-0.5 flex items-center justify-center flex-wrap gap-0.5 p-0.5 z-20 pointer-events-none">
          {playersOnTile.map(p => (
            <div
              key={p.id}
              className="transform scale-70 sm:scale-80 transition-transform duration-200 animate-bounce drop-shadow-md"
              title={`${p.name} ($${p.cash})`}
            >
              <AvatarCharacter avatarId={p.avatar} frameId={p.avatarFrame} size="xs" isAnimated={false} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
