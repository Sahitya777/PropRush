import React, { useState } from 'react';
import { GameRoom, Player, BoardTile } from '../types/game';
import { GROUP_COLORS } from '../data/boardTiles';
import { AvatarCharacter } from './AvatarCharacter';
import { sounds } from '../utils/audio';

interface TradeModalProps {
  room: GameRoom;
  tiles: BoardTile[];
  myPlayerId: string;
  onSendTradeOffer: (offer: {
    toPlayerId: string;
    offeredCash: number;
    offeredProperties: number[];
    requestedCash: number;
    requestedProperties: number[];
  }) => void;
  onAcceptTrade: () => void;
  onDeclineTrade: () => void;
  onClose: () => void;
}

export const TradeModal: React.FC<TradeModalProps> = ({
  room,
  tiles,
  myPlayerId,
  onSendTradeOffer,
  onAcceptTrade,
  onDeclineTrade,
  onClose
}) => {
  const myPlayer = room.players.find(p => p.id === myPlayerId);
  const otherPlayers = room.players.filter(p => p.id !== myPlayerId && !p.isBankrupt);

  const [targetPlayerId, setTargetPlayerId] = useState<string>(
    otherPlayers[0]?.id || ''
  );
  const [offeredCash, setOfferedCash] = useState<number>(0);
  const [offeredProperties, setOfferedProperties] = useState<number[]>([]);
  const [requestedCash, setRequestedCash] = useState<number>(0);
  const [requestedProperties, setRequestedProperties] = useState<number[]>([]);

  const activeTrade = room.activeTrade;
  const isIncomingTrade = activeTrade && activeTrade.toPlayerId === myPlayerId;
  const isOutgoingTrade = activeTrade && activeTrade.fromPlayerId === myPlayerId;

  if (!myPlayer) return null;
  const targetPlayer = room.players.find(p => p.id === targetPlayerId);

  const toggleOfferedProp = (id: number) => {
    sounds.playClick();
    setOfferedProperties(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleRequestedProp = (id: number) => {
    sounds.playClick();
    setRequestedProperties(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handlePropose = () => {
    if (!targetPlayerId) return;
    sounds.playCashRegister();
    onSendTradeOffer({
      toPlayerId: targetPlayerId,
      offeredCash,
      offeredProperties,
      requestedCash,
      requestedProperties
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl bg-[#181329] border-2 border-[#7059e2] rounded-2xl shadow-2xl p-5 overflow-hidden flex flex-col gap-4 max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🤝</span>
            <div>
              <h2 className="font-heading font-black text-lg text-white">
                PLAYER TRADE NEGOTIATION
              </h2>
              <p className="text-xs text-slate-400">Swap properties and balance cash</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Incoming Trade Review Stage */}
        {isIncomingTrade ? (
          <div className="space-y-4 p-4 rounded-xl bg-[#221b38] border border-amber-400/50">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📩</span>
              <div>
                <h4 className="font-heading font-bold text-base text-amber-300">
                  Trade Proposal Received!
                </h4>
                <p className="text-xs text-slate-300">
                  {room.players.find(p => p.id === activeTrade.fromPlayerId)?.name} is offering you a deal:
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-slate-900/70 rounded-xl border border-slate-800">
                <div className="text-emerald-400 font-bold mb-1">YOU WILL RECEIVE:</div>
                <div className="font-mono-code font-bold text-slate-200">+ ${activeTrade.offeredCash} Cash</div>
                <div className="mt-1 space-y-1">
                  {activeTrade.offeredProperties.map(id => (
                    <div key={id} className="text-slate-300">• {tiles[id]?.name}</div>
                  ))}
                  {activeTrade.offeredProperties.length === 0 && <span className="text-slate-500">No properties</span>}
                </div>
              </div>

              <div className="p-3 bg-slate-900/70 rounded-xl border border-slate-800">
                <div className="text-rose-400 font-bold mb-1">YOU GIVE UP:</div>
                <div className="font-mono-code font-bold text-slate-200">- ${activeTrade.requestedCash} Cash</div>
                <div className="mt-1 space-y-1">
                  {activeTrade.requestedProperties.map(id => (
                    <div key={id} className="text-slate-300">• {tiles[id]?.name}</div>
                  ))}
                  {activeTrade.requestedProperties.length === 0 && <span className="text-slate-500">No properties</span>}
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => {
                  sounds.playPayRent();
                  onDeclineTrade();
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 cursor-pointer"
              >
                Decline Offer
              </button>
              <button
                onClick={() => {
                  sounds.playCashRegister();
                  onAcceptTrade();
                }}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white cursor-pointer shadow-lg"
              >
                Accept Trade Deal
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Choose Partner */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Trade with:</span>
              <div className="flex gap-2 flex-wrap">
                {otherPlayers.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setTargetPlayerId(p.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all cursor-pointer ${
                      targetPlayerId === p.id
                        ? 'bg-[#7059e2] text-white border-[#8e76f7] shadow-md'
                        : 'bg-slate-900/70 text-slate-400 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    <AvatarCharacter avatarId={p.avatar} size="xs" />
                    <span>{p.name}</span>
                    <span className="text-[10px] text-amber-400 font-mono-code font-bold">(${p.cash})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Split Panel */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 overflow-y-auto pr-1">
              {/* Left: You Offer */}
              <div className="p-3.5 rounded-xl bg-[#201836] border border-slate-700/80 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                    You Offer (Your Cash: ${myPlayer.cash})
                  </span>
                </div>

                {/* Cash Input */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-300 font-mono-code font-bold">$</span>
                  <input
                    type="number"
                    min="0"
                    max={myPlayer.cash}
                    value={offeredCash || ''}
                    onChange={e => setOfferedCash(Math.min(myPlayer.cash, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                    placeholder="0"
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono-code focus:outline-none focus:border-[#7059e2]"
                  />
                </div>

                {/* Properties Owned by You */}
                <div className="text-xs text-slate-400 font-medium">Select Properties to Give:</div>
                <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                  {myPlayer.properties.length === 0 ? (
                    <div className="text-xs text-slate-500 italic py-2">You have no properties</div>
                  ) : (
                    myPlayer.properties.map(id => {
                      const t = tiles[id];
                      const isSelected = offeredProperties.includes(id);
                      const g = t.group ? GROUP_COLORS[t.group] : null;
                      return (
                        <div
                          key={id}
                          onClick={() => toggleOfferedProp(id)}
                          className={`p-2 rounded-lg text-xs flex items-center justify-between cursor-pointer border transition-all ${
                            isSelected
                              ? 'bg-[#7059e2]/30 border-[#7059e2] text-white font-bold'
                              : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800/80'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {g && <span className={`w-2.5 h-2.5 rounded-full ${g.bg}`} />}
                            <span>{t.name}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono-code">${t.price}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right: You Request */}
              <div className="p-3.5 rounded-xl bg-[#201836] border border-slate-700/80 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                    You Request ({targetPlayer?.name || 'Target'})
                  </span>
                </div>

                {/* Cash Input */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-300 font-mono-code font-bold">$</span>
                  <input
                    type="number"
                    min="0"
                    max={targetPlayer?.cash || 0}
                    value={requestedCash || ''}
                    onChange={e => setRequestedCash(Math.min(targetPlayer?.cash || 0, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                    placeholder="0"
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono-code focus:outline-none focus:border-[#7059e2]"
                  />
                </div>

                {/* Properties Owned by Target */}
                <div className="text-xs text-slate-400 font-medium">Select Properties to Receive:</div>
                <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                  {!targetPlayer || targetPlayer.properties.length === 0 ? (
                    <div className="text-xs text-slate-500 italic py-2">Player has no properties</div>
                  ) : (
                    targetPlayer.properties.map(id => {
                      const t = tiles[id];
                      const isSelected = requestedProperties.includes(id);
                      const g = t.group ? GROUP_COLORS[t.group] : null;
                      return (
                        <div
                          key={id}
                          onClick={() => toggleRequestedProp(id)}
                          className={`p-2 rounded-lg text-xs flex items-center justify-between cursor-pointer border transition-all ${
                            isSelected
                              ? 'bg-amber-500/30 border-amber-400 text-white font-bold'
                              : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800/80'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {g && <span className={`w-2.5 h-2.5 rounded-full ${g.bg}`} />}
                            <span>{t.name}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono-code">${t.price}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handlePropose}
                disabled={!targetPlayerId || (offeredCash === 0 && offeredProperties.length === 0 && requestedCash === 0 && requestedProperties.length === 0)}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#7059e2] to-[#8e76f7] hover:from-[#6047d8] hover:to-[#7f63f3] text-xs font-bold text-white disabled:opacity-40 cursor-pointer shadow-lg"
              >
                Send Trade Offer
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
