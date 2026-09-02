import React from 'react';
import { BoardTile, GameRoom, Player } from '../types/game';
import { BoardTileView } from './BoardTileView';
import { DiceRoller } from './DiceRoller';
import { AvatarCharacter } from './AvatarCharacter';
import { useTheme } from '../context/ThemeContext';

interface GameBoardProps {
  tiles: BoardTile[];
  room: GameRoom;
  activeTileId: number | null;
  onTileClick: (tile: BoardTile) => void;
  onRollDice: () => void;
  isRolling: boolean;
  canRoll: boolean;
  isMyTurn?: boolean;
  onBuyProperty?: () => void;
  onPassToAuction?: () => void;
  onPayJailFine?: () => void;
  onUseJailCard?: () => void;
  onEndTurn?: () => void;
  onToggleSpeed?: () => void;
  onStartGame?: () => void;
  isLobbyMode?: boolean;
  isHost?: boolean;
}

export const GameBoard: React.FC<GameBoardProps> = ({
  tiles,
  room,
  activeTileId,
  onTileClick,
  onRollDice,
  isRolling,
  canRoll,
  isMyTurn = false,
  onBuyProperty,
  onPassToAuction,
  onPayJailFine,
  onUseJailCard,
  onEndTurn,
  onToggleSpeed,
  onStartGame,
  isLobbyMode = false,
  isHost = false
}) => {
  const { isLight } = useTheme();
  const currentTurnPlayer = room.players.find(p => p.id === room.currentTurnPlayerId);

  // Find owner for tile
  const getTileOwner = (tileId: number): Player | undefined => {
    return room.players.find(p => p.properties.includes(tileId));
  };

  const isTileMortgaged = (tileId: number): boolean => {
    const owner = getTileOwner(tileId);
    return owner ? owner.mortgaged.includes(tileId) : false;
  };

  const getTileHouses = (tileId: number): number => {
    const owner = getTileOwner(tileId);
    return owner ? (owner.houses[tileId] || 0) : 0;
  };

  const getPlayersOnTile = (tileId: number): Player[] => {
    return room.players.filter(p => !p.isBankrupt && p.position === tileId);
  };

  // 11x11 Grid Layout Clockwise Mapper:
  // Top Row (row=0): 0 (START) -> 10 (In Prison)
  // Right Col (col=10): 10 -> 20 (Vacation)
  // Bottom Row (row=10): 20 -> 30 (Go to Prison)
  // Left Col (col=0): 30 -> 39 -> 0
  const getTileAtGrid = (row: number, col: number): BoardTile | null => {
    if (row === 0) {
      return tiles[col] || null; // 0 to 10
    }
    if (col === 10) {
      return tiles[10 + row] || null; // 11 to 20
    }
    if (row === 10) {
      return tiles[20 + (10 - col)] || null; // 21 to 30
    }
    if (col === 0) {
      return tiles[30 + (10 - row)] || null; // 31 to 39
    }
    return null;
  };

  const currentLandingTile = currentTurnPlayer ? tiles[currentTurnPlayer.position] : null;
  const recentLogs = room.logs.slice(0, 3);

  return (
    <div className={`w-full h-full max-h-full aspect-square p-1.5 sm:p-2 rounded-2xl border relative flex flex-col justify-between select-none ${
      isLight
        ? 'bg-slate-100 border-slate-300 shadow-xl'
        : 'bg-[#0c0919] border-[#2b2447] shadow-[0_0_50px_rgba(0,0,0,0.85)]'
    }`}>
      {/* 11x11 Grid Container */}
      <div className="grid grid-cols-11 grid-rows-11 w-full h-full gap-0.5 sm:gap-1">
        {Array.from({ length: 11 }).map((_, row) =>
          Array.from({ length: 11 }).map((_, col) => {
            const tile = getTileAtGrid(row, col);

            // Center Arena (Row 1-9, Col 1-9)
            if (!tile) {
              if (row === 1 && col === 1) {
                return (
                  <div
                    key="board-center-arena"
                    className={`col-span-9 row-span-9 rounded-xl border p-2 sm:p-4 flex flex-col justify-between relative overflow-hidden backdrop-blur-md ${
                      isLight
                        ? 'bg-gradient-to-br from-slate-50 via-white to-slate-100 border-slate-200 shadow-inner text-slate-800'
                        : 'bg-gradient-to-br from-[#151026]/98 via-[#18132c]/98 to-[#100c1e]/98 border-[#3b3260]/60 text-white'
                    }`}
                  >
                    {/* Background Subtle Watermark */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
                      <div className={`text-7xl sm:text-9xl font-black font-heading tracking-widest ${
                        isLight ? 'text-slate-900/5' : 'text-white opacity-4'
                      }`}>
                        PROPRUSH
                      </div>
                    </div>

                    {/* Top Center Bar: Resort Jackpot & Turbo Speed Toggle */}
                    <div className="flex items-center justify-between z-10">
                      {/* Vacation Resort Pool */}
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border ${
                        isLight
                          ? 'bg-amber-50 border-amber-300 text-amber-900'
                          : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                      }`}>
                        <span className="text-base sm:text-lg">🏖️</span>
                        <div>
                          <div className={`text-[9px] uppercase font-bold leading-none ${
                            isLight ? 'text-amber-800' : 'text-amber-400/80'
                          }`}>
                            Resort Pool
                          </div>
                          <div className={`text-xs sm:text-sm font-extrabold font-mono-code ${
                            isLight ? 'text-amber-900' : 'text-amber-300'
                          }`}>
                            ${room.freeParkingPool}
                          </div>
                        </div>
                      </div>

                      {/* Speed toggle */}
                      <button
                        onClick={onToggleSpeed}
                        className={`px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-bold font-mono-code border transition-all cursor-pointer ${
                          room.fastSpeed
                            ? 'bg-[#7059e2] text-white border-[#8e76f7] shadow-[0_0_10px_rgba(112,89,226,0.5)]'
                            : isLight
                            ? 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100 shadow-xs'
                            : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
                        }`}
                        title="Toggle 2x animation fast mode"
                      >
                        {room.fastSpeed ? '⚡ 2x TURBO' : '⏱️ 1x NORMAL'}
                      </button>
                    </div>

                    {/* Center Area: Big 3D Dice + Turn Actions */}
                    <div className="flex-1 flex flex-col items-center justify-center gap-2.5 my-1 z-10">
                      {/* 3D Dice Display */}
                      <div className="flex justify-center">
                        <DiceRoller
                          dice={room.lastDice}
                          isDouble={room.isDouble}
                          isRolling={isRolling}
                          canRoll={canRoll && !isLobbyMode}
                          onRoll={onRollDice}
                          timer={room.turnTimer}
                          fastSpeed={room.fastSpeed}
                          diceSkin={currentTurnPlayer?.diceSkin || 'dice_golden'}
                        />
                      </div>

                      {/* In Lobby Mode: Big Start Game Button (Gated to Creator only with min 2 players) */}
                      {isLobbyMode && (
                        <div className="flex flex-col items-center gap-2.5 animate-fade-in p-2 text-center max-w-xs">
                          {isHost ? (
                            room.players.length < 2 ? (
                              <div className="flex flex-col items-center gap-1.5">
                                <button
                                  disabled
                                  id="btn-start-game-center-disabled"
                                  className="px-6 py-2.5 rounded-2xl font-heading font-extrabold text-sm bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed opacity-75 shadow-none"
                                >
                                  🔒 Start Game (Min 2 Players)
                                </button>
                                <span className="text-[11px] text-amber-400 font-bold">
                                  Waiting for 1 more player to join...
                                </span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-1.5">
                                <button
                                  id="btn-start-game-center"
                                  onClick={onStartGame}
                                  className="px-8 py-3 rounded-2xl font-heading font-extrabold text-base bg-gradient-to-r from-emerald-500 via-[#7059e2] to-[#9179ff] hover:from-emerald-400 hover:to-[#8066f2] text-white shadow-[0_0_25px_rgba(112,89,226,0.65)] cursor-pointer transition-all transform active:scale-95 animate-pulse"
                                >
                                  🚀 Start Game ({room.players.length} Ready)
                                </button>
                                <span className={`text-[11px] font-mono-code ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                                  Click to launch match for all players
                                </span>
                              </div>
                            )
                          ) : (
                            <div className="flex flex-col items-center gap-1.5">
                              <div className="text-xs font-heading font-bold text-purple-300 flex items-center gap-1.5">
                                <span className="animate-spin text-sm">⏳</span>
                                <span>Waiting for Room Creator to start...</span>
                              </div>
                              <span className={`text-[11px] font-mono-code ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                                {room.players.length} players in room {room.code}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Active Turn Actions (Roll, Buy Property, End Turn, Jail Decisions) */}
                      {!isLobbyMode && (
                        <div className="flex flex-col items-center gap-2">
                          {/* 1. Unclaimed Property Buy / Pass Decision */}
                          {room.turnPhase === 'buy_decision' && currentLandingTile && isMyTurn && (
                            <div className="flex flex-wrap items-center justify-center gap-2 animate-fade-in">
                              <button
                                id="btn-buy-property"
                                disabled={(currentTurnPlayer?.cash || 0) < (currentLandingTile.price || 0)}
                                onClick={onBuyProperty}
                                className="px-5 py-2 rounded-xl text-xs sm:text-sm font-heading font-bold bg-[#7059e2] hover:bg-[#5f45d8] disabled:opacity-50 text-white cursor-pointer shadow-lg transition-all flex items-center gap-1.5"
                              >
                                <span>🛒</span> Buy for ${currentLandingTile.price}
                              </button>
                              <button
                                id="btn-end-turn-pass"
                                onClick={onEndTurn}
                                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-heading font-bold cursor-pointer shadow-md flex items-center gap-1.5 transition-all ${
                                  isLight
                                    ? 'bg-slate-200 hover:bg-slate-300 text-slate-800 border border-slate-300'
                                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                                }`}
                              >
                                <span>✓</span> End turn
                              </button>
                            </div>
                          )}

                          {/* 2. Action Phase End Turn Button */}
                          {room.turnPhase === 'action' && isMyTurn && !room.isDouble && (
                            <button
                              id="btn-end-turn"
                              onClick={onEndTurn}
                              className="px-6 py-2 rounded-xl font-heading font-bold text-xs sm:text-sm bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-lg cursor-pointer transition-all active:scale-95 flex items-center gap-1.5"
                            >
                              <span>✓</span> End turn
                            </button>
                          )}

                          {/* 4. Jail Decisions */}
                          {room.turnPhase === 'jail_decision' && currentTurnPlayer?.inJail && isMyTurn && (
                            <div className="flex flex-wrap items-center justify-center gap-2">
                              <button
                                onClick={onRollDice}
                                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#7059e2] hover:bg-[#5e46d0] text-white cursor-pointer shadow"
                              >
                                🎲 Roll Doubles
                              </button>
                              {currentTurnPlayer.cash >= 50 && (
                                <button
                                  onClick={onPayJailFine}
                                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white cursor-pointer shadow"
                                >
                                  💸 Pay $50 Fine
                                </button>
                              )}
                              {currentTurnPlayer.getOutOfJailCards > 0 && (
                                <button
                                  onClick={onUseJailCard}
                                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow"
                                >
                                  🎫 Use Card
                                </button>
                              )}
                            </div>
                          )}

                          {/* 5. Waiting for opponent turn indicator */}
                          {!isMyTurn && currentTurnPlayer && (
                            <div className="flex flex-col items-center gap-1.5 animate-fade-in py-1">
                              <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full border shadow-md text-xs font-heading font-bold ${
                                isLight 
                                  ? 'bg-purple-50/95 border-purple-200 text-purple-900' 
                                  : 'bg-[#1e1738]/95 border-[#7059e2]/40 text-purple-200'
                              }`}>
                                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                                <span>{currentTurnPlayer.isBot ? '🤖' : '👤'} {currentTurnPlayer.name}'s turn</span>
                                <span className="text-[11px] font-mono-code font-bold opacity-80">({room.turnTimer}s)</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Bottom Center Area: Live Game Announcement Feed */}
                    <div className={`w-full border rounded-xl p-2 z-10 flex flex-col gap-1 max-h-16 overflow-hidden ${
                      isLight
                        ? 'bg-white/90 border-slate-200 shadow-xs'
                        : 'bg-[#100c1e]/80 border-[#2b2447]/60'
                    }`}>
                      {recentLogs.length > 0 ? (
                        recentLogs.map(log => (
                          <div
                            key={log.id}
                            className={`text-[10px] sm:text-[11px] font-medium leading-tight truncate flex items-center gap-1.5 ${
                              isLight ? 'text-slate-700' : 'text-slate-300'
                            }`}
                          >
                            <span className="text-[#7059e2] font-bold">›</span>
                            <span>{log.text}</span>
                          </div>
                        ))
                      ) : (
                        <div className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                          Game started with a randomized players order. Good luck!
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
              return null;
            }

            const owner = getTileOwner(tile.id);
            const isMortgaged = isTileMortgaged(tile.id);
            const housesCount = getTileHouses(tile.id);
            const playersHere = getPlayersOnTile(tile.id);
            const isActive = activeTileId === tile.id;

            return (
              <BoardTileView
                key={`tile-${tile.id}`}
                tile={tile}
                owner={owner}
                isMortgaged={isMortgaged}
                housesCount={housesCount}
                playersOnTile={playersHere}
                isActiveTile={isActive}
                onClick={() => onTileClick(tile)}
                orientation={
                  row === 0 ? 'top' : row === 10 ? 'bottom' : col === 0 ? 'left' : 'right'
                }
              />
            );
          })
        )}
      </div>
    </div>
  );
};
