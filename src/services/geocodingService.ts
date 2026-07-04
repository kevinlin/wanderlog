import type { GeocodeFn } from './tripImportService';

// The Maps JS API must be loaded before calling (useJsApiLoader with MAPS_LOADER_OPTIONS).
// Returns null for "address not found"; rethrows service-level failures (REQUEST_DENIED,
// OVER_QUERY_LIMIT, ...) so callers can report them instead of treating them as misses.
export const geocodeAddress: GeocodeFn = async (address) => {
  const geocoder = new google.maps.Geocoder();
  try {
    const { results } = await geocoder.geocode({ address });
    const location = results[0]?.geometry.location;
    return location ? { lat: location.lat(), lng: location.lng() } : null;
  } catch (error) {
    // The JS API rejects on ZERO_RESULTS; that just means "not found".
    if (String(error).includes('ZERO_RESULTS')) {
      return null;
    }
    throw error instanceof Error ? error : new Error(String(error));
  }
};
