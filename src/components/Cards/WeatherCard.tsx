/**
 * WeatherCard component for displaying weather information
 * Shows temperature, precipitation, and weather conditions with travel journal styling
 */

import type React from 'react';
import { useWeatherDisplay } from '@/hooks/useWeather';
import type { WeatherData } from '@/types/weather';

export interface WeatherCardProps {
  weatherData: WeatherData | null;
  className?: string;
  compact?: boolean;
}

/**
 * WeatherCard component with travel journal styling
 */
export const WeatherCard: React.FC<WeatherCardProps> = ({ weatherData, className = '', compact = false }) => {
  const { description, icon, temperature, precipitation } = useWeatherDisplay(weatherData);

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-2 text-sm ${className}`}>
        <span aria-label="Weather icon" className="text-lg" role="img">
          {icon}
        </span>
        {temperature ? (
          <span className="text-gray-700">
            {temperature.max}°/{temperature.min}°
          </span>
        ) : (
          <span className="text-gray-500">Weather unavailable</span>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-lg border border-white/30 bg-white/40 p-3 backdrop-blur-sm ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span aria-label="Weather icon" className="text-2xl" role="img">
            {icon}
          </span>
          <div>
            <div className="font-medium text-gray-800">{description}</div>
            {temperature && (
              <div className="text-gray-600 text-sm">
                High: {temperature.max}°C • Low: {temperature.min}°C
              </div>
            )}
          </div>
        </div>

        {precipitation !== null && (
          <div className="text-right">
            <div className="text-gray-600 text-sm">Rain chance</div>
            <div className="font-medium text-sky-600">{precipitation}%</div>
          </div>
        )}
      </div>

      {!weatherData && <div className="mt-2 text-gray-500 text-xs">Weather information is currently unavailable</div>}
    </div>
  );
};

export default WeatherCard;
