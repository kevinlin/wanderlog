import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTripToday } from '../useTripToday';

const TIME_ZONE = 'Asia/Shanghai';
const MINUTE_MS = 60_000;

const setVisibility = (state: 'hidden' | 'visible') => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
};

const fireVisibilityChange = (state: 'hidden' | 'visible') =>
  act(() => {
    setVisibility(state);
    document.dispatchEvent(new Event('visibilitychange'));
  });

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

// A render counter, since "no re-render while the date holds" is the contract
// the count badge relies on.
const renderTripToday = (timeZone = TIME_ZONE) => {
  const renders = { count: 0 };
  const view = renderHook(
    ({ zone }: { zone: string }) => {
      renders.count += 1;
      return useTripToday(zone);
    },
    { initialProps: { zone: timeZone } }
  );
  return { ...view, renders };
};

describe('useTripToday', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    // Restores the prototype getter that setVisibility shadowed on the instance.
    Reflect.deleteProperty(document, 'visibilityState');
  });

  it('starts as the date in the trip timezone, not the viewer timezone', () => {
    vi.setSystemTime(new Date('2026-12-01T16:30:00Z'));
    const { result } = renderTripToday();
    expect(result.current).toBe('2026-12-02');
  });

  it('flips at trip-local midnight, within the next minute tick', () => {
    // 23:57:30 in Shanghai. Ticks land at 23:58:30, 23:59:30, then 00:00:30.
    vi.setSystemTime(new Date('2026-12-01T15:57:30Z'));
    const { result } = renderTripToday();
    expect(result.current).toBe('2026-12-01');

    advance(2 * MINUTE_MS);
    expect(result.current).toBe('2026-12-01');

    advance(MINUTE_MS);
    expect(result.current).toBe('2026-12-02');
  });

  it('does not re-render while the date holds', () => {
    vi.setSystemTime(new Date('2026-12-01T00:00:00Z'));
    const { result, renders } = renderTripToday();
    const initial = renders.count;

    advance(6 * 60 * MINUTE_MS);

    expect(result.current).toBe('2026-12-01');
    expect(renders.count).toBe(initial);
  });

  it('re-renders once on the flip, then stays quiet again', () => {
    vi.setSystemTime(new Date('2026-12-01T15:59:30Z'));
    const { result, renders } = renderTripToday();
    const initial = renders.count;

    advance(MINUTE_MS);
    expect(result.current).toBe('2026-12-02');
    expect(renders.count).toBe(initial + 1);

    advance(3 * 60 * MINUTE_MS);
    expect(renders.count).toBe(initial + 1);
  });

  it('flips on visibilitychange to visible without waiting for the next tick', () => {
    // A laptop asleep overnight: the clock moved on and no timer fired.
    vi.setSystemTime(new Date('2026-12-01T15:59:30Z'));
    const { result, renders } = renderTripToday();
    const initial = renders.count;

    vi.setSystemTime(new Date('2026-12-02T01:00:00Z'));
    expect(result.current).toBe('2026-12-01');

    fireVisibilityChange('visible');

    expect(result.current).toBe('2026-12-02');
    expect(renders.count).toBe(initial + 1);
  });

  it('does not re-render on visibilitychange when the date has not changed', () => {
    vi.setSystemTime(new Date('2026-12-01T03:00:00Z'));
    const { renders } = renderTripToday();
    const initial = renders.count;

    fireVisibilityChange('visible');

    expect(renders.count).toBe(initial);
  });

  it('ignores visibilitychange to hidden', () => {
    vi.setSystemTime(new Date('2026-12-01T15:59:30Z'));
    const { result } = renderTripToday();

    vi.setSystemTime(new Date('2026-12-02T01:00:00Z'));
    fireVisibilityChange('hidden');

    expect(result.current).toBe('2026-12-01');
  });

  it('follows a change of timezone on the same render', () => {
    vi.setSystemTime(new Date('2026-12-01T16:30:00Z'));
    const { result, rerender } = renderTripToday('UTC');
    expect(result.current).toBe('2026-12-01');

    rerender({ zone: TIME_ZONE });

    expect(result.current).toBe('2026-12-02');
  });

  it('stops its timer and listener on unmount', () => {
    vi.setSystemTime(new Date('2026-12-01T15:59:30Z'));
    const removeListener = vi.spyOn(document, 'removeEventListener');
    const { unmount } = renderTripToday();
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
    expect(removeListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
  });
});
