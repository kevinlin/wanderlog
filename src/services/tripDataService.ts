import { TripData } from '@/types';
import { isValidTripData as isValidTrip } from '@/utils/validationUtils';

/**
 * Loads trip data from the static JSON file
 */
export const loadTripData = async (filename?: string): Promise<TripData> => {
  try {
    const defaultFilename = '202512_NZ_trip-plan.json';
    const tripFile = filename || defaultFilename;
    const response = await fetch(`/wanderlog/trip-data/${tripFile}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Trip data file not found: ${tripFile}`);
      }
      throw new Error(`Failed to load trip data: ${response.status} ${response.statusText}`);
    }
    
    let data: any = await response.json();
    if (data?.tripData) {
      data = data.tripData;
    }

    const details = validateTripData(data);
    if (!details.isValid) {
      console.error('Validation failed. Details:', details);
      throw new Error(`Trip data format is invalid: ${details.errors.join(', ')}`);
    }
    
    return data as TripData;
  } catch (error) {
    console.error('Error loading trip data:', error);
    
    if (error instanceof Error) {
      throw error;
    }
    
    throw new Error('Failed to load trip data. Please check your connection and try again.');
  }
};

/**
 * Validates trip data against expected schema
 * Uses comprehensive validation from validationUtils
 */
export const validateTripData = (data: unknown): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Use the same validation logic as isValidTripData but collect details
  try {
    // Always collect warnings, even for valid data
    if (!data || typeof data !== 'object') {
      errors.push('Data must be a valid JSON object');
      return { isValid: false, errors, warnings };
    }

    const isValid = isValidTrip(data, errors, warnings);

    return {
      isValid,
      errors,
      warnings
    };
  } catch (error) {
    errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return { isValid: false, errors, warnings };
  }
};


/**
 * Calculate travel times for trip data using Google Directions API
 * This function can be called after loading to enhance trip data with route information
 */
export const calculateTravelTimes = async (tripData: TripData): Promise<TripData> => {
  // This would integrate with Google Directions API
  // For now, return the original data (implementation for later tasks)
  console.log('Travel time calculation will be implemented in Map integration tasks');
  return tripData;
};
