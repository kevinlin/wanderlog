import { StopStatus, ActivityStatus, ActivityOrder, UserModifications, WeatherCache } from '@/types';
import * as firebaseService from './firebaseService';

const STORAGE_KEYS = {
  USER_MODIFICATIONS: 'wanderlog_user_modifications',
  WEATHER_CACHE: 'wanderlog_weather_cache',
  STOP_STATUS: 'wanderlog_stop_status', // Legacy - for backward compatibility
  LAST_VIEWED_STOP: 'wanderlog_last_viewed_stop', // Legacy - for backward compatibility
  APP_VERSION: 'wanderlog_app_version',
  CURRENT_TRIP_ID: 'wanderlog_current_trip_id', // NEW: Store current trip ID
} as const;

/**
 * Get stop status from localStorage
 */
export const getStopStatus = (): StopStatus => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.STOP_STATUS);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.warn('Failed to load stop status from localStorage:', error);
    return {};
  }
};

/**
 * Save stop status to localStorage
 */
export const saveStopStatus = (stopStatus: StopStatus): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.STOP_STATUS, JSON.stringify(stopStatus));
  } catch (error) {
    console.warn('Failed to save stop status to localStorage:', error);
  }
};

/**
 * Update activity status for a specific stop
 */
export const updateActivityStatus = (
  stopId: string,
  activityId: string,
  status: ActivityStatus
): void => {
  const stopStatus = getStopStatus();
  
  if (!stopStatus[stopId]) {
    stopStatus[stopId] = {
      activities: {},
      activityOrder: {},
    };
  }
  
  stopStatus[stopId].activities[activityId] = status;
  saveStopStatus(stopStatus);
};

/**
 * Update activity order for a specific stop
 */
export const updateActivityOrder = (
  stopId: string,
  activityOrder: ActivityOrder
): void => {
  const stopStatus = getStopStatus();
  
  if (!stopStatus[stopId]) {
    stopStatus[stopId] = {
      activities: {},
      activityOrder: {},
    };
  }
  
  stopStatus[stopId].activityOrder = activityOrder;
  saveStopStatus(stopStatus);
};

/**
 * Get last viewed stop from localStorage
 */
export const getLastViewedStop = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEYS.LAST_VIEWED_STOP);
  } catch (error) {
    console.warn('Failed to load last viewed stop from localStorage:', error);
    return null;
  }
};

/**
 * Save last viewed stop to localStorage
 */
export const saveLastViewedStop = (stopId: string): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.LAST_VIEWED_STOP, stopId);
  } catch (error) {
    console.warn('Failed to save last viewed stop to localStorage:', error);
  }
};

/**
 * Clear all localStorage data
 */
export const clearStorageData = (): void => {
  try {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  } catch (error) {
    console.warn('Failed to clear localStorage data:', error);
  }
};

/**
 * Check if localStorage is available
 */
export const isStorageAvailable = (): boolean => {
  try {
    const test = '__localStorage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
};

// ============================================================================
// Current Trip ID Management
// ============================================================================

/**
 * Get the current trip ID from localStorage
 */
export const getCurrentTripId = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEYS.CURRENT_TRIP_ID);
  } catch (error) {
    console.warn('Failed to load current trip ID from localStorage:', error);
    return null;
  }
};

/**
 * Set the current trip ID in localStorage
 */
export const setCurrentTripId = (tripId: string): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.CURRENT_TRIP_ID, tripId);
  } catch (error) {
    console.warn('Failed to save current trip ID to localStorage:', error);
  }
};

// ============================================================================
// New UserModifications-based API with Firestore Dual-Write
// ============================================================================

/**
 * Get user modifications from localStorage (local-only, synchronous)
 * This is used as a fallback when Firestore is unavailable
 */
const getUserModificationsLocal = (): UserModifications => {
  try {
    const tripId = getCurrentTripId();
    if (!tripId) {
      return { activityStatus: {}, activityOrders: {} };
    }

    const key = `${STORAGE_KEYS.USER_MODIFICATIONS}_${tripId}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }

    // Migration: convert legacy StopStatus to UserModifications format
    const legacyStopStatus = getStopStatus();
    if (Object.keys(legacyStopStatus).length > 0) {
      const userMods = migrateStopStatusToUserModifications(legacyStopStatus);
      saveUserModificationsLocal(userMods);
      return userMods;
    }

    return {
      activityStatus: {},
      activityOrders: {},
    };
  } catch (error) {
    console.warn('Failed to load user modifications from localStorage:', error);
    return {
      activityStatus: {},
      activityOrders: {},
    };
  }
};

/**
 * Save user modifications to localStorage only (synchronous)
 */
const saveUserModificationsLocal = (modifications: UserModifications): void => {
  try {
    const tripId = getCurrentTripId();
    if (!tripId) {
      console.warn('No current trip ID, cannot save user modifications locally');
      return;
    }

    const key = `${STORAGE_KEYS.USER_MODIFICATIONS}_${tripId}`;
    localStorage.setItem(key, JSON.stringify(modifications));
  } catch (error) {
    console.warn('Failed to save user modifications to localStorage:', error);
  }
};

/**
 * Get user modifications from Firestore (with localStorage fallback)
 * DUAL-READ: Tries Firestore first, falls back to localStorage
 *
 * @param tripId - The trip ID to get modifications for
 * @returns Promise resolving to user modifications
 */
export const getUserModifications = async (tripId: string): Promise<UserModifications> => {
  try {
    // Try Firestore first
    const firestoreMods = await firebaseService.getUserModifications(tripId);

    // Cache in localStorage for offline access
    const key = `${STORAGE_KEYS.USER_MODIFICATIONS}_${tripId}`;
    localStorage.setItem(key, JSON.stringify(firestoreMods));

    return firestoreMods;
  } catch (error) {
    console.warn('Firestore unavailable, using localStorage fallback:', error);

    // Fallback to localStorage
    setCurrentTripId(tripId); // Temporarily set for local read
    const localMods = getUserModificationsLocal();
    return localMods;
  }
};

/**
 * Save user modifications with Firestore dual-write
 * DUAL-WRITE: Writes to both Firestore and localStorage
 *
 * @param tripId - The trip ID to save modifications for
 * @param modifications - The modifications to save
 */
export const saveUserModifications = async (
  tripId: string,
  modifications: UserModifications
): Promise<void> => {
  // Always save to localStorage first (immediate, synchronous)
  try {
    const key = `${STORAGE_KEYS.USER_MODIFICATIONS}_${tripId}`;
    localStorage.setItem(key, JSON.stringify(modifications));
  } catch (error) {
    console.warn('Failed to save user modifications to localStorage:', error);
  }

  // Then try to sync to Firestore (may fail offline)
  try {
    await firebaseService.saveUserModifications(tripId, modifications);
  } catch (error) {
    console.warn('Failed to sync user modifications to Firestore (will retry later):', error);
    // TODO: Queue for retry when back online
  }
};

/**
 * Update activity status in user modifications
 *
 * @param tripId - The trip ID
 * @param activityId - The activity ID
 * @param done - Whether the activity is done
 */
export const updateActivityDoneStatus = async (
  tripId: string,
  activityId: string,
  done: boolean
): Promise<void> => {
  const modifications = await getUserModifications(tripId);
  modifications.activityStatus[activityId] = done;
  await saveUserModifications(tripId, modifications);
};

/**
 * Update activity order for a base
 *
 * @param tripId - The trip ID
 * @param baseId - The base/stop ID
 * @param activityIds - Ordered array of activity IDs
 */
export const updateActivityOrderForBase = async (
  tripId: string,
  baseId: string,
  activityIds: string[]
): Promise<void> => {
  const modifications = await getUserModifications(tripId);
  modifications.activityOrders[baseId] = activityIds.map((_, index) => index);
  await saveUserModifications(tripId, modifications);
};

/**
 * Set last viewed base
 *
 * @param tripId - The trip ID
 * @param baseId - The base/stop ID
 */
export const setLastViewedBase = async (tripId: string, baseId: string): Promise<void> => {
  const modifications = await getUserModifications(tripId);
  modifications.lastViewedBase = baseId;
  modifications.lastViewedDate = new Date().toISOString();
  await saveUserModifications(tripId, modifications);
};

/**
 * Get weather cache from localStorage
 */
export const getWeatherCache = (): WeatherCache => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.WEATHER_CACHE);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.warn('Failed to load weather cache from localStorage:', error);
    return {};
  }
};

/**
 * Save weather cache to localStorage
 */
export const saveWeatherCache = (cache: WeatherCache): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.WEATHER_CACHE, JSON.stringify(cache));
  } catch (error) {
    console.warn('Failed to save weather cache to localStorage:', error);
  }
};

/**
 * Update weather data for a specific base
 */
export const updateWeatherForBase = (baseId: string, weatherData: import('@/types').WeatherData, cacheExpirationHours: number = 6): void => {
  const cache = getWeatherCache();
  const now = Date.now();
  
  cache[baseId] = {
    data: weatherData,
    lastFetched: now,
    expires: now + (cacheExpirationHours * 60 * 60 * 1000),
  };
  
  saveWeatherCache(cache);
};

/**
 * Check if weather data is cached and not expired
 */
export const isWeatherCacheValid = (baseId: string): boolean => {
  const cache = getWeatherCache();
  const cacheEntry = cache[baseId];
  
  if (!cacheEntry) {
    return false;
  }
  
  return Date.now() < cacheEntry.expires;
};

/**
 * Get cached weather data if valid
 */
export const getCachedWeather = (baseId: string): import('@/types').WeatherData | null => {
  if (!isWeatherCacheValid(baseId)) {
    return null;
  }
  
  const cache = getWeatherCache();
  return cache[baseId]?.data || null;
};

/**
 * Migration helper: convert legacy StopStatus to UserModifications format
 */
const migrateStopStatusToUserModifications = (stopStatus: StopStatus): UserModifications => {
  const userModifications: UserModifications = {
    activityStatus: {},
    activityOrders: {},
  };
  
  Object.entries(stopStatus).forEach(([stopId, stopData]) => {
    // Migrate activity status
    Object.entries(stopData.activities).forEach(([activityId, status]) => {
      userModifications.activityStatus[activityId] = status.done;
    });
    
    // Migrate activity order
    const orderEntries = Object.entries(stopData.activityOrder);
    if (orderEntries.length > 0) {
      userModifications.activityOrders[stopId] = orderEntries.map(([, order]) => order);
    }
  });
  
  // Migrate last viewed stop
  const lastViewed = getLastViewedStop();
  if (lastViewed) {
    userModifications.lastViewedBase = lastViewed;
  }
  
  return userModifications;
};
