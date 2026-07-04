import { XMarkIcon } from '@heroicons/react/24/outline';
import { useQueryClient } from '@tanstack/react-query';
import { type ReactElement, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@/contexts/AuthContext';
import { tripKeys } from '@/lib/queryClient';
import { runAgent } from '@/services/agentService';
import type { AgentChangeEvent, AgentErrorEvent, AgentResultEvent } from '@/types/agent';

interface AgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId?: string;
}

const EXAMPLE_PROMPTS = ['Which trips do we have coming up?', 'Which activities are not done yet?'];

const ENTITY_ORDER = ['trip', 'stop', 'accommodation', 'activity', 'waypoint'] as const;
const ENTITY_LABELS: Record<AgentChangeEvent['entity'], string> = {
  trip: 'Trip',
  stop: 'Stops',
  accommodation: 'Accommodation',
  activity: 'Activities',
  waypoint: 'Scenic waypoints',
};
const OP_LABELS: Record<AgentChangeEvent['op'], string> = {
  created: 'Added',
  updated: 'Updated',
  deleted: 'Deleted',
};

export function AgentModal({ isOpen, onClose, tripId }: AgentModalProps): ReactElement | null {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState('');
  const [phase, setPhase] = useState<'done' | 'input' | 'running'>('input');
  const [lines, setLines] = useState<string[]>([]);
  const [changes, setChanges] = useState<AgentChangeEvent[]>([]);
  const [result, setResult] = useState<AgentResultEvent | null>(null);
  const [errors, setErrors] = useState<AgentErrorEvent[]>([]);
  const [requestError, setRequestError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  if (!isOpen) {
    return null;
  }

  const reset = (): void => {
    setPrompt('');
    setPhase('input');
    setLines([]);
    setChanges([]);
    setResult(null);
    setErrors([]);
    setRequestError(null);
  };

  const handleClose = (): void => {
    abortRef.current?.abort();
    reset();
    onClose();
  };

  const handleBackdropClick = (event: React.MouseEvent): void => {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  };

  const handleSubmit = async (): Promise<void> => {
    if (!(prompt.trim() && session)) {
      return;
    }
    setPhase('running');
    setLines([]);
    setChanges([]);
    setErrors([]);
    setRequestError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await runAgent({
        accessToken: session.access_token,
        prompt: prompt.trim(),
        tripId,
        signal: controller.signal,
        onEvent: (event) => {
          if (event.type === 'progress') {
            setLines((prev) => [...prev, event.message]);
          } else if (event.type === 'error') {
            setErrors((prev) => [...prev, event]);
          } else if (event.type === 'change') {
            setChanges((prev) => [...prev, event]);
            setLines((prev) => [...prev, `${event.op}: ${event.name}`]);
          } else {
            setResult(event);
          }
        },
      });
      queryClient.invalidateQueries({ queryKey: tripKeys.all });
      if (tripId) {
        queryClient.invalidateQueries({ queryKey: tripKeys.detail(tripId) });
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setRequestError(error instanceof Error ? error.message : 'Something went wrong');
      }
    }
    setPhase('done');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={handleBackdropClick}>
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-gray-200 border-b px-6 py-4">
          <h2 className="font-bold text-gray-900 text-xl">Trip agent</h2>
          <button
            aria-label="Close"
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            onClick={handleClose}
            type="button"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-6">
          {phase === 'input' && (
            <>
              <textarea
                aria-label="Agent prompt"
                className="min-h-24 w-full resize-y rounded-lg border border-gray-300 p-3 text-sm focus:border-alpine-teal focus:outline-hidden focus:ring-1 focus:ring-alpine-teal"
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Ask about your trips…"
                value={prompt}
              />
              <p className="text-gray-500 text-xs">
                Try: “{EXAMPLE_PROMPTS[0]}” or “{EXAMPLE_PROMPTS[1]}”
              </p>
              <div className="flex justify-end">
                <button
                  className="rounded-lg bg-alpine-teal px-4 py-2 font-medium text-white transition-colors hover:bg-alpine-teal/90 disabled:opacity-50"
                  disabled={!prompt.trim()}
                  onClick={handleSubmit}
                  type="button"
                >
                  Ask agent
                </button>
              </div>
            </>
          )}

          {phase === 'running' && (
            <>
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-alpine-teal border-t-transparent" />
                Working on it…
              </div>
              {lines.length > 0 && (
                <ul className="flex flex-col gap-1 text-gray-600 text-sm">
                  {lines.map((line, index) => (
                    <li key={`${index}-${line}`}>{line}</li>
                  ))}
                </ul>
              )}
              <div className="flex justify-end">
                <button
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50"
                  onClick={() => abortRef.current?.abort()}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </>
          )}

          {phase === 'done' && (
            <>
              {lines.length > 0 && (
                <ul className="flex flex-col gap-1 text-gray-400 text-xs">
                  {lines.map((line, index) => (
                    <li key={`${index}-${line}`}>{line}</li>
                  ))}
                </ul>
              )}
              {result?.answer && <p className="whitespace-pre-wrap text-gray-800 text-sm">{result.answer}</p>}
              {changes.length > 0 && (
                <div>
                  <h3 className="font-medium text-gray-700 text-sm">Changes</h3>
                  {ENTITY_ORDER.map((entity) => {
                    const group = changes.filter((change) => change.entity === entity);
                    if (group.length === 0) {
                      return null;
                    }
                    return (
                      <div className="mt-2" key={entity}>
                        <h4 className="text-gray-500 text-xs uppercase">{ENTITY_LABELS[entity]}</h4>
                        <ul className="mt-1 space-y-1 text-gray-800 text-sm">
                          {group.map((change, index) => (
                            <li key={`${change.id}-${index}`}>
                              {OP_LABELS[change.op]}: {change.name}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}
              {errors.map((error) => (
                <p className="text-red-600 text-sm" key={error.message}>
                  {error.message}
                </p>
              ))}
              {requestError && <p className="text-red-600 text-sm">{requestError}</p>}
              <div className="flex justify-end gap-3">
                {result?.tripId && (
                  <button
                    className="rounded-lg bg-alpine-teal px-4 py-2 font-medium text-white transition-colors hover:bg-alpine-teal/90"
                    onClick={() => {
                      const target = result.tripId;
                      handleClose();
                      navigate(`/trips/${target}`);
                    }}
                    type="button"
                  >
                    Open trip
                  </button>
                )}
                <button
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50"
                  onClick={reset}
                  type="button"
                >
                  Ask another
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
