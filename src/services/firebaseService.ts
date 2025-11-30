import {
  collection,
  type DocumentData,
  doc,
  getDoc,
  getDocs,
  orderBy,
  type QueryDocumentSnapshot,
  query,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { getDb } from '../config/firebase';
import type { TripData, UserModifications } from '../types';
import type { WeatherData } from '../types/weather';

// Collection names
const COLLECTIONS = {
  TRIPS: 'trips',
  USER_MODIFICATIONS: 'user_modifications',
  WEATHER_CACHE: 'weather_cache',
} as const;

/**
 * Convert Firestore Timestamp to ISO string
 */
const timestampToISO = (timestamp: Timestamp | undefined): string | undefined => timestamp?.toDate().toISOString();

/**
 * Convert ISO string to Firestore Timestamp
 */
const isoToTimestamp = (iso: string | undefined): Timestamp | undefined => (iso ? Timestamp.fromDate(new Date(iso)) : undefined);

/**
 * Convert Firestore document to TripData
 */
const docToTripData = (docSnap: QueryDocumentSnapshot<DocumentData>): TripData => {
  const data = docSnap.data();
  return {
    ...data,
    trip_id: docSnap.id,
    created_at: timestampToISO(data.created_at),
    updated_at: timestampToISO(data.updated_at),
  } as TripData;
};

// ============================================================================
// Trip Operations
// ============================================================================

/**
 * Get all trips from Firestore
 * Returns trips sorted by created_at descending (newest first)
 *
 * @returns Array of trip data
 * @throws Error if Firestore operation fails
 */
export const getAllTrips = async (): Promise<TripData[]> => {
  try {
    const db = getDb();
    const tripsRef = collection(db, COLLECTIONS.TRIPS);
    const q = query(tripsRef, orderBy('created_at', 'desc'));
    const querySnapshot = await getDocs(q);

    const trips: TripData[] = [];
    querySnapshot.forEach((docSnap) => {
      trips.push(docToTripData(docSnap));
    });

    return trips;
  } catch (error) {
    console.error('Error fetching trips from Firestore:', error);
    throw error;
  }
};

/**
 * Get a specific trip by ID
 *
 * @param tripId - The trip document ID
 * @returns Trip data or null if not found
 */
export const getTripById = async (tripId: string): Promise<TripData | null> => {
  try {
    const db = getDb();
    const tripRef = doc(db, COLLECTIONS.TRIPS, tripId);
    const docSnap = await getDoc(tripRef);

    if (!docSnap.exists()) {
      console.warn(`Trip not found: ${tripId}`);
      return null;
    }

    return docToTripData(docSnap as QueryDocumentSnapshot<DocumentData>);
  } catch (error) {
    console.error(`Error fetching trip ${tripId}:`, error);
    return null;
  }
};

/**
 * Create a new trip in Firestore
 *
 * @param tripData - The trip data to create
 * @param tripId - Optional custom ID (auto-generated if not provided)
 * @returns The created trip ID
 */
export const createTrip = async (tripData: TripData, tripId?: string): Promise<string> => {
  try {
    const db = getDb();
    const id = tripId || doc(collection(db, COLLECTIONS.TRIPS)).id;
    const tripRef = doc(db, COLLECTIONS.TRIPS, id);

    const dataToSave = {
      ...tripData,
      created_at: Timestamp.now(),
      updated_at: Timestamp.now(),
    };

    await setDoc(tripRef, dataToSave);
    console.log(`✓ Trip created: ${id}`);

    return id;
  } catch (error) {
    console.error('Error creating trip:', error);
    throw error;
  }
};

/**
 * Update an existing trip
 *
 * @param tripId - The trip document ID
 * @param updates - Partial trip data to update
 */
export const updateTrip = async (tripId: string, updates: Partial<TripData>): Promise<void> => {
  try {
    const db = getDb();
    const tripRef = doc(db, COLLECTIONS.TRIPS, tripId);

    const dataToUpdate = {
      ...updates,
      updated_at: Timestamp.now(),
    };

    await updateDoc(tripRef, dataToUpdate);
    console.log(`✓ Trip updated: ${tripId}`);
  } catch (error) {
    console.error(`Error updating trip ${tripId}:`, error);
    throw error;
  }
};

// ============================================================================
// User Modifications Operations
// ============================================================================

/**
 * Get user modifications for a specific trip
 *
 * @param tripId - The trip document ID
 * @returns User modifications or empty object if not found
 */
export const getUserModifications = async (tripId: string): Promise<UserModifications> => {
  try {
    const db = getDb();
    const modRef = doc(db, COLLECTIONS.USER_MODIFICATIONS, tripId);
    const docSnap = await getDoc(modRef);

    if (!docSnap.exists()) {
      return {
        activityStatus: {},
        activityOrders: {},
      };
    }

    const data = docSnap.data();
    return {
      activityStatus: data.activityStatus || {},
      activityOrders: data.activityOrders || {},
      lastViewedBase: data.lastViewedBase,
      lastViewedDate: timestampToISO(data.lastViewedDate),
    };
  } catch (error) {
    console.error(`Error fetching user modifications for trip ${tripId}:`, error);
    return {
      activityStatus: {},
      activityOrders: {},
    };
  }
};

/**
 * Save user modifications for a specific trip
 *
 * @param tripId - The trip document ID
 * @param modifications - The user modifications to save
 */
export const saveUserModifications = async (tripId: string, modifications: UserModifications): Promise<void> => {
  try {
    const db = getDb();
    const modRef = doc(db, COLLECTIONS.USER_MODIFICATIONS, tripId);

    const dataToSave = {
      activityStatus: modifications.activityStatus || {},
      activityOrders: modifications.activityOrders || {},
      lastViewedBase: modifications.lastViewedBase,
      lastViewedDate: modifications.lastViewedDate ? isoToTimestamp(modifications.lastViewedDate) : Timestamp.now(),
      updated_at: Timestamp.now(),
    };

    await setDoc(modRef, dataToSave, { merge: true });
  } catch (error) {
    console.error(`Error saving user modifications for trip ${tripId}:`, error);
    throw error;
  }
};

/**
 * Update activity status for a specific trip
 *
 * @param tripId - The trip document ID
 * @param activityId - The activity ID
 * @param done - Whether the activity is done
 */
export const updateActivityStatus = async (tripId: string, activityId: string, done: boolean): Promise<void> => {
  try {
    const db = getDb();
    const modRef = doc(db, COLLECTIONS.USER_MODIFICATIONS, tripId);

    await updateDoc(modRef, {
      [`activityStatus.${activityId}`]: done,
      updated_at: Timestamp.now(),
    });
  } catch (error) {
    console.error(`Error updating activity status for trip ${tripId}:`, error);
    throw error;
  }
};

// ============================================================================
// Weather Cache Operations
// ============================================================================

/**
 * Get cached weather data for a specific base
 *
 * @param tripId - The trip document ID
 * @param baseId - The base/stop ID
 * @returns Cached weather data or null if not found/expired
 */
export const getWeatherCache = async (tripId: string, baseId: string): Promise<WeatherData | null> => {
  try {
    const db = getDb();
    const cacheKey = `${tripId}_${baseId}`;
    const cacheRef = doc(db, COLLECTIONS.WEATHER_CACHE, cacheKey);
    const docSnap = await getDoc(cacheRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();

    // Check if cache is expired
    if (data.expires && data.expires.toMillis() < Date.now()) {
      console.log(`Weather cache expired for ${cacheKey}`);
      return null;
    }

    return data.data as WeatherData;
  } catch (error) {
    console.error(`Error fetching weather cache for ${tripId}_${baseId}:`, error);
    return null;
  }
};

/**
 * Save weather data to cache
 *
 * @param tripId - The trip document ID
 * @param baseId - The base/stop ID
 * @param data - The weather data to cache
 * @param ttlHours - Time to live in hours (default: 6)
 */
export const saveWeatherCache = async (tripId: string, baseId: string, data: WeatherData, ttlHours = 6): Promise<void> => {
  try {
    const db = getDb();
    const cacheKey = `${tripId}_${baseId}`;
    const cacheRef = doc(db, COLLECTIONS.WEATHER_CACHE, cacheKey);

    const now = Timestamp.now();
    const expiresMillis = now.toMillis() + ttlHours * 60 * 60 * 1000;
    const expires = Timestamp.fromMillis(expiresMillis);

    const cacheData = {
      data,
      lastFetched: now,
      expires,
      tripId,
      baseId,
    };

    await setDoc(cacheRef, cacheData);
  } catch (error) {
    console.error(`Error saving weather cache for ${tripId}_${baseId}:`, error);
    throw error;
  }
};

/**
 * Check if weather cache is valid for a specific base
 *
 * @param tripId - The trip document ID
 * @param baseId - The base/stop ID
 * @returns True if cache exists and is not expired
 */
export const isWeatherCacheValid = async (tripId: string, baseId: string): Promise<boolean> => {
  try {
    const db = getDb();
    const cacheKey = `${tripId}_${baseId}`;
    const cacheRef = doc(db, COLLECTIONS.WEATHER_CACHE, cacheKey);
    const docSnap = await getDoc(cacheRef);

    if (!docSnap.exists()) {
      return false;
    }

    const data = docSnap.data();
    return data.expires && data.expires.toMillis() >= Date.now();
  } catch (error) {
    console.error(`Error checking weather cache validity for ${tripId}_${baseId}:`, error);
    return false;
  }
};
