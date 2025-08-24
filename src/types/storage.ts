// Storage-related types for Wanderlog Travel Journal

export interface UserModifications {
  activityStatus: Record<string, boolean>; // activityId -> done status
  activityOrders: Record<string, number[]>; // baseId -> ordered activity indices
  lastViewedBase?: string;
  lastViewedDate?: string;
}

export interface StorageKeys {
  USER_MODIFICATIONS: string;
  WEATHER_CACHE: string;
  LAST_VIEWED_BASE: string;
}

export interface StorageService {
  getUserModifications(): UserModifications;
  saveUserModifications(modifications: UserModifications): void;
  getWeatherCache(): import('./weather').WeatherCache;
  saveWeatherCache(cache: import('./weather').WeatherCache): void;
  isAvailable(): boolean;
  clear(): void;
}

export interface ExportData {
  originalData: import('./trip').TripData;
  userModifications: UserModifications;
  exportDate: string;
  version: string;
}
