import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { TripData } from '@/types';
import { UserModifications } from '@/types/storage';
import { WeatherCache } from '@/types/weather';

// State interface based on design document
export interface AppState {
  tripData: TripData | null;
  currentBase: string | null;
  selectedActivity: string | null;
  userModifications: UserModifications;
  weatherData: WeatherCache;
  loading: boolean;
  error: string | null;
}

// Action types from design document
export type AppAction = 
  | { type: 'SET_TRIP_DATA'; payload: TripData }
  | { type: 'SELECT_BASE'; payload: string }
  | { type: 'SELECT_ACTIVITY'; payload: string | null }
  | { type: 'TOGGLE_ACTIVITY_DONE'; payload: { activityId: string; done: boolean } }
  | { type: 'REORDER_ACTIVITIES'; payload: { baseId: string; fromIndex: number; toIndex: number } }
  | { type: 'SET_WEATHER_DATA'; payload: { baseId: string; weather: any } }
  | { type: 'SET_USER_MODIFICATIONS'; payload: UserModifications }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_LOADING'; payload: boolean };

// Initial state
const initialState: AppState = {
  tripData: null,
  currentBase: null,
  selectedActivity: null,
  userModifications: {
    activityStatus: {},
    activityOrders: {},
  },
  weatherData: {},
  loading: false,
  error: null,
};

// Reducer function
function appStateReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
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
      const currentBase = state.tripData?.stops.find(stop => stop.stop_id === baseId);
      if (!currentBase) return state;

      // Get current order or create from original order
      const currentOrder = state.userModifications.activityOrders[baseId] || 
        currentBase.activities.map((_, index) => index);

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

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
};

// Hook to use the app state context
export const useAppStateContext = () => {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppStateContext must be used within an AppStateProvider');
  }
  return context;
};
