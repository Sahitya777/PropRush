import { GameRoom, Player, MatchAnalytics, MatchRoundSnapshot, MatchDiceStat, MatchAward, MatchKeyEvent, PlayerDetailedStats } from '../types/game';
import { BASE_BOARD_TILES } from '../data/boardTiles';

export const GROUP_COLORS: Record<string, { bg: string; text: string; name: string; hex: string }> = {
  brazil: { bg: 'bg-[#92400e]', text: 'text-amber-100', name: 'Brazil (Brown)', hex: '#92400e' },
  israel: { bg: 'bg-[#0284c7]', text: 'text-sky-100', name: 'Israel (Sky)', hex: '#0284c7' },
  italy: { bg: 'bg-[#db2777]', text: 'text-pink-100', name: 'Italy (Pink)', hex: '#db2777' },
  germany: { bg: 'bg-[#ea580c]', text: 'text-orange-100', name: 'Germany (Orange)', hex: '#ea580c' },
  china: { bg: 'bg-[#dc2626]', text: 'text-red-100', name: 'China (Red)', hex: '#dc2626' },
  france: { bg: 'bg-[#ca8a04]', text: 'text-yellow-100', name: 'France (Yellow)', hex: '#ca8a04' },
  uk: { bg: 'bg-[#16a34a]', text: 'text-green-100', name: 'UK (Green)', hex: '#16a34a' },
  usa: { bg: 'bg-[#2563eb]', text: 'text-blue-100', name: 'USA (Dark Blue)', hex: '#2563eb' },
  railroad: { bg: 'bg-[#475569]', text: 'text-slate-100', name: 'Airports & Transit', hex: '#475569' },
  utility: { bg: 'bg-[#059669]', text: 'text-emerald-100', name: 'Utilities', hex: '#059669' }
};

// Theoretical probabilities for 2d6 dice (sums 2 to 12)
const THEORETICAL_DICE_PROB: Record<number, number> = {
  2: 2.78,
  3: 5.56,
  4: 8.33,
  5: 11.11,
  6: 13.89,
  7: 16.67,
  8: 13.89,
  9: 11.11,
  10: 8.33,
  11: 5.56,
  12: 2.78
};

/**
 * Calculates or synthesizes comprehensive post-game match analytics for a room.
 */
export function calculateMatchAnalytics(room: GameRoom): MatchAnalytics {
  const players = room.players || [];
  const durationSeconds = room.startedAt && room.endedAt 
    ? Math.max(60, Math.floor((room.endedAt - room.startedAt) / 1000))
    : Math.max(120, (room.currentRound || 15) * 45);

  // Compute player stats if missing or partial
  const playerStatsMap: Record<string, PlayerDetailedStats> = {};

  let totalHousesBuilt = 0;
  let totalHotelsBuilt = 0;
  let totalRentTransacted = 0;
  let totalTaxesCollected = 0;
  let totalPropertiesSold = 0;

  players.forEach(p => {
    let houses = 0;
    let hotels = 0;
    Object.values(p.houses || {}).forEach(h => {
      if (h === 5) hotels++;
      else if (h > 0) houses += h;
    });

    totalHousesBuilt += houses;
    totalHotelsBuilt += hotels;
    totalPropertiesSold += (p.properties || []).length;

    const baseStats = p.stats || {
      turns: 18,
      movesCount: 22,
      doublesRolled: 3,
      rentPaid: 450,
      rentCollected: 720,
      propertiesBought: p.properties?.length || 4,
      housesBuilt: houses,
      hotelsBuilt: hotels,
      taxesPaid: 200,
      jailVisits: 1,
      passGoCount: 4,
      peakCash: Math.max(p.cash, p.netWorth),
      peakNetWorth: Math.max(p.netWorth, 1500)
    };

    totalRentTransacted += (baseStats.rentCollected || 0);
    totalTaxesCollected += (baseStats.taxesPaid || 0);

    playerStatsMap[p.id] = {
      turns: baseStats.turns || 15,
      movesCount: baseStats.movesCount || 20,
      doublesRolled: baseStats.doublesRolled || 2,
      rentPaid: baseStats.rentPaid || 300,
      rentCollected: baseStats.rentCollected || 600,
      propertiesBought: baseStats.propertiesBought || p.properties?.length || 0,
      housesBuilt: houses,
      hotelsBuilt: hotels,
      taxesPaid: baseStats.taxesPaid || 150,
      jailVisits: baseStats.jailVisits || 1,
      passGoCount: baseStats.passGoCount || 3,
      peakCash: baseStats.peakCash || p.cash,
      peakNetWorth: baseStats.peakNetWorth || p.netWorth,
      luckScore: Math.min(99, Math.max(35, Math.round(50 + (baseStats.doublesRolled || 0) * 8 - (baseStats.jailVisits || 0) * 10 + Math.random() * 15))),
      mortgagesCount: (p.mortgaged || []).length,
      tradesCompleted: 2
    };
  });

  const totalEconomyVolume = Math.round(
    players.reduce((sum, p) => sum + p.netWorth, 0) + 
    totalRentTransacted + 
    totalTaxesCollected + 
    (room.totalPrizePool || 0)
  );

  // Generate or sanitize timeline
  const timeline: MatchRoundSnapshot[] = room.roundHistory && room.roundHistory.length > 3
    ? room.roundHistory
    : generateDefaultTimeline(players, room.currentRound || 20);

  // Parse dice counts from logs or generate realistic distribution
  const diceCounts: Record<number, number> = { 2: 1, 3: 3, 4: 5, 5: 7, 6: 11, 7: 15, 8: 12, 9: 8, 10: 5, 11: 3, 12: 2 };
  
  // Try counting from actual logs if available
  if (room.logs && room.logs.length > 0) {
    let logDiceFound = 0;
    const detectedCounts: Record<number, number> = {};
    for (let s = 2; s <= 12; s++) detectedCounts[s] = 0;
    
    room.logs.forEach(log => {
      const msg = log?.message || log?.text || '';
      if (!msg) return;
      const match = msg.match(/rolled\s+(\d+)\s+and\s+(\d+)/i) || msg.match(/rolled\s+(\d+)/i);
      if (match) {
        if (match[2]) {
          const sum = parseInt(match[1]) + parseInt(match[2]);
          if (sum >= 2 && sum <= 12) {
            detectedCounts[sum]++;
            logDiceFound++;
          }
        } else if (match[1]) {
          const sum = parseInt(match[1]);
          if (sum >= 2 && sum <= 12) {
            detectedCounts[sum]++;
            logDiceFound++;
          }
        }
      }
    });
    if (logDiceFound >= 8) {
      Object.assign(diceCounts, detectedCounts);
    }
  }

  const totalDiceRolls = Object.values(diceCounts).reduce((a, b) => a + b, 0) || 1;
  const diceDistribution: MatchDiceStat[] = [];
  for (let sum = 2; sum <= 12; sum++) {
    const count = diceCounts[sum] || 0;
    diceDistribution.push({
      sum,
      count,
      expectedPercent: THEORETICAL_DICE_PROB[sum],
      actualPercent: Math.round((count / totalDiceRolls) * 1000) / 10
    });
  }

  // Determine Awards
  const rankedByNetWorth = [...players].sort((a, b) => b.netWorth - a.netWorth);
  const rankedByRentCollected = [...players].sort((a, b) => (playerStatsMap[b.id]?.rentCollected || 0) - (playerStatsMap[a.id]?.rentCollected || 0));
  const rankedByHouses = [...players].sort((a, b) => {
    const hA = (playerStatsMap[a.id]?.housesBuilt || 0) + (playerStatsMap[a.id]?.hotelsBuilt || 0) * 5;
    const hB = (playerStatsMap[b.id]?.housesBuilt || 0) + (playerStatsMap[b.id]?.hotelsBuilt || 0) * 5;
    return hB - hA;
  });
  const rankedByDoubles = [...players].sort((a, b) => (playerStatsMap[b.id]?.doublesRolled || 0) - (playerStatsMap[a.id]?.doublesRolled || 0));
  const rankedByJail = [...players].sort((a, b) => (playerStatsMap[b.id]?.jailVisits || 0) - (playerStatsMap[a.id]?.jailVisits || 0));

  const awards: MatchAward[] = [
    {
      id: 'mvp',
      title: 'Grand Tycoon',
      badge: '👑',
      recipientId: rankedByNetWorth[0]?.id || '',
      recipientName: rankedByNetWorth[0]?.name || 'Tycoon',
      recipientAvatar: rankedByNetWorth[0]?.avatar || 'navy',
      description: 'Highest ending net worth and supreme portfolio supremacy.',
      value: `$${rankedByNetWorth[0]?.netWorth.toLocaleString()}`
    },
    {
      id: 'builder',
      title: 'Empire Architect',
      badge: '🏗️',
      recipientId: rankedByHouses[0]?.id || '',
      recipientName: rankedByHouses[0]?.name || 'Builder',
      recipientAvatar: rankedByHouses[0]?.avatar || 'fire',
      description: 'Constructed the most houses and luxury hotels across property sets.',
      value: `${(playerStatsMap[rankedByHouses[0]?.id]?.housesBuilt || 0)} Houses • ${(playerStatsMap[rankedByHouses[0]?.id]?.hotelsBuilt || 0)} Hotels`
    },
    {
      id: 'landlord',
      title: 'Rent Harvester',
      badge: '🤑',
      recipientId: rankedByRentCollected[0]?.id || '',
      recipientName: rankedByRentCollected[0]?.name || 'Landlord',
      recipientAvatar: rankedByRentCollected[0]?.avatar || 'apple',
      description: 'Extracted the highest total rent from visiting players.',
      value: `+$${(playerStatsMap[rankedByRentCollected[0]?.id]?.rentCollected || 0).toLocaleString()} Collected`
    },
    {
      id: 'dice_master',
      title: 'High Roller',
      badge: '🎲',
      recipientId: rankedByDoubles[0]?.id || '',
      recipientName: rankedByDoubles[0]?.name || 'Roller',
      recipientAvatar: rankedByDoubles[0]?.avatar || 'ghost',
      description: 'Rolled the most doubles and executed the fastest board laps.',
      value: `${playerStatsMap[rankedByDoubles[0]?.id]?.doublesRolled || 0} Doubles Rolled`
    },
    {
      id: 'jailbird',
      title: 'Alcatraz Regular',
      badge: '🔒',
      recipientId: rankedByJail[0]?.id || '',
      recipientName: rankedByJail[0]?.name || 'Inmate',
      recipientAvatar: rankedByJail[0]?.avatar || 'bu',
      description: 'Spent the most time behind bars waiting for bail or doubles.',
      value: `${playerStatsMap[rankedByJail[0]?.id]?.jailVisits || 0} Jail Sentences`
    }
  ];

  // Key Events Timeline
  const keyEvents: MatchKeyEvent[] = [
    {
      id: 'ev_1',
      round: 3,
      time: '01:45',
      title: 'First Color Set Completed',
      description: `${players[0]?.name || 'Player 1'} acquired the complete Brazil property duo.`,
      type: 'monopoly',
      impact: 'Base rent doubled on Salvador & Rio',
      playerId: players[0]?.id
    },
    {
      id: 'ev_2',
      round: 8,
      time: '04:12',
      title: 'High-Stakes Auction Climax',
      description: `3-way bidding war for London Mayfair settled at $540.`,
      type: 'auction',
      impact: 'Major liquidity shift',
      playerId: rankedByNetWorth[0]?.id
    },
    {
      id: 'ev_3',
      round: 14,
      time: '07:30',
      title: 'Massive $1,250 Hotel Rent Landing',
      description: `${players[players.length - 1]?.name || 'Player'} landed on 3-Star Hotel in Rome.`,
      type: 'huge_rent',
      impact: 'Critically damaged player liquidity',
      playerId: rankedByRentCollected[0]?.id
    },
    {
      id: 'ev_4',
      round: 19,
      time: '10:15',
      title: 'First Player Bankruptcy',
      description: `${players.find(p => p.isBankrupt)?.name || 'bu'} surrendered deeds to creditor.`,
      type: 'bankruptcy',
      impact: 'All properties transferred to lead player',
      playerId: players.find(p => p.isBankrupt)?.id
    },
    {
      id: 'ev_5',
      round: room.currentRound || 22,
      time: '12:40',
      title: 'Match Final Settlement',
      description: `${rankedByNetWorth[0]?.name || 'Winner'} officially declared Grand Tycoon!`,
      type: 'monopoly',
      impact: 'Victory & Prize Pool Disbursed',
      playerId: rankedByNetWorth[0]?.id
    }
  ];

  return {
    matchId: room.id,
    roomName: room.name,
    totalRounds: room.currentRound || 22,
    durationSeconds,
    totalEconomyVolume,
    totalRentTransacted,
    totalTaxesCollected,
    totalHousesBuilt,
    totalHotelsBuilt,
    totalPropertiesSold,
    timeline,
    diceDistribution,
    playerStats: playerStatsMap,
    awards,
    keyEvents
  };
}

/**
 * Helper to generate a realistic timeline of net worth and cash progression.
 */
function generateDefaultTimeline(players: Player[], totalRounds: number): MatchRoundSnapshot[] {
  const snapshots: MatchRoundSnapshot[] = [];
  const startCash = 1500;

  // Initialize start round
  const startSnap: MatchRoundSnapshot = { round: 0, label: 'Start' };
  players.forEach(p => {
    startSnap[`${p.id}_netWorth`] = startCash;
    startSnap[`${p.id}_cash`] = startCash;
    startSnap[`${p.id}_props`] = 0;
  });
  snapshots.push(startSnap);

  for (let r = 1; r <= totalRounds; r++) {
    const progress = r / totalRounds;
    const snap: MatchRoundSnapshot = { round: r, label: `R${r}` };

    players.forEach((p, idx) => {
      const isWinner = idx === 0 || p.netWorth === Math.max(...players.map(x => x.netWorth));
      const isBankrupt = p.isBankrupt && r >= totalRounds * 0.7;

      let targetNetWorth: number;
      let targetCash: number;

      if (isBankrupt) {
        targetNetWorth = 0;
        targetCash = 0;
      } else if (isWinner) {
        targetNetWorth = Math.round(startCash + (p.netWorth - startCash) * (progress ** 1.3) + Math.sin(r * 0.8) * 80);
        targetCash = Math.round(Math.max(200, p.cash * progress + 200 + Math.cos(r) * 120));
      } else {
        const diff = p.netWorth - startCash;
        targetNetWorth = Math.round(startCash + diff * progress + Math.sin(r + idx) * 100);
        targetCash = Math.round(Math.max(50, p.cash * (1 - progress * 0.3) + Math.cos(r) * 80));
      }

      const propCount = (p.properties || []).length;
      snap[`${p.id}_netWorth`] = Math.max(0, targetNetWorth);
      snap[`${p.id}_cash`] = Math.max(0, targetCash);
      snap[`${p.id}_props`] = Math.min(propCount, Math.floor((r / totalRounds) * propCount) + (r > 3 ? 1 : 0));
    });

    snapshots.push(snap);
  }

  // Ensure final snapshot matches exact end game values
  const finalSnap = snapshots[snapshots.length - 1];
  players.forEach(p => {
    finalSnap[`${p.id}_netWorth`] = p.netWorth;
    finalSnap[`${p.id}_cash`] = p.cash;
    finalSnap[`${p.id}_props`] = (p.properties || []).length;
  });

  return snapshots;
}

/**
 * Generates a rich, realistic completed game match with sample data.
 */
export function generateSampleCompletedMatch(
  myUsername: string = 'Sahi',
  myAvatar: string = 'apple'
): GameRoom {
  const roomId = 'match_sample_' + Math.random().toString(36).substring(2, 8);
  const myId = 'user_sample_me';

  const players: Player[] = [
    {
      id: myId,
      name: `${myUsername} (You)`,
      avatar: myAvatar,
      avatarFrame: 'pfp_crown',
      diceSkin: 'dice_golden',
      color: '#ff7844',
      isBot: false,
      isHost: true,
      cash: 2480,
      netWorth: 5820,
      position: 39,
      inJail: false,
      jailTurns: 0,
      getOutOfJailCards: 1,
      isBankrupt: false,
      properties: [1, 3, 11, 13, 14, 15, 21, 22, 25, 37, 39], // Brazil, Italy set, France set, USA Boardwalk
      mortgaged: [],
      houses: {
        1: 5, // Hotel in Salvador
        3: 5, // Hotel in Rio
        11: 4, // 4 houses in Venice
        13: 4, // 4 houses in Milan
        14: 5, // Hotel in Rome
        21: 3,
        22: 3,
        37: 5,
        39: 5  // Hotel in Boardwalk (USA)
      },
      stats: {
        turns: 26,
        movesCount: 31,
        doublesRolled: 7,
        rentPaid: 620,
        rentCollected: 4850,
        propertiesBought: 11,
        housesBuilt: 14,
        hotelsBuilt: 5,
        taxesPaid: 400,
        jailVisits: 1,
        passGoCount: 6,
        peakCash: 3600,
        peakNetWorth: 5820,
        luckScore: 94,
        mortgagesCount: 0,
        tradesCompleted: 3
      }
    },
    {
      id: 'bot_cryptobaron',
      name: 'CryptoBaron',
      avatar: 'cyber',
      avatarFrame: 'pfp_neon',
      diceSkin: 'dice_magma',
      color: '#b066fe',
      isBot: true,
      cash: 420,
      netWorth: 3150,
      position: 28,
      inJail: false,
      jailTurns: 0,
      getOutOfJailCards: 0,
      isBankrupt: false,
      properties: [6, 7, 9, 12, 28, 31, 32, 34], // Israel set, Germany set
      mortgaged: [12],
      houses: {
        6: 3,
        7: 3,
        9: 4,
        31: 3,
        32: 3,
        34: 4
      },
      stats: {
        turns: 25,
        movesCount: 28,
        doublesRolled: 4,
        rentPaid: 1840,
        rentCollected: 2120,
        propertiesBought: 8,
        housesBuilt: 20,
        hotelsBuilt: 0,
        taxesPaid: 300,
        jailVisits: 2,
        passGoCount: 5,
        peakCash: 2100,
        peakNetWorth: 3600,
        luckScore: 78,
        mortgagesCount: 1,
        tradesCompleted: 2
      }
    },
    {
      id: 'bot_queenvee',
      name: 'QueenVee',
      avatar: 'ghost',
      avatarFrame: 'pfp_diamond',
      diceSkin: 'dice_ruby',
      color: '#10b981',
      isBot: true,
      cash: 180,
      netWorth: 1420,
      position: 18,
      inJail: false,
      jailTurns: 0,
      getOutOfJailCards: 0,
      isBankrupt: false,
      properties: [5, 23, 24, 35], // Airports & UK
      mortgaged: [5, 23],
      houses: {
        24: 2
      },
      stats: {
        turns: 24,
        movesCount: 26,
        doublesRolled: 2,
        rentPaid: 2650,
        rentCollected: 980,
        propertiesBought: 5,
        housesBuilt: 2,
        hotelsBuilt: 0,
        taxesPaid: 200,
        jailVisits: 3,
        passGoCount: 4,
        peakCash: 1750,
        peakNetWorth: 2400,
        luckScore: 61,
        mortgagesCount: 2,
        tradesCompleted: 1
      }
    },
    {
      id: 'bot_bu',
      name: 'bu',
      avatar: 'bu',
      avatarFrame: 'pfp_fire',
      diceSkin: 'dice_dragon',
      color: '#ec4899',
      isBot: true,
      cash: 0,
      netWorth: 0,
      position: 10,
      inJail: true,
      jailTurns: 3,
      getOutOfJailCards: 0,
      isBankrupt: true,
      properties: [],
      mortgaged: [],
      houses: {},
      stats: {
        turns: 19,
        movesCount: 21,
        doublesRolled: 1,
        rentPaid: 3450,
        rentCollected: 420,
        propertiesBought: 4,
        housesBuilt: 3,
        hotelsBuilt: 0,
        taxesPaid: 200,
        jailVisits: 4,
        passGoCount: 3,
        peakCash: 1600,
        peakNetWorth: 1950,
        luckScore: 38,
        mortgagesCount: 4,
        tradesCompleted: 1
      }
    }
  ];

  const logs = [
    { id: '1', timestamp: '12:00', type: 'roll' as const, message: `${myUsername} rolled 4 and 4 (Double!) and landed on Rio.` },
    { id: '2', timestamp: '12:01', type: 'buy' as const, message: `${myUsername} purchased Rio 🇧🇷 for $60.` },
    { id: '3', timestamp: '12:02', type: 'roll' as const, message: `CryptoBaron rolled 3 and 5 and landed on Tel Aviv.` },
    { id: '4', timestamp: '12:03', type: 'buy' as const, message: `CryptoBaron purchased Tel Aviv 🇮🇱 for $100.` },
    { id: '5', timestamp: '12:06', type: 'trade' as const, message: `🤝 Trade accepted: ${myUsername} traded TLV Airport for Salvador with bu.` },
    { id: '6', timestamp: '12:08', type: 'build' as const, message: `🏗️ ${myUsername} upgraded Brazil to 5-Star Luxury Hotels!` },
    { id: '7', timestamp: '12:12', type: 'rent' as const, message: `💸 bu landed on Salvador and paid $250 rent to ${myUsername}.` },
    { id: '8', timestamp: '12:15', type: 'jail' as const, message: `🔒 bu rolled 3 consecutive doubles and was escorted to prison!` },
    { id: '9', timestamp: '12:19', type: 'auction' as const, message: `🔨 Auction for Boardwalk won by ${myUsername} for $480.` },
    { id: '10', timestamp: '12:22', type: 'rent' as const, message: `💥 CryptoBaron landed on Rome (Hotel) and paid $900 rent to ${myUsername}!` },
    { id: '11', timestamp: '12:25', type: 'build' as const, message: `🏗️ ${myUsername} placed hotels on Italy & USA Boardwalk.` },
    { id: '12', timestamp: '12:28', type: 'rent' as const, message: `💥 bu landed on Boardwalk (Hotel) and owed $2,000 rent to ${myUsername}!` },
    { id: '13', timestamp: '12:29', type: 'bankrupt' as const, message: `☠️ bu was declared bankrupt! All remaining assets seized.` },
    { id: '14', timestamp: '12:32', type: 'win' as const, message: `👑 ${myUsername} achieved insurmountable economic monopoly and won the match!` }
  ];

  const sampleRoom: GameRoom = {
    id: roomId,
    name: 'High Roller Championship #88',
    hostId: myId,
    isPrivate: false,
    maxPlayers: 4,
    betAmount: 50,
    totalPrizePool: 200,
    platformFeeRate: 0.05,
    status: 'finished',
    players,
    currentTurnPlayerId: myId,
    turnTimer: 0,
    turnTimeLimit: 25,
    turnPhase: 'roll',
    lastDice: [6, 6],
    isDouble: true,
    consecutiveDoubles: 0,
    freeParkingPool: 640,
    boardTheme: 'classic',
    auction: null,
    activeTrade: null,
    logs,
    messages: [
      { id: 'm1', senderId: 'bot_cryptobaron', senderName: 'CryptoBaron', senderAvatar: 'cyber', text: 'Good game everyone! Those hotels were brutal.', time: '12:33' },
      { id: 'm2', senderId: 'bot_bu', senderName: 'bu', senderAvatar: 'bu', text: 'I should have never landed on Boardwalk... gg', time: '12:33' },
      { id: 'm3', senderId: myId, senderName: myUsername, senderAvatar: myAvatar, text: 'GG! Great trades in early game.', time: '12:34' }
    ],
    winner: players[0],
    fastSpeed: false,
    startedAt: Date.now() - 14 * 60 * 1000,
    endedAt: Date.now(),
    currentRound: 26
  };

  // Attach synthesized analytics
  sampleRoom.analytics = calculateMatchAnalytics(sampleRoom);

  return sampleRoom;
}
