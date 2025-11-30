// Map-related types for Wanderlog Travel Journal

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface ScenicWaypoint {
  activity_id: string;
  activity_name: string;
  location: {
    lat?: number;
    lng?: number;
    address?: string;
  };
  duration?: string;
  url?: string;
  remarks?: string;
  thumbnail_url?: string | null;
  google_place_id?: string;
  status?: {
    done: boolean;
  };
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
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
  position: Coordinates;
  title: string;
  onClick?: () => void;
  style?: PinStyle;
  isSelected?: boolean;
}
