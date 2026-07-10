import { CheckCircleIcon } from '@heroicons/react/24/outline';
import { useIsMutating } from '@tanstack/react-query';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';

type SyncState = 'idle' | 'saving' | 'synced';

const SYNCED_DISPLAY_MS = 3000;

export const SyncIndicator: React.FC = () => {
  const isMutating = useIsMutating({});
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const wasMutatingRef = useRef(false);

  useEffect(() => {
    if (isMutating > 0) {
      wasMutatingRef.current = true;
      clearTimeout(timerRef.current);
      setSyncState('saving');
    } else if (wasMutatingRef.current) {
      wasMutatingRef.current = false;
      setSyncState('synced');
      timerRef.current = setTimeout(() => setSyncState('idle'), SYNCED_DISPLAY_MS);
    }

    return () => clearTimeout(timerRef.current);
  }, [isMutating]);

  if (syncState === 'idle') return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-2 left-2 z-30 flex items-center gap-1.5 rounded-full px-3 py-1 font-medium text-xs shadow-sm backdrop-blur-sm transition-opacity duration-300 sm:top-16 sm:bottom-auto sm:left-2"
    >
      {syncState === 'saving' ? (
        <span className="flex items-center gap-1.5 bg-white/70 text-gray-600">
          <span className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-gray-400 border-t-transparent" />
          Saving…
        </span>
      ) : (
        <span className="flex items-center gap-1.5 text-emerald-700">
          <CheckCircleIcon className="h-3.5 w-3.5" />
          Synced
        </span>
      )}
    </div>
  );
};
