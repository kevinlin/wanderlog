import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useOnlineStatus } from '../useOnlineStatus';

// jsdom fires online/offline events but never flips navigator.onLine itself
const setNavigatorOnline = (value: boolean) => {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, value });
};

describe('useOnlineStatus', () => {
  afterEach(() => setNavigatorOnline(true));

  it('tracks offline/online events', () => {
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true); // jsdom default

    act(() => {
      setNavigatorOnline(false);
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current).toBe(false);

    act(() => {
      setNavigatorOnline(true);
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current).toBe(true);
  });
});
