import React, { useState, useEffect } from 'react';
import { WifiIcon, SignalSlashIcon } from '@heroicons/react/24/outline';

/**
 * Component to indicate online/offline status
 */
export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showIndicator, setShowIndicator] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Show "Back online" message temporarily
      setShowIndicator(true);
      setTimeout(() => setShowIndicator(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowIndicator(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!showIndicator) return null;

  return (
    <div
      className={`
        fixed top-4 right-4 z-50
        px-4 py-3 rounded-lg shadow-lg
        flex items-center gap-3
        transition-all duration-300
        ${
          isOnline
            ? 'bg-green-50 border border-green-200'
            : 'bg-yellow-50 border border-yellow-200'
        }
      `}
    >
      {isOnline ? (
        <>
          <WifiIcon className="w-5 h-5 text-green-600" />
          <div className="flex flex-col">
            <span className="text-sm font-medium text-green-900">
              Back Online
            </span>
            <span className="text-xs text-green-700">
              Changes will sync automatically
            </span>
          </div>
        </>
      ) : (
        <>
          <SignalSlashIcon className="w-5 h-5 text-yellow-600" />
          <div className="flex flex-col">
            <span className="text-sm font-medium text-yellow-900">
              Offline Mode
            </span>
            <span className="text-xs text-yellow-700">
              Changes will sync when you're back online
            </span>
          </div>
        </>
      )}
    </div>
  );
};
