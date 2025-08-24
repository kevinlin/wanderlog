import { useState, useEffect } from 'react';
import { TripData, LoadingState } from '@/types';
import { loadTripData } from '@/services/tripDataService';

interface UseTripDataReturn extends LoadingState {
  tripData: TripData | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to load and manage trip data
 */
export const useTripData = (): UseTripDataReturn => {
  const [tripData, setTripData] = useState<TripData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTripData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const data = await loadTripData();
      
      setTripData(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Failed to load trip data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTripData();
  }, []);

  return {
    tripData,
    isLoading,
    error,
    refetch: fetchTripData,
  };
};
