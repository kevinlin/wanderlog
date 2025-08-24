import { StopStatus, ActivityStatus, ActivityOrder } from '@/types';

const STORAGE_KEYS = {
  STOP_STATUS: 'wanderlog_stop_status',
  LAST_VIEWED_STOP: 'wanderlog_last_viewed_stop',
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
