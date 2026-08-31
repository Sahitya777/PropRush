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
  const [copiedReport, setCopiedReport] = useState(false);

  // Synthesize or retrieve analytics
  const analytics: MatchAnalytics = room.analytics || calculateMatchAnalytics(room);
  const players = room.players || [];
  const winner = room.winner || players.find(p => !p.isBankrupt) || players[0];
  const isWinner = winner?.id === myPlayerId;
  const myPlayer = players.find(p => p.id === myPlayerId);

  // Ranked players by final net worth
  const rankedPlayers = [...players].sort((a, b) => {
    if (a.isBankrupt && !b.isBankrupt) return 1;
    if (!a.isBankrupt && b.isBankrupt) return -1;
    return b.netWorth - a.netWorth;
  });

  const myPlacement = rankedPlayers.findIndex(p => p.id === myPlayerId) + 1;

  // Format currency
  const fmt = (val: number | undefined) => `$${(val || 0).toLocaleString()}`;

  // Copy Match Report
  const handleCopyReport = () => {
    sounds.playClick();
    const reportText = `👑 PROPRUSH MATCH REPORT: ${room.name}
━━━━━━━━━━━━━━━━━━━━━━━━━━
🏆 Champion: ${winner?.name} (${fmt(winner?.netWorth)})
🎮 Rounds: ${analytics.totalRounds} | Total Economy: ${fmt(analytics.totalEconomyVolume)}
🏦 Total Rent Transacted: ${fmt(analytics.totalRentTransacted)}
🏗️ Houses & Hotels Built: ${analytics.totalHousesBuilt} Houses, ${analytics.totalHotelsBuilt} Hotels

📊 FINAL STANDINGS:
${rankedPlayers.map((p, i) => `${i + 1}. ${p.name}: ${p.isBankrupt ? 'BANKRUPT ☠️' : fmt(p.netWorth)} (${p.properties.length} Props)`).join('\n')}

🎲 Play fast-paced multiplayer monopoly on PropRush!`;

    navigator.clipboard?.writeText(reportText);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2500);
  };

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
    <div className="w-full max-w-5xl rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-left transition-all animate-fade-in bg-white dark:bg-[#15102a] border-slate-200 dark:border-purple-500/30 text-slate-800 dark:text-slate-100">
      
      {/* Top Header & Match Summary Banner */}
      <div className="p-4 sm:p-6 bg-gradient-to-r from-purple-900/90 via-indigo-950/90 to-purple-950/90 text-white border-b border-purple-500/20 relative">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-400 to-yellow-300 flex items-center justify-center text-2xl shadow-lg shadow-amber-500/30">
              👑
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 bg-amber-400/20 px-2 py-0.5 rounded-full border border-amber-400/30">
                  Match Concluded
                </span>
                <span className="text-xs text-purple-200 font-mono-code">
                  {analytics.totalRounds} Rounds • {Math.floor(analytics.durationSeconds / 60)}m {analytics.durationSeconds % 60}s
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-heading font-black tracking-tight text-white flex items-center gap-2">
                <span>{room.name || 'PropRush Match'}</span>
                <span className="text-sm font-normal text-purple-300 font-sans">Analytics & Standings</span>
              </h2>
            </div>
          </div>

          {/* Quick Actions in Header */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyReport}
              className="px-3 py-2 rounded-xl bg-purple-800/60 hover:bg-purple-700/80 border border-purple-400/30 text-xs font-bold font-heading text-purple-100 flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
            >
              {copiedReport ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{copiedReport ? 'Report Copied!' : 'Share Report'}</span>
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition-colors"
                title="Close"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Global Key Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mt-4 pt-4 border-t border-purple-500/20">
          <div className="bg-white/5 backdrop-blur-sm p-2.5 rounded-xl border border-white/10">
            <div className="text-[10px] uppercase font-bold text-purple-300">Total Economy Volume</div>
            <div className="text-sm sm:text-base font-black font-mono-code text-emerald-400">
              {fmt(analytics.totalEconomyVolume)}
            </div>
          </div>
          <div className="bg-white/5 backdrop-blur-sm p-2.5 rounded-xl border border-white/10">
            <div className="text-[10px] uppercase font-bold text-purple-300">Total Rent Transacted</div>
            <div className="text-sm sm:text-base font-black font-mono-code text-amber-300">
              {fmt(analytics.totalRentTransacted)}
            </div>
          </div>
          <div className="bg-white/5 backdrop-blur-sm p-2.5 rounded-xl border border-white/10">
            <div className="text-[10px] uppercase font-bold text-purple-300">Empire Buildings</div>
            <div className="text-sm sm:text-base font-black font-mono-code text-sky-300">
              {analytics.totalHousesBuilt} 🟢 / {analytics.totalHotelsBuilt} 🔴
            </div>
          </div>
          <div className="bg-white/5 backdrop-blur-sm p-2.5 rounded-xl border border-white/10">
            <div className="text-[10px] uppercase font-bold text-purple-300">Taxes & Pot Won</div>
            <div className="text-sm sm:text-base font-black font-mono-code text-rose-300">
              {fmt(analytics.totalTaxesCollected)}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tab Bar */}
      <div className="flex items-center gap-1 sm:gap-2 px-3 sm:px-6 py-2.5 border-b overflow-x-auto no-scrollbar bg-slate-50 dark:bg-[#1a1435] border-slate-200 dark:border-purple-900/40">
        {[
          { id: 'overview', label: '🏆 Standings & Podium', icon: Trophy },
          { id: 'timeline', label: '📈 Net Worth Timeline', icon: TrendingUp },
          { id: 'properties', label: '🏢 Property Portfolios', icon: Building2 },
          { id: 'dice', label: '🎲 Dice & Movement', icon: Dices },
          { id: 'economy', label: '💰 Economy & Rent', icon: DollarSign },
          { id: 'awards', label: '🎖️ Match Awards', icon: Award },
          { id: 'logs', label: '📜 Match Highlights', icon: History }
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
              className={`px-3 py-1.5 rounded-xl text-xs font-bold font-heading whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#7059e2] text-white shadow-md shadow-purple-500/25 scale-[1.02]'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-purple-900/20'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Tab Content Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">

        {/* TAB 1: OVERVIEW & PODIUM */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-fade-in">
            {/* Champion Podium Box */}
            <div className="p-4 sm:p-6 rounded-3xl border relative overflow-hidden bg-gradient-to-r from-amber-500/10 via-yellow-500/10 to-amber-500/10 border-amber-400/40 dark:border-amber-400/30">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <AvatarCharacter avatarId={winner?.avatar || 'navy'} size="lg" />
                    <span className="absolute -bottom-1 -right-1 text-2xl">👑</span>
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                      <span>1st Place Champion</span>
                      {winner?.id === myPlayerId && <span className="bg-amber-400 text-slate-900 px-1.5 py-0.2 rounded text-[10px] font-black">YOU</span>}
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-heading font-black tracking-tight text-slate-900 dark:text-white">
                      {winner?.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono-code">
                      Final Net Worth: <strong className="text-emerald-600 dark:text-emerald-400 text-sm">{fmt(winner?.netWorth)}</strong> ({winner?.properties.length} properties owned)
                    </p>
                  </div>
                </div>

                {/* Prize Payout Box */}
                {room.betAmount > 0 ? (
                  <div className="text-right px-4 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wide">
                      Winner Prize Payout (95%)
                    </div>
                    <div className="text-xl sm:text-2xl font-black font-mono-code text-emerald-600 dark:text-emerald-300">
                      +{fmt(Math.round(room.totalPrizePool * (1 - room.platformFeeRate) * 100) / 100)}
                    </div>
                    <div className="text-[9px] text-slate-500 dark:text-slate-400">
                      Pool: {fmt(room.totalPrizePool)} ($50 wager × 4)
                    </div>
                  </div>
                ) : (
                  <div className="text-right px-4 py-3 rounded-2xl bg-purple-500/10 border border-purple-500/30">
                    <div className="text-[10px] text-purple-600 dark:text-purple-400 font-bold uppercase">
                      Casual Match Victory
                    </div>
                    <div className="text-lg font-black font-mono-code text-purple-600 dark:text-purple-300">
                      +150 LP & +75 🪙
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Full Ranked Leaderboard Cards */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Final Standings & Performance Breakdown
              </h4>
              <div className="grid grid-cols-1 gap-2.5">
                {rankedPlayers.map((player, idx) => {
                  const pStats = analytics.playerStats[player.id] || ({} as any);
                  const isMe = player.id === myPlayerId;
                  const isFirst = idx === 0;

                  return (
                    <div
                      key={player.id}
                      className={`p-3.5 sm:p-4 rounded-2xl border flex items-center justify-between flex-wrap gap-3 transition-all ${
                        isMe
                          ? 'bg-[#7059e2]/10 border-[#7059e2] shadow-sm'
                          : isFirst
                          ? 'bg-amber-50/50 dark:bg-amber-500/5 border-amber-300 dark:border-amber-500/30'
                          : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-[200px]">
                        <span className={`font-heading font-black text-sm w-5 text-center ${
                          idx === 0 ? 'text-amber-500 text-lg' : idx === 1 ? 'text-slate-400 text-base' : idx === 2 ? 'text-amber-700' : 'text-slate-500'
                        }`}>
                          #{idx + 1}
                        </span>
                        <AvatarCharacter avatarId={player.avatar} size="sm" />
                        <div>
                          <div className="font-heading font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span>{player.name}</span>
                            {isMe && (
                              <span className="text-[10px] bg-[#7059e2] text-white px-1.5 py-0.2 rounded font-bold">
                                YOU
                              </span>
                            )}
                            {player.isBankrupt && (
                              <span className="text-[9px] bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 px-1.5 py-0.2 rounded font-bold">
                                Bankrupt ☠️
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                            <span>{player.properties.length} Properties</span>
                            <span>•</span>
                            <span>{pStats.housesBuilt || 0} Houses</span>
                            <span>•</span>
                            <span>{pStats.hotelsBuilt || 0} Hotels</span>
                          </div>
                        </div>
                      </div>

                      {/* Stat Metrics Columns */}
                      <div className="flex items-center gap-4 sm:gap-6 font-mono-code text-xs">
                        <div className="text-right">
                          <div className="text-[9px] uppercase font-bold text-slate-400">Cash Flow</div>
                          <div className="font-bold text-slate-700 dark:text-slate-300">
                            {fmt(player.cash)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[9px] uppercase font-bold text-slate-400">Rent Harvested</div>
                          <div className="font-bold text-emerald-600 dark:text-emerald-400">
                            +{fmt(pStats.rentCollected || 0)}
                          </div>
                        </div>
                        <div className="text-right min-w-[90px]">
                          <div className="text-[9px] uppercase font-bold text-slate-400">Final Net Worth</div>
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

            {/* Quick Match Highlights Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl border bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800">
                <div className="text-2xl mb-1">🏦</div>
                <div className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Top Rent Extractor</div>
                <div className="text-base font-black font-heading mt-1 text-slate-900 dark:text-white">
                  {rankedPlayers[0]?.name}
                </div>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-mono-code mt-0.5">
                  +{fmt(analytics.playerStats[rankedPlayers[0]?.id]?.rentCollected || 0)} collected
                </p>
              </div>

              <div className="p-4 rounded-2xl border bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800">
                <div className="text-2xl mb-1">🏗️</div>
                <div className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Empire Construction</div>
                <div className="text-base font-black font-heading mt-1 text-slate-900 dark:text-white">
                  {analytics.totalHousesBuilt} Houses & {analytics.totalHotelsBuilt} Hotels
                </div>
                <p className="text-xs text-purple-600 dark:text-purple-400 mt-0.5">
                  Built across {analytics.totalRounds} active rounds
                </p>
              </div>

              <div className="p-4 rounded-2xl border bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800">
                <div className="text-2xl mb-1">🎲</div>
                <div className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Luckiest Roller</div>
                <div className="text-base font-black font-heading mt-1 text-slate-900 dark:text-white">
                  {rankedPlayers[0]?.name}
                </div>
                <p className="text-xs text-amber-600 dark:text-amber-400 font-mono-code mt-0.5">
                  Luck Index: {analytics.playerStats[rankedPlayers[0]?.id]?.luckScore || 92}/100
                </p>
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
                  Track dynamic wealth growth, property acquisitions, and turning points throughout the match
                </p>
              </div>

              {/* Metric Toggle Buttons */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                {[
                  { id: 'netWorth', label: 'Net Worth ($)' },
                  { id: 'cash', label: 'Cash on Hand ($)' },
                  { id: 'props', label: 'Properties Owned (#)' }
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

            {/* Recharts Area / Line Chart Container */}
            <div className="h-72 sm:h-80 w-full p-3 rounded-2xl border bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartTimelineData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                  <defs>
                    {players.map((p, idx) => {
                      const color = playerColorMap[p.id] || '#7059e2';
                      return (
                        <linearGradient key={p.id} id={`grad_${p.id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={color} stopOpacity={0.4} />
                          <stop offset="95%" stopColor={color} stopOpacity={0.0} />
                        </linearGradient>
                      );
                    })}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={isLight ? '#e2e8f0' : '#332959'} />
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

            {/* Turning Point Milestone Callouts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {analytics.keyEvents.slice(0, 4).map(ev => (
                <div
                  key={ev.id}
                  className="p-3 rounded-xl border bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 flex items-start gap-3"
                >
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold flex items-center justify-center text-xs shrink-0 font-mono-code">
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
                          {ownedTiles.length} Deeds Owned • {Object.values(selectedPlayer.houses || {}).filter(h => h > 0 && h < 5).length} Houses • {Object.values(selectedPlayer.houses || {}).filter(h => h === 5).length} Luxury Hotels
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
        <div className="text-xs text-slate-500 dark:text-slate-400">
          Match ID: <code className="font-mono-code text-[11px] text-purple-400">{room.id}</code>
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

    </div>
  );
};
