import React, { useRef, useState, useEffect } from 'react';
import {
  X,
  Download,
  Sparkles
} from 'lucide-react';
import { GameRoom, MatchAnalytics } from '../types/game';
import { sounds } from '../utils/audio';

interface ShareVictoryModalProps {
  room: GameRoom;
  analytics: MatchAnalytics;
  myPlayerId: string;
  onClose: () => void;
}

export const ShareVictoryModal: React.FC<ShareVictoryModalProps> = ({
  room,
  analytics,
  myPlayerId,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);

  const players = room.players || [];
  const rankedPlayers = [...players].sort((a, b) => (b.netWorth || 0) - (a.netWorth || 0));
  const winner = rankedPlayers[0] || players[0];

  const winnerStats = analytics.playerStats[winner?.id || ''] || ({} as any);
  const prizeAmount = room.betAmount > 0
    ? Math.round(room.totalPrizePool * (1 - room.platformFeeRate) * 100) / 100
    : 0;

  const fmt = (n?: number) => `$${(n || 0).toLocaleString()}`;

  // Generate Canvas Social Graphic (1200 x 630 px)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 1200;
    const height = 630;
    canvas.width = width;
    canvas.height = height;

    // 1. Background gradient (Deep cosmic purple & midnight obsidian)
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, '#0f0a1c');
    bgGrad.addColorStop(0.5, '#191136');
    bgGrad.addColorStop(1, '#090514');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Ambient radial glow behind winner
    const glowGrad = ctx.createRadialGradient(340, 315, 20, 340, 315, 300);
    glowGrad.addColorStop(0, 'rgba(112, 89, 226, 0.45)');
    glowGrad.addColorStop(0.5, 'rgba(245, 158, 11, 0.2)');
    glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, 0, width, height);

    // 3. Grid accent lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 60) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 4. Outer Glowing Border
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.35)';
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 20, width - 40, height - 40);

    // 5. Header Branding
    // Logo Pill
    ctx.fillStyle = 'rgba(112, 89, 226, 0.25)';
    ctx.beginPath();
    ctx.roundRect(60, 50, 220, 48, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 22px system-ui, -apple-system, sans-serif';
    ctx.fillText('🎲 PROPRUSH', 80, 82);

    // Match Type / Status Pill
    ctx.fillStyle = 'rgba(245, 158, 11, 0.18)';
    ctx.beginPath();
    ctx.roundRect(width - 340, 50, 280, 48, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('🏆 MATCH VICTORY REPORT', width - 80, 81);
    ctx.textAlign = 'left';

    // 6. Left Side: Winner Hero Avatar & Info
    // Winner Avatar Circle
    const avatarX = 150;
    const avatarY = 325;
    const avatarR = 75;

    // Outer glowing ring
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarR + 6, 0, Math.PI * 2);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Inner avatar fill
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
    ctx.fillStyle = '#7059e2';
    ctx.fill();

    // Draw Emoji Face
    ctx.font = '72px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🟢', avatarX, avatarY);

    // Crown on top of avatar
    ctx.font = '48px system-ui, sans-serif';
    ctx.fillText('👑', avatarX, avatarY - 70);

    // Winner Name & Title (Bounded neatly within left column width: max 310px)
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    const textLeftX = 250;
    const maxTextWidth = 310;

    ctx.fillStyle = '#f59e0b';
    ctx.font = '800 15px system-ui, sans-serif';
    ctx.fillText('1ST PLACE CHAMPION', textLeftX, 235, maxTextWidth);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 34px system-ui, sans-serif';
    const displayName = winner?.name || 'Player';
    ctx.fillText(displayName, textLeftX, 275, maxTextWidth);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 16px system-ui, sans-serif';
    const matchTitle = room.name || 'PropRush Match';
    ctx.fillText(matchTitle, textLeftX, 308, maxTextWidth);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(`⚡ ${analytics.totalRounds} Rounds Played`, textLeftX, 335, maxTextWidth);

    // Prize Badge Box
    if (prizeAmount > 0) {
      ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
      ctx.beginPath();
      ctx.roundRect(textLeftX, 360, 260, 52, 12);
      ctx.fill();
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#34d399';
      ctx.font = '900 24px system-ui, sans-serif';
      ctx.fillText(`+${fmt(prizeAmount)} WON`, textLeftX + 20, 395);
    } else {
      ctx.fillStyle = 'rgba(168, 85, 247, 0.2)';
      ctx.beginPath();
      ctx.roundRect(textLeftX, 360, 260, 52, 12);
      ctx.fill();
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#c084fc';
      ctx.font = '900 22px system-ui, sans-serif';
      ctx.fillText('CASUAL VICTORY', textLeftX + 20, 395);
    }

    // 7. Right Side: 4 High-Impact Stat Bento Cards
    const stats = [
      { label: 'FINAL NET WORTH', val: fmt(winner?.netWorth), color: '#34d399', icon: '💰' },
      { label: 'PROPERTIES OWNED', val: `${winner?.properties.length || 0} Deeds`, color: '#60a5fa', icon: '🏢' },
      { label: 'RENT HARVESTED', val: `+${fmt(winnerStats.rentCollected || 0)}`, color: '#fbbf24', icon: '🏦' },
      { label: 'TOTAL ECONOMY', val: fmt(analytics.totalEconomyVolume), color: '#f472b6', icon: '📊' }
    ];

    const startX = 590;
    const cardW = 260;
    const cardH = 105;
    const gap = 20;

    stats.forEach((st, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cx = startX + col * (cardW + gap);
      const cy = 195 + row * (cardH + gap);

      // Card Box
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.beginPath();
      ctx.roundRect(cx, cy, cardW, cardH, 16);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Stat Label
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillText(`${st.icon} ${st.label}`, cx + 20, cy + 36);

      // Stat Value
      ctx.fillStyle = st.color;
      ctx.font = '900 24px system-ui, sans-serif';
      ctx.fillText(st.val, cx + 20, cy + 76);
    });

    // 8. Footer Bar
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(20, height - 75, width - 40, 55);

    ctx.fillStyle = '#64748b';
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.fillText('Play fast-paced multiplayer monopoly online • proprush.app', 60, height - 42);

    ctx.textAlign = 'right';
    ctx.fillText(`Match ID: ${room.id || 'proprush_match'}`, width - 60, height - 42);
    ctx.textAlign = 'left';

    // Store preview URL
    setPreviewDataUrl(canvas.toDataURL('image/png'));
  }, [room, analytics, winner, prizeAmount]);

  // Download Generated Image
  const handleDownloadImage = () => {
    sounds.playDiceRoll();
    setIsDownloading(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `proprush-victory-${winner?.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => setIsDownloading(false), 800);
  };

  // Share to Twitter / X
  const handleShareTwitter = () => {
    sounds.playClick();
    const appUrl = window.location.origin || 'https://proprush.app';
    const isWager = prizeAmount > 0;
    
    let tweetText = `🏆 Won 1st Place in PropRush! 👑\n`;
    if (isWager) {
      tweetText += `💰 Prize Won: +${fmt(prizeAmount)}\n`;
    }
    tweetText += `📈 Net Worth: ${fmt(winner?.netWorth)} (${winner?.properties.length || 0} properties)\n`;
    tweetText += `⚡ Survived ${analytics.totalRounds} rounds of high-stakes real estate trading!\n\nCan you beat my monopoly empire? Play now:`;

    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(appUrl)}&hashtags=PropRush,Monopoly`;
    window.open(twitterUrl, '_blank', 'width=600,height=500,scrollbars=yes,resizable=yes');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pt-16 pb-8 sm:p-6 sm:pt-20 sm:pb-12 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="w-full max-w-2xl rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[85vh] my-auto text-left transition-all bg-white dark:bg-[#150f28] border-slate-200 dark:border-purple-500/30 text-slate-800 dark:text-slate-100">
        
        {/* Header */}
        <div className="px-6 py-5 bg-slate-50 dark:bg-[#1b1433] border-b border-slate-200 dark:border-purple-900/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-400 to-yellow-300 flex items-center justify-center text-xl shadow-md shadow-amber-500/20">
              🚀
            </div>
            <div>
              <h3 className="text-lg font-heading font-black text-slate-900 dark:text-white">
                Share Victory & Stats
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Show off your real estate victory with high-res graphics and live social stats
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-200/70 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/20 text-slate-600 dark:text-white flex items-center justify-center cursor-pointer transition-colors text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          
          {/* Social Image Card Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Generated Victory Card (1200 × 630 HD)</span>
              </span>
              <span className="text-[11px] text-purple-600 dark:text-purple-400 font-bold">Auto-Rendered</span>
            </div>

            <div className="rounded-2xl border border-slate-300/80 dark:border-purple-500/30 overflow-hidden shadow-lg bg-black/40 relative group">
              {previewDataUrl ? (
                <img
                  src={previewDataUrl}
                  alt="PropRush Victory Card"
                  className="w-full h-auto object-cover aspect-[1200/630]"
                />
              ) : (
                <div className="w-full aspect-[1200/630] flex items-center justify-center bg-slate-900 text-slate-400 text-sm">
                  Rendering Victory Graphics...
                </div>
              )}

              {/* Hidden Canvas for crisp rendering */}
              <canvas ref={canvasRef} className="hidden" />
            </div>
          </div>

          {/* Quick Share Buttons Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            
            {/* Share to Twitter / X */}
            <button
              onClick={handleShareTwitter}
              className="p-4 rounded-2xl bg-black hover:bg-slate-900 border border-slate-700 text-white font-heading font-black text-sm flex items-center justify-center gap-2.5 cursor-pointer shadow-lg hover:shadow-purple-500/20 transition-all active:scale-95"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              <span>Share on X (Twitter)</span>
            </button>

            {/* Download HD Graphic */}
            <button
              onClick={handleDownloadImage}
              disabled={isDownloading}
              className="p-4 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-heading font-black text-sm flex items-center justify-center gap-2.5 cursor-pointer shadow-lg shadow-purple-500/25 transition-all active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>{isDownloading ? 'Saving PNG...' : 'Download Victory Image'}</span>
            </button>
          </div>

          {/* Key Match Snippet Preview */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-purple-950/20 border border-slate-200/80 dark:border-purple-900/30">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Share Caption Preview
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 font-mono-code leading-relaxed">
              🏆 Won 1st Place in PropRush! 👑 {prizeAmount > 0 ? `💰 Prize Won: +${fmt(prizeAmount)} • ` : ''}📈 Net Worth: {fmt(winner?.netWorth)} ({winner?.properties.length || 0} properties) across {analytics.totalRounds} rounds of trading.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-[#181230] border-t border-slate-200 dark:border-purple-900/40 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-[#7059e2] hover:bg-[#5f48d6] text-white font-heading font-bold text-xs cursor-pointer transition-all active:scale-95 shadow-md shadow-purple-500/25"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
