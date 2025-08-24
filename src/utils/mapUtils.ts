// Map utilities for Wanderlog Travel Journal
import { Coordinates, ScenicWaypoint } from '@/types';

/**
 * Calculate the distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
export const calculateDistance = (
  coord1: Coordinates,
  coord2: Coordinates
): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(coord2.lat - coord1.lat);
  const dLng = toRadians(coord2.lng - coord1.lng);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(coord1.lat)) * Math.cos(toRadians(coord2.lat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
};

/**
 * Convert degrees to radians
 */
export const toRadians = (degrees: number): number => {
  return degrees * (Math.PI / 180);
};

/**
 * Convert radians to degrees
 */
export const toDegrees = (radians: number): number => {
  return radians * (180 / Math.PI);
};

/**
 * Calculate the center point (centroid) of multiple coordinates
 */
export const calculateCentroid = (coordinates: Coordinates[]): Coordinates => {
  if (coordinates.length === 0) {
    throw new Error('Cannot calculate centroid of empty coordinates array');
  }
  
  if (coordinates.length === 1) {
    return coordinates[0];
  }
  
  const sum = coordinates.reduce(
    (acc, coord) => ({
      lat: acc.lat + coord.lat,
      lng: acc.lng + coord.lng,
    }),
    { lat: 0, lng: 0 }
  );
  
  return {
    lat: sum.lat / coordinates.length,
    lng: sum.lng / coordinates.length,
  };
};

/**
 * Calculate bounding box for a set of coordinates
 */
export const calculateBounds = (
  coordinates: Coordinates[]
): {
  north: number;
  south: number;
  east: number;
  west: number;
} => {
  if (coordinates.length === 0) {
    throw new Error('Cannot calculate bounds of empty coordinates array');
  }
  
  let north = coordinates[0].lat;
  let south = coordinates[0].lat;
  let east = coordinates[0].lng;
  let west = coordinates[0].lng;
  
  coordinates.forEach(coord => {
    north = Math.max(north, coord.lat);
    south = Math.min(south, coord.lat);
    east = Math.max(east, coord.lng);
    west = Math.min(west, coord.lng);
  });
  
  return { north, south, east, west };
};

/**
 * Calculate the bearing (compass direction) from one point to another
 * Returns bearing in degrees (0-360)
 */
export const calculateBearing = (
  start: Coordinates,
  end: Coordinates
): number => {
  const dLng = toRadians(end.lng - start.lng);
  const lat1 = toRadians(start.lat);
  const lat2 = toRadians(end.lat);
  
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  
  const bearing = toDegrees(Math.atan2(y, x));
  
  // Normalize to 0-360 degrees
  return (bearing + 360) % 360;
};

/**
 * Check if coordinates are within valid lat/lng bounds
 */
export const isValidCoordinates = (coord: Coordinates): boolean => {
  return (
    typeof coord.lat === 'number' &&
    typeof coord.lng === 'number' &&
    coord.lat >= -90 &&
    coord.lat <= 90 &&
    coord.lng >= -180 &&
    coord.lng <= 180 &&
    !isNaN(coord.lat) &&
    !isNaN(coord.lng)
  );
};

/**
 * Format coordinates for Google Maps URL
 */
export const formatCoordinatesForUrl = (coord: Coordinates): string => {
  return `${coord.lat.toFixed(6)},${coord.lng.toFixed(6)}`;
};

/**
 * Parse coordinates from string (e.g., "lat,lng")
 */
export const parseCoordinatesFromString = (coordString: string): Coordinates | null => {
  const parts = coordString.split(',').map(part => part.trim());
  
  if (parts.length !== 2) {
    return null;
  }
  
  const lat = parseFloat(parts[0]);
  const lng = parseFloat(parts[1]);
  
  if (isNaN(lat) || isNaN(lng)) {
    return null;
  }
  
  const coord = { lat, lng };
  return isValidCoordinates(coord) ? coord : null;
};

/**
 * Calculate approximate travel time between two points
 * Returns estimated time in minutes based on distance and average speed
 */
export const calculateEstimatedTravelTime = (
  start: Coordinates,
  end: Coordinates,
  averageSpeedKmh: number = 60 // Default highway speed
): number => {
  const distance = calculateDistance(start, end);
  const timeHours = distance / averageSpeedKmh;
  return Math.round(timeHours * 60); // Convert to minutes
};

/**
 * Generate Google Maps URL for directions between two points
 */
export const generateDirectionsUrl = (
  origin: Coordinates,
  destination: Coordinates,
  waypoints?: ScenicWaypoint[]
): string => {
  const baseUrl = 'https://www.google.com/maps/dir/';
  const originStr = formatCoordinatesForUrl(origin);
  const destStr = formatCoordinatesForUrl(destination);
  
  if (waypoints && waypoints.length > 0) {
    const waypointStr = waypoints
      .map(wp => formatCoordinatesForUrl(wp))
      .join('/');
    return `${baseUrl}${originStr}/${waypointStr}/${destStr}`;
  }
  
  return `${baseUrl}${originStr}/${destStr}`;
};

/**
 * Check if a point is within a certain radius of another point
 */
export const isWithinRadius = (
  center: Coordinates,
  point: Coordinates,
  radiusKm: number
): boolean => {
  const distance = calculateDistance(center, point);
  return distance <= radiusKm;
};

/**
 * Snap coordinates to a grid (useful for clustering nearby points)
 */
export const snapToGrid = (
  coord: Coordinates,
  gridSizeDegrees: number = 0.001
): Coordinates => {
  return {
    lat: Math.round(coord.lat / gridSizeDegrees) * gridSizeDegrees,
    lng: Math.round(coord.lng / gridSizeDegrees) * gridSizeDegrees,
  };
};

/**
 * Get the midpoint between two coordinates
 */
export const getMidpoint = (
  coord1: Coordinates,
  coord2: Coordinates
): Coordinates => {
  const lat1 = toRadians(coord1.lat);
  const lng1 = toRadians(coord1.lng);
  const lat2 = toRadians(coord2.lat);
  const dLng = toRadians(coord2.lng - coord1.lng);
  
  const bx = Math.cos(lat2) * Math.cos(dLng);
  const by = Math.cos(lat2) * Math.sin(dLng);
  
  const lat3 = Math.atan2(
    Math.sin(lat1) + Math.sin(lat2),
    Math.sqrt((Math.cos(lat1) + bx) * (Math.cos(lat1) + bx) + by * by)
  );
  const lng3 = lng1 + Math.atan2(by, Math.cos(lat1) + bx);
  
  return {
    lat: toDegrees(lat3),
    lng: toDegrees(lng3),
  };
};
