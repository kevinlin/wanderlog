import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { tripKeys } from '@/lib/queryClient';
import { fetchTripById } from '@/services/supabaseService';
import type { TripData } from '@/types';

interface UseTripDataReturn {
  error: string | null;
  isLoading: boolean;
  refetch: () => void;
  tripData: TripData | null;
}

export function useTripData({ tripId }: { tripId: string }): UseTripDataReturn {
  const { session } = useAuth();
  const query = useQuery({
    queryKey: tripKeys.detail(tripId),
    queryFn: () => fetchTripById(tripId),
    enabled: Boolean(session),
  });
  return {
    tripData: query.data ?? null,
    isLoading: query.isPending,
    error: query.error ? query.error.message : null,
    refetch: query.refetch,
  };
}
