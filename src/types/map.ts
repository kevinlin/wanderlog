// Map-related types for Wanderlog Travel Journal

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface ScenicWaypoint {
  activity_id: string;
  activity_name: string;
  duration?: string;
  google_place_id?: string;
  location: {
    lat?: number;
    lng?: number;
    address?: string;
  };
  order?: number;
  remarks?: string;
  status?: {
    done: boolean;
  };
  thumbnail_url?: string | null;
  url?: string;
  visit_duration_minutes?: number;
  visited_at?: string; // 'YYYY-MM-DD HH:mm' local to the trip timezone
}

export interface MapBounds {
  east: number;
  north: number;
  south: number;
  west: number;
}

export interface RouteSegment {
  from: Coordinates;
  to: Coordinates;
  waypoints: ScenicWaypoint[];
}

export interface MapStyleConfig {
  styles: google.maps.MapTypeStyle[];
}

export interface PinStyle {
  color: string;
  opacity: number;
  scale: number;
}

export interface MapPinProps {
  isSelected?: boolean;
  onClick?: () => void;
  position: Coordinates;
  style?: PinStyle;
  title: string;
}
