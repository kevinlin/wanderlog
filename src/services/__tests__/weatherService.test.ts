/**
 * Tests for WeatherService
 * Covers API integration, caching, and error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WeatherService } from '../weatherService';
import { WeatherData, WeatherApiResponse } from '@/types/weather';
import { Coordinates } from '@/types/map';
import * as storageService from '../storageService';

// Mock the storage service
vi.mock('../storageService', () => ({
  getCachedWeather: vi.fn(),
  updateWeatherForBase: vi.fn(),
  isWeatherCacheValid: vi.fn(),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('WeatherService', () => {
  const mockCoordinates: Coordinates = { lat: -45.8788, lng: 170.5028 }; // Dunedin, NZ
  const baseId = 'test-base-1';

  const mockWeatherResponse: WeatherApiResponse = {
    daily: {
      time: ['2025-01-15'],
      temperature_2m_max: [22.5],
      temperature_2m_min: [12.3],
      precipitation_probability_max: [30],
      weather_code: [1],
    },
  };

  const expectedWeatherData: WeatherData = {
    temperature_2m_max: 22.5,
    temperature_2m_min: 12.3,
    precipitation_probability_max: 30,
    weather_code: 1,
    time: '2025-01-15',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchWeatherData', () => {
    it('should fetch weather data successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockWeatherResponse,
      });

      const result = await WeatherService.fetchWeatherData(mockCoordinates);

      expect(result).toEqual(expectedWeatherData);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('https://api.open-meteo.com/v1/forecast'),
        expect.objectContaining({
          method: 'GET',
          headers: { Accept: 'application/json' },
        })
      );

      // Check URL parameters
      const callArgs = mockFetch.mock.calls[0][0] as string;
      expect(callArgs).toContain('latitude=-45.8788');
      expect(callArgs).toContain('longitude=170.5028');
      expect(callArgs).toContain('daily=temperature_2m_max%2Ctemperature_2m_min%2Cprecipitation_probability_max%2Cweather_code');
      expect(callArgs).toContain('forecast_days=1');
      expect(callArgs).toContain('timezone=auto');
    });

    it('should handle API error responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      });

      await expect(WeatherService.fetchWeatherData(mockCoordinates))
        .rejects.toThrow('Failed to fetch weather data: Weather API request failed: 400 Bad Request');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(WeatherService.fetchWeatherData(mockCoordinates))
        .rejects.toThrow('Failed to fetch weather data: Network error');
    });

    it('should handle invalid response format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invalid: 'response' }),
      });

      await expect(WeatherService.fetchWeatherData(mockCoordinates))
        .rejects.toThrow('Failed to fetch weather data: Invalid weather API response format');
    });

    it('should handle empty response data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          daily: {
            time: [],
            temperature_2m_max: [],
            temperature_2m_min: [],
            precipitation_probability_max: [],
            weather_code: [],
          },
        }),
      });

      await expect(WeatherService.fetchWeatherData(mockCoordinates))
        .rejects.toThrow('Failed to fetch weather data: Invalid weather API response format');
    });
  });

  describe('getWeatherData', () => {
    it('should return cached data when available and valid', async () => {
      const cachedData = expectedWeatherData;
      vi.mocked(storageService.getCachedWeather).mockReturnValue(cachedData);

      const result = await WeatherService.getWeatherData(mockCoordinates, baseId);

      expect(result).toEqual(cachedData);
      expect(storageService.getCachedWeather).toHaveBeenCalledWith(baseId);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should fetch fresh data when cache is invalid', async () => {
      vi.mocked(storageService.getCachedWeather).mockReturnValue(null);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockWeatherResponse,
      });

      const result = await WeatherService.getWeatherData(mockCoordinates, baseId);

      expect(result).toEqual(expectedWeatherData);
      expect(storageService.updateWeatherForBase).toHaveBeenCalledWith(
        baseId,
        expectedWeatherData,
        6 // default cache expiration hours
      );
    });
  });

  describe('isCacheValid', () => {
    it('should return true for valid cache', () => {
      vi.mocked(storageService.isWeatherCacheValid).mockReturnValue(true);

      const result = WeatherService.isCacheValid(baseId);

      expect(result).toBe(true);
      expect(storageService.isWeatherCacheValid).toHaveBeenCalledWith(baseId);
    });

    it('should return false for invalid cache', () => {
      vi.mocked(storageService.isWeatherCacheValid).mockReturnValue(false);

      const result = WeatherService.isCacheValid(baseId);

      expect(result).toBe(false);
    });
  });

  describe('getCachedWeatherData', () => {
    it('should return cached weather data', () => {
      vi.mocked(storageService.getCachedWeather).mockReturnValue(expectedWeatherData);

      const result = WeatherService.getCachedWeatherData(baseId);

      expect(result).toEqual(expectedWeatherData);
      expect(storageService.getCachedWeather).toHaveBeenCalledWith(baseId);
    });

    it('should return null when no cached data', () => {
      vi.mocked(storageService.getCachedWeather).mockReturnValue(null);

      const result = WeatherService.getCachedWeatherData(baseId);

      expect(result).toBeNull();
    });
  });

  describe('getWeatherDescription', () => {
    it('should return correct descriptions for known weather codes', () => {
      expect(WeatherService.getWeatherDescription(0)).toBe('Clear sky');
      expect(WeatherService.getWeatherDescription(1)).toBe('Mainly clear');
      expect(WeatherService.getWeatherDescription(2)).toBe('Partly cloudy');
      expect(WeatherService.getWeatherDescription(61)).toBe('Slight rain');
      expect(WeatherService.getWeatherDescription(95)).toBe('Thunderstorm');
    });

    it('should return default description for unknown weather codes', () => {
      expect(WeatherService.getWeatherDescription(999)).toBe('Unknown weather');
    });
  });

  describe('getWeatherIcon', () => {
    it('should return correct icons for different weather conditions', () => {
      expect(WeatherService.getWeatherIcon(0)).toBe('☀️'); // Clear sky
      expect(WeatherService.getWeatherIcon(1)).toBe('☀️'); // Mainly clear
      expect(WeatherService.getWeatherIcon(2)).toBe('⛅'); // Partly cloudy
      expect(WeatherService.getWeatherIcon(61)).toBe('🌧️'); // Rain
      expect(WeatherService.getWeatherIcon(71)).toBe('❄️'); // Snow
      expect(WeatherService.getWeatherIcon(95)).toBe('⛈️'); // Thunderstorm
    });

    it('should return default icon for unknown weather codes', () => {
      expect(WeatherService.getWeatherIcon(999)).toBe('🌤️');
    });
  });

  describe('configure', () => {
    it('should update service configuration', () => {
      const customConfig = {
        baseUrl: 'https://custom-api.example.com',
        cacheExpirationHours: 12,
      };

      WeatherService.configure(customConfig);

      // Test that the configuration is applied by checking if the custom URL is used
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockWeatherResponse,
      });

      WeatherService.fetchWeatherData(mockCoordinates);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('https://custom-api.example.com'),
        expect.any(Object)
      );
    });
  });
});
