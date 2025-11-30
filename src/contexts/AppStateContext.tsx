import type React from 'react';
import { createContext, type ReactNode, useContext, useReducer } from 'react';
import type { Activity, TripData } from '@/types';
import type { POIDetails, POIModalState, POISearchState } from '@/types/poi';
import type { UserModifications } from '@/types/storage';
import type { WeatherCache } from '@/types/weather';

// Trip summary interface for trip list
export interface TripSummary {
  trip_id: string;
  trip_name: string;
  timezone: string;
  created_at?: string;
  updated_at?: string;
}

// State interface based on design document
export interface AppState {
  // Trip management
  currentTripId: string | null;
  availableTrips: TripSummary[];

  // Current trip data
  tripData: TripData | null;
  currentBase: string | null;
  selectedActivity: string | null;
  userModifications: UserModifications;
  weatherData: WeatherCache;
  poiModal: POIModalState;
  poiSearch: POISearchState;

  // UI state
  loading: boolean;
  error: string | null;
}

// Action types from design document
export type AppAction =
  // Trip management actions
  | { type: 'SET_CURRENT_TRIP_ID'; payload: string | null }
  | { type: 'SET_AVAILABLE_TRIPS'; payload: TripSummary[] }
  | { type: 'LOAD_TRIP'; payload: { tripId: string; tripData: TripData; userModifications: UserModifications } }

  // Existing actions
  | { type: 'SET_TRIP_DATA'; payload: TripData }
  | { type: 'SELECT_BASE'; payload: string }
  | { type: 'SELECT_ACTIVITY'; payload: string | null }
  | { type: 'TOGGLE_ACTIVITY_DONE'; payload: { activityId: string; done: boolean } }
  | { type: 'REORDER_ACTIVITIES'; payload: { baseId: string; fromIndex: number; toIndex: number } }
  | { type: 'SET_WEATHER_DATA'; payload: { baseId: string; weather: any } }
  | { type: 'SET_USER_MODIFICATIONS'; payload: UserModifications }
  | { type: 'SET_POI_MODAL'; payload: Partial<POIModalState> }
  | { type: 'CLOSE_POI_MODAL' }
  | { type: 'ADD_ACTIVITY_FROM_POI'; payload: { baseId: string; activity: Activity } }

  // POI Search actions
  | { type: 'SET_POI_SEARCH_RESULTS'; payload: POIDetails[] }
  | { type: 'SET_POI_SEARCH_QUERY'; payload: string }
  | { type: 'SET_POI_SEARCH_LOADING'; payload: boolean }
  | { type: 'SET_POI_SEARCH_ERROR'; payload: string | null }
  | { type: 'CLEAR_POI_SEARCH' }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_LOADING'; payload: boolean };

// Initial state
const initialState: AppState = {
  // Trip management
  currentTripId: null,
  availableTrips: [],

  // Current trip data
  tripData: null,
  currentBase: null,
  selectedActivity: null,
  userModifications: {
    activityStatus: {},
    activityOrders: {},
  },
  weatherData: {},
  poiModal: {
    isOpen: false,
    poi: null,
    loading: false,
    error: null,
  },
  poiSearch: {
    results: [],
    query: '',
    loading: false,
    error: null,
  },

  // UI state
  loading: false,
  error: null,
};

// Reducer function
function appStateReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    // Trip management actions
    case 'SET_CURRENT_TRIP_ID':
      return {
        ...state,
        currentTripId: action.payload,
      };

    case 'SET_AVAILABLE_TRIPS':
      return {
        ...state,
        availableTrips: action.payload,
      };

    case 'LOAD_TRIP':
      return {
        ...state,
        currentTripId: action.payload.tripId,
        tripData: action.payload.tripData,
        userModifications: action.payload.userModifications,
        currentBase: action.payload.userModifications.lastViewedBase || action.payload.tripData.stops[0]?.stop_id || null,
        error: null,
      };

    case 'SET_TRIP_DATA':
      return {
        ...state,
        tripData: action.payload,
        error: null,
      };

    case 'SELECT_BASE':
      return {
        ...state,
        currentBase: action.payload,
        selectedActivity: null, // Clear activity selection when changing bases
      };

    case 'SELECT_ACTIVITY':
      return {
        ...state,
        selectedActivity: action.payload,
      };

    case 'TOGGLE_ACTIVITY_DONE':
      return {
        ...state,
        userModifications: {
          ...state.userModifications,
          activityStatus: {
            ...state.userModifications.activityStatus,
            [action.payload.activityId]: action.payload.done,
          },
        },
      };

    case 'REORDER_ACTIVITIES': {
      const { baseId, fromIndex, toIndex } = action.payload;
      const currentBase = state.tripData?.stops.find((stop) => stop.stop_id === baseId);
      if (!currentBase) return state;

      // Get current order or create from original order
      const currentOrder = state.userModifications.activityOrders[baseId] || currentBase.activities.map((_, index) => index);

      // Perform the reorder
      const newOrder = [...currentOrder];
      const [moved] = newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, moved);

      return {
        ...state,
        userModifications: {
          ...state.userModifications,
          activityOrders: {
            ...state.userModifications.activityOrders,
            [baseId]: newOrder,
          },
        },
      };
    }

    case 'SET_WEATHER_DATA':
      return {
        ...state,
        weatherData: {
          ...state.weatherData,
          [action.payload.baseId]: action.payload.weather,
        },
      };

    case 'SET_USER_MODIFICATIONS':
      return {
        ...state,
        userModifications: action.payload,
      };

    case 'SET_POI_MODAL':
      return {
        ...state,
        poiModal: {
          ...state.poiModal,
          ...action.payload,
        },
      };

    case 'CLOSE_POI_MODAL':
      return {
        ...state,
        poiModal: {
          isOpen: false,
          poi: null,
          loading: false,
          error: null,
        },
      };

    case 'ADD_ACTIVITY_FROM_POI': {
      const { baseId, activity } = action.payload;
      if (!state.tripData) return state;

      const updatedStops = state.tripData.stops.map((stop) => {
        if (stop.stop_id === baseId) {
          return {
            ...stop,
            activities: [...stop.activities, activity],
          };
        }
        return stop;
      });

      return {
        ...state,
        tripData: {
          ...state.tripData,
          stops: updatedStops,
        },
      };
    }

    // POI Search actions
    case 'SET_POI_SEARCH_RESULTS':
      return {
        ...state,
        poiSearch: {
          ...state.poiSearch,
          results: action.payload,
          loading: false,
          error: null,
        },
      };

    case 'SET_POI_SEARCH_QUERY':
      return {
        ...state,
        poiSearch: {
          ...state.poiSearch,
          query: action.payload,
        },
      };

    case 'SET_POI_SEARCH_LOADING':
      return {
        ...state,
        poiSearch: {
          ...state.poiSearch,
          loading: action.payload,
        },
      };

    case 'SET_POI_SEARCH_ERROR':
      return {
        ...state,
        poiSearch: {
          ...state.poiSearch,
          error: action.payload,
          loading: false,
        },
      };

    case 'CLEAR_POI_SEARCH':
      return {
        ...state,
        poiSearch: {
          results: [],
          query: '',
          loading: false,
          error: null,
        },
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        loading: false,
      };

    case 'SET_LOADING':
      return {
        ...state,
        loading: action.payload,
      };

    default:
      return state;
  }
}

// Context
const AppStateContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
} | null>(null);

// Provider component
interface AppStateProviderProps {
  children: ReactNode;
}

export const AppStateProvider: React.FC<AppStateProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(appStateReducer, initialState);

  const value = {
    state,
    dispatch,
  };

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
};

// Hook to use the app state context
export const useAppStateContext = () => {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppStateContext must be used within an AppStateProvider');
  }
  return context;
};
