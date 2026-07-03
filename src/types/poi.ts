// Point of Interest (POI) types for Google Places integration

export interface POIDetails {
  business_status?: string;
  formatted_address?: string;
  formatted_phone_number?: string;
  geometry?: {
    location: {
      lat: number;
      lng: number;
    };
    viewport?: {
      northeast: { lat: number; lng: number };
      southwest: { lat: number; lng: number };
    };
  };
  icon?: string;
  icon_background_color?: string;
  icon_mask_base_uri?: string;
  international_phone_number?: string;
  location: {
    lat: number;
    lng: number;
  };
  name: string;
  opening_hours?: {
    open_now?: boolean;
    periods?: Array<{
      open: { day: number; time: string };
      close?: { day: number; time: string };
    }>;
    weekday_text?: string[];
  };
  photos?: Array<{
    photo_reference: string; // Full URL from Google Places API getUrl() method
    height: number;
    width: number;
  }>;
  place_id: string;
  price_level?: number;
  rating?: number;
  types?: string[];
  user_ratings_total?: number;
  vicinity?: string;
  website?: string;
}

export interface POIModalState {
  error: string | null;
  isOpen: boolean;
  loading: boolean;
  poi: POIDetails | null;
}

export interface POISearchState {
  error: string | null;
  loading: boolean;
  query: string;
  results: POIDetails[];
}
