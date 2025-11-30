import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserModifications, WeatherCache } from '@/types';
import {
  getCachedWeather,
  getMapLayerPreferences,
  getUserModifications,
  getWeatherCache,
  isStorageAvailable,
  isWeatherCacheValid,
  type MapLayerPreferences,
  saveMapLayerPreferences,
  saveMapType,
  saveOverlayLayers,
  saveUserModifications,
  saveWeatherCache,
  setCurrentTripId,
  setLastViewedBase,
  updateActivityDoneStatus,
  updateActivityOrderForBase,
  updateWeatherForBase,
} from '../storageService';

// Mock Firebase service to make tests use localStorage fallback
vi.mock('../firebaseService', () => ({
  getUserModifications: vi.fn().mockRejectedValue(new Error('Firebase not available in tests')),
  saveUserModifications: vi.fn().mockRejectedValue(new Error('Firebase not available in tests')),
}));

describe('StorageService', () => {
  const TEST_TRIP_ID = 'test-trip-123';

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    // Set current trip ID for tests
    setCurrentTripId(TEST_TRIP_ID);
  });

  describe('isStorageAvailable', () => {
    it('should return true when localStorage is available', () => {
      expect(isStorageAvailable()).toBe(true);
    });
  });

  describe('UserModifications API', () => {
    it('should return empty modifications when none exist', async () => {
      const modifications = await getUserModifications(TEST_TRIP_ID);

      expect(modifications).toEqual({
        activityStatus: {},
        activityOrders: {},
      });
    });

    it('should save and retrieve user modifications', async () => {
      const modifications: UserModifications = {
        activityStatus: {
          activity1: true,
          activity2: false,
        },
        activityOrders: {
          base1: [0, 1, 2],
        },
        lastViewedBase: 'base1',
        lastViewedDate: '2025-01-01T00:00:00.000Z',
      };

      await saveUserModifications(TEST_TRIP_ID, modifications);
      const retrieved = await getUserModifications(TEST_TRIP_ID);

      expect(retrieved).toEqual(modifications);
    });

    it('should update activity done status', async () => {
      await updateActivityDoneStatus(TEST_TRIP_ID, 'activity1', true);

      const modifications = await getUserModifications(TEST_TRIP_ID);
      expect(modifications.activityStatus['activity1']).toBe(true);
    });

    it('should update activity order for base', async () => {
      const activityIds = ['activity1', 'activity2', 'activity3'];
      await updateActivityOrderForBase(TEST_TRIP_ID, 'base1', activityIds);

      const modifications = await getUserModifications(TEST_TRIP_ID);
      expect(modifications.activityOrders['base1']).toEqual([0, 1, 2]);
    });

    it('should set last viewed base with timestamp', async () => {
      const baseBefore = Date.now();
      await setLastViewedBase(TEST_TRIP_ID, 'base1');
      const baseAfter = Date.now();

      const modifications = await getUserModifications(TEST_TRIP_ID);
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
        base1: {
          data: {
            temperature_2m_max: 25,
            temperature_2m_min: 15,
            precipitation_probability_max: 30,
            weather_code: 1,
            time: '2025-01-01T00:00:00Z',
          },
          lastFetched: Date.now(),
          expires: Date.now() + 6 * 60 * 60 * 1000,
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
      const futureExpiration = Date.now() + 60 * 60 * 1000; // 1 hour from now
      const pastExpiration = Date.now() - 60 * 60 * 1000; // 1 hour ago

      const cache: WeatherCache = {
        base1: {
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
        base2: {
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
        base1: {
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
    it('should handle localStorage errors gracefully', async () => {
      // Mock localStorage to throw errors
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn().mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      // Should not throw, but handle error gracefully
      await expect(
        saveUserModifications(TEST_TRIP_ID, {
          activityStatus: {},
          activityOrders: {},
        })
      ).resolves.not.toThrow();

      // Restore original localStorage
      localStorage.setItem = originalSetItem;
    });

    it('should handle malformed JSON in localStorage', async () => {
      // Manually set invalid JSON
      const originalGetItem = localStorage.getItem.bind(localStorage);
      Object.defineProperty(localStorage, 'getItem', {
        value: vi.fn().mockReturnValue('invalid json'),
        configurable: true,
      });

      const modifications = await getUserModifications(TEST_TRIP_ID);

      expect(modifications).toEqual({
        activityStatus: {},
        activityOrders: {},
      });

      // Restore original localStorage.getItem
      Object.defineProperty(localStorage, 'getItem', {
        value: originalGetItem,
        configurable: true,
      });
    });
  });

  describe('Map Layer Preferences API', () => {
    const MAP_LAYER_KEY = 'wanderlog_map_layer_preferences';

    // Clear map layer preferences before each test in this group
    beforeEach(() => {
      localStorage.removeItem(MAP_LAYER_KEY);
    });

    it('should return default preferences when none exist', () => {
      const preferences = getMapLayerPreferences();

      expect(preferences).toEqual({
        mapType: 'roadmap',
        overlayLayers: {
          traffic: false,
          transit: false,
          bicycling: false,
        },
      });
    });

    it('should save and retrieve map layer preferences', () => {
      const preferences: MapLayerPreferences = {
        mapType: 'satellite',
        overlayLayers: {
          traffic: true,
          transit: false,
          bicycling: true,
        },
      };

      saveMapLayerPreferences(preferences);
      const retrieved = getMapLayerPreferences();

      expect(retrieved).toEqual(preferences);
    });

    it('should save and retrieve map type preference', () => {
      saveMapType('terrain');
      const preferences = getMapLayerPreferences();

      expect(preferences.mapType).toBe('terrain');
    });

    it('should save and retrieve overlay layers preference', () => {
      const overlayLayers = {
        traffic: true,
        transit: true,
        bicycling: false,
      };

      saveOverlayLayers(overlayLayers);
      const preferences = getMapLayerPreferences();

      expect(preferences.overlayLayers).toEqual(overlayLayers);
    });

    it('should preserve other preferences when saving map type', () => {
      const initialPreferences: MapLayerPreferences = {
        mapType: 'roadmap',
        overlayLayers: {
          traffic: true,
          transit: true,
          bicycling: true,
        },
      };

      saveMapLayerPreferences(initialPreferences);
      saveMapType('hybrid');

      const preferences = getMapLayerPreferences();
      expect(preferences.mapType).toBe('hybrid');
      expect(preferences.overlayLayers).toEqual(initialPreferences.overlayLayers);
    });

    it('should preserve other preferences when saving overlay layers', () => {
      const initialPreferences: MapLayerPreferences = {
        mapType: 'satellite',
        overlayLayers: {
          traffic: false,
          transit: false,
          bicycling: false,
        },
      };

      saveMapLayerPreferences(initialPreferences);
      saveOverlayLayers({
        traffic: true,
        transit: true,
        bicycling: true,
      });

      const preferences = getMapLayerPreferences();
      expect(preferences.mapType).toBe('satellite');
      expect(preferences.overlayLayers).toEqual({
        traffic: true,
        transit: true,
        bicycling: true,
      });
    });

    describe('validation and error handling', () => {
      beforeEach(async () => {
        // Reset modules to get fresh localStorage access
        vi.resetModules();
        localStorage.clear();
      });

      it('should return defaults for invalid stored map type', async () => {
        // Set invalid data directly
        localStorage.setItem(
          MAP_LAYER_KEY,
          JSON.stringify({
            mapType: 'invalid_type',
            overlayLayers: {
              traffic: true,
              transit: false,
              bicycling: false,
            },
          })
        );

        // Dynamically import to get fresh module
        const { getMapLayerPreferences: freshGet } = await import('../storageService');
        const preferences = freshGet();

        expect(preferences).toEqual({
          mapType: 'roadmap',
          overlayLayers: {
            traffic: false,
            transit: false,
            bicycling: false,
          },
        });
      });

      it('should return defaults for invalid stored overlay layers', async () => {
        localStorage.setItem(
          MAP_LAYER_KEY,
          JSON.stringify({
            mapType: 'satellite',
            overlayLayers: {
              traffic: 'yes', // Invalid - should be boolean
              transit: false,
              bicycling: false,
            },
          })
        );

        const { getMapLayerPreferences: freshGet } = await import('../storageService');
        const preferences = freshGet();

        expect(preferences).toEqual({
          mapType: 'roadmap',
          overlayLayers: {
            traffic: false,
            transit: false,
            bicycling: false,
          },
        });
      });

      it('should return defaults for malformed JSON', async () => {
        localStorage.setItem(MAP_LAYER_KEY, 'not valid json');

        const { getMapLayerPreferences: freshGet } = await import('../storageService');
        const preferences = freshGet();

        expect(preferences).toEqual({
          mapType: 'roadmap',
          overlayLayers: {
            traffic: false,
            transit: false,
            bicycling: false,
          },
        });
      });

      it('should handle missing overlay layer properties', async () => {
        localStorage.setItem(
          MAP_LAYER_KEY,
          JSON.stringify({
            mapType: 'terrain',
            overlayLayers: {
              traffic: true,
              // missing transit and bicycling
            },
          })
        );

        const { getMapLayerPreferences: freshGet } = await import('../storageService');
        const preferences = freshGet();

        // Should return defaults due to invalid structure
        expect(preferences).toEqual({
          mapType: 'roadmap',
          overlayLayers: {
            traffic: false,
            transit: false,
            bicycling: false,
          },
        });
      });
    });

    it('should handle localStorage errors gracefully when saving', () => {
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn().mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      // Should not throw
      expect(() =>
        saveMapLayerPreferences({
          mapType: 'satellite',
          overlayLayers: {
            traffic: true,
            transit: false,
            bicycling: false,
          },
        })
      ).not.toThrow();

      // Restore original localStorage
      localStorage.setItem = originalSetItem;
    });
  });
});
