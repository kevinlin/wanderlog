/**
 * Weather Service for Open-Meteo API integration
 * Handles weather data fetching with caching and error handling
 */

import type { Coordinates } from '@/types/map';
import type { WeatherApiResponse, WeatherData, WeatherServiceConfig } from '@/types/weather';
import { getCachedWeather, isWeatherCacheValid, updateWeatherForBase } from './storageService';

// Default configuration for Open-Meteo API
const DEFAULT_CONFIG: WeatherServiceConfig = {
  baseUrl: 'https://api.open-meteo.com/v1/forecast',
  cacheExpirationHours: 6, // Cache weather data for 6 hours
};

/**
 * Weather Service class for API integration
 */
export class WeatherService {
  private static config: WeatherServiceConfig = DEFAULT_CONFIG;

  /**
   * Configure the weather service
   */
  static configure(config: Partial<WeatherServiceConfig>): void {
    WeatherService.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Fetch weather data from Open-Meteo API
   */
  static async fetchWeatherData(coordinates: Coordinates): Promise<WeatherData> {
    const { lat, lng } = coordinates;
    const url = new URL(WeatherService.config.baseUrl);

    // Add query parameters for Open-Meteo API
    url.searchParams.append('latitude', lat.toString());
    url.searchParams.append('longitude', lng.toString());
    url.searchParams.append('daily', 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code');
    url.searchParams.append('forecast_days', '1'); // Get today's weather
    url.searchParams.append('timezone', 'auto');

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Weather API request failed: ${response.status} ${response.statusText}`);
      }

      const data: WeatherApiResponse = await response.json();

      // Validate response structure
      if (!(data.daily && Array.isArray(data.daily.time)) || data.daily.time.length === 0) {
        throw new Error('Invalid weather API response format');
      }

      // Extract the first day's data
      const weatherData: WeatherData = {
        temperature_2m_max: data.daily.temperature_2m_max[0],
        temperature_2m_min: data.daily.temperature_2m_min[0],
        precipitation_probability_max: data.daily.precipitation_probability_max[0],
        weather_code: data.daily.weather_code[0],
        time: data.daily.time[0],
      };

      return weatherData;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch weather data: ${error.message}`);
      }
      throw new Error('Failed to fetch weather data: Unknown error');
    }
  }

  /**
   * Get weather data with caching support
   */
  static async getWeatherData(coordinates: Coordinates, baseId: string): Promise<WeatherData> {
    // Check if we have valid cached data
    const cachedData = getCachedWeather(baseId);
    if (cachedData) {
      return cachedData;
    }

    // Fetch fresh data and cache it
    const weatherData = await WeatherService.fetchWeatherData(coordinates);
    updateWeatherForBase(baseId, weatherData, WeatherService.config.cacheExpirationHours);

    return weatherData;
  }

  /**
   * Check if weather data is cached and valid
   */
  static isCacheValid(baseId: string): boolean {
    return isWeatherCacheValid(baseId);
  }

  /**
   * Get cached weather data without fetching
   */
  static getCachedWeatherData(baseId: string): WeatherData | null {
    return getCachedWeather(baseId);
  }

  /**
   * Get weather description from weather code
   * Based on WMO Weather interpretation codes
   */
  static getWeatherDescription(weatherCode: number): string {
    const weatherCodes: Record<number, string> = {
      0: 'Clear sky',
      1: 'Mainly clear',
      2: 'Partly cloudy',
      3: 'Overcast',
      45: 'Fog',
      48: 'Depositing rime fog',
      51: 'Light drizzle',
      53: 'Moderate drizzle',
      55: 'Dense drizzle',
      56: 'Light freezing drizzle',
      57: 'Dense freezing drizzle',
      61: 'Slight rain',
      63: 'Moderate rain',
      65: 'Heavy rain',
      66: 'Light freezing rain',
      67: 'Heavy freezing rain',
      71: 'Slight snow fall',
      73: 'Moderate snow fall',
      75: 'Heavy snow fall',
      77: 'Snow grains',
      80: 'Slight rain showers',
      81: 'Moderate rain showers',
      82: 'Violent rain showers',
      85: 'Slight snow showers',
      86: 'Heavy snow showers',
      95: 'Thunderstorm',
      96: 'Thunderstorm with slight hail',
      99: 'Thunderstorm with heavy hail',
    };

    return weatherCodes[weatherCode] || 'Unknown weather';
  }

  /**
   * Get weather icon emoji from weather code
   */
  static getWeatherIcon(weatherCode: number): string {
    if (weatherCode === 0 || weatherCode === 1) return '☀️';
    if (weatherCode === 2 || weatherCode === 3) return '⛅';
    if (weatherCode === 45 || weatherCode === 48) return '🌫️';
    if (weatherCode >= 51 && weatherCode <= 57) return '🌦️';
    if (weatherCode >= 61 && weatherCode <= 67) return '🌧️';
    if (weatherCode >= 71 && weatherCode <= 77) return '❄️';
    if (weatherCode >= 80 && weatherCode <= 82) return '🌦️';
    if (weatherCode >= 85 && weatherCode <= 86) return '🌨️';
    if (weatherCode >= 95 && weatherCode <= 99) return '⛈️';
    return '🌤️'; // Default icon
  }
}

// Export convenience functions
export const fetchWeatherData = WeatherService.fetchWeatherData.bind(WeatherService);
export const getWeatherData = WeatherService.getWeatherData.bind(WeatherService);
export const isCacheValid = WeatherService.isCacheValid.bind(WeatherService);
export const getCachedWeatherData = WeatherService.getCachedWeatherData.bind(WeatherService);
export const getWeatherDescription = WeatherService.getWeatherDescription.bind(WeatherService);
export const getWeatherIcon = WeatherService.getWeatherIcon.bind(WeatherService);
