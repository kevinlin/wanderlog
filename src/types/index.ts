// Central export file for all types

export * from './map';
export * from './trip';
export * from './weather';

// Common UI types
export interface LoadingState {
  error: string | null;
  isLoading: boolean;
}

export interface WeatherForecast {
  date: string;
  high_c: number;
  low_c: number;
  precipitation_chance_pct: number;
}

// Google Maps types
export interface GoogleMapsConfig {
  apiKey: string;
  libraries: string[];
  mapId?: string;
}

// Export status types
export interface ExportData {
  exportDate: string;
  tripData: import('./trip').TripData;
  version: string;
}
