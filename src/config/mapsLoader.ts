export const MAPS_LOADER_OPTIONS = {
  id: 'wanderlog-maps',
  googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '',
  libraries: ['places', 'marker'] as ('places' | 'marker')[],
};

// DEMO_MAP_ID renders an unstyled map, so it is for development only; the real ID carries the cloud style.
export const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';
