import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { tripKeys } from '@/lib/queryClient';
import { type CreateTripInput, createTrip, deleteTrip } from '@/services/supabaseService';
import { getCurrentTripId, setCurrentTripId } from '@/services/viewStateStorage';

export function useCreateTrip() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (input: CreateTripInput) => createTrip(input),
    onSuccess: (newTripId) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.all });
      navigate(`/trips/${newTripId}`);
    },
  });
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
