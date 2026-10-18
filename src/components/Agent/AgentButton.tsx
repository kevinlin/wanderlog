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
      <button
        className="flex min-h-11 items-center gap-1.5 rounded-xl bg-alpine-teal-deep px-4 py-2 font-medium text-white shadow-xs transition-colors hover:bg-alpine-teal-deep/90 focus-visible:outline-2 focus-visible:outline-alpine-teal focus-visible:outline-offset-2 disabled:opacity-50"
        disabled={!isOnline}
        onClick={() => setIsOpen(true)}
        title={isOnline ? 'Ask the agent' : 'Agent unavailable offline'}
        type="button"
      >
        <SparklesIcon className="h-4 w-4" />
        Agent
      </button>
      <AgentModal isOpen={isOpen} onClose={() => setIsOpen(false)} tripId={tripId} />
    </>
  );
}
