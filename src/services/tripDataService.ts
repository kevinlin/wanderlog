import { TripData } from '@/types';

/**
 * Loads trip data from the static JSON file
 */
export const loadTripData = async (): Promise<TripData> => {
  try {
    const response = await fetch('/wanderlog/trip-data/202512_NZ_trip-plan.json');
    
    if (!response.ok) {
      throw new Error(`Failed to load trip data: ${response.status}`);
    }
    
    const data: TripData = await response.json();
    return data;
  } catch (error) {
    console.error('Error loading trip data:', error);
    throw new Error('Failed to load trip data. Please check your connection and try again.');
  }
};

/**
 * Validates trip data against expected schema
 */
export const validateTripData = (data: unknown): data is TripData => {
  if (!data || typeof data !== 'object') {
    return false;
  }
  
  const d = data as Record<string, unknown>;
  
  return (
    typeof d.trip_name === 'string' &&
    typeof d.timezone === 'string' &&
    Array.isArray(d.travellers) &&
    Array.isArray(d.stops) &&
    d.stops.every((stop: unknown) => {
      const s = stop as Record<string, unknown>;
      return s.stop_id && 
        s.name && 
        s.location && 
        s.date &&
        Array.isArray(s.activities);
    })
  );
};
