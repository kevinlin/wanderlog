import type { GeocodeFn } from './tripImportService';

// The Maps JS API must be loaded before calling (useJsApiLoader with MAPS_LOADER_OPTIONS).
export const geocodeAddress: GeocodeFn = async (address) => {
  const geocoder = new google.maps.Geocoder();
  try {
    const { results } = await geocoder.geocode({ address });
    const location = results[0]?.geometry.location;
    return location ? { lat: location.lat(), lng: location.lng() } : null;
  } catch {
    return null; // the JS API rejects on ZERO_RESULTS
  }
};
