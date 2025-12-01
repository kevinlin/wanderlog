import type { TripData } from '@/types';
import { isValidTripData } from '@/utils/validationUtils';
import { getAllTrips as getAllTripsFromFirestore, getTripById as getTripByIdFromFirestore } from './firebaseService';

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Load all trips from Firestore
 * Returns trips sorted by creation date (newest first)
 *
 * @returns Promise resolving to array of trip data
 * @throws Error if Firestore is unavailable and no fallback exists
 */
export const loadAllTrips = async (): Promise<TripData[]> => {
  try {
    const trips = await getAllTripsFromFirestore();
    console.log(`✓ Loaded ${trips.length} trips from Firestore`);
    return trips;
  } catch (error) {
    console.error('Failed to load trips from Firestore:', error);
    throw new Error('Unable to load trips. Please check your internet connection.');
  }
};

/**
 * Load a specific trip by ID from Firestore
 * Validates the loaded trip data before returning
 *
 * @param tripId - The trip document ID to load
 * @returns Promise resolving to trip data
 * @throws Error if trip not found or invalid
 */
export const loadTripData = async (tripId: string): Promise<TripData> => {
  try {
    const tripData = await getTripByIdFromFirestore(tripId);

    if (!tripData) {
      throw new Error(`Trip not found: ${tripId}`);
    }

    // Validate the trip data
    const validation = validateTripData(tripData);

    if (!validation.isValid) {
      console.error('Invalid trip data:', validation.errors);
      throw new Error(`Invalid trip data: ${validation.errors.join(', ')}`);
    }

    if (validation.warnings.length > 0) {
      console.warn('Trip data warnings:', validation.warnings);
    }

    console.log(`✓ Loaded trip: ${tripData.trip_name}`);
    return tripData;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    console.error('Failed to load trip data:', error);
    throw new Error('Unable to load trip data. Please try again later.');
  }
};

/**
 * Validate trip data structure and contents
 * Checks for required fields and data integrity
 *
 * @param data - The trip data to validate
 * @returns Validation result with errors and warnings
 */
export const validateTripData = (data: unknown): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Use the existing validation utility
  const isValid = isValidTripData(data, errors, warnings);

  return {
    isValid,
    errors,
    warnings,
  };
};
