// Weather-related types for Wanderlog Travel Journal

export interface WeatherData {
  precipitation_probability_max: number;
  temperature_2m_max: number;
  temperature_2m_min: number;
  time: string; // ISO date string
  weather_code: number;
}

export interface WeatherCache {
  [baseId: string]: {
    data: WeatherData;
    lastFetched: number; // timestamp
    expires: number; // timestamp
  };
}

export interface WeatherApiResponse {
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: number[];
    weather_code: number[];
  };
}

export interface WeatherServiceConfig {
  baseUrl: string;
  cacheExpirationHours: number;
}
