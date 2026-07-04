import { type UseMutationResult, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useToast } from '@/components/Layout/Toast';
import { tripKeys } from '@/lib/queryClient';
import { deleteTrip, importTrip, type TripMetadataPatch, updateTripMetadata } from '@/services/supabaseService';
import { getCurrentTripId, setCurrentTripId } from '@/services/viewStateStorage';
import type { TripData } from '@/types/trip';

export function useImportTrip() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (tripData: TripData) => importTrip(tripData),
    onSuccess: (newTripId) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.all });
      navigate(`/trips/${newTripId}`);
    },
  });
}

interface UpdateTripMetadataVariables {
  patch: TripMetadataPatch;
  tripId: string;
}

// No optimistic cache patch - metadata edits are low-frequency, so pending
// state on the modal plus invalidation on success is enough (both the library
// list and the open trip reflect the change).
export function useUpdateTripMetadata(): UseMutationResult<void, Error, UpdateTripMetadataVariables> {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const mutation: UseMutationResult<void, Error, UpdateTripMetadataVariables> = useMutation({
    mutationFn: ({ tripId, patch }: UpdateTripMetadataVariables) => updateTripMetadata(tripId, patch),
    onSuccess: (_data, { tripId }) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.all });
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(tripId) });
    },
    onError: (_error, vars) => {
      showToast({
        message: 'Could not save the trip details',
        type: 'error',
        action: { label: 'Retry', onClick: () => mutation.mutate(vars) },
      });
    },
  });
  return mutation;
}

export function useDeleteTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tripId: string) => deleteTrip(tripId),
    onSuccess: (_data, tripId) => {
      queryClient.removeQueries({ queryKey: tripKeys.detail(tripId) });
      queryClient.invalidateQueries({ queryKey: tripKeys.all });
      if (getCurrentTripId() === tripId) {
        setCurrentTripId(null);
      }
    },
  });
}
