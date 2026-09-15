import React, { useState, useEffect, useRef } from 'react';
import { GameRoom, Player, BoardTile, BoardMapTheme, TradeOffer } from '../types/game';
import { BASE_BOARD_TILES, CHANCE_CARDS, CHEST_CARDS, GROUP_PROPERTY_COUNTS } from '../data/boardTiles';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import { GameBoard } from '../components/GameBoard';
import { PropertyCardModal } from '../components/PropertyCardModal';
import { AuctionModal } from '../components/AuctionModal';
import { TradeModal } from '../components/TradeModal';
import { GameOverModal } from '../components/GameOverModal';
import { AvatarCharacter } from '../components/AvatarCharacter';
import { PlayerNameWithWallet } from '../components/PlayerNameWithWallet';
import { sounds } from '../utils/audio';
import { saveActiveMatch, getActiveMatch, markDisconnected, clearActiveMatch } from '../utils/reconnectStorage';
import { updateActiveRoomPlayerCount } from '../utils/activeRoomsRegistry';
import {
  fetchServerRoom,
  createServerRoom,
  joinServerRoom,
  syncServerRoomState,
  sendServerChatMessage
} from '../utils/serverRoomSync';

interface GameRoomViewProps {
  roomConfig: {
    roomCode: string;
    roomName: string;
    maxPlayers: number;
    betAmount: number;
    initialCash: number;
    turnTimeSeconds: number;
    boardTheme: string | BoardMapTheme;
    fillWithBots: boolean;
    isCreator?: boolean;
    isPrivate?: boolean;
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
  const { user, recordMatchResult, equipItem, updateUser, depositFunds } = useUser();
  const { isLight, toggleTheme } = useTheme();

  // Mobile / Tablet Tab switch: 'board' or 'stats'
  const [mobileTab, setMobileTab] = useState<'board' | 'stats'>('board');

  // Check if resuming an existing active match
  const savedActive = getActiveMatch();
  const isResuming = Boolean(
    savedActive &&
    savedActive.roomConfig.roomCode.toLowerCase() === roomConfig.roomCode.toLowerCase() &&
    savedActive.room.status === 'playing'
  );

  // Constants & Bot definitions
  const botNames = ['bu', 'CryptoBaron', 'PixelTycoon', 'QueenVee', 'DiamondAce'];
  const botAvatars = ['bu', 'apple', 'ghost', 'cyber', 'king'];
  const botFrames = ['pfp_neon', 'pfp_crown', 'pfp_fire', 'pfp_diamond'];
  const botDiceSkins = ['dice_neon', 'dice_ruby', 'dice_magma', 'dice_cyber', 'dice_cosmic', 'dice_rainbow', 'dice_dragon'];
  const playerColors = ['#ff7844', '#b066fe', '#10b981', '#06b6d4', '#ec4899', '#eab308'];

  const customRoomStorageKey = `proprush_custom_room_${roomConfig.roomCode.toLowerCase()}`;

  // Verify if this browser session was the original creator of this room
  const isSessionCreator = Boolean(
    roomConfig.isCreator ||
    (typeof window !== 'undefined' && sessionStorage.getItem(`proprush_creator_${roomConfig.roomCode.toLowerCase()}`) === 'true')
  );

  // Master Room State (Restores from saved active match or waiting lobby)
  const [room, setRoom] = useState<GameRoom>(() => {
    if (isResuming && savedActive) {
      return savedActive.room;
    }

    // 1. Quick Play / Bots mode enabled:
    if (roomConfig.fillWithBots) {
      const initialPlayers: Player[] = [
        {
          id: user.id,
          name: user.username,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          walletAddress: user.walletAddress,
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

      return {
        id: roomConfig.roomCode,
        name: roomConfig.roomName,
        code: roomConfig.roomCode,
        hostId: user.id,
        isPrivate: false,
        maxPlayers: roomConfig.maxPlayers,
        players: initialPlayers,
        status: 'playing', // Active game ready to roll
        currentTurnPlayerId: user.id,
        currentTurnIndex: 0,
        turnPhase: 'roll',
        turnTimer: roomConfig.turnTimeSeconds || 15,
        turnTimeLimit: roomConfig.turnTimeSeconds || 15,
        lastDice: [1, 2],
        isDouble: false,
        consecutiveDoubles: 0,
        doubleCount: 0,
        freeParkingPool: 100,
        auction: null,
        activeTrade: null,
        pendingCard: null,
        messages: [],
        winner: null,
        logs: [
          { id: 'l1', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), text: `Game started with a randomized players order. Good luck!`, type: 'info' }
        ],
        betAmount: roomConfig.betAmount,
        totalPrizePool: roomConfig.betAmount * roomConfig.maxPlayers,
        platformFeeRate: 0.05,
        boardTheme: (roomConfig.boardTheme || 'classic') as BoardMapTheme,
        fastSpeed: true
      };
    }

    // 2. Custom Room for Real Players (fillWithBots = false):
    // Check if room was already stored in localStorage
    try {
      const stored = localStorage.getItem(customRoomStorageKey);
      if (stored) {
        const parsed: GameRoom = JSON.parse(stored);
        const playerExists = parsed.players.some(p => p.id === user.id);
        if (!playerExists && parsed.players.length < roomConfig.maxPlayers) {
          const colorIdx = parsed.players.length % playerColors.length;
          const newPlayer: Player = {
            id: user.id,
            name: user.username,
            avatar: user.avatar || 'orange',
            avatarFrame: user.avatarFrame,
            diceSkin: user.diceSkin || 'dice_golden',
            color: playerColors[colorIdx],
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
            isHost: false // Joining player is never host
          };
          parsed.players.push(newPlayer);
          parsed.totalPrizePool = roomConfig.betAmount * parsed.players.length;
          localStorage.setItem(customRoomStorageKey, JSON.stringify(parsed));
          updateActiveRoomPlayerCount(roomConfig.roomCode, parsed.players.length);
        }
        return parsed;
      }
    } catch {}

    // If NOT session creator, initialize waiting room without setting this user as host
    if (!isSessionCreator) {
      return {
        id: roomConfig.roomCode,
        name: roomConfig.roomName,
        code: roomConfig.roomCode,
        hostId: '', // Authoritative host will be loaded from server
        isPrivate: roomConfig.isPrivate ?? false,
        maxPlayers: roomConfig.maxPlayers || 4,
        players: [],
        status: 'waiting',
        currentTurnPlayerId: '',
        currentTurnIndex: 0,
        turnPhase: 'roll',
        turnTimer: roomConfig.turnTimeSeconds || 15,
        turnTimeLimit: roomConfig.turnTimeSeconds || 15,
        lastDice: [1, 2],
        isDouble: false,
        consecutiveDoubles: 0,
        doubleCount: 0,
        freeParkingPool: 100,
        auction: null,
        activeTrade: null,
        pendingCard: null,
        messages: [],
        winner: null,
        logs: [
          { id: 'l1', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), text: `Connecting to room ${roomConfig.roomCode.toUpperCase()}...`, type: 'info' }
        ],
        betAmount: roomConfig.betAmount,
        totalPrizePool: 0,
        platformFeeRate: 0.05,
        boardTheme: (roomConfig.boardTheme || 'classic') as BoardMapTheme,
        fastSpeed: true
      };
    }

    // Room Creator creates initial custom room in waiting state:
    const hostPlayer: Player = {
      id: user.id,
      name: user.username,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      walletAddress: user.walletAddress,
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
    };

    const initialCustomRoom: GameRoom = {
      id: roomConfig.roomCode,
      name: roomConfig.roomName,
      code: roomConfig.roomCode,
      hostId: user.id,
      isPrivate: roomConfig.isPrivate ?? false,
      maxPlayers: roomConfig.maxPlayers || 4,
      players: [hostPlayer],
      status: 'waiting', // Waiting in lobby for real players
      currentTurnPlayerId: user.id,
      currentTurnIndex: 0,
      turnPhase: 'roll',
      turnTimer: roomConfig.turnTimeSeconds || 15,
      turnTimeLimit: roomConfig.turnTimeSeconds || 15,
      lastDice: [1, 2],
      isDouble: false,
      consecutiveDoubles: 0,
      doubleCount: 0,
      freeParkingPool: 100,
      auction: null,
      activeTrade: null,
      pendingCard: null,
      messages: [],
      winner: null,
      logs: [
        { id: 'l1', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), text: `Custom Room created by ${user.username}. Waiting for real players to join...`, type: 'info' }
      ],
      betAmount: roomConfig.betAmount,
      totalPrizePool: roomConfig.betAmount * 1,
      platformFeeRate: 0.05,
      boardTheme: (roomConfig.boardTheme || 'classic') as BoardMapTheme,
      fastSpeed: true
    };

    try {
      localStorage.setItem(customRoomStorageKey, JSON.stringify(initialCustomRoom));
      updateActiveRoomPlayerCount(roomConfig.roomCode, 1);
    } catch {}

    return initialCustomRoom;
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
  const [roomNotFound, setRoomNotFound] = useState(false);
  const [isConnecting, setIsConnecting] = useState(!isSessionCreator && !isResuming);

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

  // The authoritative current player ID in this session
  const myPlayerId = user.id;

  // The room's authentic host ID
  const hostId = room.hostId || (isSessionCreator ? myPlayerId : (room.players[0]?.id || ''));

  // Am I the host of this room?
  // MUST be the session creator OR my ID strictly matches the room's hostId.
  // Anyone joining via invite link or room code CAN NEVER be host unless room.hostId matches their ID.
  const isCurrentUserHost = Boolean(
    (isSessionCreator && (!room.hostId || room.hostId === myPlayerId)) ||
    (room.hostId && room.hostId === myPlayerId)
  );

  // Identify who the local user is in this room
  const myPlayer: Player | undefined = 
    room.players.find(p => p.id === myPlayerId) ||
    (isCurrentUserHost 
      ? room.players.find(p => p.id === hostId || p.isHost) || room.players[0]
      : room.players.find(p => p.id !== hostId && !p.isHost && !p.isBot) || room.players[1] || room.players[0]
    );

  // Active turn player
  const currentTurnPlayer: Player | undefined = 
    room.players.find(p => p.id === room.currentTurnPlayerId) || 
    room.players[room.currentTurnIndex] || 
    room.players[0];

  // Accurate turn determination:
  const isMyTurn = Boolean(
    currentTurnPlayer && (
      currentTurnPlayer.id === myPlayerId ||
      (myPlayer && currentTurnPlayer.id === myPlayer.id)
    )
  );

  // Check if current turn is an AI Bot and current user is host (host drives bot turns)
  const isBotTurn = Boolean(currentTurnPlayer?.isBot && isCurrentUserHost);

  // Cash change indicator badges map: playerId -> { delta: number, key: number }
  const [cashDeltas, setCashDeltas] = useState<Record<string, { delta: number; key: number }>>({});

  const showCashDelta = (playerId: string, amount: number) => {
    setCashDeltas(prev => ({
      ...prev,
      [playerId]: { delta: amount, key: Date.now() }
    }));
  };

  // Central room broadcast and server state sync
  const broadcastAndSync = (
    updatedRoom: GameRoom,
    eventType:
      | 'SYNC_ROOM'
      | 'GAME_STARTED'
      | 'PLAYER_KICKED'
      | 'TRADE_OFFERED'
      | 'TRADE_ACCEPTED'
      | 'TRADE_DECLINED'
      | 'BANKRUPTCY'
      | 'GAME_OVER' = 'SYNC_ROOM'
  ) => {
    try {
      localStorage.setItem(customRoomStorageKey, JSON.stringify(updatedRoom));
      updateActiveRoomPlayerCount(roomConfig.roomCode, updatedRoom.players.length);
      const channel = new BroadcastChannel(`proprush_sync_${roomConfig.roomCode.toLowerCase()}`);
      channel.postMessage({ type: eventType, room: updatedRoom });
      channel.close();
    } catch {}
    syncServerRoomState(roomConfig.roomCode, updatedRoom).catch(() => {});
  };

  // Turn timer ref
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isRollingRef = useRef<boolean>(false);
  const lastLogRef = useRef<{ text: string; time: number }>({ text: '', time: 0 });
  const serverVersionRef = useRef<number>(0);

  // Auto-save active match whenever room or chat state updates
  useEffect(() => {
    if (room.status === 'playing' || room.status === 'waiting') {
      saveActiveMatch(room, roomConfig, chatMessages);
    }
  }, [room, chatMessages, roomConfig]);

  // Real-Time Cross-Device Server Sync + Multi-Tab BroadcastChannel
  useEffect(() => {
    let isMounted = true;
    const channelName = `proprush_sync_${roomConfig.roomCode.toLowerCase()}`;
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(channelName);
    } catch {}

    const myPlayerPayload: Partial<Player> = {
      id: user.id,
      name: user.username,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      walletAddress: user.walletAddress,
      avatar: user.avatar || 'orange',
      avatarFrame: user.avatarFrame,
      diceSkin: user.diceSkin || 'dice_golden',
      color: playerColors[isSessionCreator ? 0 : 1],
      isHost: Boolean(isSessionCreator)
    };

    // 1. Initial Room Discovery & Join on Server
    fetchServerRoom(roomConfig.roomCode).then(serverRoom => {
      if (!isMounted) return;
      if (serverRoom) {
        // Room already exists on server!
        if (serverRoom.hostId === user.id && isSessionCreator) {
          // I am the verified room creator
          setIsConnecting(false);
          setRoom(prev => ({
            ...prev,
            ...serverRoom,
            players: serverRoom.players
          }));
          serverVersionRef.current = (serverRoom as any).version || 1;
        } else {
          // I am a joining player
          joinServerRoom(roomConfig.roomCode, { ...myPlayerPayload, isHost: false }).then(joinedRoom => {
            if (!isMounted) return;
            if (joinedRoom) {
              setIsConnecting(false);
              setRoom(prev => ({
                ...prev,
                ...joinedRoom,
                players: joinedRoom.players
              }));
              serverVersionRef.current = (joinedRoom as any).version || 1;
              const joinedAny = joinedRoom as any;
              if (joinedAny.chatMessages && Array.isArray(joinedAny.chatMessages)) {
                setChatMessages(joinedAny.chatMessages);
              }
            } else {
              setIsConnecting(false);
              setRoomNotFound(true);
              sounds.playBankrupt();
            }
          });
        }
      } else if (isSessionCreator) {
        // Only the actual room creator creates the room on the server
        createServerRoom({
          code: roomConfig.roomCode,
          name: roomConfig.roomName,
          hostId: user.id,
          maxPlayers: roomConfig.maxPlayers,
          betAmount: roomConfig.betAmount,
          initialCash: roomConfig.initialCash,
          turnTimeSeconds: roomConfig.turnTimeSeconds,
          boardTheme: roomConfig.boardTheme,
          status: 'waiting',
          players: [
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
          ],
          isPrivate: false,
          fillWithBots: false
        } as any).then(created => {
          if (!isMounted || !created) return;
          setIsConnecting(false);
          setRoom(prev => ({
            ...prev,
            ...created,
            players: created.players
          }));
          serverVersionRef.current = (created as any).version || 1;
        });
      } else {
        // Joining player but room record not yet in server cache -> retry once after 350ms
        setTimeout(() => {
          if (!isMounted) return;
          fetchServerRoom(roomConfig.roomCode).then(retryRoom => {
            if (!isMounted) return;
            if (retryRoom) {
              joinServerRoom(roomConfig.roomCode, { ...myPlayerPayload, isHost: false }).then(joinedRoom => {
                if (!isMounted) return;
                if (joinedRoom) {
                  setIsConnecting(false);
                  setRoom(prev => ({
                    ...prev,
                    ...joinedRoom,
                    players: joinedRoom.players
                  }));
                  serverVersionRef.current = (joinedRoom as any).version || 1;
                  const joinedAny = joinedRoom as any;
                  if (joinedAny.chatMessages && Array.isArray(joinedAny.chatMessages)) {
                    setChatMessages(joinedAny.chatMessages);
                  }
                } else {
                  setIsConnecting(false);
                  setRoomNotFound(true);
                  sounds.playBankrupt();
                }
              });
            } else {
              setIsConnecting(false);
              setRoomNotFound(true);
              sounds.playBankrupt();
            }
          });
        }, 350);
      }
    });

    // 2. Broadcast presence to local tabs
    if (channel) {
      channel.postMessage({
        type: 'PLAYER_JOINED',
        player: {
          ...myPlayerPayload,
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
          isBot: false
        }
      });

      channel.onmessage = (event) => {
        const data = event.data;
        if (!data || !data.type) return;

        if (
          (data.type === 'SYNC_ROOM' ||
            data.type === 'TRADE_OFFERED' ||
            data.type === 'TRADE_ACCEPTED' ||
            data.type === 'TRADE_DECLINED' ||
            data.type === 'BANKRUPTCY' ||
            data.type === 'GAME_OVER') &&
          data.room
        ) {
          if (data.type === 'GAME_OVER' || data.room.status === 'finished') {
            sounds.playWin();
          }
          setRoom(data.room);
        } else if (data.type === 'GAME_STARTED' && data.room) {
          sounds.playDiceRoll();
          setRoom(data.room);
          addLog(`🚀 Match launched by room creator! Game in progress.`, 'info');
        } else if (data.type === 'PLAYER_KICKED') {
          if (room.status === 'waiting') {
            const isMeKicked =
              (data.kickedPlayerId && data.kickedPlayerId === myPlayerId) ||
              (data.room && !data.room.players?.some((p: any) => p.id === myPlayerId) && !isCurrentUserHost);
            if (isMeKicked) {
              clearActiveMatch();
              try {
                sessionStorage.removeItem(`proprush_creator_${roomConfig.roomCode.toLowerCase()}`);
                window.history.replaceState({}, '', window.location.pathname);
              } catch {}
              if (roomConfig.betAmount > 0) {
                depositFunds(roomConfig.betAmount, 'room_kick_refund');
              }
              sounds.playPayRent();
              onLeaveRoom();
              return;
            }
          }
          if (data.room) {
            setRoom(data.room);
          }
        } else if (data.type === 'PLAYER_JOINED' && data.player) {
          setRoom(prev => {
            if (prev.status !== 'waiting') return prev;
            if (prev.players.some(p => p.id === data.player.id)) return prev;
            if (prev.players.length >= roomConfig.maxPlayers) return prev;

            const assignedColor = playerColors[prev.players.length % playerColors.length];
            const updatedPlayers = [...prev.players, { ...data.player, color: assignedColor, isHost: false }];
            const updatedRoom: GameRoom = {
              ...prev,
              players: updatedPlayers,
              totalPrizePool: roomConfig.betAmount * updatedPlayers.length,
              logs: [
                {
                  id: 'log_join_' + Date.now(),
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  text: `👋 ${data.player.name} joined the room! (${updatedPlayers.length}/${roomConfig.maxPlayers})`,
                  type: 'info'
                },
                ...prev.logs
              ]
            };

            if (isCurrentUserHost) {
              sounds.playPassGo();
              broadcastAndSync(updatedRoom);
            }
            return updatedRoom;
          });
        } else if (data.type === 'PLAYER_LEFT') {
          setRoom(prev => {
            if (prev.status !== 'waiting') return prev;
            const updatedPlayers = prev.players.filter(p => p.id !== data.playerId);
            const updatedRoom: GameRoom = {
              ...prev,
              players: updatedPlayers,
              totalPrizePool: roomConfig.betAmount * updatedPlayers.length
            };
            if (isCurrentUserHost) {
              broadcastAndSync(updatedRoom);
            }
            return updatedRoom;
          });
        } else if (data.type === 'CHAT_MESSAGE') {
          if (data.message && data.message.sender !== user.username) {
            setChatMessages(prev => [...prev.slice(-30), data.message]);
            if (!isChatOpen) {
              setUnreadChatCount(c => c + 1);
            }
          }
        }
      };
    }

    // 3. Periodic Server Polling Interval (Every 450ms for fast cross-device updates)
    const pollInterval = setInterval(async () => {
      if (!isMounted || isRollingRef.current) return;

      try {
        const sRoom: any = await fetchServerRoom(roomConfig.roomCode);
        if (!sRoom || !isMounted) return;

        setRoom(prev => {
          const wasWaiting = prev.status === 'waiting';
          const isNowPlaying = sRoom.status === 'playing';

          // Check if current user got kicked by host from lobby
          if (wasWaiting && sRoom.status === 'waiting') {
            const amIHost = isCurrentUserHost || (sRoom.hostId && sRoom.hostId === myPlayerId);
            if (!amIHost) {
              const wasInRoom = prev.players.some(p => p.id === myPlayerId);
              const isStillInRoom = sRoom.players?.some((p: any) => p.id === myPlayerId);
              if (wasInRoom && !isStillInRoom) {
                clearActiveMatch();
                try {
                  sessionStorage.removeItem(`proprush_creator_${roomConfig.roomCode.toLowerCase()}`);
                  window.history.replaceState({}, '', window.location.pathname);
                } catch {}
                if (roomConfig.betAmount > 0) {
                  depositFunds(roomConfig.betAmount, 'room_kick_refund');
                }
                sounds.playPayRent();
                onLeaveRoom();
                return prev;
              }
            }
          }

          if (wasWaiting && isNowPlaying) {
            sounds.playDiceRoll();
            addLog(`🚀 Match launched by room creator! Game in progress.`, 'info');
          }

          if (prev.status === 'playing' && (sRoom.status === 'finished' || sRoom.status === 'gameover')) {
            sounds.playWin();
          }

          const playersCountDiff = prev.players.length !== (sRoom.players?.length || 0);
          const waitingPlayersDiff = wasWaiting && (
            playersCountDiff ||
            JSON.stringify(prev.players.map(p => ({ id: p.id, name: p.name, wallet: p.walletAddress, ready: (p as any).isReady }))) !==
            JSON.stringify((sRoom.players || []).map((p: any) => ({ id: p.id, name: p.name, wallet: p.walletAddress, ready: p.isReady })))
          );

          if (wasWaiting && sRoom.players && sRoom.players.length > prev.players.length) {
            sounds.playCashRegister();
          }

          const statusDiff = prev.status !== sRoom.status;
          const turnDiff =
            prev.currentTurnPlayerId !== sRoom.currentTurnPlayerId ||
            prev.turnPhase !== sRoom.turnPhase ||
            prev.currentTurnIndex !== sRoom.currentTurnIndex;
          const bankruptDiff = sRoom.players?.some(
            (sp: any) => sp.isBankrupt !== prev.players.find(p => p.id === sp.id)?.isBankrupt
          );
          const hasNewerVersion = sRoom.version && sRoom.version > serverVersionRef.current;
          const logsDiff = sRoom.logs && sRoom.logs.length > prev.logs.length;
          const tradeDiff = JSON.stringify(prev.activeTrade) !== JSON.stringify(sRoom.activeTrade);

          if (waitingPlayersDiff || playersCountDiff || statusDiff || turnDiff || bankruptDiff || hasNewerVersion || logsDiff || tradeDiff) {
            if (sRoom.version) serverVersionRef.current = sRoom.version;
            return {
              ...prev,
              ...sRoom,
              players: sRoom.players && sRoom.players.length > 0 ? sRoom.players : prev.players,
              logs: sRoom.logs && sRoom.logs.length > 0 ? sRoom.logs : prev.logs
            };
          }
          return prev;
        });

        // Sync incoming server chat messages
        if (sRoom.chatMessages && Array.isArray(sRoom.chatMessages) && sRoom.chatMessages.length > 0) {
          setChatMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const newOnes = sRoom.chatMessages.filter((m: any) => !existingIds.has(m.id));
            if (newOnes.length > 0) {
              const unreadFromOthers = newOnes.filter((m: any) => m.sender !== user.username).length;
              if (unreadFromOthers > 0 && !isChatOpen) {
                setUnreadChatCount(c => c + unreadFromOthers);
              }
              return [...prev, ...newOnes].slice(-40);
            }
            return prev;
          });
        }
      } catch {}
    }, 800);

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === customRoomStorageKey && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          setRoom(parsed);
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      window.removeEventListener('storage', handleStorageChange);
      if (channel) {
        channel.postMessage({ type: 'PLAYER_LEFT', playerId: user.id });
        channel.close();
      }
    };
  }, [roomConfig.roomCode]);

  // Host Action: Start Match (Gated to Creator only with minimum 2 players)
  const handleHostStartGame = () => {
    if (!isCurrentUserHost) {
      alert('Only the room creator / host can start the match.');
      return;
    }
    if (room.players.length < 2) {
      sounds.playBankrupt();
      alert('A minimum of 2 players is required to start the match. Please invite another player with your room code/link, or add an AI bot.');
      return;
    }

    sounds.playDiceRoll();
    const updatedRoom: GameRoom = {
      ...room,
      status: 'playing',
      currentTurnPlayerId: room.players[0].id,
      currentTurnIndex: 0,
      turnPhase: 'roll',
      turnTimer: roomConfig.turnTimeSeconds || 15,
      totalPrizePool: room.betAmount * room.players.length,
      logs: [
        {
          id: 'log_start_' + Date.now(),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          text: `🚀 Match started by room creator ${user.username}! All ${room.players.length} players ready to roll.`,
          type: 'info'
        },
        ...room.logs
      ]
    };

    setRoom(updatedRoom);
    broadcastAndSync(updatedRoom, 'GAME_STARTED');

    // Notify backend server of match start
    fetch(`/api/rooms/${encodeURIComponent(roomConfig.roomCode.toLowerCase())}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostId: myPlayerId, playerId: myPlayerId })
    }).catch(() => {});
  };

  // Host Action: Add an AI Bot to fill an empty slot (Optional)
  const handleAddBotToLobby = () => {
    if (!isCurrentUserHost) return;
    if (room.players.length >= roomConfig.maxPlayers) return;
    const botIdx = room.players.length;
    const newBot: Player = {
      id: 'bot_' + Date.now().toString(36),
      name: botNames[(botIdx - 1) % botNames.length] || `Tycoon_${botIdx}`,
      avatar: botAvatars[(botIdx - 1) % botAvatars.length] || 'bu',
      avatarFrame: botFrames[(botIdx - 1) % botFrames.length] || undefined,
      diceSkin: botDiceSkins[(botIdx - 1) % botDiceSkins.length],
      color: playerColors[botIdx % playerColors.length],
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
      isBot: true,
      isHost: false
    };

    const updatedRoom: GameRoom = {
      ...room,
      players: [...room.players, newBot],
      totalPrizePool: room.betAmount * (room.players.length + 1)
    };

    setRoom(updatedRoom);
    sounds.playClick();
    broadcastAndSync(updatedRoom);
  };

  // Host Action: Remove player or bot from waiting room
  const handleRemovePlayerFromLobby = (playerId: string) => {
    if (!isCurrentUserHost) return;
    const updatedPlayers = room.players.filter(p => p.id !== playerId);
    const updatedRoom: GameRoom = {
      ...room,
      players: updatedPlayers,
      totalPrizePool: room.betAmount * updatedPlayers.length,
      logs: [
        {
          id: 'log_kick_' + Date.now(),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text: `👢 A player was removed from the lobby by the host.`,
          type: 'info'
        },
        ...room.logs
      ]
    };
    setRoom(updatedRoom);
    sounds.playClick();
    broadcastAndSync(updatedRoom, 'PLAYER_KICKED');

    // Notify backend server of kick
    fetch(`/api/rooms/${encodeURIComponent(roomConfig.roomCode.toLowerCase())}/kick`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostId: myPlayerId, playerIdToKick: playerId })
    }).catch(() => {});

    try {
      const channel = new BroadcastChannel(`proprush_sync_${roomConfig.roomCode.toLowerCase()}`);
      channel.postMessage({
        type: 'PLAYER_KICKED',
        kickedPlayerId: playerId,
        room: updatedRoom
      });
      channel.close();
    } catch {}
  };

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
      if (prev.logs.length > 0 && (prev.logs[0].text === text || prev.logs[0].message === text)) {
        return prev;
      }
      return {
        ...prev,
        logs: [
          {
            id: 'log_' + Date.now() + Math.random().toString(36).substring(2, 6),
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            text,
            message: text,
            type
          },
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
        sounds.playWin();
        clearActiveMatch();
        const myId = myPlayer?.id || user.id;
        const finalPlacement = winner.id === myId ? 1 : 2;
        const statsResult = recordMatchResult({
          roomName: prev.name,
          placement: finalPlacement,
          totalPlayers: prev.players.length,
          betAmount: prev.betAmount,
          payout: finalPlacement === 1 ? prev.totalPrizePool * (1 - prev.platformFeeRate) : 0,
          netWorth: winner.netWorth,
          durationMinutes: 6,
          stats: {
            rentCollected: 1200,
            propertiesBought: winner.properties.length,
            housesBuilt: (Object.values(winner.houses || {}) as number[]).reduce((a: number, b: number) => a + b, 0),
            doublesRolled: 3
          }
        });
        setMatchSummaryStats(statsResult);
        addLog(`🏆 ${winner.name} won the match! All opponents went bankrupt.`, 'info');

        const finishedRoom: GameRoom = {
          ...prev,
          status: 'finished',
          winner: winner,
          activeTrade: null,
          auction: null
        };
        broadcastAndSync(finishedRoom, 'GAME_OVER');
        return finishedRoom;
      }

      const currentIndex = prev.players.findIndex(p => p.id === prev.currentTurnPlayerId);
      let nextIndex = (currentIndex >= 0 ? currentIndex + 1 : (prev.currentTurnIndex || 0) + 1) % prev.players.length;
      let loopCount = 0;
      while (prev.players[nextIndex].isBankrupt && loopCount < prev.players.length) {
        nextIndex = (nextIndex + 1) % prev.players.length;
        loopCount++;
      }

      const nextPlayer = prev.players[nextIndex];

      const updated: GameRoom = {
        ...prev,
        currentTurnIndex: nextIndex,
        currentTurnPlayerId: nextPlayer.id,
        turnPhase: nextPlayer.inJail ? 'jail_decision' : 'roll',
        turnTimer: roomConfig.turnTimeSeconds || 15,
        isDouble: false,
        doubleCount: 0,
        pendingCard: null
      };
      broadcastAndSync(updated, 'SYNC_ROOM');
      return updated;
    });
  };

  const handleGameOver = (winner: Player) => {
    sounds.playWin();
    clearActiveMatch();
    const myId = myPlayer?.id || user.id;
    const finalPlacement = winner.id === myId ? 1 : 2;
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
        housesBuilt: (Object.values(winner.houses || {}) as number[]).reduce((a: number, b: number) => a + b, 0),
        doublesRolled: 3
      }
    });

    setMatchSummaryStats(statsResult);
    setRoom(prev => {
      const updated: GameRoom = {
        ...prev,
        status: 'finished',
        winner: winner,
        activeTrade: null,
        auction: null
      };
      broadcastAndSync(updated, 'GAME_OVER');
      return updated;
    });
  };

  const handleForfeit = () => {
    // 1. If match has not started yet (waiting room), forfeit / leave refunds the player's buy-in
    if (room.status === 'waiting') {
      sounds.playCashRegister();
      clearActiveMatch();
      setShowForfeitConfirmModal(false);
      try {
        sessionStorage.removeItem(`proprush_creator_${roomConfig.roomCode.toLowerCase()}`);
        window.history.replaceState({}, '', window.location.pathname);
      } catch {}

      if (roomConfig.betAmount > 0) {
        depositFunds(roomConfig.betAmount, 'room_leave_refund');
      }

      const updatedPlayers = room.players.filter(p => p.id !== myPlayerId);
      const updatedRoom: GameRoom = {
        ...room,
        players: updatedPlayers,
        totalPrizePool: room.betAmount * updatedPlayers.length
      };
      broadcastAndSync(updatedRoom);
      try {
        const channel = new BroadcastChannel(`proprush_sync_${roomConfig.roomCode.toLowerCase()}`);
        channel.postMessage({ type: 'PLAYER_LEFT', playerId: myPlayerId });
        channel.close();
      } catch {}

      onLeaveRoom();
      return;
    }

    // 2. Active game forfeit (bankruptcy)
    sounds.playBankrupt();
    clearActiveMatch();
    setShowForfeitConfirmModal(false);

    setRoom(prev => {
      const playerToForfeit =
        prev.players.find(p => p.id === myPlayerId) ||
        prev.players[0];
      if (!playerToForfeit) return prev;

      const updatedPlayers = prev.players.map(p => {
        if (p.id === playerToForfeit.id) {
          return {
            ...p,
            isBankrupt: true,
            cash: 0,
            netWorth: 0,
            properties: [],
            mortgaged: [],
            houses: {}
          };
        }
        return p;
      });

      addLog(`💀 ${playerToForfeit.name} surrendered and declared bankruptcy.`, 'info');

      const remainingActive = updatedPlayers.filter(p => !p.isBankrupt);

      // If only 1 player remains, they WIN immediately!
      if (remainingActive.length <= 1) {
        const winner = remainingActive[0] || updatedPlayers[0];
        sounds.playWin();
        addLog(`🏆 ${winner.name} won the match! All opponents went bankrupt.`, 'info');

        const finalPlacement = winner.id === myPlayerId ? 1 : 2;
        const statsResult = recordMatchResult({
          roomName: prev.name,
          placement: finalPlacement,
          totalPlayers: prev.players.length,
          betAmount: prev.betAmount,
          payout: finalPlacement === 1 ? prev.totalPrizePool * (1 - prev.platformFeeRate) : 0,
          netWorth: winner.netWorth,
          durationMinutes: 6,
          stats: {
            rentCollected: 1200,
            propertiesBought: winner.properties.length,
            housesBuilt: (Object.values(winner.houses || {}) as number[]).reduce((a: number, b: number) => a + b, 0),
            doublesRolled: 3
          }
        });
        setMatchSummaryStats(statsResult);

        const finishedRoom: GameRoom = {
          ...prev,
          players: updatedPlayers,
          status: 'finished',
          winner: winner,
          activeTrade: null,
          auction: null
        };
        broadcastAndSync(finishedRoom, 'GAME_OVER');
        return finishedRoom;
      }

      // Otherwise, advance turn to the next non-bankrupt player
      const currentIndex = updatedPlayers.findIndex(p => p.id === prev.currentTurnPlayerId);
      let nextIndex = (currentIndex >= 0 ? currentIndex + 1 : (prev.currentTurnIndex || 0)) % updatedPlayers.length;
      let loopCount = 0;
      while (updatedPlayers[nextIndex].isBankrupt && loopCount < updatedPlayers.length) {
        nextIndex = (nextIndex + 1) % updatedPlayers.length;
        loopCount++;
      }

      const nextPlayer = updatedPlayers[nextIndex];
      const updatedRoom: GameRoom = {
        ...prev,
        players: updatedPlayers,
        currentTurnIndex: nextIndex,
        currentTurnPlayerId: nextPlayer.id,
        turnPhase: nextPlayer.inJail ? 'jail_decision' : 'roll',
        turnTimer: roomConfig.turnTimeSeconds || 15,
        isDouble: false,
        doubleCount: 0,
        pendingCard: null,
        activeTrade:
          prev.activeTrade?.fromPlayerId === playerToForfeit.id ||
          prev.activeTrade?.toPlayerId === playerToForfeit.id
            ? null
            : prev.activeTrade
      };
      broadcastAndSync(updatedRoom, 'BANKRUPTCY');
      return updatedRoom;
    });
  };

  // Handle dice rolling and tile resolution
  const handleRollDice = (isAutoTimeout = false) => {
    // Check turn authorization (current player, host controlling bot, or authoritative timeout fallback)
    const currentTurn = room.players.find(p => p.id === room.currentTurnPlayerId);
    const isBotTurn = Boolean(currentTurn?.isBot && isCurrentUserHost);
    const isAuthorized = isMyTurn || isBotTurn || (isAutoTimeout && (isCurrentUserHost || isMyTurn));
    if (!isAuthorized) return;

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
      const currentPlayerIndex = prev.players.findIndex(p => p.id === prev.currentTurnPlayerId);
      if (currentPlayerIndex === -1) return prev;
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
        player.cash = 0;
        player.netWorth = 0;
        player.properties = [];
        player.houses = {};
        player.mortgaged = [];
        addLog(`💀 ${player.name} went bankrupt and is out of the game!`, 'info');
        sounds.playBankrupt();
      }

      const updatedPlayers = [...prev.players];
      updatedPlayers[currentPlayerIndex] = player;

      const remainingActive = updatedPlayers.filter(p => !p.isBankrupt);
      if (remainingActive.length <= 1 && prev.status === 'playing') {
        const winner = remainingActive[0] || updatedPlayers[0];
        sounds.playWin();
        clearActiveMatch();
        const myId = myPlayer?.id || user.id;
        const finalPlacement = winner.id === myId ? 1 : 2;
        const statsResult = recordMatchResult({
          roomName: prev.name,
          placement: finalPlacement,
          totalPlayers: prev.players.length,
          betAmount: prev.betAmount,
          payout: finalPlacement === 1 ? prev.totalPrizePool * (1 - prev.platformFeeRate) : 0,
          netWorth: winner.netWorth,
          durationMinutes: 6,
          stats: {
            rentCollected: 1200,
            propertiesBought: winner.properties.length,
            housesBuilt: (Object.values(winner.houses || {}) as number[]).reduce((a: number, b: number) => a + b, 0),
            doublesRolled: 3
          }
        });
        setMatchSummaryStats(statsResult);
        addLog(`🏆 ${winner.name} won the match! All opponents went bankrupt.`, 'info');

        const finishedRoom: GameRoom = {
          ...prev,
          players: updatedPlayers,
          status: 'finished',
          winner: winner,
          activeTrade: null,
          auction: null
        };
        broadcastAndSync(finishedRoom, 'GAME_OVER');
        return finishedRoom;
      }

      if (player.isBankrupt) {
        let nextIndex = (currentPlayerIndex + 1) % updatedPlayers.length;
        let loopCount = 0;
        while (updatedPlayers[nextIndex].isBankrupt && loopCount < updatedPlayers.length) {
          nextIndex = (nextIndex + 1) % updatedPlayers.length;
          loopCount++;
        }
        const nextPlayer = updatedPlayers[nextIndex];
        const updatedRoom: GameRoom = {
          ...prev,
          players: updatedPlayers,
          currentTurnIndex: nextIndex,
          currentTurnPlayerId: nextPlayer.id,
          turnPhase: nextPlayer.inJail ? 'jail_decision' : 'roll',
          turnTimer: roomConfig.turnTimeSeconds || 15,
          lastDice: [d1, d2],
          isDouble: false,
          doubleCount: 0,
          pendingCard: null,
          freeParkingPool
        };
        broadcastAndSync(updatedRoom, 'BANKRUPTCY');
        return updatedRoom;
      }

      const updatedRoom: GameRoom = {
        ...prev,
        players: updatedPlayers,
        lastDice: [d1, d2],
        isDouble,
        doubleCount,
        turnPhase: newPhase,
        pendingCard,
        freeParkingPool
      };
      broadcastAndSync(updatedRoom);
      return updatedRoom;
    });
  };

  // Buy Property Handler
  const handleBuyProperty = () => {
    const currentTurn = room.players.find(p => p.id === room.currentTurnPlayerId);
    const isBotTurn = Boolean(currentTurn?.isBot && isCurrentUserHost);
    if (!isMyTurn && !isBotTurn) return;

    setRoom(prev => {
      const currentPlayerIndex = prev.players.findIndex(p => p.id === prev.currentTurnPlayerId);
      if (currentPlayerIndex === -1) return prev;
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

      const updated: GameRoom = {
        ...prev,
        players: updatedPlayers,
        turnPhase: 'action'
      };
      broadcastAndSync(updated);
      return updated;
    });
  };

  // Pass to Auction
  const handlePassToAuction = () => {
    const currentTurn = room.players.find(p => p.id === room.currentTurnPlayerId);
    const isBotTurn = Boolean(currentTurn?.isBot && isCurrentUserHost);
    if (!isMyTurn && !isBotTurn) return;

    setRoom(prev => {
      const currentPlayerIndex = prev.players.findIndex(p => p.id === prev.currentTurnPlayerId);
      if (currentPlayerIndex === -1) return prev;
      const player = prev.players[currentPlayerIndex];
      const tile = tiles[player.position];
      if (!tile || !tile.price) return { ...prev, turnPhase: 'action' };

      const activeIds = prev.players.filter(p => !p.isBankrupt).map(p => p.id);

      addLog(`🔨 ${player.name} passed on ${tile.name}. Speed Auction started!`, 'auction');
      sounds.playAuction();

      const updated: GameRoom = {
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
      broadcastAndSync(updated);
      return updated;
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

      const updated: GameRoom = {
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
      broadcastAndSync(updated);
      return updated;
    });
  };

  // Jail Fine & Card
  const handlePayJailFine = () => {
    const currentTurn = room.players.find(p => p.id === room.currentTurnPlayerId);
    const isBotTurn = Boolean(currentTurn?.isBot && isCurrentUserHost);
    if (!isMyTurn && !isBotTurn) return;

    setRoom(prev => {
      const currentPlayerIndex = prev.players.findIndex(p => p.id === prev.currentTurnPlayerId);
      if (currentPlayerIndex === -1) return prev;
      const p = { ...prev.players[currentPlayerIndex] };
      if (p.cash < 50) return prev;
      p.cash -= 50;
      p.inJail = false;
      p.jailTurns = 0;
      showCashDelta(p.id, -50);
      addLog(`💸 ${p.name} paid $50 fine into Resort Pool and is out of prison.`, 'jail');
      sounds.playEscape();

      const updated = [...prev.players];
      updated[currentPlayerIndex] = p;
      const updatedRoom: GameRoom = {
        ...prev,
        players: updated,
        freeParkingPool: prev.freeParkingPool + 50,
        turnPhase: 'roll'
      };
      broadcastAndSync(updatedRoom);
      return updatedRoom;
    });
  };

  const handleUseJailCard = () => {
    const currentTurn = room.players.find(p => p.id === room.currentTurnPlayerId);
    const isBotTurn = Boolean(currentTurn?.isBot && isCurrentUserHost);
    if (!isMyTurn && !isBotTurn) return;

    setRoom(prev => {
      const currentPlayerIndex = prev.players.findIndex(p => p.id === prev.currentTurnPlayerId);
      if (currentPlayerIndex === -1) return prev;
      const p = { ...prev.players[currentPlayerIndex] };
      if (p.getOutOfJailCards <= 0) return prev;
      p.getOutOfJailCards -= 1;
      p.inJail = false;
      p.jailTurns = 0;
      addLog(`🎫 ${p.name} used a Get Out of Jail Free card!`, 'jail');
      sounds.playEscape();

      const updated = [...prev.players];
      updated[currentPlayerIndex] = p;
      const updatedRoom: GameRoom = { ...prev, players: updated, turnPhase: 'roll' };
      broadcastAndSync(updatedRoom);
      return updatedRoom;
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
      const updatedRoom: GameRoom = { ...prev, players: updated };
      broadcastAndSync(updatedRoom);
      return updatedRoom;
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
      const updatedRoom: GameRoom = { ...prev, players: updated };
      broadcastAndSync(updatedRoom);
      return updatedRoom;
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
      const updatedRoom: GameRoom = { ...prev, players: updated };
      broadcastAndSync(updatedRoom);
      return updatedRoom;
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
      const updatedRoom: GameRoom = { ...prev, players: updated };
      broadcastAndSync(updatedRoom);
      return updatedRoom;
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
    try {
      const channel = new BroadcastChannel(`proprush_sync_${roomConfig.roomCode.toLowerCase()}`);
      channel.postMessage({ type: 'CHAT_MESSAGE', message: newMsg });
      channel.close();
    } catch {}
    sendServerChatMessage(roomConfig.roomCode, newMsg).catch(() => {});
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

  // Handle Timeout Auto-Action when Turn Timer reaches 0
  useEffect(() => {
    if (room.status !== 'playing' || room.turnTimer > 0) return;

    const current = room.players.find(p => p.id === room.currentTurnPlayerId);
    if (!current || current.isBankrupt) return;

    // Timeout expired! Auto execute if it is my turn, OR if host acting as fallback
    const isLocalTurn = isMyTurn || (myPlayer && current.id === myPlayer.id);
    if (!isLocalTurn && !isCurrentUserHost) return;

    if (room.turnPhase === 'roll' || (room.isDouble && room.turnPhase === 'action')) {
      handleRollDice(true);
    } else if (room.turnPhase === 'jail_decision') {
      if (current.cash >= 50) {
        handlePayJailFine();
      } else {
        handleRollDice(true);
      }
    } else if (room.turnPhase === 'buy_decision') {
      nextTurn();
    } else if (room.turnPhase === 'action') {
      nextTurn();
    }
  }, [room.turnTimer, room.turnPhase, room.status, room.currentTurnPlayerId, isMyTurn, isCurrentUserHost, myPlayer]);

  // Alert and sound effect when an active trade offer arrives
  const prevActiveTradeStr = useRef<string>('');
  useEffect(() => {
    const tradeStr = JSON.stringify(room.activeTrade || null);
    if (tradeStr !== prevActiveTradeStr.current) {
      if (room.activeTrade) {
        const myId = myPlayer?.id || user.id;
        if (room.activeTrade.toPlayerId === myId) {
          sounds.playPassGo();
          const sender = room.players.find(p => p.id === room.activeTrade?.fromPlayerId);
          addLog(`📩 Trade proposal received from ${sender?.name || 'Player'}!`, 'info');
        }
      }
      prevActiveTradeStr.current = tradeStr;
    }
  }, [room.activeTrade, myPlayer?.id, user.id]);

  // AI Bot Trade Evaluation & Response (Host Authoritative)
  useEffect(() => {
    if (room.status !== 'playing' || !room.activeTrade) return;
    if (!isCurrentUserHost) return;

    const target = room.players.find(p => p.id === room.activeTrade?.toPlayerId);
    if (!target || !target.isBot) return;

    const trade = room.activeTrade;
    const botTimer = setTimeout(() => {
      let offeredValue = trade.offeredCash;
      trade.offeredProperties.forEach(pid => {
        const t = tiles[pid];
        if (t?.price) offeredValue += t.price;
      });

      let requestedValue = trade.requestedCash;
      trade.requestedProperties.forEach(pid => {
        const t = tiles[pid];
        if (t?.price) requestedValue += t.price;
      });

      const isGoodDeal = offeredValue >= requestedValue * 0.9 && target.cash >= trade.requestedCash;
      if (isGoodDeal) {
        setRoom(prev => {
          if (!prev.activeTrade) return prev;
          const { fromPlayerId, toPlayerId, offeredCash, offeredProperties, requestedCash, requestedProperties } = prev.activeTrade;
          const updatedPlayers = prev.players.map(p => {
            if (p.id === fromPlayerId) {
              const newP = {
                ...p,
                cash: p.cash - offeredCash + requestedCash,
                properties: [...p.properties.filter(id => !offeredProperties.includes(id)), ...requestedProperties]
              };
              newP.netWorth = calculateNetWorth(newP);
              return newP;
            }
            if (p.id === toPlayerId) {
              const newP = {
                ...p,
                cash: p.cash - requestedCash + offeredCash,
                properties: [...p.properties.filter(id => !requestedProperties.includes(id)), ...offeredProperties]
              };
              newP.netWorth = calculateNetWorth(newP);
              return newP;
            }
            return p;
          });
          const p1 = prev.players.find(p => p.id === fromPlayerId);
          addLog(`🤝 ${target.name} accepted the trade offer from ${p1?.name || 'Player'}!`, 'info');
          sounds.playCashRegister();
          const updated: GameRoom = { ...prev, players: updatedPlayers, activeTrade: null };
          broadcastAndSync(updated, 'TRADE_ACCEPTED');
          return updated;
        });
        sendChatMessage(target.name, target.avatar, 'Deal! Pleasure doing business with you. 🤝');
      } else {
        setRoom(prev => {
          const updated: GameRoom = { ...prev, activeTrade: null };
          broadcastAndSync(updated, 'TRADE_DECLINED');
          return updated;
        });
        addLog(`🤝 ${target.name} declined the trade offer.`, 'info');
        sendChatMessage(target.name, target.avatar, 'No deal! I need a much better offer than that. 🙅‍♂️');
      }
    }, 1500);

    return () => clearTimeout(botTimer);
  }, [room.activeTrade, room.status, isCurrentUserHost]);

  // Bot Turn Automation (Host authoritative to prevent multiple tabs/devices from running bot turns simultaneously)
  useEffect(() => {
    if (room.status !== 'playing') return;
    const isHost = room.hostId === user.id;
    // Only the room host executes bot AI turns so actions are never duplicated
    if (!isHost) return;

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
    if (room.status === 'playing' || room.status === 'waiting') {
      markDisconnected(room, roomConfig, chatMessages);
    }
    onLeaveRoom();
  };

  const handleCopyLink = () => {
    try {
      const url = `${window.location.origin}/?room=${encodeURIComponent(room.code || roomConfig.roomCode)}`;
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(url).catch(() => {});
      }
    } catch {}
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const myOwnedTiles = tiles.filter(t => myPlayer?.properties.includes(t.id));

  if (roomNotFound) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-8 text-center shadow-2xl backdrop-blur-sm">
          <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-5 text-2xl font-bold">
            !
          </div>
          <h2 className="text-2xl font-black text-slate-100 mb-2">Room Not Found</h2>
          <p className="text-slate-400 text-sm mb-6 leading-relaxed">
            Room <span className="font-mono text-amber-400 font-bold tracking-wider">"{roomConfig.roomCode.toUpperCase()}"</span> does not exist or has already closed. Please verify the code with your host.
          </p>
          <button
            onClick={() => {
              clearActiveMatch();
              onLeaveRoom();
            }}
            className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 transition-all active:scale-95"
          >
            Return to Game Lobby
          </button>
        </div>
      </div>
    );
  }

  if (isConnecting) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-slate-900/80 border border-slate-800 rounded-2xl p-8 text-center shadow-xl backdrop-blur-sm">
          <div className="w-12 h-12 border-3 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-100 mb-1">Connecting to Table...</h3>
          <p className="text-xs text-slate-400 font-mono">Room {roomConfig.roomCode.toUpperCase()}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full h-screen max-h-screen overflow-hidden flex flex-col select-none relative transition-colors duration-200 ${
      isLight ? 'bg-slate-100 text-slate-900' : 'bg-[#0e0b1f] text-slate-100'
    }`}>
      {/* 1. TOP HEADER BAR */}
      <header className={`h-12 border-b px-2 sm:px-4 flex items-center justify-between flex-shrink-0 z-30 shadow-md ${
        isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#130f26] border-[#251d45] text-white'
      }`}>
        {/* Left: Logo + Navigation Links */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1 sm:gap-1.5 font-heading font-black text-sm sm:text-lg tracking-wider">
            <span className="text-[#7059e2] text-lg sm:text-xl">🎲</span>
            <span className={isLight ? 'text-slate-900' : 'text-white'}>PROPRUSH</span>
          </div>

          <div className={`h-4 w-px hidden sm:block ${isLight ? 'bg-slate-200' : 'bg-slate-700'}`} />

          <button
            id="btn-leave-room"
            onClick={handleGracefulLeave}
            className={`px-2 sm:px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold border cursor-pointer flex items-center gap-1 transition-all ${
              isLight
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-slate-700'
            }`}
            title="Leave room (Your state is saved for 2 minutes to rejoin)"
          >
            <span>←</span>
            <span>Lobby</span>
          </button>

          {room.status === 'playing' && (
            <button
              id="btn-header-forfeit"
              onClick={() => {
                sounds.playClick();
                setShowForfeitConfirmModal(true);
              }}
              className={`px-2 sm:px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold border cursor-pointer flex items-center gap-1 transition-all active:scale-95 ${
                isLight
                  ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                  : 'bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border-rose-800/60'
              }`}
              title="Surrender / Bankrupt"
            >
              <span>🚩</span>
              <span>Forfeit</span>
            </button>
          )}
        </div>

        {/* Center: Room Code Display & Pot */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className={`px-2 sm:px-3 py-0.5 rounded-full border text-[10px] sm:text-xs font-mono-code font-bold flex items-center gap-1 sm:gap-1.5 shadow-inner ${
            isLight
              ? 'bg-purple-50 border-purple-200 text-purple-800'
              : 'bg-[#1e1738] border-[#7059e2]/40 text-[#b4a4ff]'
          }`}>
            <span className="hidden xs:inline">Room:</span>
            <span className="tracking-wider uppercase font-bold">{room.code}</span>
          </div>
          {room.betAmount > 0 && (
            <div className={`px-2 sm:px-2.5 py-0.5 rounded-full border text-[10px] sm:text-xs font-mono-code font-bold ${
              isLight
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
            }`}>
              Pot: ${room.totalPrizePool}
            </div>
          )}
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className={`p-1.5 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-center ${
              isLight
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                : 'bg-[#1a1433] hover:bg-[#281f4a] text-slate-200 border-[#3b2f66]'
            }`}
            title={isLight ? 'Switch to Dark Theme' : 'Switch to Light Theme'}
          >
            {isLight ? '🌙' : '☀️'}
          </button>

          {/* Sound Mute Toggle */}
          {onToggleMute && (
            <button
              onClick={onToggleMute}
              className={`p-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                  : 'bg-[#1a1433] hover:bg-[#281f4a] text-slate-200 border-[#3b2f66]'
              }`}
              title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            >
              {isMuted ? '🔇' : '🔊'}
            </button>
          )}

          {/* Share Button with Instant Copy */}
          <button
            onClick={handleCopyLink}
            className="px-2.5 sm:px-3 py-1 rounded-lg bg-[#7059e2]/20 hover:bg-[#7059e2]/30 text-[#7059e2] border border-[#7059e2]/40 text-xs font-bold cursor-pointer transition-all flex items-center gap-1"
            title="Copy room invite link"
          >
            <span>🔗</span>
            <span className="hidden sm:inline">{copiedLink ? 'Copied!' : 'Share'}</span>
          </button>
        </div>
      </header>

      {/* Mobile/Tablet Screen View Mode Tabs (Visible on < lg screens) */}
      <div className={`lg:hidden flex items-center justify-around border-b px-2 py-1 flex-shrink-0 z-20 ${
        isLight ? 'bg-white border-slate-200' : 'bg-[#110d24] border-[#251d45]'
      }`}>
        <button
          onClick={() => setMobileTab('board')}
          className={`flex-1 py-1 px-2 rounded-lg text-xs font-bold text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            mobileTab === 'board'
              ? 'bg-[#7059e2] text-white shadow-xs'
              : isLight
              ? 'text-slate-600 hover:bg-slate-100'
              : 'text-slate-400 hover:bg-slate-800/60'
          }`}
        >
          <span>🎲</span>
          <span>Game Board</span>
        </button>
        <button
          onClick={() => setMobileTab('stats')}
          className={`flex-1 py-1 px-2 rounded-lg text-xs font-bold text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            mobileTab === 'stats'
              ? 'bg-[#7059e2] text-white shadow-xs'
              : isLight
              ? 'text-slate-600 hover:bg-slate-100'
              : 'text-slate-400 hover:bg-slate-800/60'
          }`}
        >
          <span>👥</span>
          <span>Players & Stats ({room.players.length})</span>
        </button>
      </div>

      {/* 2. MAIN LAYOUT: RESPONSIVE ACROSS MOBILE, IPAD/TABLET & DESKTOP */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row items-stretch justify-between p-1.5 sm:p-2.5 lg:p-3 gap-2 sm:gap-3 overflow-hidden">
        
        {/* CENTER / PRIMARY COLUMN: The Authentic 11x11 GameBoard (Expanded & Centered) */}
        <div className={`flex-1 min-h-0 min-w-0 flex items-center justify-center p-0.5 sm:p-1 relative overflow-hidden ${
          mobileTab === 'board' ? 'flex' : 'hidden lg:flex'
        }`}>
          <div className="w-full h-full max-h-full max-w-full aspect-square flex items-center justify-center">
            <GameBoard
              tiles={tiles}
              room={room}
              activeTileId={selectedTile?.id || null}
              onTileClick={tile => setSelectedTile(tile)}
              onRollDice={handleRollDice}
              isRolling={isRolling}
              canRoll={isMyTurn && (room.turnPhase === 'roll' || (room.isDouble && room.turnPhase === 'action'))}
              isMyTurn={isMyTurn}
              onBuyProperty={handleBuyProperty}
              onPassToAuction={handlePassToAuction}
              onPayJailFine={handlePayJailFine}
              onUseJailCard={handleUseJailCard}
              onEndTurn={nextTurn}
              onToggleSpeed={() => setRoom(r => ({ ...r, fastSpeed: !r.fastSpeed }))}
              onStartGame={handleHostStartGame}
              onKickPlayer={handleRemovePlayerFromLobby}
              isLobbyMode={room.status === 'waiting'}
              isHost={isCurrentUserHost}
            />
          </div>
        </div>

        {/* RIGHT COLUMN: Player List, Bankrupt Button, Trades Card, My Properties */}
        <div className={`w-full lg:w-72 xl:w-80 flex-shrink-0 flex flex-col justify-between gap-2.5 h-full overflow-y-auto lg:overflow-hidden ${
          mobileTab === 'stats' ? 'flex' : 'hidden lg:flex'
        }`}>
          
          {/* Players List */}
          <div className={`p-3 rounded-2xl border flex flex-col gap-2 shadow-md ${
            isLight ? 'bg-white border-slate-200' : 'bg-[#141026] border-[#2b2447]'
          }`}>
            <div className={`flex items-center justify-between text-xs font-bold border-b pb-1.5 ${
              isLight ? 'text-slate-700 border-slate-100' : 'text-slate-300 border-slate-800'
            }`}>
              <span>Players ({room.players.length})</span>
              <span className={`text-[10px] font-mono-code ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Ranked</span>
            </div>

            <div className="space-y-1.5 max-h-[240px] overflow-y-auto overflow-x-hidden pr-1 scrollbar-thin">
              {room.players.map(p => {
                const isTurn = p.id === room.currentTurnPlayerId;
                const delta = cashDeltas[p.id];
                const authoritativeHost = room.hostId || (isSessionCreator ? myPlayerId : (room.players[0] ? room.players[0].id : ''));
                const isPlayerHost = Boolean((authoritativeHost && p.id === authoritativeHost) || p.isHost);

                return (
                  <div
                    key={p.id}
                    className={`p-2 rounded-xl border min-h-[50px] transition-all flex items-center justify-between ${
                      p.isBankrupt
                        ? 'opacity-40 grayscale ' + (isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-950/40 border-slate-900')
                        : isTurn
                        ? (isLight
                            ? 'bg-purple-50/90 border-[#7059e2] ring-1.5 ring-[#7059e2]/60 shadow-xs'
                            : 'bg-[#22183d] border-[#7059e2] ring-1.5 ring-[#7059e2]/80 shadow-[0_0_15px_rgba(112,89,226,0.3)]')
                        : (isLight
                            ? 'bg-slate-50 border-slate-200'
                            : 'bg-[#0f0c1e] border-slate-800/80')
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="relative w-8 h-8 flex items-center justify-center shrink-0">
                        <AvatarCharacter avatarId={p.avatar} frameId={p.avatarFrame} size="sm" isAnimated={false} />
                        {p.inJail && (
                          <div className="absolute -bottom-1 -right-1 text-[10px]">🔒</div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className={`font-heading font-bold text-xs flex items-center ${
                          isLight ? 'text-slate-900' : 'text-white'
                        }`}>
                          <PlayerNameWithWallet
                            player={p}
                            isYou={p.id === myPlayerId}
                            isHost={isPlayerHost}
                            maxNameWidthClass="max-w-[105px]"
                          />
                        </div>
                        <div className={`text-[10px] font-mono-code ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                          {p.properties.length} props
                        </div>
                      </div>
                    </div>

                    {/* Cash & Turn Indicator / Host Kick Button in Lobby */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {room.status === 'waiting' && isCurrentUserHost && !isPlayerHost && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemovePlayerFromLobby(p.id);
                          }}
                          className="px-2 py-0.5 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white text-[10px] font-bold border border-rose-500/30 transition-all cursor-pointer shadow-xs active:scale-95"
                          title={`Kick ${p.name} from room`}
                        >
                          Kick ✕
                        </button>
                      )}

                      <div className="text-right">
                        <div className={`text-xs font-mono-code font-extrabold ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                          ${p.cash}
                        </div>
                        {/* Animated Net Change Badge */}
                        {delta && (
                          <div
                            key={delta.key}
                            className={`text-[9px] font-mono-code font-bold animate-fade-in ${
                              delta.delta >= 0 ? (isLight ? 'text-emerald-600' : 'text-emerald-400') : 'text-rose-500'
                            }`}
                          >
                            {delta.delta >= 0 ? `+$${delta.delta}` : `-$${Math.abs(delta.delta)}`}
                          </div>
                        )}
                      </div>

                      {isTurn && (
                        <span className="text-[#7059e2] font-black text-sm animate-pulse">
                          →
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bankrupt / Forfeit Button with Confirmation Trigger (Only in active playing game) */}
            {room.status === 'playing' && (
              <button
                id="btn-bankrupt-forfeit"
                onClick={() => {
                  sounds.playClick();
                  setShowForfeitConfirmModal(true);
                }}
                className={`w-full py-1.5 rounded-xl border text-[11px] font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5 active:scale-95 shadow-xs ${
                  isLight
                    ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                    : 'bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60'
                }`}
                title="Surrender this match and declare bankruptcy"
              >
                <span>🚩</span>
                <span>Forfeit / Bankrupt</span>
              </button>
            )}
          </div>

          {/* Trades Section Card */}
          <div className={`p-3 rounded-2xl border flex flex-col gap-2 shadow-md transition-all ${
            room.status !== 'waiting' && room.activeTrade && (room.activeTrade.toPlayerId === (myPlayer?.id || user.id))
              ? isLight ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400/50' : 'bg-[#221a36] border-amber-500/60 ring-2 ring-amber-500/30'
              : isLight ? 'bg-white border-slate-200' : 'bg-[#141026] border-[#2b2447]'
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-bold flex items-center gap-1.5 ${isLight ? 'text-slate-800' : 'text-white'}`}>
                <span>🤝</span>
                <span>Trades</span>
                {room.status !== 'waiting' && room.activeTrade && room.activeTrade.toPlayerId === (myPlayer?.id || user.id) && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                )}
              </span>
              {room.status === 'waiting' ? (
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono-code font-medium flex items-center gap-1 border ${
                  isLight ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-slate-800/60 text-slate-400 border-slate-700/60'
                }`}>
                  <span>🔒</span>
                  <span>Unlocks In-Game</span>
                </span>
              ) : (
                <button
                  onClick={() => setShowTradeModal(true)}
                  className="px-2.5 py-1 rounded-lg bg-[#7059e2] hover:bg-[#5e46d0] text-white text-[10px] font-bold cursor-pointer transition-all active:scale-95 flex items-center gap-1 shadow-sm"
                >
                  <span>+</span>
                  <span>{room.activeTrade ? 'View Trade' : 'Create'}</span>
                </button>
              )}
            </div>

            {room.status === 'waiting' ? (
              <p className={`text-[10px] leading-relaxed ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Trading properties and negotiating deals opens up once the match is started by the host.
              </p>
            ) : (
              <>
                {/* Active Incoming Trade Card */}
                {room.activeTrade && (room.activeTrade.toPlayerId === (myPlayer?.id || user.id)) && (
                  <div className={`p-2.5 rounded-xl border text-xs space-y-1.5 ${
                    isLight ? 'bg-white border-amber-200 text-slate-800' : 'bg-slate-900/80 border-amber-500/40 text-slate-200'
                  }`}>
                    <div className="flex items-center justify-between font-bold text-[11px] text-amber-500">
                      <span>📩 Incoming Proposal</span>
                      <span className="text-[10px] text-slate-400">
                        From {room.players.find(p => p.id === room.activeTrade?.fromPlayerId)?.name || 'Player'}
                      </span>
                    </div>
                    <div className="text-[10px] space-y-0.5 font-medium">
                      <div className="text-emerald-500">
                        Receive: +${room.activeTrade.offeredCash} {room.activeTrade.offeredProperties.length > 0 && `& ${room.activeTrade.offeredProperties.length} prop(s)`}
                      </div>
                      <div className="text-rose-400">
                        Give: -${room.activeTrade.requestedCash} {room.activeTrade.requestedProperties.length > 0 && `& ${room.activeTrade.requestedProperties.length} prop(s)`}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <button
                        onClick={() => setShowTradeModal(true)}
                        className="flex-1 py-1 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] cursor-pointer transition-all"
                      >
                        Review & Accept
                      </button>
                      <button
                        onClick={() => {
                          setRoom(prev => {
                            const updated: GameRoom = { ...prev, activeTrade: null };
                            broadcastAndSync(updated, 'TRADE_DECLINED');
                            return updated;
                          });
                          sounds.playPayRent();
                          addLog(`Trade proposal declined.`, 'info');
                        }}
                        className="py-1 px-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-[10px] cursor-pointer transition-all"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                )}

                {/* Active Outgoing Trade Card */}
                {room.activeTrade && (room.activeTrade.fromPlayerId === (myPlayer?.id || user.id)) && (
                  <div className={`p-2.5 rounded-xl border text-xs space-y-1.5 ${
                    isLight ? 'bg-purple-50 border-purple-200 text-slate-800' : 'bg-purple-950/40 border-purple-800/40 text-slate-200'
                  }`}>
                    <div className="flex items-center justify-between font-bold text-[11px] text-purple-400">
                      <span className="flex items-center gap-1">⏳ Proposal Sent</span>
                      <span className="text-[10px] text-slate-400">
                        To {room.players.find(p => p.id === room.activeTrade?.toPlayerId)?.name || 'Player'}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Waiting for response...
                    </div>
                    <div className="flex gap-1.5 pt-0.5">
                      <button
                        onClick={() => setShowTradeModal(true)}
                        className="flex-1 py-1 px-2 rounded-lg bg-[#7059e2] hover:bg-[#5e46d0] text-white font-bold text-[10px] cursor-pointer transition-all"
                      >
                        View Details
                      </button>
                      <button
                        onClick={() => {
                          setRoom(prev => {
                            const updated: GameRoom = { ...prev, activeTrade: null };
                            broadcastAndSync(updated, 'TRADE_DECLINED');
                            return updated;
                          });
                          sounds.playClick();
                          addLog(`Trade proposal cancelled.`, 'info');
                        }}
                        className="py-1 px-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] cursor-pointer transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Spectator Active Trade Card (Visible to all other players in the game) */}
                {room.activeTrade && 
                 (room.activeTrade.toPlayerId !== (myPlayer?.id || user.id)) && 
                 (room.activeTrade.fromPlayerId !== (myPlayer?.id || user.id)) && (
                  <div className={`p-2.5 rounded-xl border text-xs space-y-1.5 ${
                    isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-slate-900/80 border-slate-800 text-slate-200'
                  }`}>
                    <div className="flex items-center justify-between font-bold text-[11px] text-[#7059e2]">
                      <span className="flex items-center gap-1">👁️ Live Deal</span>
                      <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                        {room.players.find(p => p.id === room.activeTrade?.fromPlayerId)?.name || 'Sender'} ➔ {room.players.find(p => p.id === room.activeTrade?.toPlayerId)?.name || 'Receiver'}
                      </span>
                    </div>
                    <div className="text-[10px] space-y-0.5 font-medium">
                      <div className="text-emerald-500">
                        Offers: +${room.activeTrade.offeredCash} {room.activeTrade.offeredProperties.length > 0 && `& ${room.activeTrade.offeredProperties.length} prop(s)`}
                      </div>
                      <div className="text-amber-400">
                        Requests: ${room.activeTrade.requestedCash} {room.activeTrade.requestedProperties.length > 0 && `& ${room.activeTrade.requestedProperties.length} prop(s)`}
                      </div>
                    </div>
                    <div className="flex gap-1.5 pt-0.5">
                      <button
                        onClick={() => setShowTradeModal(true)}
                        className="w-full py-1 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[10px] cursor-pointer transition-all border border-slate-700"
                      >
                        View Trade Deal (Spectator)
                      </button>
                    </div>
                  </div>
                )}

                {/* Default Trade Info when no active trade */}
                {!room.activeTrade && (
                  <p className={`text-[10px] leading-relaxed ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    Make trades with other players to acquire monopolies and build houses.
                  </p>
                )}
              </>
            )}
          </div>

          {/* My Properties Card */}
          <div className={`flex-1 min-h-0 p-3 rounded-2xl border flex flex-col justify-between gap-1.5 shadow-md overflow-hidden ${
            isLight ? 'bg-white border-slate-200' : 'bg-[#141026] border-[#2b2447]'
          }`}>
            <div className={`flex items-center justify-between border-b pb-1 ${
              isLight ? 'border-slate-100' : 'border-slate-800'
            }`}>
              <span className={`text-xs font-bold flex items-center gap-1 ${isLight ? 'text-slate-800' : 'text-white'}`}>
                <span>🏘️</span> My Properties ({myOwnedTiles.length})
              </span>
              <span className={`text-[9px] font-mono-code ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Click to manage</span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-1 text-xs">
              {myOwnedTiles.length > 0 ? (
                myOwnedTiles.map(t => (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTile(t)}
                    className={`p-1.5 rounded-xl border cursor-pointer flex items-center justify-between transition-colors ${
                      isLight
                        ? 'bg-slate-50 hover:bg-purple-50 border-slate-200'
                        : 'bg-[#0f0c1e] hover:bg-[#1f1935] border-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="text-xs">{t.flag || '📍'}</span>
                      <span className={`text-[11px] font-bold truncate ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                        {t.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {myPlayer?.houses[t.id] ? (
                        <span className={`text-[9px] font-bold ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                          {myPlayer.houses[t.id] === 5 ? '🏨' : `🏠x${myPlayer.houses[t.id]}`}
                        </span>
                      ) : null}
                      <span className={`text-[10px] font-mono-code ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>${t.price}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className={`h-full flex items-center justify-center text-center text-[10px] p-2 ${
                  isLight ? 'text-slate-400' : 'text-slate-500'
                }`}>
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
          <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black font-mono-code border-2 border-white animate-pulse shadow-md">
            {unreadChatCount}
          </span>
        )}
      </button>

      {/* Floating Chat Popover Window */}
      {isChatOpen && (
        <div
          id="floating-chat-window"
          className={`fixed bottom-18 right-4 sm:bottom-20 sm:right-6 w-80 sm:w-88 h-[430px] max-h-[72vh] rounded-2xl shadow-[0_12px_45px_rgba(0,0,0,0.45)] z-50 flex flex-col justify-between overflow-hidden animate-fade-in border ${
            isLight
              ? 'bg-white/98 backdrop-blur-xl border-slate-200 text-slate-800'
              : 'bg-[#141026]/98 backdrop-blur-xl border-[#3b3260] text-white'
          }`}
        >
          {/* Chat Header */}
          <div className={`px-3.5 py-2.5 border-b flex items-center justify-between flex-shrink-0 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#1b1535] border-[#2e2554]'
          }`}>
            <div className="flex items-center gap-2">
              <span className="text-sm">💬</span>
              <span className={`font-heading font-bold text-xs ${isLight ? 'text-slate-800' : 'text-white'}`}>Live Room Chat</span>
              <span className={`px-1.5 py-0.2 rounded-full border text-[9px] font-mono-code font-bold ${
                isLight
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                  : 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400'
              }`}>
                Online
              </span>
            </div>
            <button
              onClick={() => setIsChatOpen(false)}
              className={`w-6 h-6 rounded-lg text-xs flex items-center justify-center cursor-pointer transition-colors ${
                isLight
                  ? 'bg-slate-200 hover:bg-slate-300 text-slate-600'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white'
              }`}
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
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${
                      isLight
                        ? 'bg-slate-100 text-slate-600 border-slate-200'
                        : 'bg-slate-900/80 text-slate-400 border-slate-800'
                    }`}>
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
                      <span className={`text-[10px] font-bold ${
                        isMe ? (isLight ? 'text-purple-700' : 'text-[#b4a4ff]') : (isLight ? 'text-slate-600' : 'text-slate-300')
                      }`}>
                        {msg.sender}
                      </span>
                      <span className={`text-[8px] font-mono-code ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{msg.time}</span>
                    </div>
                    <div
                      className={`px-3 py-1.5 rounded-2xl text-[11px] break-words shadow-xs ${
                        isMe
                          ? 'bg-[#7059e2] text-white rounded-tr-none'
                          : isLight
                          ? 'bg-slate-100 text-slate-800 border border-slate-200 rounded-tl-none'
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
          <div className={`px-3 py-1.5 border-t flex items-center justify-between gap-1 overflow-x-auto flex-shrink-0 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#100d21] border-[#251d45]'
          }`}>
            {['🔥', '🎲', '💸', '🚀', '😭', '👑', 'GG!'].map(emoji => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  sounds.playClick();
                  sendChatMessage(user.username, user.avatar || 'orange', emoji);
                }}
                className={`px-2 py-0.5 rounded-lg text-[11px] cursor-pointer transition-all active:scale-90 ${
                  isLight
                    ? 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                    : 'bg-[#191433] hover:bg-[#2b2254] text-slate-200'
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Chat Input Form */}
          <form onSubmit={handleSendChat} className={`p-2.5 border-t flex items-center gap-2 flex-shrink-0 ${
            isLight ? 'bg-white border-slate-200' : 'bg-[#141026] border-[#2e2554]'
          }`}>
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder="Say something..."
              className={`flex-1 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-[#7059e2] border ${
                isLight
                  ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                  : 'bg-[#0e0a1e] border-slate-800 text-white placeholder-slate-500'
              }`}
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
      {/* Forfeit / Bankrupt / Leave Room Confirmation Modal */}
      {showForfeitConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fade-in">
          <div className={`w-full max-w-sm rounded-2xl shadow-[0_12px_45px_rgba(0,0,0,0.85)] p-5 overflow-hidden flex flex-col gap-4 border ${
            isLight ? 'bg-white border-rose-200' : 'bg-[#1a122e] border-rose-500/50'
          }`}>
            <div className={`flex items-center gap-3 border-b pb-3 ${
              isLight ? 'text-rose-600 border-slate-100' : 'text-rose-400 border-slate-800'
            }`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 border ${
                isLight ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-rose-950/80 border-rose-600/60'
              }`}>
                {room.status === 'waiting' ? '↩️' : '⚠️'}
              </div>
              <div>
                <h3 className={`font-heading font-black text-base ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  {room.status === 'waiting' ? 'Leave Waiting Room' : 'Confirm Forfeit'}
                </h3>
                <p className={`text-xs font-medium ${isLight ? 'text-rose-600' : 'text-rose-300'}`}>
                  {room.status === 'waiting' ? 'Refund entry fee & exit lobby' : 'Declare bankruptcy & surrender match'}
                </p>
              </div>
            </div>

            <div className={`text-xs p-3 rounded-xl border leading-relaxed ${
              isLight ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-slate-950/70 border-slate-800/80 text-slate-300'
            }`}>
              {room.status === 'waiting'
                ? `Are you sure you want to leave? Because the match has not started yet, your full buy-in of $${room.betAmount} will be immediately refunded back to your wallet.`
                : 'Are you sure you want to forfeit? You will surrender all your cash and owned properties, declare bankruptcy, and be eliminated from the current match.'}
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                onClick={() => {
                  sounds.playClick();
                  setShowForfeitConfirmModal(false);
                }}
                className={`py-2.5 rounded-xl font-bold text-xs cursor-pointer transition-all active:scale-95 border ${
                  isLight
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                }`}
              >
                {room.status === 'waiting' ? 'Stay in Lobby' : 'Keep Playing'}
              </button>
              <button
                onClick={() => {
                  handleForfeit();
                }}
                className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 font-bold text-xs text-white cursor-pointer transition-all active:scale-95 shadow-md shadow-rose-950/50"
              >
                {room.status === 'waiting' ? `Leave & Refund ($${room.betAmount})` : 'Yes, Forfeit Match'}
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
          myPlayerId={myPlayer?.id || user.id}
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
                  activePlayerIds: prev.auction.activePlayerIds.filter(id => id !== (myPlayer?.id || user.id))
                }
              };
            });
          }}
          myPlayerId={myPlayer?.id || user.id}
        />
      )}

      {/* Trade Modal */}
      {showTradeModal && (
        <TradeModal
          room={room}
          tiles={tiles}
          myPlayerId={myPlayer?.id || user.id}
          onSendTradeOffer={(offer) => {
            const resolvedOffer: TradeOffer = {
              id: 'trade_' + Date.now(),
              fromPlayerId: offer.fromPlayerId || myPlayer?.id || user.id,
              toPlayerId: offer.toPlayerId,
              offeredCash: offer.offeredCash,
              offeredProperties: offer.offeredProperties,
              requestedCash: offer.requestedCash,
              requestedProperties: offer.requestedProperties,
              status: 'pending'
            };
            setRoom(prev => {
              const updated: GameRoom = { ...prev, activeTrade: resolvedOffer };
              broadcastAndSync(updated, 'TRADE_OFFERED');
              return updated;
            });
            setShowTradeModal(false);
            const targetPlayer = room.players.find(p => p.id === offer.toPlayerId);
            const senderPlayer = room.players.find(p => p.id === (offer.fromPlayerId || myPlayer?.id || user.id));
            addLog(`🤝 Trade proposal sent by ${senderPlayer?.name || 'Player'} to ${targetPlayer?.name || 'player'}.`, 'info');
            sounds.playCashRegister();
          }}
          onAcceptTrade={() => {
            setRoom(prev => {
              if (!prev.activeTrade) return prev;
              const { fromPlayerId, toPlayerId, offeredCash, offeredProperties, requestedCash, requestedProperties } = prev.activeTrade;
              const updatedPlayers = prev.players.map(p => {
                if (p.id === fromPlayerId) {
                  const newCash = p.cash - offeredCash + requestedCash;
                  const newProps = [...p.properties.filter(id => !offeredProperties.includes(id)), ...requestedProperties];
                  const newP = { ...p, cash: newCash, properties: newProps };
                  newP.netWorth = calculateNetWorth(newP);
                  return newP;
                }
                if (p.id === toPlayerId) {
                  const newCash = p.cash - requestedCash + offeredCash;
                  const newProps = [...p.properties.filter(id => !requestedProperties.includes(id)), ...offeredProperties];
                  const newP = { ...p, cash: newCash, properties: newProps };
                  newP.netWorth = calculateNetWorth(newP);
                  return newP;
                }
                return p;
              });

              const p1 = prev.players.find(p => p.id === fromPlayerId);
              const p2 = prev.players.find(p => p.id === toPlayerId);
              addLog(`🤝 Trade completed between ${p1?.name || 'Player 1'} and ${p2?.name || 'Player 2'}!`, 'info');
              sounds.playCashRegister();

              const updated: GameRoom = {
                ...prev,
                players: updatedPlayers,
                activeTrade: null
              };
              broadcastAndSync(updated, 'TRADE_ACCEPTED');
              return updated;
            });
            setShowTradeModal(false);
          }}
          onDeclineTrade={() => {
            setRoom(prev => {
              const updated: GameRoom = { ...prev, activeTrade: null };
              broadcastAndSync(updated, 'TRADE_DECLINED');
              return updated;
            });
            setShowTradeModal(false);
            addLog(`Trade proposal was declined.`, 'info');
            sounds.playPayRent();
          }}
          onClose={() => setShowTradeModal(false)}
        />
      )}

      {/* Game Over Modal */}
      {room.status === 'finished' && (
        <GameOverModal
          room={room}
          myPlayerId={myPlayer?.id || user.id}
          onPlayAgain={onLeaveRoom}
          onReturnHome={onLeaveRoom}
          statsSummary={matchSummaryStats}
        />
      )}
    </div>
  );
};
