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
export const validateTripData = (data: any): data is TripData => {
  return (
    data &&
    typeof data.trip_name === 'string' &&
    typeof data.timezone === 'string' &&
    Array.isArray(data.travellers) &&
    Array.isArray(data.stops) &&
    data.stops.every((stop: any) => 
      stop.stop_id && 
      stop.name && 
      stop.location && 
      stop.date &&
      Array.isArray(stop.activities)
    )
  );
};
