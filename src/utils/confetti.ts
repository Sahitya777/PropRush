export interface ConfettiOptions {
  particleCount?: number;
  angle?: number;
  spread?: number;
  startVelocity?: number;
  decay?: number;
  gravity?: number;
  drift?: number;
  ticks?: number;
  origin?: { x?: number; y?: number };
  colors?: string[];
  shapes?: ('square' | 'circle')[];
  scalar?: number;
  zIndex?: number;
  disableForReducedMotion?: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  angularVelocity: number;
  width: number;
  height: number;
  color: string;
  shape: 'square' | 'circle';
  decay: number;
  gravity: number;
  opacity: number;
  ticks: number;
  maxTicks: number;
}

let activeCanvas: HTMLCanvasElement | null = null;
let activeCtx: CanvasRenderingContext2D | null = null;
let animationId: number | null = null;
const particles: Particle[] = [];

const DEFAULT_COLORS = [
  '#f59e0b',
  '#ec4899',
  '#8b5cf6',
  '#3b82f6',
  '#10b981',
  '#f43f5e',
  '#fbbf24',
  '#6366f1'
];

function ensureCanvas(zIndex = 99999): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;

  if (!activeCanvas || !document.body.contains(activeCanvas)) {
    activeCanvas = document.createElement('canvas');
    activeCanvas.style.position = 'fixed';
    activeCanvas.style.top = '0';
    activeCanvas.style.left = '0';
    activeCanvas.style.width = '100vw';
    activeCanvas.style.height = '100vh';
    activeCanvas.style.pointerEvents = 'none';
    activeCanvas.style.zIndex = String(zIndex);
    activeCanvas.width = window.innerWidth;
    activeCanvas.height = window.innerHeight;
    document.body.appendChild(activeCanvas);

    const onResize = () => {
      if (activeCanvas) {
        activeCanvas.width = window.innerWidth;
        activeCanvas.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', onResize);
  } else {
    activeCanvas.style.zIndex = String(zIndex);
  }

  activeCtx = activeCanvas.getContext('2d');
  return activeCtx ? { canvas: activeCanvas, ctx: activeCtx } : null;
}

function updateAndRender() {
  if (!activeCanvas || !activeCtx) {
    animationId = null;
    return;
  }

  activeCtx.clearRect(0, 0, activeCanvas.width, activeCanvas.height);

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.ticks++;
    p.x += p.vx;
    p.y += p.vy;
    p.vy += p.gravity;
    p.vx *= p.decay;
    p.vy *= p.decay;
    p.angle += p.angularVelocity;
    p.opacity = Math.max(0, 1 - p.ticks / p.maxTicks);

    if (p.ticks >= p.maxTicks || p.y > activeCanvas.height + 50 || p.opacity <= 0) {
      particles.splice(i, 1);
      continue;
    }

    activeCtx.save();
    activeCtx.translate(p.x, p.y);
    activeCtx.rotate(p.angle);
    activeCtx.globalAlpha = p.opacity;
    activeCtx.fillStyle = p.color;

    if (p.shape === 'circle') {
      activeCtx.beginPath();
      activeCtx.arc(0, 0, p.width / 2, 0, Math.PI * 2);
      activeCtx.fill();
    } else {
      activeCtx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
    }

    activeCtx.restore();
  }

  if (particles.length > 0) {
    animationId = requestAnimationFrame(updateAndRender);
  } else {
    if (activeCanvas && document.body.contains(activeCanvas)) {
      document.body.removeChild(activeCanvas);
    }
    activeCanvas = null;
    activeCtx = null;
    animationId = null;
  }
}

export function fireConfetti(options: ConfettiOptions = {}): void {
  try {
    const env = ensureCanvas(options.zIndex ?? 99999);
    if (!env) return;

    const count = options.particleCount ?? 60;
    const angle = ((options.angle ?? 90) * Math.PI) / 180;
    const spread = ((options.spread ?? 60) * Math.PI) / 180;
    const startVelocity = options.startVelocity ?? 35;
    const colors = options.colors && options.colors.length > 0 ? options.colors : DEFAULT_COLORS;
    const originX = (options.origin?.x ?? 0.5) * window.innerWidth;
    const originY = (options.origin?.y ?? 0.5) * window.innerHeight;
    const gravity = options.gravity ?? 0.45;
    const decay = options.decay ?? 0.94;
    const maxTicks = options.ticks ?? 180;
    const scalar = options.scalar ?? 1;

    for (let i = 0; i < count; i++) {
      const pAngle = angle - spread / 2 + Math.random() * spread;
      const speed = startVelocity * (0.6 + Math.random() * 0.8);
      const isCircle = Math.random() < 0.25;

      particles.push({
        x: originX,
        y: originY,
        vx: Math.cos(pAngle) * speed + (options.drift ?? 0),
        vy: -Math.sin(pAngle) * speed,
        angle: Math.random() * Math.PI * 2,
        angularVelocity: (Math.random() - 0.5) * 0.2,
        width: (isCircle ? 7 : 9 + Math.random() * 4) * scalar,
        height: (isCircle ? 7 : 6 + Math.random() * 4) * scalar,
        color: colors[Math.floor(Math.random() * colors.length)],
        shape: isCircle ? 'circle' : 'square',
        decay,
        gravity,
        opacity: 1,
        ticks: 0,
        maxTicks: maxTicks * (0.7 + Math.random() * 0.6)
      });
    }

    if (!animationId) {
      animationId = requestAnimationFrame(updateAndRender);
    }
  } catch (err) {
    console.warn('Native confetti animation error:', err);
  }
}

export default fireConfetti;
