import type React from 'react';
import { createContext, type ReactNode, useContext, useReducer } from 'react';
import type { POIDetails, POIModalState, POISearchState } from '@/types/poi';

// Trip summary interface for trip list
export interface TripSummary {
  created_at?: string;
  timezone: string;
  trip_id: string;
  trip_name: string;
  updated_at?: string;
}

// UI-only state; server state (trip data, weather) lives in TanStack Query
export interface AppState {
  currentBase: string | null;
  currentTripId: string | null;
  poiModal: POIModalState;
  poiSearch: POISearchState;
  selectedActivity: string | null;
}

export type AppAction =
  | { type: 'SET_CURRENT_TRIP_ID'; payload: string | null }
  | { type: 'SELECT_BASE'; payload: string }
  | { type: 'SELECT_ACTIVITY'; payload: string | null }
  | { type: 'SET_POI_MODAL'; payload: Partial<POIModalState> }
  | { type: 'CLOSE_POI_MODAL' }
  | { type: 'SET_POI_SEARCH_RESULTS'; payload: POIDetails[] }
  | { type: 'SET_POI_SEARCH_QUERY'; payload: string }
  | { type: 'SET_POI_SEARCH_LOADING'; payload: boolean }
  | { type: 'SET_POI_SEARCH_ERROR'; payload: string | null }
  | { type: 'CLEAR_POI_SEARCH' };

// Initial state
const initialState: AppState = {
  currentTripId: null,
  currentBase: null,
  selectedActivity: null,
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
};

// Reducer function
function appStateReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_CURRENT_TRIP_ID':
      return {
        ...state,
        currentTripId: action.payload,
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
