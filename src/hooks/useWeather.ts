import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { weatherKeys } from '@/lib/queryClient';
import { WeatherService } from '@/services/weatherService';
import type { Coordinates } from '@/types/map';
import type { WeatherData } from '@/types/weather';

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

export interface UseWeatherReturn {
  isStale: boolean;
  updatedAt: number | null;
  weather: WeatherData | null;
}

export function useWeather(coords: Coordinates | null, baseId: string): UseWeatherReturn {
  const query = useQuery({
    queryKey: weatherKeys.base(baseId),
    queryFn: () => WeatherService.fetchWeatherData(coords as Coordinates),
    enabled: coords !== null,
    staleTime: SIX_HOURS_MS,
  });
  return {
    weather: query.data ?? null,
    isStale: query.isStale,
    updatedAt: query.dataUpdatedAt || null,
  };
}

/**
 * Hook to get weather description and icon for display
 */
export const useWeatherDisplay = (weatherData: WeatherData | null) =>
  useMemo(() => {
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
