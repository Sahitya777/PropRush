import confetti from 'canvas-confetti';

interface ConfettiOptions {
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

export function fireConfetti(options?: ConfettiOptions) {
  try {
    if (typeof confetti === 'function') {
      confetti(options);
      return;
    }
    const anyConfetti = confetti as unknown as { default?: (opts?: ConfettiOptions) => void };
    if (typeof anyConfetti?.default === 'function') {
      anyConfetti.default(options);
      return;
    }
  } catch (err) {
    console.warn('Confetti animation failed to trigger:', err);
  }
}
