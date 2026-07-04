export const MAPS_LOADER_OPTIONS = {
  id: 'wanderlog-maps',
  googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '',
  libraries: ['places'] as 'places'[],
};
