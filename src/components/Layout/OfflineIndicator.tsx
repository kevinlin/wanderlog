import { SignalSlashIcon, WifiIcon } from '@heroicons/react/24/outline';
import type React from 'react';
import { useEffect, useState } from 'react';

const OFFLINE_NOTICE_MS = 5000;

/**
 * Component to indicate online/offline status
 */
export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showIndicator, setShowIndicator] = useState(!navigator.onLine);

  useEffect(() => {
    // The offline notice is an announcement, not a fixture: it sits over the
    // top-right buttons, and the To do list must stay reachable offline. The
    // controls themselves carry the offline state once it fades.
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    const showFor = (ms: number) => {
      setShowIndicator(true);
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => setShowIndicator(false), ms);
    };
    if (!navigator.onLine) {
      showFor(OFFLINE_NOTICE_MS);
    }

    const handleOnline = () => {
      setIsOnline(true);
      showFor(3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      showFor(OFFLINE_NOTICE_MS);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearTimeout(hideTimer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!showIndicator) return null;

  return (
    <div
      className={`pointer-events-none fixed top-4 right-4 z-50 flex items-center gap-3 rounded-lg px-4 py-3 shadow-lg transition-all duration-300 ${
        isOnline ? 'border border-green-200 bg-green-50' : 'border border-yellow-200 bg-yellow-50'
      }
      `}
    >
      {isOnline ? (
        <>
          <WifiIcon className="h-5 w-5 text-green-600" />
          <div className="flex flex-col">
            <span className="font-medium text-green-900 text-sm">Back Online</span>
            <span className="text-green-700 text-xs">Changes will sync automatically</span>
          </div>
        </>
      ) : (
        <>
          <SignalSlashIcon className="h-5 w-5 text-yellow-600" />
          <div className="flex flex-col">
            <span className="font-medium text-sm text-yellow-900">Offline Mode</span>
            <span className="text-xs text-yellow-700">You're offline - viewing cached data, editing disabled</span>
          </div>
        </>
      )}
    </div>
  );
};
