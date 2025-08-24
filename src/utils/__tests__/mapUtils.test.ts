import { describe, it, expect } from 'vitest';
import {
  calculateDistance,
  toRadians,
  toDegrees,
  calculateCentroid,
  calculateBounds,
  calculateBearing,
  isValidCoordinates,
  formatCoordinatesForUrl,
  parseCoordinatesFromString,
  calculateEstimatedTravelTime,
  generateDirectionsUrl,
  isWithinRadius,
  snapToGrid,
  getMidpoint,
} from '../mapUtils';
import { Coordinates, ScenicWaypoint } from '@/types';

describe('MapUtils', () => {
  const aucklandCoords: Coordinates = { lat: -36.8485, lng: 174.7633 };
  const wellingtonCoords: Coordinates = { lat: -41.2924, lng: 174.7787 };

  describe('calculateDistance', () => {
    it('should calculate distance between two coordinates', () => {
      const distance = calculateDistance(aucklandCoords, wellingtonCoords);
      
      // Distance between Auckland and Wellington is approximately 495 km
      expect(distance).toBeGreaterThan(490);
      expect(distance).toBeLessThan(500);
    });

    it('should return 0 for same coordinates', () => {
      const distance = calculateDistance(aucklandCoords, aucklandCoords);
      expect(distance).toBe(0);
    });
  });

  describe('toRadians and toDegrees', () => {
    it('should convert degrees to radians', () => {
      expect(toRadians(180)).toBeCloseTo(Math.PI);
      expect(toRadians(90)).toBeCloseTo(Math.PI / 2);
      expect(toRadians(0)).toBe(0);
    });

    it('should convert radians to degrees', () => {
      expect(toDegrees(Math.PI)).toBeCloseTo(180);
      expect(toDegrees(Math.PI / 2)).toBeCloseTo(90);
      expect(toDegrees(0)).toBe(0);
    });
  });

  describe('calculateCentroid', () => {
    it('should calculate centroid of multiple coordinates', () => {
      const coords = [
        { lat: 0, lng: 0 },
        { lat: 10, lng: 10 },
        { lat: 20, lng: 20 },
      ];
      
      const centroid = calculateCentroid(coords);
      expect(centroid.lat).toBeCloseTo(10);
      expect(centroid.lng).toBeCloseTo(10);
    });

    it('should return single coordinate for single point', () => {
      const centroid = calculateCentroid([aucklandCoords]);
      expect(centroid).toEqual(aucklandCoords);
    });

    it('should throw error for empty array', () => {
      expect(() => calculateCentroid([])).toThrow('Cannot calculate centroid of empty coordinates array');
    });
  });

  describe('calculateBounds', () => {
    it('should calculate bounds for multiple coordinates', () => {
      const coords = [
        { lat: -36.8485, lng: 174.7633 }, // Auckland
        { lat: -41.2924, lng: 174.7787 }, // Wellington
        { lat: -45.8788, lng: 170.5028 }, // Dunedin
      ];
      
      const bounds = calculateBounds(coords);
      
      expect(bounds.north).toBe(-36.8485); // Auckland (northernmost)
      expect(bounds.south).toBe(-45.8788); // Dunedin (southernmost)
      expect(bounds.east).toBe(174.7787);  // Wellington (easternmost)
      expect(bounds.west).toBe(170.5028);  // Dunedin (westernmost)
    });

    it('should throw error for empty array', () => {
      expect(() => calculateBounds([])).toThrow('Cannot calculate bounds of empty coordinates array');
    });
  });

  describe('calculateBearing', () => {
    it('should calculate bearing between two points', () => {
      // Auckland to Wellington should be roughly south
      const bearing = calculateBearing(aucklandCoords, wellingtonCoords);
      
      // Should be roughly between 170-190 degrees (south)
      expect(bearing).toBeGreaterThan(170);
      expect(bearing).toBeLessThan(190);
    });

    it('should return 0 for north bearing', () => {
      const northPoint = { lat: aucklandCoords.lat + 1, lng: aucklandCoords.lng };
      const bearing = calculateBearing(aucklandCoords, northPoint);
      
      expect(bearing).toBeCloseTo(0, 1);
    });
  });

  describe('isValidCoordinates', () => {
    it('should validate correct coordinates', () => {
      expect(isValidCoordinates(aucklandCoords)).toBe(true);
      expect(isValidCoordinates({ lat: 0, lng: 0 })).toBe(true);
      expect(isValidCoordinates({ lat: 90, lng: 180 })).toBe(true);
      expect(isValidCoordinates({ lat: -90, lng: -180 })).toBe(true);
    });

    it('should reject invalid coordinates', () => {
      expect(isValidCoordinates({ lat: 91, lng: 0 })).toBe(false);
      expect(isValidCoordinates({ lat: 0, lng: 181 })).toBe(false);
      expect(isValidCoordinates({ lat: NaN, lng: 0 })).toBe(false);
      expect(isValidCoordinates({ lat: 0, lng: NaN })).toBe(false);
    });
  });

  describe('formatCoordinatesForUrl', () => {
    it('should format coordinates for URL', () => {
      const formatted = formatCoordinatesForUrl(aucklandCoords);
      expect(formatted).toBe('-36.848500,174.763300');
    });
  });

  describe('parseCoordinatesFromString', () => {
    it('should parse valid coordinate strings', () => {
      const parsed = parseCoordinatesFromString('-36.8485,174.7633');
      expect(parsed).toEqual(aucklandCoords);
    });

    it('should handle strings with spaces', () => {
      const parsed = parseCoordinatesFromString(' -36.8485 , 174.7633 ');
      expect(parsed).toEqual(aucklandCoords);
    });

    it('should return null for invalid strings', () => {
      expect(parseCoordinatesFromString('invalid')).toBeNull();
      expect(parseCoordinatesFromString('lat,lng')).toBeNull();
      expect(parseCoordinatesFromString('91,0')).toBeNull(); // Invalid latitude
    });
  });

  describe('calculateEstimatedTravelTime', () => {
    it('should calculate travel time based on distance and speed', () => {
      const time = calculateEstimatedTravelTime(aucklandCoords, wellingtonCoords, 100);
      
      // Distance ~495km at 100km/h should be ~495/100*60 = ~297 minutes
      expect(time).toBeGreaterThan(290);
      expect(time).toBeLessThan(300);
    });

    it('should use default speed when not specified', () => {
      const time = calculateEstimatedTravelTime(aucklandCoords, wellingtonCoords);
      expect(time).toBeGreaterThan(0);
    });
  });

  describe('generateDirectionsUrl', () => {
    it('should generate URL without waypoints', () => {
      const url = generateDirectionsUrl(aucklandCoords, wellingtonCoords);
      
      expect(url).toContain('https://www.google.com/maps/dir/');
      expect(url).toContain('-36.848500,174.763300');
      expect(url).toContain('-41.292400,174.778700');
    });

    it('should generate URL with waypoints', () => {
      const waypoints: ScenicWaypoint[] = [
        { lat: -38.0, lng: 175.0, label: 'Waypoint 1' },
      ];
      
      const url = generateDirectionsUrl(aucklandCoords, wellingtonCoords, waypoints);
      
      expect(url).toContain('https://www.google.com/maps/dir/');
      expect(url).toContain('-38.000000,175.000000');
    });
  });

  describe('isWithinRadius', () => {
    it('should determine if point is within radius', () => {
      // Wellington is ~495km from Auckland
      expect(isWithinRadius(aucklandCoords, wellingtonCoords, 500)).toBe(true);
      expect(isWithinRadius(aucklandCoords, wellingtonCoords, 400)).toBe(false);
    });
  });

  describe('snapToGrid', () => {
    it('should snap coordinates to grid', () => {
      const coord = { lat: -36.84851, lng: 174.76334 };
      const snapped = snapToGrid(coord, 0.01);
      
      expect(snapped.lat).toBe(-36.85);
      expect(snapped.lng).toBe(174.76);
    });

    it('should use default grid size', () => {
      const coord = { lat: -36.84851, lng: 174.76334 };
      const snapped = snapToGrid(coord);
      
      // Default grid size is 0.001
      expect(snapped.lat).toBeCloseTo(-36.849, 3);
      expect(snapped.lng).toBeCloseTo(174.763, 3);
    });
  });

  describe('getMidpoint', () => {
    it('should calculate midpoint between two coordinates', () => {
      const midpoint = getMidpoint(aucklandCoords, wellingtonCoords);
      
      // Midpoint should be roughly between Auckland and Wellington
      expect(midpoint.lat).toBeGreaterThan(wellingtonCoords.lat);
      expect(midpoint.lat).toBeLessThan(aucklandCoords.lat);
      expect(midpoint.lng).toBeCloseTo(174.77, 1);
    });

    it('should return same point for identical coordinates', () => {
      const midpoint = getMidpoint(aucklandCoords, aucklandCoords);
      expect(midpoint.lat).toBeCloseTo(aucklandCoords.lat);
      expect(midpoint.lng).toBeCloseTo(aucklandCoords.lng);
    });
  });
});
