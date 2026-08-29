import React, { useState, useEffect, useRef } from 'react';
import { GameRoom, Player, BoardTile } from '../types/game';
import { BASE_BOARD_TILES, CHANCE_CARDS, CHEST_CARDS, GROUP_PROPERTY_COUNTS } from '../data/boardTiles';
import { useUser } from '../context/UserContext';
import { GameBoard } from '../components/GameBoard';
import { PropertyCardModal } from '../components/PropertyCardModal';
import { AuctionModal } from '../components/AuctionModal';
import { TradeModal } from '../components/TradeModal';
import { GameOverModal } from '../components/GameOverModal';
import { AvatarCharacter } from '../components/AvatarCharacter';
import { sounds } from '../utils/audio';
import { saveActiveMatch, getActiveMatch, markDisconnected, clearActiveMatch } from '../utils/reconnectStorage';

interface GameRoomViewProps {
  roomConfig: {
    roomCode: string;
    roomName: string;
    maxPlayers: number;
    betAmount: number;
    initialCash: number;
    turnTimeSeconds: number;
    boardTheme: string;
    fillWithBots: boolean;
  };
  onLeaveRoom: () => void;
  isMuted?: boolean;
  onToggleMute?: () => void;
  onOpenRules?: () => void;
}

export const GameRoomView: React.FC<GameRoomViewProps> = ({
  roomConfig,
  onLeaveRoom,
  isMuted = false,
  onToggleMute,
  onOpenRules
}) => {
  const { user, recordMatchResult, equipItem, updateUser } = useUser();

  // Check if resuming an existing active match
  const savedActive = getActiveMatch();
  const isResuming = Boolean(
    savedActive &&
    savedActive.roomConfig.roomCode.toLowerCase() === roomConfig.roomCode.toLowerCase() &&
    savedActive.room.status === 'playing'
  );

  // Create initial players
  const botNames = ['bu', 'CryptoBaron', 'PixelTycoon', 'QueenVee'];
  const botAvatars = ['bu', 'apple', 'ghost', 'cyber', 'king'];
  const botFrames = ['pfp_neon', 'pfp_crown', 'pfp_fire', 'pfp_diamond'];
  const botDiceSkins = ['dice_neon', 'dice_ruby', 'dice_magma', 'dice_cyber', 'dice_cosmic', 'dice_rainbow', 'dice_dragon'];
  const playerColors = ['#ff7844', '#b066fe', '#10b981', '#06b6d4', '#ec4899', '#eab308'];

  const initialPlayers: Player[] = [
    {
      id: user.id,
      name: user.username,
      avatar: user.avatar || 'orange',
      avatarFrame: user.avatarFrame,
      diceSkin: user.diceSkin || 'dice_golden',
      color: playerColors[0],
      cash: roomConfig.initialCash,
      netWorth: roomConfig.initialCash,
      position: 0,
      inJail: false,
      jailTurns: 0,
      getOutOfJailCards: 0,
      properties: [],
      mortgaged: [],
      houses: {},
      isBankrupt: false,
      isBot: false,
      isHost: true
    }
  ];

  for (let i = 1; i < roomConfig.maxPlayers; i++) {
    initialPlayers.push({
      id: 'bot_' + i,
      name: botNames[i - 1] || `Tycoon_${i}`,
      avatar: botAvatars[i - 1] || 'bu',
      avatarFrame: botFrames[i - 1] || undefined,
      diceSkin: botDiceSkins[(i - 1) % botDiceSkins.length],
      color: playerColors[i % playerColors.length],
      cash: roomConfig.initialCash,
      netWorth: roomConfig.initialCash,
      position: 0,
      inJail: false,
      jailTurns: 0,
      getOutOfJailCards: 0,
      properties: [],
      mortgaged: [],
      houses: {},
      isBankrupt: false,
      isBot: true
    });
  }

  // Master Room State (Restores from saved active match if rejoining within 2 mins)
  const [room, setRoom] = useState<GameRoom>(() => {
    if (isResuming && savedActive) {
      return savedActive.room;
    }
    return {
      id: roomConfig.roomCode,
      name: roomConfig.roomName,
      code: roomConfig.roomCode,
      hostId: user.id,
      players: initialPlayers,
      status: 'playing', // Active game ready to roll
      currentTurnPlayerId: user.id,
      currentTurnIndex: 0,
      turnPhase: 'roll',
      turnTimer: roomConfig.turnTimeSeconds || 15,
      lastDice: [1, 2],
      isDouble: false,
      doubleCount: 0,
      freeParkingPool: 100, // starting resort pool
      auction: null,
      activeTrade: null,
      pendingCard: null,
      logs: [
        { id: 'l1', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), text: `Game started with a randomized players order. Good luck!`, type: 'info' }
      ],
      betAmount: roomConfig.betAmount,
      totalPrizePool: roomConfig.betAmount * roomConfig.maxPlayers,
      platformFeeRate: 0.05,
      boardTheme: roomConfig.boardTheme,
      fastSpeed: true
    };
  });

  const [tiles] = useState<BoardTile[]>(BASE_BOARD_TILES);
  const [selectedTile, setSelectedTile] = useState<BoardTile | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [showForfeitConfirmModal, setShowForfeitConfirmModal] = useState(false);
  const [showAppearanceModal, setShowAppearanceModal] = useState(false);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [matchSummaryStats, setMatchSummaryStats] = useState<any>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Chat message state & smart floating drawer state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{ id: string; sender: string; avatar: string; text: string; time: string }[]>(() => {
    if (isResuming && savedActive && savedActive.chatMessages.length > 0) {
      return savedActive.chatMessages;
    }
    return [
      { id: 'c1', sender: 'System', avatar: 'navy', text: 'Welcome to PropRush! Have fun and play fair.', time: '12:00' }
    ];
  });

  // Cash change indicator badges map: playerId -> { delta: number, key: number }
  const [cashDeltas, setCashDeltas] = useState<Record<string, { delta: number; key: number }>>({});

  const showCashDelta = (playerId: string, amount: number) => {
    setCashDeltas(prev => ({
      ...prev,
      [playerId]: { delta: amount, key: Date.now() }
    }));
  };

  // Turn timer ref
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isRollingRef = useRef<boolean>(false);
  const lastLogRef = useRef<{ text: string; time: number }>({ text: '', time: 0 });

  // Auto-save active match whenever room or chat state updates
  useEffect(() => {
    if (room.status === 'playing') {
      saveActiveMatch(room, roomConfig, chatMessages);
    }
  }, [room, chatMessages, roomConfig]);

  // Log on resumption
  useEffect(() => {
    if (isResuming) {
      addLog(`🔄 Reconnected to room ${roomConfig.roomCode.toUpperCase()}! Full match state and bankroll restored.`, 'info');
    }
  }, []);

  const addLog = (text: string, type: 'move' | 'buy' | 'rent' | 'card' | 'jail' | 'auction' | 'info' = 'info') => {
    const now = Date.now();
    if (lastLogRef.current.text === text && now - lastLogRef.current.time < 1200) {
      return; // Deduplicate rapid duplicate logs
    }
    lastLogRef.current = { text, time: now };

    setRoom(prev => {
      if (prev.logs.length > 0 && prev.logs[0].text === text) {
        return prev;
      }
      return {
        ...prev,
        logs: [
          { id: 'log_' + Date.now() + Math.random().toString(36).substring(2, 6), timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), text, type },
          ...prev.logs.slice(0, 30)
        ]
      };
    });
  };

  const calculateNetWorth = (player: Player): number => {
    let propValue = 0;
    player.properties.forEach(pid => {
      const t = tiles[pid];
      if (t && t.price) {
        propValue += player.mortgaged.includes(pid) ? Math.floor(t.price / 2) : t.price;
        const houses = player.houses[pid] || 0;
        if (houses > 0 && t.houseCost) {
          propValue += houses * t.houseCost;
        }
      }
    });
    return player.cash + propValue;
  };

  // Switch to next active player
  const nextTurn = () => {
    setRoom(prev => {
      const activePlayers = prev.players.filter(p => !p.isBankrupt);
      if (activePlayers.length <= 1 && prev.status === 'playing') {
        const winner = activePlayers[0] || prev.players[0];
        handleGameOver(winner);
        return prev;
      }

      let nextIndex = (prev.currentTurnIndex + 1) % prev.players.length;
      while (prev.players[nextIndex].isBankrupt) {
        nextIndex = (nextIndex + 1) % prev.players.length;
      }

      const nextPlayer = prev.players[nextIndex];

      return {
        ...prev,
        currentTurnIndex: nextIndex,
        currentTurnPlayerId: nextPlayer.id,
        turnPhase: nextPlayer.inJail ? 'jail_decision' : 'roll',
        turnTimer: roomConfig.turnTimeSeconds || 15,
        isDouble: false,
        doubleCount: 0,
        pendingCard: null
      };
    });
  };

  const handleGameOver = (winner: Player) => {
    sounds.playWin();
    clearActiveMatch();
    const finalPlacement = winner.id === user.id ? 1 : 2;
    const statsResult = recordMatchResult({
      roomName: room.name,
      placement: finalPlacement,
      totalPlayers: room.players.length,
      betAmount: room.betAmount,
      payout: finalPlacement === 1 ? room.totalPrizePool * (1 - room.platformFeeRate) : 0,
      netWorth: winner.netWorth,
      durationMinutes: 6,
      stats: {
        rentCollected: 1200,
        propertiesBought: winner.properties.length,
        housesBuilt: Object.values(winner.houses).reduce((a, b) => a + b, 0),
        doublesRolled: 3
      }
    });

    setMatchSummaryStats(statsResult);
    setRoom(prev => ({
      ...prev,
      status: 'finished',
      winner: winner.name
    }));
  };

  // Handle dice rolling and tile resolution
  const handleRollDice = () => {
    if (isRolling || isRollingRef.current) return;
    isRollingRef.current = true;
    setIsRolling(true);
    sounds.playDiceRoll();

    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    const isDouble = d1 === d2;
    const totalSteps = d1 + d2;

    setTimeout(() => {
      isRollingRef.current = false;
      setIsRolling(false);
      executeMove(d1, d2, totalSteps, isDouble);
    }, room.fastSpeed ? 350 : 650);
  };

  const executeMove = (d1: number, d2: number, steps: number, isDouble: boolean) => {
    setRoom(prev => {
      const currentPlayerIndex = prev.currentTurnIndex;
      const player = { ...prev.players[currentPlayerIndex] };

      let doubleCount = isDouble ? prev.doubleCount + 1 : 0;
      let freeParkingPool = prev.freeParkingPool;

      // 3 consecutive doubles -> Go to prison
      if (doubleCount >= 3) {
        player.inJail = true;
        player.jailTurns = 0;
        player.position = 10;
        addLog(`🚨 ${player.name} rolled 3 doubles and was sent directly to prison!`, 'jail');
        sounds.playJail();

        const updatedPlayers = [...prev.players];
        updatedPlayers[currentPlayerIndex] = player;

        return {
          ...prev,
          players: updatedPlayers,
          lastDice: [d1, d2],
          isDouble: false,
          doubleCount: 0,
          turnPhase: 'action'
        };
      }

      // In jail check
      if (player.inJail) {
        if (isDouble) {
          player.inJail = false;
          player.jailTurns = 0;
          addLog(`🔓 ${player.name} rolled doubles (${d1}+${d2}) and escaped prison!`, 'jail');
          sounds.playEscape();
        } else {
          player.jailTurns += 1;
          if (player.jailTurns >= 3) {
            player.inJail = false;
            player.cash -= 50;
            player.jailTurns = 0;
            freeParkingPool += 50;
            showCashDelta(player.id, -50);
            addLog(`${player.name} served 3 turns, paid $50 fine into Resort Pool and was released.`, 'jail');
          } else {
            addLog(`${player.name} failed to roll doubles and stays in prison (${player.jailTurns}/3).`, 'jail');
            const updatedPlayers = [...prev.players];
            updatedPlayers[currentPlayerIndex] = player;
            return {
              ...prev,
              players: updatedPlayers,
              lastDice: [d1, d2],
              isDouble: false,
              turnPhase: 'action',
              freeParkingPool
            };
          }
        }
      }

      // Calculate new position
      const oldPos = player.position;
      const newPos = (oldPos + steps) % 40;
      player.position = newPos;

      // Pass START (+$200) vs Land on START (+$300)
      if (newPos === 0) {
        player.cash += 300;
        player.netWorth = calculateNetWorth(player);
        showCashDelta(player.id, 300);
        addLog(`🚀 ${player.name} landed on START and collected $300 salary!`, 'rent');
        sounds.playPassGo();
      } else if (newPos < oldPos && oldPos !== 0) {
        player.cash += 200;
        player.netWorth = calculateNetWorth(player);
        showCashDelta(player.id, 200);
        addLog(`🚀 ${player.name} passed START and collected $200!`, 'rent');
        sounds.playPassGo();
      }

      const landedTile = tiles[newPos];
      let newPhase: GameRoom['turnPhase'] = 'action';
      let pendingCard = null;

      addLog(`${player.name} rolled ${d1}+${d2} (${steps}) and landed on ${landedTile.name}.`, 'move');

      // Tile Actions
      if (landedTile.type === 'gotojail') {
        player.inJail = true;
        player.jailTurns = 0;
        player.position = 10;
        addLog(`🔒 ${player.name} landed on Go to Prison and was locked up!`, 'jail');
        sounds.playJail();
      } else if (landedTile.type === 'vacation') {
        if (freeParkingPool > 0) {
          player.cash += freeParkingPool;
          player.netWorth = calculateNetWorth(player);
          showCashDelta(player.id, freeParkingPool);
          addLog(`🏖️ ${player.name} landed on Vacation and collected the $${freeParkingPool} Resort Pool!`, 'rent');
          sounds.playCashRegister();
          freeParkingPool = 0; // Reset pool to 0 for next tax cycle
        } else {
          addLog(`🏖️ ${player.name} is resting on Vacation (Pool is currently $0).`, 'info');
        }
      } else if (landedTile.type === 'tax') {
        const taxVal = landedTile.taxAmount || 100;
        player.cash -= taxVal;
        player.netWorth = calculateNetWorth(player);
        freeParkingPool += taxVal; // Tax is deposited into vacation pool
        showCashDelta(player.id, -taxVal);
        addLog(`💸 ${player.name} paid $${taxVal} tax into the Resort Pool.`, 'rent');
        sounds.playPayRent();
      } else if (landedTile.type === 'chance' || landedTile.type === 'chest') {
        const cardDeck = landedTile.type === 'chance' ? CHANCE_CARDS : CHEST_CARDS;
        const randomCard = cardDeck[Math.floor(Math.random() * cardDeck.length)];
        pendingCard = {
          type: landedTile.type,
          title: randomCard.title,
          description: randomCard.description
        };
        sounds.playChance();
        addLog(`🎴 ${player.name} drew: ${randomCard.title}`, 'card');

        if (randomCard.action === 'cash' && randomCard.value) {
          player.cash += randomCard.value;
          player.netWorth = calculateNetWorth(player);
          showCashDelta(player.id, randomCard.value);
          if (randomCard.value < 0) {
            const fineAmount = Math.abs(randomCard.value);
            freeParkingPool += fineAmount;
            addLog(`💸 ${player.name} paid $${fineAmount} penalty into the Resort Pool.`, 'rent');
          }
        } else if (randomCard.action === 'goto' && randomCard.tileId !== undefined) {
          player.position = randomCard.tileId;
          if (randomCard.tileId === 0) {
            player.cash += 300;
            showCashDelta(player.id, 300);
            addLog(`🚀 ${player.name} landed on START and collected $300!`, 'rent');
          }
        } else if (randomCard.action === 'jail') {
          player.inJail = true;
          player.jailTurns = 0;
          player.position = 10;
        } else if (randomCard.action === 'out_of_jail') {
          player.getOutOfJailCards += 1;
        }
      } else if (landedTile.type === 'property' || landedTile.type === 'railroad' || landedTile.type === 'utility') {
        const owner = prev.players.find(p => p.properties.includes(landedTile.id));
        if (!owner) {
          newPhase = 'buy_decision';
        } else if (owner.id !== player.id && !owner.mortgaged.includes(landedTile.id) && !owner.inJail) {
          // Pay rent
          let rentAmount = landedTile.rent ? landedTile.rent[0] : 10;
          const houses = owner.houses[landedTile.id] || 0;
          if (houses > 0 && landedTile.rent && landedTile.rent[houses]) {
            rentAmount = landedTile.rent[houses];
          }

          player.cash -= rentAmount;
          owner.cash += rentAmount;
          player.netWorth = calculateNetWorth(player);
          owner.netWorth = calculateNetWorth(owner);

          showCashDelta(player.id, -rentAmount);
          showCashDelta(owner.id, rentAmount);

          addLog(`💰 ${player.name} paid $${rentAmount} rent to ${owner.name} for ${landedTile.name}.`, 'rent');
          sounds.playPayRent();
        }
      }

      // Check bankruptcy
      if (player.cash < 0) {
        player.isBankrupt = true;
        addLog(`💀 ${player.name} went bankrupt and is out of the game!`, 'info');
        sounds.playBankrupt();
      }

      const updatedPlayers = [...prev.players];
      updatedPlayers[currentPlayerIndex] = player;

      return {
        ...prev,
        players: updatedPlayers,
        lastDice: [d1, d2],
        isDouble,
        doubleCount,
        turnPhase: newPhase,
        pendingCard,
        freeParkingPool
      };
    });
  };

  // Buy Property Handler
  const handleBuyProperty = () => {
    setRoom(prev => {
      const currentPlayerIndex = prev.currentTurnIndex;
      const player = { ...prev.players[currentPlayerIndex] };
      const tile = tiles[player.position];

      if (!tile || !tile.price || player.cash < tile.price) return prev;

      player.cash -= tile.price;
      player.properties = [...player.properties, tile.id];
      player.netWorth = calculateNetWorth(player);

      showCashDelta(player.id, -tile.price);
      addLog(`🏠 ${player.name} purchased ${tile.name} for $${tile.price}!`, 'buy');
      sounds.playCashRegister();

      const updatedPlayers = [...prev.players];
      updatedPlayers[currentPlayerIndex] = player;

      return {
        ...prev,
        players: updatedPlayers,
        turnPhase: 'action'
      };
    });
  };

  // Pass to Auction
  const handlePassToAuction = () => {
    setRoom(prev => {
      const player = prev.players[prev.currentTurnIndex];
      const tile = tiles[player.position];
      if (!tile || !tile.price) return { ...prev, turnPhase: 'action' };

      const activeIds = prev.players.filter(p => !p.isBankrupt).map(p => p.id);

      addLog(`🔨 ${player.name} passed on ${tile.name}. Speed Auction started!`, 'auction');
      sounds.playAuction();

      return {
        ...prev,
        turnPhase: 'auction',
        auction: {
          tileId: tile.id,
          highestBid: 10,
          highestBidderId: null,
          activePlayerIds: activeIds,
          currentBidderIndex: 0,
          timer: 15,
          bidHistory: []
        }
      };
    });
  };

  // Auction Place Bid
  const handlePlaceBid = (amount: number) => {
    setRoom(prev => {
      if (!prev.auction) return prev;
      const bidder = prev.players.find(p => p.id === user.id);
      if (!bidder || bidder.cash < amount) return prev;

      sounds.playCashRegister();
      addLog(`🔨 ${bidder.name} bid $${amount} for ${tiles[prev.auction.tileId].name}.`, 'auction');

      return {
        ...prev,
        auction: {
          ...prev.auction,
          highestBid: amount,
          highestBidderId: user.id,
          timer: 10,
          bidHistory: [
            { playerId: user.id, amount, time: new Date().toLocaleTimeString([], { minute: '2-digit', second: '2-digit' }) },
            ...prev.auction.bidHistory
          ]
        }
      };
    });
  };

  // Jail Fine & Card
  const handlePayJailFine = () => {
    setRoom(prev => {
      const p = { ...prev.players[prev.currentTurnIndex] };
      if (p.cash < 50) return prev;
      p.cash -= 50;
      p.inJail = false;
      p.jailTurns = 0;
      showCashDelta(p.id, -50);
      addLog(`💸 ${p.name} paid $50 fine into Resort Pool and is out of prison.`, 'jail');
      sounds.playEscape();

      const updated = [...prev.players];
      updated[prev.currentTurnIndex] = p;
      return {
        ...prev,
        players: updated,
        freeParkingPool: prev.freeParkingPool + 50,
        turnPhase: 'roll'
      };
    });
  };

  const handleUseJailCard = () => {
    setRoom(prev => {
      const p = { ...prev.players[prev.currentTurnIndex] };
      if (p.getOutOfJailCards <= 0) return prev;
      p.getOutOfJailCards -= 1;
      p.inJail = false;
      p.jailTurns = 0;
      addLog(`🎫 ${p.name} used a Get Out of Jail Free card!`, 'jail');
      sounds.playEscape();

      const updated = [...prev.players];
      updated[prev.currentTurnIndex] = p;
      return { ...prev, players: updated, turnPhase: 'roll' };
    });
  };

  // Property Building (Monopoly set ownership, turn-based, even-building rules, and cash deduction)
  const handleBuildHouse = (tileId: number) => {
    setRoom(prev => {
      // Must be player's turn to build
      if (prev.currentTurnPlayerId !== user.id || prev.status !== 'playing') return prev;

      const p = { ...prev.players.find(x => x.id === user.id)! };
      const tile = tiles[tileId];
      if (!tile || !tile.houseCost || !tile.group || p.cash < tile.houseCost) return prev;

      // Check complete monopoly set ownership
      const groupTiles = tiles.filter(t => t.type === 'property' && t.group === tile.group);
      const ownsAllInGroup = groupTiles.every(t => p.properties.includes(t.id));
      if (!ownsAllInGroup) return prev;

      // Check no mortgaged properties in the color set
      const anyMortgaged = groupTiles.some(t => p.mortgaged.includes(t.id));
      if (anyMortgaged) return prev;

      const currentHouses = p.houses[tileId] || 0;
      if (currentHouses >= 5) return prev;

      // Even building rule: cannot build if this property already has more houses than any other property in the group
      const groupHouses = groupTiles.map(t => p.houses[t.id] || 0);
      const minHouses = Math.min(...groupHouses);
      if (currentHouses !== minHouses) return prev;

      p.cash -= tile.houseCost;
      p.houses[tileId] = currentHouses + 1;
      p.netWorth = calculateNetWorth(p);

      showCashDelta(p.id, -tile.houseCost);
      addLog(`🏗️ ${p.name} upgraded ${tile.name} to ${p.houses[tileId] === 5 ? 'Hotel 🏨' : `${p.houses[tileId]} Houses 🏠`}.`, 'buy');
      sounds.playBuild();

      const updated = prev.players.map(x => (x.id === p.id ? p : x));
      return { ...prev, players: updated };
    });
  };

  const handleSellHouse = (tileId: number) => {
    setRoom(prev => {
      // Must be player's turn to sell
      if (prev.currentTurnPlayerId !== user.id || prev.status !== 'playing') return prev;

      const p = { ...prev.players.find(x => x.id === user.id)! };
      const tile = tiles[tileId];
      const currentHouses = p.houses[tileId] || 0;
      if (!tile || currentHouses <= 0 || !tile.group) return prev;

      // Even selling rule: must sell from the property with the most houses in the group
      const groupTiles = tiles.filter(t => t.type === 'property' && t.group === tile.group);
      const groupHouses = groupTiles.map(t => p.houses[t.id] || 0);
      const maxHouses = Math.max(...groupHouses);
      if (currentHouses !== maxHouses) return prev;

      const refund = Math.floor((tile.houseCost || 100) / 2);
      p.cash += refund;
      p.houses[tileId] = currentHouses - 1;
      p.netWorth = calculateNetWorth(p);

      showCashDelta(p.id, refund);
      addLog(`🏚️ ${p.name} sold a building on ${tile.name} for $${refund}.`, 'buy');

      const updated = prev.players.map(x => (x.id === p.id ? p : x));
      return { ...prev, players: updated };
    });
  };

  const handleMortgage = (tileId: number) => {
    setRoom(prev => {
      // Must be player's turn to mortgage
      if (prev.currentTurnPlayerId !== user.id || prev.status !== 'playing') return prev;

      const p = { ...prev.players.find(x => x.id === user.id)! };
      const tile = tiles[tileId];
      if (!tile || !tile.mortgageValue || p.mortgaged.includes(tileId)) return prev;

      // Cannot mortgage if any property in the group has houses
      if (tile.group && tile.type === 'property') {
        const groupTiles = tiles.filter(t => t.type === 'property' && t.group === tile.group);
        const hasAnyHouses = groupTiles.some(t => (p.houses[t.id] || 0) > 0);
        if (hasAnyHouses) return prev;
      }

      p.cash += tile.mortgageValue;
      p.mortgaged = [...p.mortgaged, tileId];
      p.netWorth = calculateNetWorth(p);

      showCashDelta(p.id, tile.mortgageValue);
      addLog(`📑 ${p.name} mortgaged ${tile.name} for $${tile.mortgageValue}.`, 'buy');

      const updated = prev.players.map(x => (x.id === p.id ? p : x));
      return { ...prev, players: updated };
    });
  };

  const handleUnmortgage = (tileId: number) => {
    setRoom(prev => {
      // Must be player's turn to unmortgage
      if (prev.currentTurnPlayerId !== user.id || prev.status !== 'playing') return prev;

      const p = { ...prev.players.find(x => x.id === user.id)! };
      const tile = tiles[tileId];
      if (!tile || !tile.mortgageValue || !p.mortgaged.includes(tileId)) return prev;

      const cost = Math.round(tile.mortgageValue * 1.1);
      if (p.cash < cost) return prev;

      p.cash -= cost;
      p.mortgaged = p.mortgaged.filter(id => id !== tileId);
      p.netWorth = calculateNetWorth(p);

      showCashDelta(p.id, -cost);
      addLog(`💵 ${p.name} unmortgaged ${tile.name} for $${cost}.`, 'buy');

      const updated = prev.players.map(x => (x.id === p.id ? p : x));
      return { ...prev, players: updated };
    });
  };

  // Helper to send chat message and handle unread counter
  const sendChatMessage = (sender: string, avatar: string, text: string) => {
    const newMsg = {
      id: 'chat_' + Date.now() + Math.random().toString(36).substring(2, 5),
      sender,
      avatar,
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setChatMessages(prev => [...prev.slice(-30), newMsg]);
    if (!isChatOpen && sender !== user.username) {
      setUnreadChatCount(prev => prev + 1);
    }
  };

  // Active 30-Second Turn Countdown Effect
  useEffect(() => {
    if (room.status !== 'playing') return;

    const interval = setInterval(() => {
      setRoom(prev => {
        if (prev.status !== 'playing') return prev;
        if (prev.turnTimer <= 1) {
          return { ...prev, turnTimer: 0 };
        }
        return { ...prev, turnTimer: prev.turnTimer - 1 };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [room.status, room.currentTurnPlayerId]);

  // Handle Timeout Auto-Action when 30s Timer reaches 0
  useEffect(() => {
    if (room.status !== 'playing' || room.turnTimer > 0) return;

    const current = room.players.find(p => p.id === room.currentTurnPlayerId);
    if (!current || current.isBankrupt || current.isBot) return;

    // Timeout expired for human player! Auto execute current phase action
    if (room.turnPhase === 'roll') {
      handleRollDice();
    } else if (room.turnPhase === 'jail_decision') {
      if (current.cash >= 50) {
        handlePayJailFine();
      } else {
        handleRollDice();
      }
    } else if (room.turnPhase === 'buy_decision') {
      nextTurn();
    } else if (room.turnPhase === 'action') {
      nextTurn();
    }
  }, [room.turnTimer, room.turnPhase, room.status, room.currentTurnPlayerId]);

  // Bot Turn Automation
  useEffect(() => {
    if (room.status !== 'playing') return;
    const current = room.players.find(p => p.id === room.currentTurnPlayerId);
    if (!current || !current.isBot || current.isBankrupt) return;

    const delay = room.fastSpeed ? 500 : 1000;

    const botTimer = setTimeout(() => {
      if (isRollingRef.current) return;
      if (room.turnPhase === 'jail_decision') {
        if (current.cash >= 50) {
          handlePayJailFine();
        } else {
          handleRollDice();
        }
      } else if (room.turnPhase === 'roll') {
        handleRollDice();
      } else if (room.turnPhase === 'buy_decision') {
        const landingTile = tiles[current.position];
        if (landingTile && landingTile.price && current.cash >= landingTile.price + 150) {
          handleBuyProperty();
          if (Math.random() < 0.25) {
            const banter = ['Nice estate!', 'Adding this to my portfolio 🏙️', 'Good deal! 💸', 'Watch out for my rent next round!'];
            sendChatMessage(current.name, current.avatar, banter[Math.floor(Math.random() * banter.length)]);
          }
        } else {
          nextTurn();
        }
      } else if (room.turnPhase === 'action') {
        nextTurn();
      }
    }, delay);

    return () => clearTimeout(botTimer);
  }, [room.currentTurnPlayerId, room.turnPhase, room.status, isRolling]);

  // Handle Chat Send
  const handleSendChat = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim()) return;

    sounds.playClick();
    sendChatMessage(user.username, user.avatar || 'orange', chatInput.trim());
    setChatInput('');
  };

  const handleGracefulLeave = () => {
    if (room.status === 'playing') {
      markDisconnected(room, roomConfig, chatMessages);
    }
    onLeaveRoom();
  };

  const handleCopyLink = () => {
    try {
      const url = `${window.location.origin}?room=${room.code}`;
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(url).catch(() => {});
      }
    } catch {}
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const currentTurnPlayer = room.players.find(p => p.id === room.currentTurnPlayerId);
  const isMyTurn = currentTurnPlayer?.id === user.id;
  const myPlayer = room.players.find(p => p.id === user.id);
  const myOwnedTiles = tiles.filter(t => myPlayer?.properties.includes(t.id));

  return (
    <div className="w-full h-screen max-h-screen overflow-hidden flex flex-col bg-[#0e0b1f] text-slate-100 select-none relative">
      {/* 1. TOP HEADER BAR */}
      <header className="h-12 bg-[#130f26] border-b border-[#251d45] px-3 sm:px-4 flex items-center justify-between flex-shrink-0 z-30 shadow-md">
        {/* Left: Logo + Navigation Links */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-heading font-black text-base sm:text-lg tracking-wider text-white">
            <span className="text-[#a390ff] text-xl">🎲</span>
            <span>PROPRUSH</span>
          </div>

          <div className="h-4 w-px bg-slate-700 hidden sm:block" />

          <button
            id="btn-leave-room"
            onClick={handleGracefulLeave}
            className="px-2.5 py-1 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-[11px] font-bold text-slate-300 border border-slate-700 cursor-pointer flex items-center gap-1 transition-all"
            title="Leave room (Your state is saved for 2 minutes to rejoin)"
          >
            <span>←</span>
            <span>Lobby</span>
          </button>
        </div>

        {/* Center: Room Code Display & Pot */}
        <div className="flex items-center gap-2">
          <div className="px-3 py-0.5 rounded-full bg-[#1e1738] border border-[#7059e2]/40 text-xs font-mono-code font-bold text-[#b4a4ff] flex items-center gap-1.5 shadow-inner">
            <span>Room:</span>
            <span className="text-white tracking-wider uppercase">{room.code}</span>
          </div>
          {room.betAmount > 0 && (
            <div className="px-2.5 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-500/40 text-xs font-mono-code font-bold text-emerald-300">
              Pot: ${room.totalPrizePool}
            </div>
          )}
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center gap-2">
          {/* Sound Mute Toggle */}
          {onToggleMute && (
            <button
              onClick={onToggleMute}
              className="p-1.5 rounded-lg bg-[#1a1433] hover:bg-[#281f4a] border border-[#3b2f66] text-xs cursor-pointer transition-colors"
              title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            >
              {isMuted ? '🔇' : '🔊'}
            </button>
          )}

          {/* Share Button with Instant Copy */}
          <button
            onClick={handleCopyLink}
            className="px-3 py-1 rounded-lg bg-[#7059e2]/20 hover:bg-[#7059e2]/40 text-[#a390ff] border border-[#7059e2]/50 text-xs font-bold cursor-pointer transition-all flex items-center gap-1"
            title="Copy room invite link"
          >
            <span>🔗</span>
            <span className="hidden sm:inline">{copiedLink ? 'Copied!' : 'Share'}</span>
          </button>
        </div>
      </header>

      {/* 2. MAIN SINGLE-VIEW EXPANSIVE LAYOUT (MAX BOARD SPACE) */}
      <div className="flex-1 min-h-0 flex flex-row items-stretch justify-between p-2 sm:p-3 gap-3 overflow-hidden">
        
        {/* CENTER / PRIMARY COLUMN: The Authentic 11x11 GameBoard (Expanded & Centered) */}
        <div className="flex-1 min-h-0 min-w-0 flex items-center justify-center p-1 relative">
          <GameBoard
            tiles={tiles}
            room={room}
            activeTileId={selectedTile?.id || null}
            onTileClick={tile => setSelectedTile(tile)}
            onRollDice={handleRollDice}
            isRolling={isRolling}
            canRoll={isMyTurn && (room.turnPhase === 'roll' || (room.isDouble && room.turnPhase === 'action'))}
            onBuyProperty={handleBuyProperty}
            onPassToAuction={handlePassToAuction}
            onPayJailFine={handlePayJailFine}
            onUseJailCard={handleUseJailCard}
            onEndTurn={nextTurn}
            onToggleSpeed={() => setRoom(r => ({ ...r, fastSpeed: !r.fastSpeed }))}
            onStartGame={() => setRoom(r => ({ ...r, status: 'playing' }))}
            isLobbyMode={room.status === 'waiting'}
          />
        </div>

        {/* RIGHT COLUMN: Player List, Bankrupt Button, Trades Card, My Properties */}
        <div className="w-68 xl:w-76 flex-shrink-0 flex flex-col justify-between gap-2.5 h-full overflow-hidden">
          
          {/* Players List */}
          <div className="p-3 rounded-2xl bg-[#141026] border border-[#2b2447] flex flex-col gap-2 shadow-lg">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300 border-b border-slate-800 pb-1.5">
              <span>Players ({room.players.length})</span>
              <span className="text-[10px] text-slate-500 font-mono-code">Ranked</span>
            </div>

            <div className="space-y-1.5 max-h-[190px] overflow-y-auto pr-1">
              {room.players.map(p => {
                const isTurn = p.id === room.currentTurnPlayerId;
                const delta = cashDeltas[p.id];

                return (
                  <div
                    key={p.id}
                    className={`p-2 rounded-xl border transition-all flex items-center justify-between ${
                      p.isBankrupt
                        ? 'bg-slate-950/40 border-slate-900 opacity-40 grayscale'
                        : isTurn
                        ? 'bg-[#22183d] border-[#7059e2] ring-1.5 ring-[#7059e2]/80 shadow-[0_0_15px_rgba(112,89,226,0.3)]'
                        : 'bg-[#0f0c1e] border-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="relative">
                        <AvatarCharacter avatarId={p.avatar} frameId={p.avatarFrame} size="sm" isAnimated={false} />
                        {p.inJail && (
                          <div className="absolute -bottom-1 -right-1 text-[10px]">🔒</div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-heading font-bold text-xs text-white truncate flex items-center gap-1">
                          <span>{p.name}</span>
                          {p.id === user.id && (
                            <span className="text-[9px] text-[#a390ff] font-mono-code font-normal">(You)</span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono-code">
                          {p.properties.length} props
                        </div>
                      </div>
                    </div>

                    {/* Cash & Turn Indicator */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="text-right">
                        <div className="text-xs font-mono-code font-extrabold text-emerald-400">
                          ${p.cash}
                        </div>
                        {/* Animated Net Change Badge */}
                        {delta && (
                          <div
                            key={delta.key}
                            className={`text-[9px] font-mono-code font-bold animate-fade-in ${
                              delta.delta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {delta.delta >= 0 ? `+$${delta.delta}` : `-$${Math.abs(delta.delta)}`}
                          </div>
                        )}
                      </div>

                      {isTurn && (
                        <span className="text-[#a390ff] font-black text-sm animate-pulse">
                          →
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bankrupt / Forfeit Button with Confirmation Trigger */}
            <button
              id="btn-bankrupt-forfeit"
              onClick={() => {
                sounds.playClick();
                setShowForfeitConfirmModal(true);
              }}
              className="w-full py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 text-[11px] font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5 active:scale-95 shadow-sm"
              title="Surrender this match and declare bankruptcy"
            >
              <span>🚩</span>
              <span>Forfeit / Bankrupt</span>
            </button>
          </div>

          {/* Trades Section Card */}
          <div className="p-3 rounded-2xl bg-[#141026] border border-[#2b2447] flex flex-col gap-1.5 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1">
                <span>🤝</span> Trades
              </span>
              <button
                onClick={() => setShowTradeModal(true)}
                className="px-2 py-0.5 rounded-lg bg-[#7059e2] hover:bg-[#5e46d0] text-white text-[10px] font-bold cursor-pointer"
              >
                + Create
              </button>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Make trades with other players to acquire monopolies and build houses.
            </p>
          </div>

          {/* My Properties Card */}
          <div className="flex-1 min-h-0 p-3 rounded-2xl bg-[#141026] border border-[#2b2447] flex flex-col justify-between gap-1.5 shadow-lg overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1">
              <span className="text-xs font-bold text-white flex items-center gap-1">
                <span>🏘️</span> My Properties ({myOwnedTiles.length})
              </span>
              <span className="text-[9px] text-slate-500 font-mono-code">Click to manage</span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-1 text-xs">
              {myOwnedTiles.length > 0 ? (
                myOwnedTiles.map(t => (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTile(t)}
                    className="p-1.5 rounded-xl bg-[#0f0c1e] hover:bg-[#1f1935] border border-slate-800/80 cursor-pointer flex items-center justify-between transition-colors"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="text-xs">{t.flag || '📍'}</span>
                      <span className="text-[11px] font-bold text-slate-200 truncate">{t.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {myPlayer?.houses[t.id] ? (
                        <span className="text-[9px] text-emerald-400 font-bold">
                          {myPlayer.houses[t.id] === 5 ? '🏨' : `🏠x${myPlayer.houses[t.id]}`}
                        </span>
                      ) : null}
                      <span className="text-[10px] font-mono-code text-slate-400">${t.price}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-full flex items-center justify-center text-center text-[10px] text-slate-500 p-2">
                  No properties owned yet. Roll and buy available tiles!
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. SMART FLOATING LIVE CHAT SYSTEM */}
      {/* Floating Chat Launcher Button (Corner Bubble) */}
      <button
        id="btn-floating-chat"
        onClick={() => {
          sounds.playClick();
          setIsChatOpen(prev => !prev);
          setUnreadChatCount(0);
        }}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 w-12 h-12 rounded-full bg-[#7059e2] hover:bg-[#5f46d6] text-white shadow-[0_4px_25px_rgba(112,89,226,0.65)] flex items-center justify-center text-xl cursor-pointer transition-all active:scale-95 hover:scale-105"
        title="Open Live Room Chat"
      >
        <span>💬</span>
        {unreadChatCount > 0 && !isChatOpen && (
          <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black font-mono-code border-2 border-[#0e0b1f] animate-pulse shadow-md">
            {unreadChatCount}
          </span>
        )}
      </button>

      {/* Floating Chat Popover Window */}
      {isChatOpen && (
        <div
          id="floating-chat-window"
          className="fixed bottom-18 right-4 sm:bottom-20 sm:right-6 w-80 sm:w-88 h-[430px] max-h-[72vh] bg-[#141026]/98 backdrop-blur-xl border border-[#3b3260] rounded-2xl shadow-[0_12px_45px_rgba(0,0,0,0.85)] z-50 flex flex-col justify-between overflow-hidden animate-fade-in"
        >
          {/* Chat Header */}
          <div className="px-3.5 py-2.5 bg-[#1b1535] border-b border-[#2e2554] flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-sm">💬</span>
              <span className="font-heading font-bold text-xs text-white">Live Room Chat</span>
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-[9px] font-mono-code font-bold text-emerald-400">
                Online
              </span>
            </div>
            <button
              onClick={() => setIsChatOpen(false)}
              className="w-6 h-6 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white text-xs flex items-center justify-center cursor-pointer transition-colors"
              title="Close chat"
            >
              ✕
            </button>
          </div>

          {/* Chat Messages Stream */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2 text-xs">
            {chatMessages.map(msg => {
              const isMe = msg.sender === user.username;
              const isSystem = msg.sender === 'System';

              if (isSystem) {
                return (
                  <div key={msg.id} className="text-center py-1">
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-900/80 text-[10px] text-slate-400 border border-slate-800 font-medium">
                      ℹ️ {msg.text}
                    </span>
                  </div>
                );
              }

              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-2 ${isMe ? 'flex-row-reverse' : ''}`}
                >
                  <AvatarCharacter avatarId={msg.avatar} size="xs" isAnimated={false} />
                  <div className={`max-w-[75%] ${isMe ? 'text-right' : 'text-left'}`}>
                    <div className="flex items-center gap-1.5 mb-0.5 leading-none px-1">
                      <span className={`text-[10px] font-bold ${isMe ? 'text-[#b4a4ff]' : 'text-slate-300'}`}>
                        {msg.sender}
                      </span>
                      <span className="text-[8px] text-slate-500 font-mono-code">{msg.time}</span>
                    </div>
                    <div
                      className={`px-3 py-1.5 rounded-2xl text-[11px] break-words shadow-sm ${
                        isMe
                          ? 'bg-[#7059e2] text-white rounded-tr-none'
                          : 'bg-[#211a3e] text-slate-200 border border-[#33285c] rounded-tl-none'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Reactions Bar */}
          <div className="px-3 py-1.5 bg-[#100d21] border-t border-[#251d45] flex items-center justify-between gap-1 overflow-x-auto flex-shrink-0">
            {['🔥', '🎲', '💸', '🚀', '😭', '👑', 'GG!'].map(emoji => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  sounds.playClick();
                  sendChatMessage(user.username, user.avatar || 'orange', emoji);
                }}
                className="px-2 py-0.5 rounded-lg bg-[#191433] hover:bg-[#2b2254] text-[11px] text-slate-200 cursor-pointer transition-all active:scale-90"
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Chat Input Form */}
          <form onSubmit={handleSendChat} className="p-2.5 bg-[#141026] border-t border-[#2e2554] flex items-center gap-2 flex-shrink-0">
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder="Say something..."
              className="flex-1 bg-[#0e0a1e] border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#7059e2]"
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-xl bg-[#7059e2] hover:bg-[#5e46d0] text-white text-xs font-bold cursor-pointer transition-all active:scale-95"
            >
              Send
            </button>
          </form>
        </div>
      )}

      {/* 3. MODALS & POPUPS */}
      {/* Forfeit / Bankrupt Confirmation Modal */}
      {showForfeitConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-sm bg-[#1a122e] border border-rose-500/50 rounded-2xl shadow-[0_12px_45px_rgba(0,0,0,0.85)] p-5 overflow-hidden flex flex-col gap-4">
            <div className="flex items-center gap-3 text-rose-400 border-b border-slate-800 pb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-950/80 border border-rose-600/60 flex items-center justify-center text-xl flex-shrink-0">
                ⚠️
              </div>
              <div>
                <h3 className="font-heading font-black text-base text-white">
                  Confirm Forfeit
                </h3>
                <p className="text-xs text-rose-300 font-medium">
                  Declare bankruptcy & surrender match
                </p>
              </div>
            </div>

            <div className="text-xs text-slate-300 bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 leading-relaxed">
              Are you sure you want to forfeit? You will surrender all your cash and owned properties, declare bankruptcy, and be eliminated from the current match.
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                onClick={() => {
                  sounds.playClick();
                  setShowForfeitConfirmModal(false);
                }}
                className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 font-bold text-xs text-slate-200 cursor-pointer transition-all active:scale-95 border border-slate-700"
              >
                Keep Playing
              </button>
              <button
                onClick={() => {
                  sounds.playBankrupt();
                  clearActiveMatch();
                  setShowForfeitConfirmModal(false);
                  setRoom(prev => {
                    const updated = prev.players.map(p => p.id === user.id ? { ...p, isBankrupt: true, cash: 0 } : p);
                    return { ...prev, players: updated };
                  });
                  addLog(`💀 ${user.username} surrendered and declared bankruptcy.`, 'info');
                  nextTurn();
                }}
                className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 font-bold text-xs text-white cursor-pointer transition-all active:scale-95 shadow-md shadow-rose-950/50"
              >
                Yes, Forfeit Match
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Property Deed & House Management Modal */}
      {selectedTile && (
        <PropertyCardModal
          tile={selectedTile}
          tiles={tiles}
          room={room}
          myPlayerId={user.id}
          isMyTurn={isMyTurn}
          onClose={() => setSelectedTile(null)}
          onBuildHouse={handleBuildHouse}
          onSellHouse={handleSellHouse}
          onMortgage={handleMortgage}
          onUnmortgage={handleUnmortgage}
        />
      )}

      {/* Speed Auction Modal */}
      {room.auction && (
        <AuctionModal
          room={room}
          tile={tiles[room.auction.tileId]}
          onPlaceBid={handlePlaceBid}
          onPassAuction={() => {
            setRoom(prev => {
              if (!prev.auction) return prev;
              return {
                ...prev,
                auction: {
                  ...prev.auction,
                  activePlayerIds: prev.auction.activePlayerIds.filter(id => id !== user.id)
                }
              };
            });
          }}
          myPlayerId={user.id}
        />
      )}

      {/* Trade Modal */}
      {showTradeModal && (
        <TradeModal
          room={room}
          tiles={tiles}
          myPlayerId={user.id}
          onSendTradeOffer={(offer) => {
            setRoom(prev => ({ ...prev, activeTrade: offer }));
            setShowTradeModal(false);
            addLog(`Trade proposal sent to ${room.players.find(p => p.id === offer.toPlayerId)?.name}.`, 'info');
          }}
          onAcceptTrade={() => {
            setRoom(prev => {
              if (!prev.activeTrade) return prev;
              const { fromPlayerId, toPlayerId, offeredCash, offeredProperties, requestedCash, requestedProperties } = prev.activeTrade;
              const p1 = prev.players.find(p => p.id === fromPlayerId);
              const p2 = prev.players.find(p => p.id === toPlayerId);
              if (!p1 || !p2) return prev;
              p1.cash = p1.cash - offeredCash + requestedCash;
              p2.cash = p2.cash - requestedCash + offeredCash;
              p1.properties = [...p1.properties.filter(id => !offeredProperties.includes(id)), ...requestedProperties];
              p2.properties = [...p2.properties.filter(id => !requestedProperties.includes(id)), ...offeredProperties];
              p1.netWorth = calculateNetWorth(p1);
              p2.netWorth = calculateNetWorth(p2);
              addLog(`🤝 Trade completed between ${p1.name} and ${p2.name}!`, 'info');
              return { ...prev, activeTrade: null };
            });
          }}
          onDeclineTrade={() => {
            setRoom(prev => ({ ...prev, activeTrade: null }));
            addLog(`Trade proposal was declined.`, 'info');
          }}
          onClose={() => setShowTradeModal(false)}
        />
      )}

      {/* Game Over Modal */}
      {room.status === 'finished' && (
        <GameOverModal
          room={room}
          myPlayerId={user.id}
          onPlayAgain={() => {
            setRoom(prev => ({
              ...prev,
              status: 'playing',
              winner: undefined,
              players: initialPlayers.map(p => ({
                ...p,
                cash: roomConfig.initialCash,
                netWorth: roomConfig.initialCash,
                position: 0,
                inJail: false,
                jailTurns: 0,
                getOutOfJailCards: 0,
                properties: [],
                mortgaged: [],
                houses: {},
                isBankrupt: false
              })),
              turnPhase: 'roll',
              currentTurnIndex: 0,
              currentTurnPlayerId: user.id
            }));
          }}
          onReturnHome={onLeaveRoom}
          statsSummary={matchSummaryStats}
        />
      )}
    </div>
  );
};
