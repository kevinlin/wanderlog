/**
 * Custom hook for weather data management
 * Integrates with global state and provides weather fetching functionality
 */

import { useCallback, useMemo } from 'react';
import { WeatherData } from '@/types/weather';
import { Coordinates } from '@/types/map';
import { useAppStateContext } from '@/contexts/AppStateContext';
import { WeatherService } from '@/services/weatherService';

export interface UseWeatherReturn {
  weatherData: Record<string, WeatherData>;
  fetchWeather: (coordinates: Coordinates, baseId: string) => Promise<void>;
  getWeatherForBase: (baseId: string) => WeatherData | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook for weather data management with global state integration
 */
export const useWeather = (): UseWeatherReturn => {
  const { state, dispatch } = useAppStateContext();

  /**
   * Fetch weather data for a specific base
   */
  const fetchWeather = useCallback(async (coordinates: Coordinates, baseId: string) => {
    try {
      // Check if we already have valid cached data
      if (WeatherService.isCacheValid(baseId)) {
        const cachedData = WeatherService.getCachedWeatherData(baseId);
        if (cachedData) {
          // Update global state with cached data
          dispatch({
            type: 'SET_WEATHER_DATA',
            payload: {
              baseId,
              weather: {
                data: cachedData,
                lastFetched: Date.now(),
                expires: Date.now() + (6 * 60 * 60 * 1000), // 6 hours
              },
            },
          });
          return;
        }
      }

      // Fetch fresh weather data
      const weatherData = await WeatherService.getWeatherData(coordinates, baseId);
      
      // Update global state with fresh data
      dispatch({
        type: 'SET_WEATHER_DATA',
        payload: {
          baseId,
          weather: {
            data: weatherData,
            lastFetched: Date.now(),
            expires: Date.now() + (6 * 60 * 60 * 1000), // 6 hours
          },
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch weather data';
      console.error(`Weather fetch error for base ${baseId}:`, errorMessage);
      
      // Don't set global error state for weather failures - they should be handled gracefully
      // Individual components can check if weather data is available
    }
  }, [dispatch]);

  /**
   * Get weather data for a specific base
   */
  const getWeatherForBase = useCallback((baseId: string): WeatherData | null => {
    const weatherCache = state.weatherData[baseId];
    
    if (!weatherCache) {
      return null;
    }

    // Check if cached data is still valid
    if (Date.now() > weatherCache.expires) {
      return null;
    }

    return weatherCache.data;
  }, [state.weatherData]);

  /**
   * Convert weather cache to simple data format for easier consumption
   */
  const weatherData = useMemo(() => {
    const result: Record<string, WeatherData> = {};
    
    Object.entries(state.weatherData).forEach(([baseId, cache]) => {
      // Only include valid (non-expired) weather data
      if (Date.now() <= cache.expires) {
        result[baseId] = cache.data;
      }
    });
    
    return result;
  }, [state.weatherData]);

  return {
    weatherData,
    fetchWeather,
    getWeatherForBase,
    isLoading: state.loading,
    error: state.error,
  };
};

/**
 * Hook to get weather description and icon for display
 */
export const useWeatherDisplay = (weatherData: WeatherData | null) => {
  return useMemo(() => {
    if (!weatherData) {
      return {
        description: 'Weather unavailable',
        icon: '🌤️',
        temperature: null,
        precipitation: null,
      };
    }

    return {
      description: WeatherService.getWeatherDescription(weatherData.weather_code),
      icon: WeatherService.getWeatherIcon(weatherData.weather_code),
      temperature: {
        max: Math.round(weatherData.temperature_2m_max),
        min: Math.round(weatherData.temperature_2m_min),
      },
      precipitation: Math.round(weatherData.precipitation_probability_max),
    };
  }, [weatherData]);
};
