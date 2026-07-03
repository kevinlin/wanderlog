// localStorage-only view state (device-local preferences, not synced)

const LAST_VIEWED_BASE_PREFIX = 'wanderlog_last_viewed_base_';
const MAP_LAYER_PREFERENCES_KEY = 'wanderlog_map_layer_preferences';

export const getLastViewedBase = (tripId: string): string | null => {
  try {
    return localStorage.getItem(`${LAST_VIEWED_BASE_PREFIX}${tripId}`);
  } catch (error) {
    console.warn('Failed to load last viewed base from localStorage:', error);
    return null;
  }
};

export const setLastViewedBase = (tripId: string, baseId: string): void => {
  try {
    localStorage.setItem(`${LAST_VIEWED_BASE_PREFIX}${tripId}`, baseId);
  } catch (error) {
    console.warn('Failed to save last viewed base to localStorage:', error);
  }
};

export type MapTypeId = 'roadmap' | 'satellite' | 'terrain' | 'hybrid';

export interface OverlayLayers {
  bicycling: boolean;
  traffic: boolean;
  transit: boolean;
}

export interface MapLayerPreferences {
  mapType: MapTypeId;
  overlayLayers: OverlayLayers;
}

const DEFAULT_MAP_LAYER_PREFERENCES: MapLayerPreferences = {
  mapType: 'roadmap',
  overlayLayers: {
    traffic: false,
    transit: false,
    bicycling: false,
  },
};

const isValidMapType = (mapType: unknown): mapType is MapTypeId =>
  typeof mapType === 'string' && ['roadmap', 'satellite', 'terrain', 'hybrid'].includes(mapType);

const isValidOverlayLayers = (overlayLayers: unknown): overlayLayers is OverlayLayers => {
  if (typeof overlayLayers !== 'object' || overlayLayers === null) {
    return false;
  }
  const obj = overlayLayers as Record<string, unknown>;
  return typeof obj.traffic === 'boolean' && typeof obj.transit === 'boolean' && typeof obj.bicycling === 'boolean';
};

export const getMapLayerPreferences = (): MapLayerPreferences => {
  try {
    const stored = localStorage.getItem(MAP_LAYER_PREFERENCES_KEY);
    if (!stored) {
      return DEFAULT_MAP_LAYER_PREFERENCES;
    }

    const parsed = JSON.parse(stored);
    if (!(isValidMapType(parsed.mapType) && isValidOverlayLayers(parsed.overlayLayers))) {
      console.warn('Invalid map layer preferences in localStorage, using defaults');
      return DEFAULT_MAP_LAYER_PREFERENCES;
    }

    return parsed;
  } catch (error) {
    console.warn('Failed to load map layer preferences from localStorage:', error);
    return DEFAULT_MAP_LAYER_PREFERENCES;
  }
};

export const setMapLayerPreferences = (preferences: MapLayerPreferences): void => {
  try {
    localStorage.setItem(MAP_LAYER_PREFERENCES_KEY, JSON.stringify(preferences));
  } catch (error) {
    console.warn('Failed to save map layer preferences to localStorage:', error);
  }
};

export const saveMapType = (mapType: MapTypeId): void => {
  const preferences = getMapLayerPreferences();
  preferences.mapType = mapType;
  setMapLayerPreferences(preferences);
};

export const saveOverlayLayers = (overlayLayers: OverlayLayers): void => {
  const preferences = getMapLayerPreferences();
  preferences.overlayLayers = overlayLayers;
  setMapLayerPreferences(preferences);
};
