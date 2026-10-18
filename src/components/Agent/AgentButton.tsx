import { SparklesIcon } from '@heroicons/react/24/outline';
import { type ReactElement, useState } from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { AgentModal } from './AgentModal';

interface AgentButtonProps {
  tripId?: string;
}

export function AgentButton({ tripId }: AgentButtonProps): ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const isOnline = useOnlineStatus();
  return (
    <>
      {/* Same footprint as the To do button: an icon on phones, labelled from sm up */}
      <button
        aria-label="Ask the agent"
        className="flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl bg-alpine-teal-deep px-3 font-medium text-white shadow-xs transition-colors hover:bg-alpine-teal-deep/90 focus-visible:outline-2 focus-visible:outline-alpine-teal focus-visible:outline-offset-2 disabled:opacity-50 sm:px-4"
        disabled={!isOnline}
        onClick={() => setIsOpen(true)}
        title={isOnline ? 'Ask the agent' : 'Agent unavailable offline'}
        type="button"
      >
        <SparklesIcon aria-hidden="true" className="h-5 w-5" />
        <span className="hidden sm:inline">Agent</span>
      </button>
      <AgentModal isOpen={isOpen} onClose={() => setIsOpen(false)} tripId={tripId} />
    </>
  );
}
