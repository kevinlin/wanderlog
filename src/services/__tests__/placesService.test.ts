import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlacesService } from '../placesService';

// Mock Google Maps API
const mockTextSearch = vi.fn();
const mockGetDetails = vi.fn();
const mockNearbySearch = vi.fn();

const mockPlacesService = {
  textSearch: mockTextSearch,
  getDetails: mockGetDetails,
  nearbySearch: mockNearbySearch,
};

const mockMap = {} as google.maps.Map;

// Mock window.google
Object.defineProperty(window, 'google', {
  value: {
    maps: {
      places: {
        PlacesService: vi.fn(() => mockPlacesService),
        PlacesServiceStatus: {
          OK: 'OK',
          ZERO_RESULTS: 'ZERO_RESULTS',
          ERROR: 'ERROR',
          INVALID_REQUEST: 'INVALID_REQUEST',
        },
      },
      LatLng: vi.fn((lat, lng) => ({ lat: () => lat, lng: () => lng })),
    },
  },
  writable: true,
});

describe('PlacesService', () => {
  let placesService: PlacesService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset singleton instance for testing
    // @ts-expect-error - accessing private property for testing
    PlacesService.instance = undefined;
    placesService = PlacesService.getInstance();
    placesService.initialize(mockMap);
  });

  describe('getInstance', () => {
    it('should return the same instance (singleton pattern)', () => {
      const instance1 = PlacesService.getInstance();
      const instance2 = PlacesService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('textSearchWithLocationBias', () => {
    const mockLocation = { lat: -44.5, lng: 170.0 };
    const mockPlaceResults: google.maps.places.PlaceResult[] = [
      {
        place_id: 'place_1',
        name: 'Test Restaurant',
        formatted_address: '123 Test St',
        geometry: {
          location: {
            lat: () => -44.51,
            lng: () => 170.01,
          } as google.maps.LatLng,
        },
        types: ['restaurant', 'food'],
        rating: 4.5,
        user_ratings_total: 100,
        price_level: 2,
        opening_hours: {
          isOpen: () => true,
          weekday_text: ['Monday: 9:00 AM – 9:00 PM'],
        } as google.maps.places.PlaceOpeningHours,
        photos: [
          {
            getUrl: () => 'https://example.com/photo.jpg',
            height: 400,
            width: 600,
          } as google.maps.places.PlacePhoto,
        ],
        business_status: 'OPERATIONAL',
        icon: 'https://example.com/icon.png',
      },
      {
        place_id: 'place_2',
        name: 'Test Cafe',
        formatted_address: '456 Cafe Ave',
        geometry: {
          location: {
            lat: () => -44.52,
            lng: () => 170.02,
          } as google.maps.LatLng,
        },
        types: ['cafe'],
        rating: 4.2,
        user_ratings_total: 50,
      },
    ];

    it('should search for places with location bias', async () => {
      mockTextSearch.mockImplementation((request, callback) => {
        callback(mockPlaceResults, window.google.maps.places.PlacesServiceStatus.OK);
      });

      const results = await placesService.textSearchWithLocationBias('restaurants', mockLocation);

      expect(mockTextSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'restaurants',
          radius: 5000,
        }),
        expect.any(Function)
      );

      expect(results).toHaveLength(2);
      expect(results[0].place_id).toBe('place_1');
      expect(results[0].name).toBe('Test Restaurant');
    });

    it('should convert PlaceResult to POIDetails correctly', async () => {
      mockTextSearch.mockImplementation((request, callback) => {
        callback([mockPlaceResults[0]], window.google.maps.places.PlacesServiceStatus.OK);
      });

      const results = await placesService.textSearchWithLocationBias('test', mockLocation);

      expect(results[0]).toEqual({
        place_id: 'place_1',
        name: 'Test Restaurant',
        formatted_address: '123 Test St',
        location: {
          lat: -44.51,
          lng: 170.01,
        },
        types: ['restaurant', 'food'],
        rating: 4.5,
        user_ratings_total: 100,
        price_level: 2,
        opening_hours: {
          open_now: true,
          weekday_text: ['Monday: 9:00 AM – 9:00 PM'],
        },
        photos: [
          {
            photo_reference: 'https://example.com/photo.jpg',
            height: 400,
            width: 600,
          },
        ],
        business_status: 'OPERATIONAL',
        icon: 'https://example.com/icon.png',
      });
    });

    it('should use custom radius when provided', async () => {
      mockTextSearch.mockImplementation((request, callback) => {
        callback(mockPlaceResults, window.google.maps.places.PlacesServiceStatus.OK);
      });

      await placesService.textSearchWithLocationBias('test', mockLocation, 10_000);

      expect(mockTextSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          radius: 10_000,
        }),
        expect.any(Function)
      );
    });

    it('should return empty array for ZERO_RESULTS', async () => {
      mockTextSearch.mockImplementation((request, callback) => {
        callback([], window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS);
      });

      const results = await placesService.textSearchWithLocationBias('nonexistent place', mockLocation);

      expect(results).toEqual([]);
    });

    it('should reject on API error', async () => {
      mockTextSearch.mockImplementation((request, callback) => {
        callback(null, window.google.maps.places.PlacesServiceStatus.ERROR);
      });

      await expect(placesService.textSearchWithLocationBias('test', mockLocation)).rejects.toThrow('Failed to search places: ERROR');
    });

    it('should reject when service is not initialized', async () => {
      // Reset singleton and don't initialize
      // @ts-expect-error - accessing private property for testing
      PlacesService.instance = undefined;
      const uninitializedService = PlacesService.getInstance();

      await expect(uninitializedService.textSearchWithLocationBias('test', mockLocation)).rejects.toThrow('Places service not initialized');
    });

    it('should handle places without optional fields', async () => {
      const minimalPlace: google.maps.places.PlaceResult = {
        place_id: 'minimal_place',
        name: 'Minimal Place',
        geometry: {
          location: {
            lat: () => -44.5,
            lng: () => 170.0,
          } as google.maps.LatLng,
        },
      };

      mockTextSearch.mockImplementation((request, callback) => {
        callback([minimalPlace], window.google.maps.places.PlacesServiceStatus.OK);
      });

      const results = await placesService.textSearchWithLocationBias('test', mockLocation);

      expect(results[0]).toEqual({
        place_id: 'minimal_place',
        name: 'Minimal Place',
        formatted_address: undefined,
        location: {
          lat: -44.5,
          lng: 170.0,
        },
        types: undefined,
        rating: undefined,
        user_ratings_total: undefined,
        price_level: undefined,
        opening_hours: undefined,
        photos: undefined,
        business_status: undefined,
        icon: undefined,
      });
    });

    it('should handle place with missing geometry', async () => {
      const placeWithoutGeometry: google.maps.places.PlaceResult = {
        place_id: 'no_geo',
        name: 'No Geometry Place',
      };

      mockTextSearch.mockImplementation((request, callback) => {
        callback([placeWithoutGeometry], window.google.maps.places.PlacesServiceStatus.OK);
      });

      const results = await placesService.textSearchWithLocationBias('test', mockLocation);

      expect(results[0].location).toEqual({ lat: 0, lng: 0 });
    });
  });

  describe('textSearch (without location bias)', () => {
    it('should search without location bias', async () => {
      const mockResults: google.maps.places.PlaceResult[] = [
        {
          place_id: 'global_place',
          name: 'Global Place',
        },
      ];

      mockTextSearch.mockImplementation((request, callback) => {
        callback(mockResults, window.google.maps.places.PlacesServiceStatus.OK);
      });

      const results = await placesService.textSearch('global search');

      expect(mockTextSearch).toHaveBeenCalledWith({ query: 'global search' }, expect.any(Function));
      expect(results).toEqual(mockResults);
    });
  });
});
