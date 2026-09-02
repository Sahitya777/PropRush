import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell
} from 'recharts';
import {
  Trophy,
  TrendingUp,
  Building2,
  Dices,
  DollarSign,
  Award,
  History,
  Share2,
  ChevronRight,
  Sparkles,
  Home,
  RotateCcw,
  Check,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  Flame,
  Percent
} from 'lucide-react';
import { GameRoom, Player, MatchAnalytics } from '../types/game';
import { BASE_BOARD_TILES } from '../data/boardTiles';
import { calculateMatchAnalytics, GROUP_COLORS } from '../utils/matchAnalytics';
import { AvatarCharacter } from './AvatarCharacter';
import { ShareVictoryModal } from './ShareVictoryModal';
import { useTheme } from '../context/ThemeContext';
import { sounds } from '../utils/audio';

interface MatchStatsAnalyticsModalProps {
  room: GameRoom;
  myPlayerId: string;
  onPlayAgain?: () => void;
  onReturnHome?: () => void;
  onClose?: () => void;
  isStandalonePreview?: boolean;
}

type TabType = 'overview' | 'timeline' | 'properties' | 'dice' | 'economy' | 'awards' | 'logs';

export const MatchStatsAnalyticsModal: React.FC<MatchStatsAnalyticsModalProps> = ({
  room,
  myPlayerId,
  onPlayAgain,
  onReturnHome,
  onClose,
  isStandalonePreview = false
}) => {
  const { isLight } = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [timelineMetric, setTimelineMetric] = useState<'netWorth' | 'cash' | 'props'>('netWorth');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>(myPlayerId || room.players[0]?.id || '');
  const [showShareModal, setShowShareModal] = useState(false);

  // Synthesize or retrieve analytics
  const analytics: MatchAnalytics = room.analytics || calculateMatchAnalytics(room);
  const players = room.players || [];
  const winnerObj =
    typeof room.winner === 'object' && room.winner !== null
      ? (room.winner as Player)
      : typeof room.winner === 'string'
        ? players.find(p => p.name === room.winner)
        : (players.find(p => !p.isBankrupt) || players[0]);
  const winner = winnerObj || players[0];
  const myPlayer = players.find(p => p.id === myPlayerId);
  const isWinner = winner?.id === myPlayerId;

  // Ranked players by final net worth
  const rankedPlayers = [...players].sort((a, b) => {
    if (a.isBankrupt && !b.isBankrupt) return 1;
    if (!a.isBankrupt && b.isBankrupt) return -1;
    return b.netWorth - a.netWorth;
  });

  const myPlacement = rankedPlayers.findIndex(p => p.id === myPlayerId) + 1;

  // Format currency
  const fmt = (val: number | undefined) => `$${(val || 0).toLocaleString()}`;

  // Color palette for charts
  const playerColorMap: Record<string, string> = {
    [players[0]?.id || 'p0']: '#f97316', // orange
    [players[1]?.id || 'p1']: '#8b5cf6', // purple
    [players[2]?.id || 'p2']: '#10b981', // emerald
    [players[3]?.id || 'p3']: '#ec4899', // pink
    [players[4]?.id || 'p4']: '#06b6d4', // cyan
    [players[5]?.id || 'p5']: '#eab308'  // yellow
  };

  // Format timeline data for Recharts
  const chartTimelineData = analytics.timeline.map(snap => {
    const item: any = { round: snap.label || `R${snap.round}` };
    players.forEach(p => {
      if (timelineMetric === 'netWorth') {
        item[p.name] = snap[`${p.id}_netWorth`] ?? p.netWorth;
      } else if (timelineMetric === 'cash') {
        item[p.name] = snap[`${p.id}_cash`] ?? p.cash;
      } else {
        item[p.name] = snap[`${p.id}_props`] ?? p.properties.length;
      }
    });
    return item;
  });

  // Financial matrix comparison data for Recharts
  const financeComparisonData = players.map(p => {
    const stats = analytics.playerStats[p.id] || ({} as any);
    return {
      name: p.name,
      'Rent Collected': stats.rentCollected || 0,
      'Rent Paid': stats.rentPaid || 0,
      'Taxes Paid': stats.taxesPaid || 0,
      NetWorth: p.netWorth
    };
  });

  // Building comparison data for Recharts
  const buildingComparisonData = players.map(p => {
    const stats = analytics.playerStats[p.id] || ({} as any);
    return {
      name: p.name,
      'Houses Built': stats.housesBuilt || 0,
      'Hotels Built': stats.hotelsBuilt || 0,
      'Properties': p.properties.length
    };
  });

  return (
    <div className="w-full max-w-4xl rounded-2xl sm:rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[88vh] text-left transition-all animate-fade-in bg-white dark:bg-[#120d24] border-slate-200/80 dark:border-purple-500/20 text-slate-800 dark:text-slate-100">
      
      {/* Sleek, Clean Top Header */}
      <div className="px-6 py-5 sm:px-8 sm:py-6 bg-slate-50/90 dark:bg-[#181230]/95 border-b border-slate-200/80 dark:border-purple-900/40 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-2xl shrink-0 shadow-sm">
            👑
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-lg sm:text-2xl font-heading font-black tracking-tight text-slate-900 dark:text-white truncate">
                {room.name || 'PropRush Match'}
              </h2>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-300 bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-400/30">
                Concluded
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono-code flex items-center gap-2 flex-wrap">
              <span>{analytics.totalRounds} Rounds</span>
              <span>•</span>
              <span>{Math.floor(analytics.durationSeconds / 60)}m {analytics.durationSeconds % 60}s</span>
              <span>•</span>
              <span>Economy Volume: <strong className="text-slate-700 dark:text-slate-300">{fmt(analytics.totalEconomyVolume)}</strong></span>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => {
              sounds.playClick();
              setShowShareModal(true);
            }}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white border border-purple-400/30 text-xs font-bold font-heading flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-md shadow-purple-500/25"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share Report</span>
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-200/70 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/20 text-slate-600 dark:text-white flex items-center justify-center cursor-pointer transition-colors text-sm font-bold shadow-sm"
              title="Close"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Spacious Navigation Tabs Bar with Dedicated Padding & Gap */}
      <div className="px-6 py-4 sm:px-8 border-b bg-slate-100/60 dark:bg-[#150f2b]/80 border-slate-200/80 dark:border-purple-900/30">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          {[
            { id: 'overview', label: '🏆 Standings', icon: Trophy },
            { id: 'timeline', label: '📈 Timeline', icon: TrendingUp },
            { id: 'properties', label: '🏢 Portfolios', icon: Building2 },
            { id: 'dice', label: '🎲 Dice Stats', icon: Dices },
            { id: 'economy', label: '💰 Economy', icon: DollarSign },
            { id: 'awards', label: '🎖️ Awards', icon: Award },
            { id: 'logs', label: '📜 Action Log', icon: History }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  sounds.playClick();
                  setActiveTab(tab.id as TabType);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold font-heading whitespace-nowrap flex items-center gap-2 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#7059e2] text-white shadow-md shadow-purple-500/25 scale-[1.02]'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-purple-900/40'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Tab Body with Generous Breathing Room */}
      <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">

        {/* TAB 1: OVERVIEW & PODIUM */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-fade-in">
            
            {/* Champion Box */}
            <div className="p-5 sm:p-6 rounded-2xl border bg-gradient-to-r from-amber-500/[0.07] via-amber-400/[0.04] to-transparent border-amber-400/30 flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  <AvatarCharacter avatarId={winner?.avatar || 'navy'} size="md" />
                  <span className="absolute -bottom-1 -right-1 text-xl">👑</span>
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <span>Champion</span>
                    {winner?.id === myPlayerId && (
                      <span className="bg-amber-400 text-slate-900 px-1.5 py-0.2 rounded text-[9px] font-black">
                        YOU
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl sm:text-2xl font-heading font-black tracking-tight text-slate-900 dark:text-white mt-0.5">
                    {winner?.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono-code">
                    Final Net Worth: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{fmt(winner?.netWorth)}</strong> • {winner?.properties.length} Properties
                  </p>
                </div>
              </div>

              {/* Prize Payout Box */}
              {room.betAmount > 0 ? (
                <div className="text-right px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase">
                    Payout (95%)
                  </div>
                  <div className="text-xl font-black font-mono-code text-emerald-600 dark:text-emerald-300">
                    +{fmt(Math.round(room.totalPrizePool * (1 - room.platformFeeRate) * 100) / 100)}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Pool: {fmt(room.totalPrizePool)}
                  </div>
                </div>
              ) : (
                <div className="text-right px-4 py-2.5 rounded-xl bg-purple-500/10 border border-purple-500/25">
                  <div className="text-[10px] text-purple-600 dark:text-purple-400 font-bold uppercase">
                    Casual Match
                  </div>
                  <div className="text-base font-black font-mono-code text-purple-600 dark:text-purple-300">
                    +150 LP & +75 🪙
                  </div>
                </div>
              )}
            </div>

            {/* Standings List */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Standings & Performance
                </h4>
                <span className="text-xs text-slate-400 font-mono-code">{players.length} Players</span>
              </div>

              <div className="divide-y divide-slate-200/70 dark:divide-purple-900/30 rounded-2xl border border-slate-200/80 dark:border-purple-900/30 overflow-hidden bg-slate-50/50 dark:bg-purple-950/20">
                {rankedPlayers.map((player, idx) => {
                  const pStats = analytics.playerStats[player.id] || ({} as any);
                  const isMe = player.id === myPlayerId;
                  const isFirst = idx === 0;

                  return (
                    <div
                      key={player.id}
                      className={`p-3.5 sm:p-4 flex items-center justify-between flex-wrap gap-3 transition-colors ${
                        isMe
                          ? 'bg-[#7059e2]/10 dark:bg-[#7059e2]/15'
                          : 'hover:bg-slate-100/60 dark:hover:bg-purple-900/20'
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-[180px]">
                        <span className={`font-heading font-black text-sm w-5 text-center ${
                          idx === 0 ? 'text-amber-500 text-base' : idx === 1 ? 'text-slate-400' : idx === 2 ? 'text-amber-700' : 'text-slate-400'
                        }`}>
                          #{idx + 1}
                        </span>
                        <AvatarCharacter avatarId={player.avatar} size="sm" />
                        <div>
                          <div className="font-heading font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span>{player.name}</span>
                            {isMe && (
                              <span className="text-[9px] bg-[#7059e2] text-white px-1.5 py-0.2 rounded font-bold">
                                YOU
                              </span>
                            )}
                            {player.isBankrupt && (
                              <span className="text-[9px] bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20 px-1.5 py-0.2 rounded font-bold">
                                Bankrupt
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5 font-mono-code">
                            <span>{player.properties.length} Props</span>
                            <span>•</span>
                            <span>{pStats.housesBuilt || 0} Houses</span>
                          </div>
                        </div>
                      </div>

                      {/* Stat Metrics */}
                      <div className="flex items-center gap-5 sm:gap-8 font-mono-code text-xs">
                        <div className="text-right hidden sm:block">
                          <div className="text-[9px] uppercase font-bold text-slate-400">Cash</div>
                          <div className="font-bold text-slate-700 dark:text-slate-300">
                            {fmt(player.cash)}
                          </div>
                        </div>
                        <div className="text-right hidden sm:block">
                          <div className="text-[9px] uppercase font-bold text-slate-400">Rent Collected</div>
                          <div className="font-bold text-emerald-600 dark:text-emerald-400">
                            +{fmt(pStats.rentCollected || 0)}
                          </div>
                        </div>
                        <div className="text-right min-w-[85px]">
                          <div className="text-[9px] uppercase font-bold text-slate-400">Net Worth</div>
                          <div className="font-black text-sm text-slate-900 dark:text-white">
                            {fmt(player.netWorth)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Concise 3-Metric Summary Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="p-4 rounded-2xl border bg-slate-50/60 dark:bg-purple-950/20 border-slate-200/80 dark:border-purple-900/30">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Rent Transacted</div>
                <div className="text-lg font-black font-mono-code mt-1 text-emerald-600 dark:text-emerald-400">
                  {fmt(analytics.totalRentTransacted)}
                </div>
              </div>

              <div className="p-4 rounded-2xl border bg-slate-50/60 dark:bg-purple-950/20 border-slate-200/80 dark:border-purple-900/30">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Houses & Hotels Built</div>
                <div className="text-lg font-black font-mono-code mt-1 text-slate-900 dark:text-white">
                  {analytics.totalHousesBuilt} 🟢 / {analytics.totalHotelsBuilt} 🔴
                </div>
              </div>

              <div className="p-4 rounded-2xl border bg-slate-50/60 dark:bg-purple-950/20 border-slate-200/80 dark:border-purple-900/30">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Taxes & Pot Won</div>
                <div className="text-lg font-black font-mono-code mt-1 text-amber-600 dark:text-amber-400">
                  {fmt(analytics.totalTaxesCollected)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: NET WORTH & CASH TIMELINE */}
        {activeTab === 'timeline' && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h4 className="text-sm font-bold font-heading text-slate-900 dark:text-white">
                  Round-by-Round Trajectory
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Track dynamic wealth growth, property acquisitions, and turning points
                </p>
              </div>

              {/* Metric Toggle Buttons */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                {[
                  { id: 'netWorth', label: 'Net Worth ($)' },
                  { id: 'cash', label: 'Cash ($)' },
                  { id: 'props', label: 'Deeds (#)' }
                ].map(m => (
                  <button
                    key={m.id}
                    onClick={() => {
                      sounds.playClick();
                      setTimelineMetric(m.id as any);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold font-heading cursor-pointer transition-all ${
                      timelineMetric === m.id
                        ? 'bg-[#7059e2] text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Recharts Area Chart Container */}
            <div className="h-64 sm:h-72 w-full p-4 rounded-2xl border bg-slate-50/50 dark:bg-purple-950/20 border-slate-200/80 dark:border-purple-900/30">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartTimelineData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                  <defs>
                    {players.map((p, idx) => {
                      const color = playerColorMap[p.id] || '#7059e2';
                      return (
                        <linearGradient key={p.id} id={`grad_${p.id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={color} stopOpacity={0.0} />
                        </linearGradient>
                      );
                    })}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={isLight ? '#e2e8f0' : '#2d2250'} />
                  <XAxis dataKey="round" stroke={isLight ? '#64748b' : '#94a3b8'} fontSize={11} />
                  <YAxis
                    stroke={isLight ? '#64748b' : '#94a3b8'}
                    fontSize={11}
                    tickFormatter={val => timelineMetric === 'props' ? `${val}` : `$${val}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isLight ? '#ffffff' : '#181329',
                      borderColor: isLight ? '#cbd5e1' : '#4c3882',
                      borderRadius: '12px',
                      fontSize: '12px',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)'
                    }}
                    formatter={(value: any) => [timelineMetric === 'props' ? `${value} Deeds` : fmt(Number(value)), '']}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  {players.map((p, idx) => {
                    const color = playerColorMap[p.id] || '#7059e2';
                    return (
                      <Area
                        key={p.id}
                        type="monotone"
                        dataKey={p.name}
                        stroke={color}
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill={`url(#grad_${p.id})`}
                      />
                    );
                  })}
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Turning Point Milestones */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {analytics.keyEvents.slice(0, 4).map(ev => (
                <div
                  key={ev.id}
                  className="p-3.5 rounded-xl border bg-slate-50/60 dark:bg-purple-950/20 border-slate-200/80 dark:border-purple-900/30 flex items-start gap-3"
                >
                  <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-300 font-bold flex items-center justify-center text-xs shrink-0 font-mono-code">
                    R{ev.round}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">{ev.title}</div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{ev.description}</p>
                    <span className="inline-block mt-1 text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                      Impact: {ev.impact}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: PROPERTIES & PORTFOLIOS */}
        {activeTab === 'properties' && (
          <div className="space-y-6 animate-fade-in">
            {/* Player Selector Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <span className="text-xs font-bold text-slate-400 uppercase mr-1 shrink-0">View Player:</span>
              {players.map(p => (
                <button
                  key={p.id}
                  onClick={() => {
                    sounds.playClick();
                    setSelectedPlayerId(p.id);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold font-heading flex items-center gap-2 shrink-0 cursor-pointer transition-all ${
                    selectedPlayerId === p.id
                      ? 'bg-[#7059e2] text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <AvatarCharacter avatarId={p.avatar} size="xs" />
                  <span>{p.name}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/20 text-white font-mono-code">
                    {p.properties.length}
                  </span>
                </button>
              ))}
            </div>

            {/* Selected Player Portfolio Grid */}
            {(() => {
              const selectedPlayer = players.find(p => p.id === selectedPlayerId) || players[0];
              const ownedTiles = (selectedPlayer.properties || []).map(id => BASE_BOARD_TILES.find(t => t.id === id)).filter(Boolean) as any[];

              // Group owned properties by group
              const grouped: Record<string, any[]> = {};
              ownedTiles.forEach(tile => {
                const grp = tile.group || 'special';
                if (!grouped[grp]) grouped[grp] = [];
                grouped[grp].push(tile);
              });

              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <AvatarCharacter avatarId={selectedPlayer.avatar} size="sm" />
                      <div>
                        <div className="font-heading font-black text-sm text-slate-900 dark:text-white">
                          {selectedPlayer.name}'s Real Estate Empire
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {ownedTiles.length} Deeds Owned • {Object.values(selectedPlayer.houses || {}).filter((h: any) => Number(h) > 0 && Number(h) < 5).length} Houses • {Object.values(selectedPlayer.houses || {}).filter((h: any) => Number(h) === 5).length} Luxury Hotels
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Property Valuation</div>
                      <div className="text-base font-mono-code font-black text-emerald-600 dark:text-emerald-400">
                        {fmt(ownedTiles.reduce((acc, t) => acc + (t.price || 0), 0))}
                      </div>
                    </div>
                  </div>

                  {/* Portfolio Cards by Color Group */}
                  {Object.keys(grouped).length === 0 ? (
                    <div className="p-8 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-400">
                      No properties owned by this player.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {Object.entries(grouped).map(([groupKey, tiles]) => {
                        const grpMeta = GROUP_COLORS[groupKey] || { bg: 'bg-slate-600', text: 'text-white', name: groupKey, hex: '#475569' };
                        return (
                          <div
                            key={groupKey}
                            className="p-3.5 rounded-2xl border bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 flex flex-col justify-between"
                          >
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${grpMeta.bg} ${grpMeta.text}`}>
                                  {grpMeta.name}
                                </span>
                                <span className="text-xs font-mono-code text-slate-400 font-bold">
                                  {tiles.length} cards
                                </span>
                              </div>

                              <div className="space-y-1.5">
                                {tiles.map((tile: any) => {
                                  const houses = selectedPlayer.houses[tile.id] || 0;
                                  const isMortgaged = (selectedPlayer.mortgaged || []).includes(tile.id);
                                  return (
                                    <div
                                      key={tile.id}
                                      className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/50 flex items-center justify-between text-xs"
                                    >
                                      <div className="flex items-center gap-1.5">
                                        <span>{tile.flag || tile.icon || '🏠'}</span>
                                        <span className="font-bold text-slate-800 dark:text-slate-200">{tile.name}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {isMortgaged ? (
                                          <span className="text-[9px] px-1.5 py-0.2 bg-rose-500/20 text-rose-400 rounded font-bold">
                                            Mortgaged
                                          </span>
                                        ) : houses === 5 ? (
                                          <span className="text-[10px] font-bold text-rose-500 flex items-center gap-0.5">
                                            <span>🏨</span> Hotel
                                          </span>
                                        ) : houses > 0 ? (
                                          <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-0.5">
                                            <span>🟢</span> {houses} {houses === 1 ? 'House' : 'Houses'}
                                          </span>
                                        ) : (
                                          <span className="text-[10px] text-slate-400">Base</span>
                                        )}
                                        <span className="font-mono-code font-bold text-slate-600 dark:text-slate-300">
                                          ${tile.price}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Building & Construction Comparative Bar Chart */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Building & Hotel Comparison Across All Players
              </h4>
              <div className="h-60 w-full p-3 rounded-2xl border bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={buildingComparisonData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isLight ? '#e2e8f0' : '#332959'} />
                    <XAxis dataKey="name" stroke={isLight ? '#64748b' : '#94a3b8'} fontSize={11} />
                    <YAxis stroke={isLight ? '#64748b' : '#94a3b8'} fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: isLight ? '#ffffff' : '#181329',
                        borderColor: isLight ? '#cbd5e1' : '#4c3882',
                        borderRadius: '12px',
                        fontSize: '12px'
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="Houses Built" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Hotels Built" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Properties" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: DICE & MOVEMENT STATS */}
        {activeTab === 'dice' && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h4 className="text-sm font-bold font-heading text-slate-900 dark:text-white">
                Dice Distribution & Movement Analytics
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Analysis of 2d6 dice rolls compared against mathematical theoretical bell curve (sums 2 to 12)
              </p>
            </div>

            {/* Dice Distribution Histogram Chart */}
            <div className="h-64 sm:h-72 w-full p-3 rounded-2xl border bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.diceDistribution} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isLight ? '#e2e8f0' : '#332959'} />
                  <XAxis dataKey="sum" stroke={isLight ? '#64748b' : '#94a3b8'} fontSize={11} label={{ value: 'Dice Total (2-12)', position: 'insideBottom', offset: -2 }} />
                  <YAxis stroke={isLight ? '#64748b' : '#94a3b8'} fontSize={11} unit="%" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isLight ? '#ffffff' : '#181329',
                      borderColor: isLight ? '#cbd5e1' : '#4c3882',
                      borderRadius: '12px',
                      fontSize: '12px'
                    }}
                    formatter={(val: any, name: any) => [`${val}%`, name === 'actualPercent' ? 'Actual Match Rate' : 'Theoretical Probability']}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Bar dataKey="actualPercent" name="Actual Rate (%)" fill="#7059e2" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expectedPercent" name="Expected Bell Curve (%)" fill="#94a3b8" radius={[4, 4, 0, 0]} opacity={0.4} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Player-by-Player Dice & Movement Metrics Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Movement & Prison Statistics Table
              </h4>
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-heading uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="p-3">Player</th>
                      <th className="p-3 text-center">Total Moves</th>
                      <th className="p-3 text-center">Doubles Rolled</th>
                      <th className="p-3 text-center">Prison Visits</th>
                      <th className="p-3 text-center">Pass GO (+200)</th>
                      <th className="p-3 text-center">Luck Rating</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {players.map(p => {
                      const stats = analytics.playerStats[p.id] || ({} as any);
                      return (
                        <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                          <td className="p-3 flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                            <AvatarCharacter avatarId={p.avatar} size="xs" />
                            <span>{p.name}</span>
                          </td>
                          <td className="p-3 text-center font-mono-code text-slate-700 dark:text-slate-300">
                            {stats.movesCount || 20}
                          </td>
                          <td className="p-3 text-center font-mono-code font-bold text-purple-600 dark:text-purple-400">
                            {stats.doublesRolled || 2} 🎲
                          </td>
                          <td className="p-3 text-center font-mono-code text-rose-600 dark:text-rose-400">
                            {stats.jailVisits || 0} 🔒
                          </td>
                          <td className="p-3 text-center font-mono-code text-emerald-600 dark:text-emerald-400 font-bold">
                            {stats.passGoCount || 4} 🚀
                          </td>
                          <td className="p-3 text-center font-mono-code font-black">
                            <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-600 dark:text-amber-300 border border-amber-400/30">
                              {stats.luckScore || 75}/100
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: ECONOMY & RENT MATRIX */}
        {activeTab === 'economy' && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h4 className="text-sm font-bold font-heading text-slate-900 dark:text-white">
                Financial Transactions & Rent Matrix
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Comparison of rent collected from tenants versus rent paid out to opponents
              </p>
            </div>

            {/* Rent Comparison Bar Chart */}
            <div className="h-64 sm:h-72 w-full p-3 rounded-2xl border bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={financeComparisonData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isLight ? '#e2e8f0' : '#332959'} />
                  <XAxis dataKey="name" stroke={isLight ? '#64748b' : '#94a3b8'} fontSize={11} />
                  <YAxis stroke={isLight ? '#64748b' : '#94a3b8'} fontSize={11} tickFormatter={val => `$${val}`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isLight ? '#ffffff' : '#181329',
                      borderColor: isLight ? '#cbd5e1' : '#4c3882',
                      borderRadius: '12px',
                      fontSize: '12px'
                    }}
                    formatter={(val: any) => [fmt(Number(val)), '']}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Bar dataKey="Rent Collected" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Rent Paid" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Taxes Paid" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Financial Ledger Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {players.map(p => {
                const stats = analytics.playerStats[p.id] || ({} as any);
                const netRentalYield = (stats.rentCollected || 0) - (stats.rentPaid || 0);
                return (
                  <div
                    key={p.id}
                    className="p-4 rounded-2xl border bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <AvatarCharacter avatarId={p.avatar} size="xs" />
                      <div className="font-heading font-bold text-xs text-slate-900 dark:text-white truncate">
                        {p.name}
                      </div>
                    </div>
                    <div className="space-y-1 text-xs pt-1 border-t border-slate-200 dark:border-slate-800">
                      <div className="flex justify-between">
                        <span className="text-slate-400 text-[11px]">Rent Collected:</span>
                        <span className="font-mono-code font-bold text-emerald-600 dark:text-emerald-400">+{fmt(stats.rentCollected)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 text-[11px]">Rent Paid:</span>
                        <span className="font-mono-code font-bold text-rose-600 dark:text-rose-400">-{fmt(stats.rentPaid)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 text-[11px]">Peak Cash:</span>
                        <span className="font-mono-code text-slate-600 dark:text-slate-300">{fmt(stats.peakCash)}</span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-800">
                        <span className="font-bold text-[11px]">Net Rental Gain:</span>
                        <span className={`font-mono-code font-black ${netRentalYield >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {netRentalYield >= 0 ? `+${fmt(netRentalYield)}` : fmt(netRentalYield)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 6: MATCH AWARDS & RECORDS */}
        {activeTab === 'awards' && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <h4 className="text-sm font-bold font-heading text-slate-900 dark:text-white">
                Match Awards & Accolades
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Special titles awarded to players based on notable achievements and distinct playstyles
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {analytics.awards.map(award => {
                const recipient = players.find(p => p.id === award.recipientId);
                return (
                  <div
                    key={award.id}
                    className="p-4 rounded-2xl border bg-gradient-to-br from-slate-50 to-white dark:from-slate-900/80 dark:to-purple-950/30 border-slate-200 dark:border-purple-500/20 shadow-sm flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-3xl">{award.badge}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/20 uppercase font-mono-code">
                          {award.value}
                        </span>
                      </div>
                      <h5 className="font-heading font-black text-base text-slate-900 dark:text-white">
                        {award.title}
                      </h5>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {award.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                      <AvatarCharacter avatarId={recipient?.avatar || award.recipientAvatar || 'navy'} size="xs" />
                      <div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase">Awarded To</div>
                        <div className="font-heading font-bold text-xs text-slate-900 dark:text-white">
                          {award.recipientName}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 7: MATCH HIGHLIGHTS & LOGS */}
        {activeTab === 'logs' && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold font-heading text-slate-900 dark:text-white">
                  Match Action Log & Milestones
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Full chronological transcript of all moves, trades, builds, and bankruptcies
                </p>
              </div>
              <span className="text-xs font-mono-code text-slate-400">
                {room.logs?.length || 0} Events Recorded
              </span>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {(room.logs || []).slice().reverse().map((log, i) => (
                <div
                  key={log.id || i}
                  className="p-2.5 rounded-xl border bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 flex items-start gap-2.5 text-xs"
                >
                  <span className="font-mono-code text-[10px] text-slate-400 shrink-0 pt-0.5">
                    {log.timestamp || '00:00'}
                  </span>
                  <span className="text-slate-800 dark:text-slate-200 leading-relaxed">
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Bottom Footer Actions */}
      <div className="p-4 sm:p-5 border-t bg-slate-50 dark:bg-[#130e26] border-slate-200 dark:border-purple-900/40 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              sounds.playClick();
              setShowShareModal(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/40 dark:hover:bg-purple-800/50 border border-purple-300/60 dark:border-purple-500/40 text-purple-700 dark:text-purple-200 font-heading font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-sm"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share Victory Card & Tweet</span>
          </button>
          <div className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
            Match ID: <code className="font-mono-code text-[11px] text-purple-400">{room.id}</code>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {onReturnHome && (
            <button
              onClick={onReturnHome}
              className="px-4 py-2.5 rounded-xl font-heading font-bold text-xs bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer transition-colors"
            >
              ← Return to Lobby
            </button>
          )}
          {onPlayAgain && (
            <button
              onClick={onPlayAgain}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#7059e2] to-[#8e76f7] hover:from-[#6047d8] hover:to-[#7f63f3] font-heading font-black text-xs text-white cursor-pointer shadow-lg shadow-purple-500/25 active:scale-95 transition-all"
            >
              Play Again 🚀
            </button>
          )}
        </div>
      </div>

      {/* Share Victory Modal Popup */}
      {showShareModal && (
        <ShareVictoryModal
          room={room}
          analytics={analytics}
          myPlayerId={myPlayerId}
          onClose={() => setShowShareModal(false)}
        />
      )}

    </div>
  );
};
