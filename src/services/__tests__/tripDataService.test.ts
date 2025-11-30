import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TripData } from '@/types';
import { loadTripData, validateTripData } from '../tripDataService';

describe('TripDataService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateTripData', () => {
    it('should return true for valid trip data', () => {
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
            activities: [
              {
                activity_id: 'activity1',
                activity_name: 'Test Activity',
              },
            ],
          },
        ],
      };

      expect(validateTripData(validTripData).isValid).toBe(true);
    });

    it('should return false for invalid trip data', () => {
      expect(validateTripData(null).isValid).toBe(false);
      expect(validateTripData(undefined).isValid).toBe(false);
      expect(validateTripData({}).isValid).toBe(false);
      expect(validateTripData({ trip_name: 'Test' }).isValid).toBe(false);
    });

    it('should return false for trip data with invalid stops', () => {
      const invalidTripData = {
        trip_name: 'Test Trip',
        timezone: 'Pacific/Auckland',
        stops: [
          {
            // Missing required fields
            stop_id: 'stop1',
          },
        ],
      };

      expect(validateTripData(invalidTripData).isValid).toBe(false);
    });

    it('should return detailed validation errors', () => {
      const invalidData = {
        trip_name: 123, // Should be string
        // Missing timezone
        stops: 'not-an-array', // Should be array
      };

      const result = validateTripData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('trip_name must be a string');
      expect(result.errors).toContain('timezone must be a string');
      expect(result.errors).toContain('stops must be an array');
    });

    it('should return warnings for missing optional fields', () => {
      const dataWithoutOptionals = {
        trip_name: 'Test Trip',
        timezone: 'Pacific/Auckland',
        stops: [],
      };

      const result = validateTripData(dataWithoutOptionals);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Trip has no stops defined');
      // Note: we only warn about invalid optional fields, not missing ones
    });
  });

  describe('loadTripData', () => {
    it('should load trip data successfully', async () => {
      const mockTripData: TripData = {
        trip_name: 'Test Trip',
        timezone: 'Pacific/Auckland',
        stops: [],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockTripData),
      } as Response);

      const result = await loadTripData();

      expect(result).toEqual(mockTripData);
      expect(fetch).toHaveBeenCalledWith('/wanderlog/trip-data/202512_NZ_trip-plan.json');
    });

    it('should handle 404 errors gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      await expect(loadTripData('missing-file.json')).rejects.toThrow('Trip data file not found: missing-file.json');
    });

    it('should handle invalid JSON gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ invalid: 'data' }),
      } as Response);

      await expect(loadTripData()).rejects.toThrow('Trip data format is invalid:');
    });

    it('should handle network errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(loadTripData()).rejects.toThrow('Network error');
    });
  });
});
