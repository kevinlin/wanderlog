import { describe, it, expect } from 'vitest';
import {
  isValidTripData,
  isValidStop,
  isValidDateRange,
  isValidDateString,
  isValidCoordinates,
  isValidAccommodation,
  isValidActivity,
  isValidActivityStatus,
  isValidUrl,
  isValidEmail,
  sanitizeString,
  validateAndSanitizeInput,
} from '../validationUtils';
import { TripData, TripBase, Coordinates, Accommodation, Activity } from '@/types';

describe('ValidationUtils', () => {
  describe('isValidTripData', () => {
    it('should validate correct trip data', () => {
      const validTripData: TripData = {
        trip_name: 'Test Trip',
        timezone: 'Pacific/Auckland',
        stops: [
          {
            stop_id: 'stop1',
            name: 'Auckland',
            date: {
              from: '2025-01-01',
              to: '2025-01-02',
            },
            location: {
              lat: -36.8485,
              lng: 174.7633,
            },
            duration_days: 1,
            accommodation: {
              name: 'Test Hotel',
              address: '123 Test St',
              check_in: '2025-01-01 15:00',
              check_out: '2025-01-02 11:00',
            },
            activities: [],
          },
        ],
      };

      const errors: string[] = [];
      const warnings: string[] = [];
      expect(isValidTripData(validTripData, errors, warnings)).toBe(true);
    });

    it('should reject invalid trip data', () => {
      const errors: string[] = [];
      const warnings: string[] = [];
      expect(isValidTripData(null, errors, warnings)).toBe(false);
      expect(isValidTripData(undefined, [], [])).toBe(false);
      expect(isValidTripData({}, [], [])).toBe(false);
      expect(isValidTripData({ trip_name: 123 }, [], [])).toBe(false);
    });
  });

  describe('isValidTripBase', () => {
    const validBase: TripBase = {
      stop_id: 'stop1',
      name: 'Auckland',
      date: {
        from: '2025-01-01',
        to: '2025-01-02',
      },
      location: {
        lat: -36.8485,
        lng: 174.7633,
      },
      duration_days: 1,
      accommodation: {
        name: 'Test Hotel',
        address: '123 Test St',
        check_in: '2025-01-01 15:00',
        check_out: '2025-01-02 11:00',
      },
      activities: [],
    };

    it('should validate correct trip base', () => {
      const errors: string[] = [];
      const warnings: string[] = [];
      expect(isValidStop(validBase, errors, warnings)).toBe(true);
    });

    it('should reject trip base with missing required fields', () => {
      const invalidBase = { ...validBase };
      delete (invalidBase as Record<string, unknown>).stop_id;
      const errors: string[] = [];
      const warnings: string[] = [];
      expect(isValidStop(invalidBase, errors, warnings)).toBe(false);
    });
  });

  describe('isValidDateRange', () => {
    it('should validate correct date range', () => {
      const validRange = {
        from: '2025-01-01',
        to: '2025-01-02',
      };
      expect(isValidDateRange(validRange)).toBe(true);
    });

    it('should reject invalid date range', () => {
      expect(isValidDateRange(null)).toBe(false);
      expect(isValidDateRange({ from: 'invalid-date', to: '2025-01-02' })).toBe(false);
      expect(isValidDateRange({ from: '2025-01-01' })).toBe(false);
    });
  });

  describe('isValidDateString', () => {
    it('should validate correct date strings', () => {
      expect(isValidDateString('2025-01-01')).toBe(true);
      expect(isValidDateString('2024-12-31')).toBe(true);
    });

    it('should reject invalid date strings', () => {
      expect(isValidDateString('invalid-date')).toBe(false);
      expect(isValidDateString('2025-13-01')).toBe(false);
      expect(isValidDateString('2025-01-32')).toBe(false);
      expect(isValidDateString(123)).toBe(false);
    });
  });

  describe('isValidCoordinates', () => {
    it('should validate correct coordinates', () => {
      const validCoords: Coordinates = { lat: -36.8485, lng: 174.7633 };
      expect(isValidCoordinates(validCoords)).toBe(true);
    });

    it('should reject invalid coordinates', () => {
      expect(isValidCoordinates({ lat: 91, lng: 0 })).toBe(false); // lat > 90
      expect(isValidCoordinates({ lat: 0, lng: 181 })).toBe(false); // lng > 180
      expect(isValidCoordinates({ lat: 'invalid', lng: 0 })).toBe(false);
    });
  });

  describe('isValidAccommodation', () => {
    const validAccommodation: Accommodation = {
      name: 'Test Hotel',
      address: '123 Test St',
      check_in: '2025-01-01 15:00',
      check_out: '2025-01-02 11:00',
    };

    it('should validate correct accommodation', () => {
      const errors: string[] = [];
      const warnings: string[] = [];
      expect(isValidAccommodation(validAccommodation, errors, warnings)).toBe(true);
    });

    it('should validate accommodation with optional fields', () => {
      const accommodationWithOptionals = {
        ...validAccommodation,
        confirmation: 'ABC123',
        url: 'https://example.com',
        thumbnail_url: 'https://example.com/image.jpg',
      };
      const errors: string[] = [];
      const warnings: string[] = [];
      expect(isValidAccommodation(accommodationWithOptionals, errors, warnings)).toBe(true);
    });

    it('should reject accommodation with missing required fields', () => {
      const invalidAccommodation = { ...validAccommodation };
      delete (invalidAccommodation as Record<string, unknown>).name;
      const errors: string[] = [];
      const warnings: string[] = [];
      expect(isValidAccommodation(invalidAccommodation, errors, warnings)).toBe(false);
    });
  });

  describe('isValidActivity', () => {
    const validActivity: Activity = {
      activity_id: 'activity1',
      activity_name: 'Test Activity',
    };

    it('should validate correct activity', () => {
      const errors: string[] = [];
      expect(isValidActivity(validActivity, errors)).toBe(true);
    });

    it('should validate activity with optional fields', () => {
      const activityWithOptionals: Activity = {
        ...validActivity,
        location: {
          lat: -36.8485,
          lng: 174.7633,
          address: '123 Test St',
        },
        duration: '2 hours',
        travel_time_from_accommodation: '15 minutes',
        url: 'https://example.com',
        remarks: 'Great activity',
        thumbnail_url: 'https://example.com/image.jpg',
        manual_order: 1,
        status: { done: false },
      };
      const errors: string[] = [];
      expect(isValidActivity(activityWithOptionals, errors)).toBe(true);
    });

    it('should reject activity with missing required fields', () => {
      const invalidActivity = { ...validActivity };
      delete (invalidActivity as Record<string, unknown>).activity_id;
      const errors: string[] = [];
      expect(isValidActivity(invalidActivity, errors)).toBe(false);
    });
  });

  describe('isValidActivityStatus', () => {
    it('should validate correct activity status', () => {
      expect(isValidActivityStatus({ done: true })).toBe(true);
      expect(isValidActivityStatus({ done: false })).toBe(true);
    });

    it('should reject invalid activity status', () => {
      expect(isValidActivityStatus(null)).toBe(false);
      expect(isValidActivityStatus({})).toBe(false);
      expect(isValidActivityStatus({ done: 'true' })).toBe(false);
    });
  });

  describe('isValidUrl', () => {
    it('should validate correct URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://example.com')).toBe(true);
      expect(isValidUrl('https://example.com/path?query=value')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(isValidUrl('not-a-url')).toBe(false);
      expect(isValidUrl('ftp://example.com')).toBe(true); // FTP is valid URL
      expect(isValidUrl('')).toBe(false);
    });
  });

  describe('isValidEmail', () => {
    it('should validate correct emails', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name+tag@example.co.uk')).toBe(true);
    });

    it('should reject invalid emails', () => {
      expect(isValidEmail('not-an-email')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
    });
  });

  describe('sanitizeString', () => {
    it('should sanitize HTML characters', () => {
      const input = '<script>alert("xss")</script>';
      const expected = '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;';
      expect(sanitizeString(input)).toBe(expected);
    });

    it('should handle normal strings', () => {
      const input = 'Normal string with no special chars';
      expect(sanitizeString(input)).toBe(input);
    });
  });

  describe('validateAndSanitizeInput', () => {
    it('should validate and sanitize string input', () => {
      const input = '<script>alert("test")</script>';
      const result = validateAndSanitizeInput(input);
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;');
    });

    it('should return empty string for non-string input', () => {
      expect(validateAndSanitizeInput(123)).toBe('');
      expect(validateAndSanitizeInput(null)).toBe('');
      expect(validateAndSanitizeInput(undefined)).toBe('');
    });

    it('should respect max length', () => {
      const longString = 'a'.repeat(2000);
      const result = validateAndSanitizeInput(longString, 100);
      expect(result.length).toBe(100);
    });
  });
});
