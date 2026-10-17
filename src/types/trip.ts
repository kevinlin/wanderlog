// Trip data models for Wanderlog Travel Journal
import type { Coordinates, ScenicWaypoint } from './map';

export interface TripSummary {
  created_at?: string;
  description: string | null;
  destination: string | null;
  end_date: string; // YYYY-MM-DD
  start_date: string; // YYYY-MM-DD
  timezone: string;
  // Only the browser's library select embeds these, so the agent's list_trips
  // output carries no key.
  todos?: TodoWindow[];
  trip_id: string;
  trip_name: string;
  updated_at?: string;
}

export interface TripData {
  constraints?: TripConstraints;
  created_at?: string;
  end_date?: string; // YYYY-MM-DD, from the stored trip row
  start_date?: string; // YYYY-MM-DD, from the stored trip row
  stops: TripBase[];
  timezone: string;
  // Optional: only the browser's detail select embeds them, and a cache
  // persisted before Phase 5 has none.
  todos?: Todo[];
  // Legacy fields for backward compatibility
  travellers?: string[];
  trip_id?: string;
  trip_name: string;
  updated_at?: string;
  vehicle?: string;
}

export interface TripBase {
  accommodation?: Accommodation;
  activities: Activity[];
  date: {
    from: string; // YYYY-MM-DD
    to: string; // YYYY-MM-DD
  };
  duration_days: number;
  location: Coordinates;
  name: string;
  scenic_waypoints?: ScenicWaypoint[];
  stop_id: string;
  travel_time_from_previous?: string;
  // Legacy field for backward compatibility
  weather?: Weather;
}

export interface Accommodation {
  address: string;
  check_in: string; // YYYY-MM-DD HH:mm
  check_out: string; // YYYY-MM-DD HH:mm
  confirmation?: string;
  google_place_id?: string;
  host?: string;
  // Legacy fields for backward compatibility
  location?: Coordinates;
  name: string;
  phone?: string;
  remarks?: string;
  room?: string;
  thumbnail_url?: string;
  url?: string;
}

export interface Todo {
  activity_id?: string;
  done: boolean;
  due_on?: string; // YYYY-MM-DD, trip timezone
  notes?: string;
  opens_on?: string; // YYYY-MM-DD, trip timezone
  stop_id?: string;
  title: string;
  todo_id: string;
  url?: string;
}

// The fields the active count needs; what the library summary carries.
export type TodoWindow = Pick<Todo, 'opens_on' | 'done'>;

export const ActivityType = {
  RESTAURANT: 'restaurant',
  ATTRACTION: 'attraction',
  SHOPPING: 'shopping',
  OUTDOOR: 'outdoor',
  CULTURAL: 'cultural',
  RECREATION: 'recreation',
  SCENIC: 'scenic',
  BEACH: 'beach',
  PLAYGROUND: 'playground',
  GROCERY: 'grocery',
  TRANSPORT: 'transport',
  OTHER: 'other',
} as const;

export type ActivityType = (typeof ActivityType)[keyof typeof ActivityType];

export interface Activity {
  activity_id: string;
  activity_name: string;
  activity_type?: ActivityType;
  duration?: string;
  google_place_id?: string;
  location?: {
    lat?: number;
    lng?: number;
    address?: string;
  };
  order?: number;
  remarks?: string;
  status?: {
    done: boolean;
  };
  thumbnail_url?: string;
  travel_time_from_accommodation?: string;
  url?: string;
  visit_duration_minutes?: number;
  visited_at?: string; // 'YYYY-MM-DD HH:mm' local to the trip timezone
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
  notes: string;
  precipitation_chance_pct: number | null;
}

// TripStop is now just an alias to TripBase for backward compatibility
export type TripStop = TripBase;

export interface TripConstraints {
  exceptions: string[];
  max_daily_driving_hours: string;
  min_nights_per_stop: number;
}

// Legacy TripData interface for backward compatibility
export interface LegacyTripData {
  constraints: TripConstraints;
  stops: TripStop[];
  timezone: string;
  travellers: string[];
  trip_name: string;
  vehicle: string;
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
  selectedActivityId: string | null;
  stopStatus: StopStatus;
}
