import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { tripKeys } from '@/lib/queryClient';
import { deleteTrip, importTrip } from '@/services/supabaseService';
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
