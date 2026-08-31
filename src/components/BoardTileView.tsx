import React from 'react';
import { BoardTile, Player } from '../types/game';
import { GROUP_COLORS } from '../data/boardTiles';
import { AvatarCharacter } from './AvatarCharacter';
import { useTheme } from '../context/ThemeContext';

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
  onClick,
}) => {
  const { isLight } = useTheme();
  const isCorner = tile.id % 10 === 0;
  const groupStyle = tile.group ? GROUP_COLORS[tile.group] : null;

  // 1. CORNER TILES (0: START, 10: PRISON, 20: VACATION, 30: GO TO PRISON)
  if (isCorner) {
    return (
      <div
        id={`tile-${tile.id}`}
        onClick={onClick}
        className={`relative w-full h-full select-none cursor-pointer transition-all duration-150 flex flex-col items-center justify-between p-1 rounded-xl border ${
          isActiveTile
            ? 'border-amber-400 ring-2 ring-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.9)] z-30'
            : isLight ? 'bg-white hover:bg-slate-50 border-slate-300' : 'bg-[#130f28] hover:bg-[#1e173e] border-[#332958]'
        }`}
      >
        {tile.id === 0 && (
          // START TILE
          <div className={`w-full h-full flex flex-col items-center justify-between py-1 text-center rounded-lg ${
            isLight ? 'bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200' : 'bg-gradient-to-br from-emerald-950/80 to-slate-900/90'
          }`}>
            <div className={`text-[10px] sm:text-[12px] font-black tracking-wider flex items-center gap-0.5 justify-center ${
              isLight ? 'text-emerald-800' : 'text-emerald-400'
            }`}>
              <span>START</span>
              <span>🚀</span>
            </div>
            <div className="text-xl sm:text-2xl filter drop-shadow my-auto">🚩</div>
            <div className={`text-[8px] sm:text-[9.5px] font-mono font-black px-1.5 py-0.5 rounded border ${
              isLight ? 'bg-white text-emerald-800 border-emerald-300' : 'bg-emerald-950/90 text-emerald-300 border-emerald-500/50'
            }`}>
              +$200
            </div>
          </div>
        )}

        {tile.id === 10 && (
          // PRISON TILE
          <div className={`w-full h-full flex flex-col items-center justify-between py-1 text-center rounded-lg ${
            isLight ? 'bg-gradient-to-bl from-slate-100 via-slate-50 to-slate-200 border border-slate-200' : 'bg-gradient-to-bl from-slate-900 via-slate-950 to-slate-900'
          }`}>
            <div className={`text-[8px] sm:text-[9.5px] font-bold uppercase tracking-wider ${
              isLight ? 'text-slate-600' : 'text-slate-400'
            }`}>
              VISITING
            </div>
            <div className="text-xl sm:text-2xl my-auto filter drop-shadow">
              🔒
            </div>
            <div className={`text-[8.5px] sm:text-[10.5px] font-black uppercase tracking-wider ${
              isLight ? 'text-slate-800' : 'text-slate-200'
            }`}>
              IN PRISON
            </div>
          </div>
        )}

        {tile.id === 20 && (
          // VACATION TILE
          <div className={`w-full h-full flex flex-col items-center justify-between py-1 text-center rounded-lg ${
            isLight ? 'bg-gradient-to-tl from-amber-50 to-amber-100 border border-amber-200' : 'bg-gradient-to-tl from-amber-950/80 to-slate-900/90'
          }`}>
            <div className={`text-[9.5px] sm:text-[11.5px] font-black tracking-wider ${
              isLight ? 'text-amber-800' : 'text-amber-400'
            }`}>
              VACATION
            </div>
            <div className="text-xl sm:text-2xl filter drop-shadow my-auto">🏖️</div>
            <div className={`text-[8px] sm:text-[9.5px] font-mono font-black px-1.5 py-0.5 rounded border ${
              isLight ? 'bg-white text-amber-800 border-amber-300' : 'bg-amber-950/90 text-amber-300 border-amber-500/50'
            }`}>
              Resort Pot
            </div>
          </div>
        )}

        {tile.id === 30 && (
          // GO TO PRISON TILE
          <div className={`w-full h-full flex flex-col items-center justify-between py-1 text-center rounded-lg ${
            isLight ? 'bg-gradient-to-tr from-rose-50 to-rose-100 border border-rose-200' : 'bg-gradient-to-tr from-rose-950/80 to-slate-900/90'
          }`}>
            <div className={`text-[8.5px] sm:text-[10px] font-black uppercase tracking-wider ${
              isLight ? 'text-rose-800' : 'text-rose-400'
            }`}>
              GO TO PRISON
            </div>
            <div className="text-xl sm:text-2xl filter drop-shadow my-auto">☠️</div>
            <div className={`text-[7.5px] sm:text-[9px] font-mono font-bold ${
              isLight ? 'text-rose-700' : 'text-rose-300'
            }`}>
              Arrested
            </div>
          </div>
        )}

        {/* Players Floating on Corner Tile */}
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

  // 2. STANDARD TILES (PROPERTIES, AIRPORTS, UTILITIES, TAXES, CHESTS, SURPRISES)
  const isAirport = tile.type === 'railroad';
  const isUtility = tile.type === 'utility';
  const isTax = tile.type === 'tax';
  const isChest = tile.type === 'chest';
  const isChance = tile.type === 'chance';

  // Group Color Stripe
  const groupBadgeColor =
    groupStyle?.badge ||
    (isAirport ? '#0284c7' : isUtility ? '#0d9488' : isTax ? '#e11d48' : isChest ? '#d97706' : '#9333ea');

  return (
    <div
      id={`tile-${tile.id}`}
      onClick={onClick}
      style={{
        borderColor: owner ? owner.color : undefined,
        boxShadow: owner
          ? `0 0 10px ${owner.color}90, inset 0 0 8px ${owner.color}25`
          : undefined,
      }}
      className={`relative w-full h-full select-none cursor-pointer transition-all duration-150 rounded-xl flex flex-col justify-between p-1 ${
        isLight ? 'bg-white hover:bg-slate-50' : 'bg-[#130f28] hover:bg-[#1e173e]'
      } ${
        isActiveTile
          ? 'border-amber-400 ring-2 ring-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.9)] z-30'
          : owner
          ? 'border-2 sm:border-[2.5px] z-10'
          : isLight ? 'border border-slate-200' : 'border border-[#2c234b]'
      } ${isMortgaged ? 'opacity-40 grayscale' : ''}`}
    >
      {/* 1. TOP ACCENT STRIPE (Group/Country Set Color) */}
      <div className="w-full flex items-center gap-1 flex-shrink-0">
        <div
          className="flex-1 h-1.5 sm:h-2 rounded-full shadow-xs"
          style={{ backgroundColor: groupBadgeColor }}
        />
        {/* If owned, show small owner color indicator tag at top corner */}
        {owner && (
          <div
            className="w-2 h-2 rounded-full flex-shrink-0 shadow-sm ring-1 ring-white/60 animate-pulse"
            style={{ backgroundColor: owner.color }}
            title={`Owned by ${owner.name}`}
          />
        )}
      </div>

      {/* Houses / Hotel Indicator */}
      {housesCount > 0 && (
        <div className="absolute top-1 right-1 bg-black/85 px-1 py-0.5 rounded text-[8px] sm:text-[9.5px] font-bold text-white border border-amber-400/60 filter drop-shadow leading-none z-10">
          {housesCount === 5 ? '🏨 Hotel' : `🏠 ${housesCount}`}
        </div>
      )}

      {/* 2. PLACE NAME & ICON (ALWAYS VISIBLE & HIGH-CONTRAST) */}
      <div className="w-full flex-1 flex flex-col items-center justify-center text-center my-0.5 px-0.5">
        <div
          style={{
            color: isLight ? '#1e293b' : '#ffffff',
            textShadow: isLight ? 'none' : '0 1px 3px rgba(0,0,0,0.95), 0 0 6px rgba(0,0,0,0.85)',
          }}
          className={`text-[9.5px] sm:text-[11px] font-black leading-tight text-center break-words ${
            isLight ? 'text-slate-800' : 'text-white'
          }`}
        >
          {tile.flag ? `${tile.flag} ` : tile.icon ? `${tile.icon} ` : ''}
          {tile.name}
        </div>
      </div>

      {/* 3. BOTTOM PRICE / OWNER BANNER */}
      <div className="w-full flex items-center justify-center flex-shrink-0">
        {owner ? (
          // UNMISTAKABLE OWNER BADGE MATCHING PLAYER OUTLINE & COLOR
          <div
            className="w-full flex items-center justify-center gap-1 px-1 py-0.5 rounded-md text-[8px] sm:text-[9.5px] font-bold text-white leading-none shadow-sm truncate"
            style={{
              backgroundColor: owner.color,
              boxShadow: `0 0 8px ${owner.color}90`,
              textShadow: '0 1px 2px rgba(0,0,0,0.9)',
            }}
            title={`Owned by ${owner.name} (Rent active)`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0 animate-pulse" />
            <span className="truncate max-w-[50px] sm:max-w-[70px] font-mono uppercase tracking-tight">
              {owner.name}
            </span>
          </div>
        ) : tile.price ? (
          // UNOWNED BUY PRICE
          <div className={`px-1.5 py-0.2 rounded-full text-[8.5px] sm:text-[10px] font-mono font-bold border leading-none ${
            isLight ? 'bg-amber-50 text-amber-900 border-amber-300' : 'bg-[#1e1738] text-amber-300 border-slate-700'
          }`}>
            ${tile.price}
          </div>
        ) : tile.taxAmount ? (
          <div className={`px-1.5 py-0.2 rounded-full text-[8.5px] sm:text-[9.5px] font-mono font-bold border leading-none ${
            isLight ? 'bg-rose-50 text-rose-800 border-rose-300' : 'bg-rose-950/90 text-rose-300 border-rose-800'
          }`}>
            -${tile.taxAmount}
          </div>
        ) : isChest ? (
          <div className={`px-1.5 py-0.2 rounded-full text-[8px] sm:text-[9px] font-bold border leading-none ${
            isLight ? 'bg-amber-50 text-amber-800 border-amber-300' : 'bg-amber-950/90 text-amber-300 border-amber-800'
          }`}>
            Bonus
          </div>
        ) : isChance ? (
          <div className={`px-1.5 py-0.2 rounded-full text-[8px] sm:text-[9px] font-bold border leading-none ${
            isLight ? 'bg-purple-50 text-purple-800 border-purple-300' : 'bg-purple-950/90 text-purple-300 border-purple-800'
          }`}>
            Mystery
          </div>
        ) : null}
      </div>

      {/* Mortgaged Overlay */}
      {isMortgaged && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center z-10 pointer-events-none rounded-xl">
          <span className="px-1 py-0.5 rounded bg-rose-950 text-rose-200 text-[7px] sm:text-[8px] font-black font-mono border border-rose-600 shadow-md">
            MORTGAGED
          </span>
        </div>
      )}

      {/* Players on Tile - Compact Floating Badge */}
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
