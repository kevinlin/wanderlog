// Map-related types for Wanderlog Travel Journal

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface ScenicWaypoint {
  lat: number;
  lng: number;
  label: string;
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
