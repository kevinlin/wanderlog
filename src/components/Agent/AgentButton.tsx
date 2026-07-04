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
        className="flex items-center gap-1.5 rounded-xl bg-alpine-teal px-4 py-2 font-medium text-white shadow-xs transition-colors hover:bg-alpine-teal/90 disabled:opacity-50"
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
