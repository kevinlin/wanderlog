import { type MutationScope, type NetworkMode, type UseMutationResult, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/Layout/Toast';
import { tripKeys } from '@/lib/queryClient';
import type { TripData } from '@/types/trip';

interface TripCacheMutationOptions<TVars, TResult> {
  errorMessage: string;
  // Also invalidates the library list on settle, for writes that change what a
  // library card shows (the todo count).
  invalidateLibrary?: boolean;
  mutationFn: (vars: TVars) => Promise<TResult>;
  // Passed through to useMutation. Left unset, a write made offline is paused.
  networkMode?: NetworkMode;
  // Pure cache patch applied optimistically in onMutate (receives a fresh clone)
  patch: (trip: TripData, vars: TVars) => TripData;
  // Passed through to useMutation: writes sharing a scope id run one at a time, in order.
  scope?: MutationScope;
  tripId: string;
}

interface MutationContext {
  previous: TripData | undefined;
}

// Shared optimistic-write pattern: cancel in-flight reads, snapshot the cache,
// patch it, roll back + retry toast on error, invalidate on settle.
export function useTripCacheMutation<TVars, TResult = void>({
  tripId,
  mutationFn,
  patch,
  errorMessage,
  invalidateLibrary,
  networkMode,
  scope,
}: TripCacheMutationOptions<TVars, TResult>): UseMutationResult<TResult, Error, TVars, MutationContext> {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const mutation: UseMutationResult<TResult, Error, TVars, MutationContext> = useMutation({
    mutationFn,
    // Spread only when set: an explicit undefined would override any
    // QueryClient-level default, and callers that pass neither must see no change.
    ...(networkMode ? { networkMode } : {}),
    ...(scope ? { scope } : {}),
    onMutate: async (vars: TVars) => {
      await queryClient.cancelQueries({ queryKey: tripKeys.detail(tripId) });
      const previous = queryClient.getQueryData<TripData>(tripKeys.detail(tripId));
      queryClient.setQueryData<TripData>(tripKeys.detail(tripId), (old) => (old ? patch(structuredClone(old), vars) : old));
      return { previous };
    },
    onError: (_error, vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(tripKeys.detail(tripId), context.previous);
      }
      showToast({
        message: errorMessage,
        type: 'error',
        action: { label: 'Retry', onClick: () => mutation.mutate(vars) },
      });
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: tripKeys.detail(tripId) }),
        invalidateLibrary ? queryClient.invalidateQueries({ queryKey: tripKeys.all }) : undefined,
      ]),
  });
  return mutation;
}
