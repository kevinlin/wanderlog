import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OfflineIndicator } from '../OfflineIndicator';

describe('OfflineIndicator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // It sits over the top-right buttons, and the To do list has to stay
  // reachable offline, so it announces and then gets out of the way.
  it('announces going offline, never blocks taps, and fades after five seconds', () => {
    render(<OfflineIndicator />);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    const notice = screen.getByText('Offline Mode').closest('div.fixed');
    expect(notice).toHaveClass('pointer-events-none');

    act(() => {
      vi.advanceTimersByTime(4999);
    });
    expect(screen.getByText('Offline Mode')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByText('Offline Mode')).not.toBeInTheDocument();
  });

  it('does not let an earlier timer cut a later notice short', () => {
    render(<OfflineIndicator />);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    act(() => {
      vi.advanceTimersByTime(2000);
      window.dispatchEvent(new Event('offline'));
    });
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    // The "back online" timer would have fired at 3000ms; the offline notice keeps its full five seconds.
    expect(screen.getByText('Offline Mode')).toBeInTheDocument();
  });
});
