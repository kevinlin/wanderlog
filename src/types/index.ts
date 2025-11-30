// Central export file for all types

export * from './map';
export * from './storage';
export * from './trip';
export * from './weather';

// Common UI types
export interface LoadingState {
  isLoading: boolean;
  error: string | null;
}

export interface WeatherForecast {
  high_c: number;
  low_c: number;
  precipitation_chance_pct: number;
  date: string;
}

// Google Maps types
export interface GoogleMapsConfig {
  apiKey: string;
  libraries: string[];
  mapId?: string;
}

// Export status types
export interface ExportData {
  tripData: import('./trip').TripData;
  exportDate: string;
  version: string;
}
