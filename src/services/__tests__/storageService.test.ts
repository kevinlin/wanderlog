import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getUserModifications,
  saveUserModifications,
  updateActivityDoneStatus,
  updateActivityOrderForBase,
  setLastViewedBase,
  getWeatherCache,
  saveWeatherCache,
  updateWeatherForBase,
  isWeatherCacheValid,
  getCachedWeather,
  isStorageAvailable,
} from '../storageService';
import { UserModifications, WeatherCache } from '@/types';

describe('StorageService', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('isStorageAvailable', () => {
    it('should return true when localStorage is available', () => {
      expect(isStorageAvailable()).toBe(true);
    });
  });

  describe('UserModifications API', () => {
    it('should return empty modifications when none exist', () => {
      const modifications = getUserModifications();
      
      expect(modifications).toEqual({
        activityStatus: {},
        activityOrders: {},
      });
    });

    it('should save and retrieve user modifications', () => {
      const modifications: UserModifications = {
        activityStatus: {
          'activity1': true,
          'activity2': false,
        },
        activityOrders: {
          'base1': [0, 1, 2],
        },
        lastViewedBase: 'base1',
        lastViewedDate: '2025-01-01T00:00:00.000Z',
      };

      saveUserModifications(modifications);
      const retrieved = getUserModifications();
      
      expect(retrieved).toEqual(modifications);
    });

    it('should update activity done status', () => {
      updateActivityDoneStatus('activity1', true);
      
      const modifications = getUserModifications();
      expect(modifications.activityStatus['activity1']).toBe(true);
    });

    it('should update activity order for base', () => {
      const activityIds = ['activity1', 'activity2', 'activity3'];
      updateActivityOrderForBase('base1', activityIds);
      
      const modifications = getUserModifications();
      expect(modifications.activityOrders['base1']).toEqual([0, 1, 2]);
    });

    it('should set last viewed base with timestamp', () => {
      const baseBefore = Date.now();
      setLastViewedBase('base1');
      const baseAfter = Date.now();
      
      const modifications = getUserModifications();
      expect(modifications.lastViewedBase).toBe('base1');
      expect(modifications.lastViewedDate).toBeDefined();
      
      const timestamp = new Date(modifications.lastViewedDate!).getTime();
      expect(timestamp).toBeGreaterThanOrEqual(baseBefore);
      expect(timestamp).toBeLessThanOrEqual(baseAfter);
    });
  });

  describe('Weather Cache API', () => {
    it('should return empty cache when none exists', () => {
      const cache = getWeatherCache();
      expect(cache).toEqual({});
    });

    it('should save and retrieve weather cache', () => {
      const cache: WeatherCache = {
        'base1': {
          data: {
            temperature_2m_max: 25,
            temperature_2m_min: 15,
            precipitation_probability_max: 30,
            weather_code: 1,
            time: '2025-01-01T00:00:00Z',
          },
          lastFetched: Date.now(),
          expires: Date.now() + (6 * 60 * 60 * 1000),
        },
      };

      saveWeatherCache(cache);
      const retrieved = getWeatherCache();
      
      expect(retrieved).toEqual(cache);
    });

    it('should update weather for base with expiration', () => {
      const weatherData = {
        temperature_2m_max: 25,
        temperature_2m_min: 15,
        precipitation_probability_max: 30,
        weather_code: 1,
        time: '2025-01-01T00:00:00Z',
      };

      const before = Date.now();
      updateWeatherForBase('base1', weatherData, 6);
      const after = Date.now();

      const cache = getWeatherCache();
      const entry = cache['base1'];
      
      expect(entry).toBeDefined();
      expect(entry.data).toEqual(weatherData);
      expect(entry.lastFetched).toBeGreaterThanOrEqual(before);
      expect(entry.lastFetched).toBeLessThanOrEqual(after);
      expect(entry.expires).toBeGreaterThan(entry.lastFetched);
    });

    it('should validate weather cache correctly', () => {
      const futureExpiration = Date.now() + (60 * 60 * 1000); // 1 hour from now
      const pastExpiration = Date.now() - (60 * 60 * 1000); // 1 hour ago

      const cache: WeatherCache = {
        'base1': {
          data: {
            temperature_2m_max: 25,
            temperature_2m_min: 15,
            precipitation_probability_max: 30,
            weather_code: 1,
            time: '2025-01-01T00:00:00Z',
          },
          lastFetched: Date.now(),
          expires: futureExpiration,
        },
        'base2': {
          data: {
            temperature_2m_max: 20,
            temperature_2m_min: 10,
            precipitation_probability_max: 50,
            weather_code: 2,
            time: '2025-01-02T00:00:00Z',
          },
          lastFetched: Date.now(),
          expires: pastExpiration,
        },
      };

      saveWeatherCache(cache);

      expect(isWeatherCacheValid('base1')).toBe(true);
      expect(isWeatherCacheValid('base2')).toBe(false);
      expect(isWeatherCacheValid('nonexistent')).toBe(false);
    });

    it('should return cached weather when valid', () => {
      const weatherData = {
        temperature_2m_max: 25,
        temperature_2m_min: 15,
        precipitation_probability_max: 30,
        weather_code: 1,
        time: '2025-01-01T00:00:00Z',
      };

      updateWeatherForBase('base1', weatherData);
      
      const cached = getCachedWeather('base1');
      expect(cached).toEqual(weatherData);
    });

    it('should return null for expired cache', () => {
      const cache: WeatherCache = {
        'base1': {
          data: {
            temperature_2m_max: 25,
            temperature_2m_min: 15,
            precipitation_probability_max: 30,
            weather_code: 1,
            time: '2025-01-01T00:00:00Z',
          },
          lastFetched: Date.now(),
          expires: Date.now() - 1000, // Expired 1 second ago
        },
      };

      saveWeatherCache(cache);
      
      const cached = getCachedWeather('base1');
      expect(cached).toBeNull();
    });
  });

  describe('Error handling', () => {
    it('should handle localStorage errors gracefully', () => {
      // Mock localStorage to throw errors
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn().mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      // Should not throw, but log warning
      expect(() => {
        saveUserModifications({
          activityStatus: {},
          activityOrders: {},
        });
      }).not.toThrow();

      // Restore original localStorage
      localStorage.setItem = originalSetItem;
    });

    it('should handle malformed JSON in localStorage', () => {
      // Manually set invalid JSON
      Object.defineProperty(localStorage, 'getItem', {
        value: vi.fn().mockReturnValue('invalid json'),
        configurable: true,
      });

      const modifications = getUserModifications();
      
      expect(modifications).toEqual({
        activityStatus: {},
        activityOrders: {},
      });
    });
  });
});
