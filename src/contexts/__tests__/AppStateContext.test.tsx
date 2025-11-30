import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import type { POIDetails } from '@/types/poi';
import { AppStateProvider, useAppStateContext } from '../AppStateContext';

// Wrapper component for testing hooks
const wrapper = ({ children }: { children: ReactNode }) => <AppStateProvider>{children}</AppStateProvider>;

describe('AppStateContext - POI Search', () => {
  const mockPOIDetails: POIDetails[] = [
    {
      place_id: 'poi_1',
      name: 'Test Restaurant',
      formatted_address: '123 Test St',
      location: { lat: -44.5, lng: 170.0 },
      types: ['restaurant', 'food'],
      rating: 4.5,
      user_ratings_total: 100,
    },
    {
      place_id: 'poi_2',
      name: 'Test Cafe',
      formatted_address: '456 Cafe Ave',
      location: { lat: -44.6, lng: 170.1 },
      types: ['cafe', 'food'],
      rating: 4.2,
      user_ratings_total: 50,
    },
  ];

  describe('SET_POI_SEARCH_RESULTS', () => {
    it('should set search results and clear loading/error state', () => {
      const { result } = renderHook(() => useAppStateContext(), { wrapper });

      act(() => {
        result.current.dispatch({ type: 'SET_POI_SEARCH_RESULTS', payload: mockPOIDetails });
      });

      expect(result.current.state.poiSearch.results).toEqual(mockPOIDetails);
      expect(result.current.state.poiSearch.loading).toBe(false);
      expect(result.current.state.poiSearch.error).toBeNull();
    });

    it('should replace existing results with new results', () => {
      const { result } = renderHook(() => useAppStateContext(), { wrapper });

      // Set initial results
      act(() => {
        result.current.dispatch({ type: 'SET_POI_SEARCH_RESULTS', payload: mockPOIDetails });
      });

      // Set new results
      const newResults: POIDetails[] = [
        {
          place_id: 'poi_3',
          name: 'New Place',
          location: { lat: -44.7, lng: 170.2 },
        },
      ];

      act(() => {
        result.current.dispatch({ type: 'SET_POI_SEARCH_RESULTS', payload: newResults });
      });

      expect(result.current.state.poiSearch.results).toEqual(newResults);
      expect(result.current.state.poiSearch.results).toHaveLength(1);
    });
  });

  describe('SET_POI_SEARCH_QUERY', () => {
    it('should set the search query', () => {
      const { result } = renderHook(() => useAppStateContext(), { wrapper });

      act(() => {
        result.current.dispatch({ type: 'SET_POI_SEARCH_QUERY', payload: 'restaurants near me' });
      });

      expect(result.current.state.poiSearch.query).toBe('restaurants near me');
    });

    it('should preserve other search state when setting query', () => {
      const { result } = renderHook(() => useAppStateContext(), { wrapper });

      // Set initial state
      act(() => {
        result.current.dispatch({ type: 'SET_POI_SEARCH_RESULTS', payload: mockPOIDetails });
      });

      // Set query
      act(() => {
        result.current.dispatch({ type: 'SET_POI_SEARCH_QUERY', payload: 'new query' });
      });

      expect(result.current.state.poiSearch.query).toBe('new query');
      expect(result.current.state.poiSearch.results).toEqual(mockPOIDetails);
    });
  });

  describe('SET_POI_SEARCH_LOADING', () => {
    it('should set loading state to true', () => {
      const { result } = renderHook(() => useAppStateContext(), { wrapper });

      act(() => {
        result.current.dispatch({ type: 'SET_POI_SEARCH_LOADING', payload: true });
      });

      expect(result.current.state.poiSearch.loading).toBe(true);
    });

    it('should set loading state to false', () => {
      const { result } = renderHook(() => useAppStateContext(), { wrapper });

      // Set loading to true first
      act(() => {
        result.current.dispatch({ type: 'SET_POI_SEARCH_LOADING', payload: true });
      });

      act(() => {
        result.current.dispatch({ type: 'SET_POI_SEARCH_LOADING', payload: false });
      });

      expect(result.current.state.poiSearch.loading).toBe(false);
    });
  });

  describe('SET_POI_SEARCH_ERROR', () => {
    it('should set error message and clear loading state', () => {
      const { result } = renderHook(() => useAppStateContext(), { wrapper });

      // Set loading first
      act(() => {
        result.current.dispatch({ type: 'SET_POI_SEARCH_LOADING', payload: true });
      });

      // Set error
      act(() => {
        result.current.dispatch({ type: 'SET_POI_SEARCH_ERROR', payload: 'Search failed' });
      });

      expect(result.current.state.poiSearch.error).toBe('Search failed');
      expect(result.current.state.poiSearch.loading).toBe(false);
    });

    it('should clear error when set to null', () => {
      const { result } = renderHook(() => useAppStateContext(), { wrapper });

      // Set error
      act(() => {
        result.current.dispatch({ type: 'SET_POI_SEARCH_ERROR', payload: 'Some error' });
      });

      // Clear error
      act(() => {
        result.current.dispatch({ type: 'SET_POI_SEARCH_ERROR', payload: null });
      });

      expect(result.current.state.poiSearch.error).toBeNull();
    });
  });

  describe('CLEAR_POI_SEARCH', () => {
    it('should reset all search state to initial values', () => {
      const { result } = renderHook(() => useAppStateContext(), { wrapper });

      // Set up search state
      act(() => {
        result.current.dispatch({ type: 'SET_POI_SEARCH_QUERY', payload: 'test query' });
        result.current.dispatch({ type: 'SET_POI_SEARCH_RESULTS', payload: mockPOIDetails });
      });

      // Clear search
      act(() => {
        result.current.dispatch({ type: 'CLEAR_POI_SEARCH' });
      });

      expect(result.current.state.poiSearch.results).toEqual([]);
      expect(result.current.state.poiSearch.query).toBe('');
      expect(result.current.state.poiSearch.loading).toBe(false);
      expect(result.current.state.poiSearch.error).toBeNull();
    });
  });

  describe('Initial state', () => {
    it('should have empty initial POI search state', () => {
      const { result } = renderHook(() => useAppStateContext(), { wrapper });

      expect(result.current.state.poiSearch).toEqual({
        results: [],
        query: '',
        loading: false,
        error: null,
      });
    });
  });

  describe('Search flow integration', () => {
    it('should handle complete search flow: query -> loading -> results', () => {
      const { result } = renderHook(() => useAppStateContext(), { wrapper });

      // Step 1: Set query
      act(() => {
        result.current.dispatch({ type: 'SET_POI_SEARCH_QUERY', payload: 'coffee shops' });
      });
      expect(result.current.state.poiSearch.query).toBe('coffee shops');

      // Step 2: Set loading
      act(() => {
        result.current.dispatch({ type: 'SET_POI_SEARCH_LOADING', payload: true });
      });
      expect(result.current.state.poiSearch.loading).toBe(true);

      // Step 3: Set results
      act(() => {
        result.current.dispatch({ type: 'SET_POI_SEARCH_RESULTS', payload: mockPOIDetails });
      });

      expect(result.current.state.poiSearch.results).toEqual(mockPOIDetails);
      expect(result.current.state.poiSearch.loading).toBe(false);
      expect(result.current.state.poiSearch.error).toBeNull();
    });

    it('should handle search error flow: query -> loading -> error', () => {
      const { result } = renderHook(() => useAppStateContext(), { wrapper });

      // Step 1: Set query
      act(() => {
        result.current.dispatch({ type: 'SET_POI_SEARCH_QUERY', payload: 'restaurants' });
      });

      // Step 2: Set loading
      act(() => {
        result.current.dispatch({ type: 'SET_POI_SEARCH_LOADING', payload: true });
      });

      // Step 3: Set error
      act(() => {
        result.current.dispatch({ type: 'SET_POI_SEARCH_ERROR', payload: 'Network error' });
      });

      expect(result.current.state.poiSearch.query).toBe('restaurants');
      expect(result.current.state.poiSearch.loading).toBe(false);
      expect(result.current.state.poiSearch.error).toBe('Network error');
      expect(result.current.state.poiSearch.results).toEqual([]);
    });
  });
});
