import { flushSync } from 'react-dom';

export type StopTransitionDirection = 'forward' | 'backward';

const prefersReducedMotion = (): boolean => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Rapid stop clicks skip the in-flight transition; only the newest one may
// clear the direction attribute, or it would break the newer animation mid-run.
let activeTransitionToken = 0;

/**
 * Page-turn between stops: wraps the state update in a View Transition so the
 * old stop's panel content slides out, the new one slides in, and the timeline
 * selection morphs across the strip. The direction attribute lets CSS slide
 * toward the stop being travelled to. Falls back to an instant update when the
 * API is missing or the user prefers reduced motion.
 */
export function runStopTransition(direction: StopTransitionDirection, update: () => void): void {
  if (prefersReducedMotion() || typeof document.startViewTransition !== 'function') {
    update();
    return;
  }

  const token = ++activeTransitionToken;
  document.documentElement.dataset.stopDirection = direction;

  const transition = document.startViewTransition(() => {
    flushSync(update);
  });

  // ready and finished reject with AbortError when a newer click skips this transition
  transition.ready.catch(() => undefined);
  transition.finished
    .catch(() => undefined)
    .then(() => {
      if (token === activeTransitionToken) {
        delete document.documentElement.dataset.stopDirection;
      }
    });
}
