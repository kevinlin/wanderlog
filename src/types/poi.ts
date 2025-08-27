// Point of Interest (POI) types for Google Places integration

export interface POIDetails {
  place_id: string;
  name: string;
  formatted_address?: string;
  location: {
    lat: number;
    lng: number;
  };
  types?: string[];
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
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
  website?: string;
  formatted_phone_number?: string;
  international_phone_number?: string;
  business_status?: string;
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
  vicinity?: string;
  icon?: string;
  icon_background_color?: string;
  icon_mask_base_uri?: string;
}

export interface POIModalState {
  isOpen: boolean;
  poi: POIDetails | null;
  loading: boolean;
  error: string | null;
}
