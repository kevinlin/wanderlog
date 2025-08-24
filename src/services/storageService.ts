import { StopStatus, ActivityStatus, ActivityOrder, UserModifications, WeatherCache } from '@/types';

const STORAGE_KEYS = {
  USER_MODIFICATIONS: 'wanderlog_user_modifications',
  WEATHER_CACHE: 'wanderlog_weather_cache',
  STOP_STATUS: 'wanderlog_stop_status', // Legacy - for backward compatibility
  LAST_VIEWED_STOP: 'wanderlog_last_viewed_stop', // Legacy - for backward compatibility
  APP_VERSION: 'wanderlog_app_version',
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

// New UserModifications-based API (aligns with design specification)

/**
 * Get user modifications from localStorage
 */
export const getUserModifications = (): UserModifications => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.USER_MODIFICATIONS);
    if (stored) {
      return JSON.parse(stored);
    }
    
    // Migration: convert legacy StopStatus to UserModifications format
    const legacyStopStatus = getStopStatus();
    if (Object.keys(legacyStopStatus).length > 0) {
      const userMods = migrateStopStatusToUserModifications(legacyStopStatus);
      saveUserModifications(userMods);
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
 * Save user modifications to localStorage
 */
export const saveUserModifications = (modifications: UserModifications): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.USER_MODIFICATIONS, JSON.stringify(modifications));
  } catch (error) {
    console.warn('Failed to save user modifications to localStorage:', error);
  }
};

/**
 * Update activity status in user modifications
 */
export const updateActivityDoneStatus = (activityId: string, done: boolean): void => {
  const modifications = getUserModifications();
  modifications.activityStatus[activityId] = done;
  saveUserModifications(modifications);
};

/**
 * Update activity order for a base
 */
export const updateActivityOrderForBase = (baseId: string, activityIds: string[]): void => {
  const modifications = getUserModifications();
  modifications.activityOrders[baseId] = activityIds.map((_, index) => index);
  saveUserModifications(modifications);
};

/**
 * Set last viewed base
 */
export const setLastViewedBase = (baseId: string): void => {
  const modifications = getUserModifications();
  modifications.lastViewedBase = baseId;
  modifications.lastViewedDate = new Date().toISOString();
  saveUserModifications(modifications);
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
