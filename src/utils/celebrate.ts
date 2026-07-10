import confetti from 'canvas-confetti';

// Brand + rainbow-timeline colors so a burst reads as "this trip", not generic party.
const BRAND_COLORS = ['#4a9e9e', '#6bb6d6', '#5b8c5a', '#10b981', '#f59e0b', '#0ea5e9'];

const prefersReducedMotion = (): boolean => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * A quick, contained burst for finishing every activity at a single stop.
 * The toast carries the message; confetti is the pleasant surprise on top.
 */
export function celebrateStopComplete(): void {
  if (prefersReducedMotion()) return;

  confetti({
    particleCount: 90,
    spread: 72,
    startVelocity: 42,
    ticks: 160,
    gravity: 1.1,
    scalar: 0.9,
    origin: { y: 0.72 },
    colors: BRAND_COLORS,
    disableForReducedMotion: true,
  });
}

/**
 * A fuller, two-sided finale reserved for the whole trip being done.
 * Rarer than the stop burst, so it earns the extra flourish.
 */
export function celebrateTripComplete(): void {
  if (prefersReducedMotion()) return;

  const shared = {
    particleCount: 70,
    startVelocity: 50,
    ticks: 200,
    spread: 60,
    colors: BRAND_COLORS,
    disableForReducedMotion: true,
  } as const;

  confetti({ ...shared, angle: 60, origin: { x: 0, y: 0.75 } });
  confetti({ ...shared, angle: 120, origin: { x: 1, y: 0.75 } });
}
