import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { tripKeys } from '@/lib/queryClient';
import { type CreateTripInput, createTrip } from '@/services/supabaseService';

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
