// Trip data models for Wanderlog Travel Journal
import type { Coordinates, ScenicWaypoint } from './map';

export interface TripData {
  trip_id?: string;
  trip_name: string;
  timezone: string;
  stops: TripBase[];
  created_at?: string;
  updated_at?: string;
  // Legacy fields for backward compatibility
  travellers?: string[];
  vehicle?: string;
  constraints?: TripConstraints;
}

export interface TripBase {
  stop_id: string;
  name: string;
  date: {
    from: string; // YYYY-MM-DD
    to: string; // YYYY-MM-DD
  };
  location: Coordinates;
  duration_days: number;
  travel_time_from_previous?: string;
  scenic_waypoints?: ScenicWaypoint[];
  accommodation?: Accommodation;
  activities: Activity[];
  // Legacy field for backward compatibility
  weather?: Weather;
}

export interface Accommodation {
  name: string;
  address: string;
  check_in: string; // YYYY-MM-DD HH:mm
  check_out: string; // YYYY-MM-DD HH:mm
  confirmation?: string;
  url?: string;
  thumbnail_url?: string;
  google_place_id?: string;
  // Legacy fields for backward compatibility
  location?: Coordinates;
  room?: string;
  phone?: string;
  host?: string;
  rooms?: string;
}

export const ActivityType = {
  RESTAURANT: 'restaurant',
  ATTRACTION: 'attraction',
  SHOPPING: 'shopping',
  OUTDOOR: 'outdoor',
  CULTURAL: 'cultural',
  TRANSPORT: 'transport',
  OTHER: 'other',
} as const;

export type ActivityType = (typeof ActivityType)[keyof typeof ActivityType];

export interface Activity {
  activity_id: string;
  activity_name: string;
  activity_type?: ActivityType;
  location?: {
    lat?: number;
    lng?: number;
    address?: string;
  };
  duration?: string;
  travel_time_from_accommodation?: string;
  url?: string;
  remarks?: string;
  thumbnail_url?: string;
  google_place_id?: string;
  order?: number;
  status?: {
    done: boolean;
  };
}

// Legacy interface mappings for backward compatibility
export interface Location extends Coordinates {
  address?: string;
}

export interface DateRange {
  from: string; // YYYY-MM-DD format
  to: string; // YYYY-MM-DD format
}

export interface ActivityStatus {
  done: boolean;
}

export interface Weather {
  forecast_high_c: number | null;
  forecast_low_c: number | null;
  precipitation_chance_pct: number | null;
  notes: string;
}

// TripStop is now just an alias to TripBase for backward compatibility
export type TripStop = TripBase;

export interface TripConstraints {
  max_daily_driving_hours: string;
  min_nights_per_stop: number;
  exceptions: string[];
}

// Legacy TripData interface for backward compatibility
export interface LegacyTripData {
  trip_name: string;
  timezone: string;
  travellers: string[];
  vehicle: string;
  constraints: TripConstraints;
  stops: TripStop[];
}

// UI State Types
export interface ActivityOrder {
  [activityId: string]: number;
}

export interface StopStatus {
  [stopId: string]: {
    activities: {
      [activityId: string]: ActivityStatus;
    };
    activityOrder: ActivityOrder;
  };
}

export interface AppState {
  currentStopId: string;
  stopStatus: StopStatus;
  selectedActivityId: string | null;
}
