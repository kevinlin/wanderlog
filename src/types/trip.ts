export interface Location {
  lat: number;
  lng: number;
  address?: string;
}

export interface DateRange {
  from: string; // YYYY-MM-DD format
  to: string;   // YYYY-MM-DD format
}

export interface ScenicWaypoint {
  lat: number;
  lng: number;
  label: string;
}

export interface Accommodation {
  name: string;
  address: string;
  check_in: string;    // YYYY-MM-DD hh:mm format
  check_out: string;   // YYYY-MM-DD hh:mm format
  confirmation: string;
  url: string;
  thumbnail_url: string | null;
  location?: Location;
  room?: string;
  phone?: string;
  host?: string;
  rooms?: string;
  google_place_id?: string | null;
}

export interface ActivityStatus {
  done: boolean;
}

export interface Activity {
  activity_id: string;
  order: number;
  manual_order: number;
  status: ActivityStatus;
  activity_name: string;
  location: Location;
  travel_time_from_accommodation: string;
  duration: string;
  url: string;
  remarks: string;
  thumbnail_url: string | null;
  google_place_id?: string | null;
}

export interface Weather {
  forecast_high_c: number | null;
  forecast_low_c: number | null;
  precipitation_chance_pct: number | null;
  notes: string;
}

export interface TripStop {
  stop_id: string;
  name: string;
  location: Location;
  date: DateRange;
  duration_days: number;
  travel_time_from_previous: string | null;
  scenic_waypoints: ScenicWaypoint[];
  accommodation: Accommodation;
  weather: Weather;
  activities: Activity[];
}

export interface TripConstraints {
  max_daily_driving_hours: string;
  min_nights_per_stop: number;
  exceptions: string[];
}

export interface TripData {
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

// Map-related types
export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface RouteSegment {
  from: Location;
  to: Location;
  waypoints: ScenicWaypoint[];
}
