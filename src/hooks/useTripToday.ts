import { useCallback, useSyncExternalStore } from 'react';
import { tripToday } from '@/utils/todoUtils';

const CHECK_INTERVAL_MS = 60_000;

// Render-time "today" alone leaves a page left open overnight showing
// yesterday's count, and nothing refetches to fix it. The snapshot is the date
// string itself, so React re-renders only when the date changes: at most once a
// day, however often the minute check or visibilitychange fires.
export function useTripToday(timeZone: string): string {
  const subscribe = useCallback((onChange: () => void) => {
    const timer = setInterval(onChange, CHECK_INTERVAL_MS);
    // A backgrounded tab throttles its timers, so check again on return.
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        onChange();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  return useSyncExternalStore(subscribe, () => tripToday(timeZone));
}
