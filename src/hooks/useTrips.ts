import { useQuery } from '@tanstack/react-query';
import type { TripSummary } from '@/contexts/AppStateContext';
import { useAuth } from '@/contexts/AuthContext';
import { tripKeys } from '@/lib/queryClient';
import { fetchTripSummaries } from '@/services/supabaseService';

interface UseTripsReturn {
  error: string | null;
  isLoading: boolean;
  refetch: () => void;
  trips: TripSummary[];
}

// Unwired in the UI until M3 (trip library); kept compiling and tested.
export function useTrips(): UseTripsReturn {
  const { session } = useAuth();
  const query = useQuery({
    queryKey: tripKeys.all,
    queryFn: fetchTripSummaries,
    enabled: Boolean(session),
  });
  return {
    trips: query.data ?? [],
    isLoading: query.isPending,
    error: query.error ? query.error.message : null,
    refetch: query.refetch,
  };
}
