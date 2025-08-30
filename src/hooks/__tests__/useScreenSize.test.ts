import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useScreenSize } from '../useScreenSize';

// Mock window object
const mockWindow = {
  innerWidth: 1024,
  innerHeight: 768,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

Object.defineProperty(window, 'innerWidth', {
  writable: true,
  configurable: true,
  value: 1024,
});

Object.defineProperty(window, 'innerHeight', {
  writable: true,
  configurable: true,
  value: 768,
});

describe('useScreenSize', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.innerWidth = 1024;
    window.innerHeight = 768;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return desktop screen size for large screens', () => {
    window.innerWidth = 1024;
    window.innerHeight = 768;

    const { result } = renderHook(() => useScreenSize());

    expect(result.current).toEqual({
      width: 1024,
      height: 768,
      isMobile: false,
      isTablet: false,
      isDesktop: true,
    });
  });

  it('should return mobile screen size for small screens', () => {
    window.innerWidth = 375;
    window.innerHeight = 667;

    const { result } = renderHook(() => useScreenSize());

    expect(result.current).toEqual({
      width: 375,
      height: 667,
      isMobile: true,
      isTablet: false,
      isDesktop: false,
    });
  });

  it('should return tablet screen size for medium screens', () => {
    window.innerWidth = 768;
    window.innerHeight = 1024;

    const { result } = renderHook(() => useScreenSize());

    expect(result.current).toEqual({
      width: 768,
      height: 1024,
      isMobile: false,
      isTablet: true,
      isDesktop: false,
    });
  });

  it('should handle boundary cases correctly', () => {
    // Test mobile/tablet boundary (640px)
    window.innerWidth = 640;
    window.innerHeight = 480;

    const { result } = renderHook(() => useScreenSize());

    expect(result.current.isMobile).toBe(false);
    expect(result.current.isTablet).toBe(true);
    expect(result.current.isDesktop).toBe(false);

    // Test tablet/desktop boundary (1024px)
    window.innerWidth = 1024;
    window.innerHeight = 768;

    const { result: result2 } = renderHook(() => useScreenSize());

    expect(result2.current.isMobile).toBe(false);
    expect(result2.current.isTablet).toBe(false);
    expect(result2.current.isDesktop).toBe(true);
  });

  it('should add and remove resize event listener', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useScreenSize());

    expect(addEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
  });

  it('should update screen size on window resize', () => {
    let resizeHandler: ((event: Event) => void) | undefined;
    
    vi.spyOn(window, 'addEventListener').mockImplementation((event, handler) => {
      if (event === 'resize') {
        resizeHandler = handler as (event: Event) => void;
      }
    });

    window.innerWidth = 1024;
    window.innerHeight = 768;

    const { result } = renderHook(() => useScreenSize());

    expect(result.current.isDesktop).toBe(true);
    expect(result.current.isMobile).toBe(false);

    // Simulate window resize to mobile
    act(() => {
      window.innerWidth = 375;
      window.innerHeight = 667;
      if (resizeHandler) {
        resizeHandler(new Event('resize'));
      }
    });

    expect(result.current.width).toBe(375);
    expect(result.current.height).toBe(667);
    expect(result.current.isMobile).toBe(true);
    expect(result.current.isDesktop).toBe(false);
  });

  it('should handle edge case screen sizes correctly', () => {
    // Test very small screen
    window.innerWidth = 320;
    window.innerHeight = 568;

    const { result } = renderHook(() => useScreenSize());

    expect(result.current.isMobile).toBe(true);
    expect(result.current.isTablet).toBe(false);
    expect(result.current.isDesktop).toBe(false);

    // Test very large screen
    window.innerWidth = 2560;
    window.innerHeight = 1440;

    const { result: result2 } = renderHook(() => useScreenSize());

    expect(result2.current.isMobile).toBe(false);
    expect(result2.current.isTablet).toBe(false);
    expect(result2.current.isDesktop).toBe(true);
  });
});