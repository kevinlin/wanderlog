// Storage-related types for Wanderlog Travel Journal

export interface UserModifications {
  activityOrders: Record<string, number[]>; // baseId -> ordered activity indices
  activityStatus: Record<string, boolean>; // activityId -> done status
  lastViewedBase?: string;
  lastViewedDate?: string;
}

export interface StorageKeys {
  LAST_VIEWED_BASE: string;
  USER_MODIFICATIONS: string;
  WEATHER_CACHE: string;
}

export interface StorageService {
  clear(): void;
  getUserModifications(): UserModifications;
  getWeatherCache(): import('./weather').WeatherCache;
  isAvailable(): boolean;
  saveUserModifications(modifications: UserModifications): void;
  saveWeatherCache(cache: import('./weather').WeatherCache): void;
}

export interface ExportData {
  exportDate: string;
  originalData: import('./trip').TripData;
  userModifications: UserModifications;
  version: string;
}
