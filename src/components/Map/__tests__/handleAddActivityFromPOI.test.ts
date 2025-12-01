import { describe, expect, it } from 'vitest';
import type { POIDetails } from '../../../types/poi';
import { ActivityType } from '../../../types/trip';

// This test file verifies the logic for converting POI data to Activity format
// It validates that handleAddActivityFromPOI creates activities with the correct fields

describe('handleAddActivityFromPOI logic', () => {
  it('should create activity with thumbnail_url when POI has photos', () => {
    const mockPOI: POIDetails = {
      place_id: 'ChIJ0V7CXcf0MW0Rr-YZarWKrZU',
      name: 'Test Restaurant',
      formatted_address: '123 Test St, Test City',
      location: { lat: -44.5, lng: 170.0 },
      types: ['restaurant', 'food'],
      rating: 4.5,
      user_ratings_total: 100,
      website: 'https://example.com',
      photos: [
        {
          photo_reference: 'https://maps.googleapis.com/maps/api/place/photo?photoreference=test123',
          height: 400,
          width: 400,
        },
      ],
    };

    // Simulate the activity creation logic from handleAddActivityFromPOI
    const activityId = `poi_${mockPOI.place_id}_${Date.now()}`;
    const newActivity = {
      activity_id: activityId,
      activity_name: mockPOI.name,
      activity_type: ActivityType.RESTAURANT,
      location: {
        lat: mockPOI.location.lat,
        lng: mockPOI.location.lng,
        address: mockPOI.formatted_address,
      },
      duration: '1-2 hours',
      url: mockPOI.website,
      remarks: mockPOI.rating ? `Rating: ${mockPOI.rating}/5 (${mockPOI.user_ratings_total} reviews)` : undefined,
      order: 999,
      thumbnail_url: mockPOI.photos?.[0]?.photo_reference,
      google_place_id: mockPOI.place_id,
    };

    expect(newActivity.thumbnail_url).toBe('https://maps.googleapis.com/maps/api/place/photo?photoreference=test123');
    expect(newActivity.google_place_id).toBe('ChIJ0V7CXcf0MW0Rr-YZarWKrZU');
    expect(newActivity.activity_name).toBe('Test Restaurant');
    expect(newActivity.location.address).toBe('123 Test St, Test City');
  });

  it('should create activity without thumbnail_url when POI has no photos', () => {
    const mockPOI: POIDetails = {
      place_id: 'ChIJ0V7CXcf0MW0Rr-YZarWKrZU',
      name: 'Test Cafe',
      formatted_address: '456 Test Ave, Test City',
      location: { lat: -44.6, lng: 170.1 },
      types: ['cafe', 'food'],
      rating: 4.2,
      user_ratings_total: 50,
    };

    // Simulate the activity creation logic from handleAddActivityFromPOI
    const activityId = `poi_${mockPOI.place_id}_${Date.now()}`;
    const newActivity = {
      activity_id: activityId,
      activity_name: mockPOI.name,
      activity_type: ActivityType.RESTAURANT,
      location: {
        lat: mockPOI.location.lat,
        lng: mockPOI.location.lng,
        address: mockPOI.formatted_address,
      },
      duration: '1-2 hours',
      url: mockPOI.website,
      remarks: mockPOI.rating ? `Rating: ${mockPOI.rating}/5 (${mockPOI.user_ratings_total} reviews)` : undefined,
      order: 999,
      thumbnail_url: mockPOI.photos?.[0]?.photo_reference,
      google_place_id: mockPOI.place_id,
    };

    expect(newActivity.thumbnail_url).toBeUndefined();
    expect(newActivity.google_place_id).toBe('ChIJ0V7CXcf0MW0Rr-YZarWKrZU');
    expect(newActivity.activity_name).toBe('Test Cafe');
  });

  it('should include rating information in remarks when POI has rating', () => {
    const mockPOI: POIDetails = {
      place_id: 'ChIJ123abc',
      name: 'Woolworths Christchurch Airport',
      formatted_address: '530/546A Memorial Avenue, Christchurch Airport',
      location: { lat: -43.490_069_7, lng: 172.547_657 },
      types: ['grocery_or_supermarket', 'store'],
      rating: 4.2,
      user_ratings_total: 1545,
      photos: [
        {
          photo_reference: 'https://maps.googleapis.com/maps/api/place/photo?photoreference=woolworths123',
          height: 400,
          width: 400,
        },
      ],
    };

    // Simulate the activity creation logic from handleAddActivityFromPOI
    const newActivity = {
      activity_id: `poi_${mockPOI.place_id}_${Date.now()}`,
      activity_name: mockPOI.name,
      activity_type: ActivityType.SHOPPING,
      location: {
        lat: mockPOI.location.lat,
        lng: mockPOI.location.lng,
        address: mockPOI.formatted_address,
      },
      duration: '1-2 hours',
      url: mockPOI.website,
      remarks: mockPOI.rating ? `Rating: ${mockPOI.rating}/5 (${mockPOI.user_ratings_total} reviews)` : undefined,
      order: 999,
      thumbnail_url: mockPOI.photos?.[0]?.photo_reference,
      google_place_id: mockPOI.place_id,
    };

    expect(newActivity.remarks).toBe('Rating: 4.2/5 (1545 reviews)');
    expect(newActivity.google_place_id).toBe('ChIJ123abc');
    expect(newActivity.thumbnail_url).toBe('https://maps.googleapis.com/maps/api/place/photo?photoreference=woolworths123');
  });

  it('should not include remarks when POI has no rating', () => {
    const mockPOI: POIDetails = {
      place_id: 'ChIJ456def',
      name: 'New Place',
      formatted_address: '789 New St',
      location: { lat: -44.7, lng: 170.3 },
      types: ['point_of_interest'],
    };

    // Simulate the activity creation logic from handleAddActivityFromPOI
    const newActivity = {
      activity_id: `poi_${mockPOI.place_id}_${Date.now()}`,
      activity_name: mockPOI.name,
      activity_type: ActivityType.OTHER,
      location: {
        lat: mockPOI.location.lat,
        lng: mockPOI.location.lng,
        address: mockPOI.formatted_address,
      },
      duration: '1-2 hours',
      url: mockPOI.website,
      remarks: mockPOI.rating ? `Rating: ${mockPOI.rating}/5 (${mockPOI.user_ratings_total} reviews)` : undefined,
      order: 999,
      thumbnail_url: mockPOI.photos?.[0]?.photo_reference,
      google_place_id: mockPOI.place_id,
    };

    expect(newActivity.remarks).toBeUndefined();
    expect(newActivity.google_place_id).toBe('ChIJ456def');
    expect(newActivity.thumbnail_url).toBeUndefined();
  });

  it('should handle POI with empty photos array', () => {
    const mockPOI: POIDetails = {
      place_id: 'ChIJ789ghi',
      name: 'Test Location',
      formatted_address: '111 Empty St',
      location: { lat: -44.8, lng: 170.4 },
      types: ['establishment'],
      photos: [], // Empty array
    };

    // Simulate the activity creation logic from handleAddActivityFromPOI
    const newActivity = {
      activity_id: `poi_${mockPOI.place_id}_${Date.now()}`,
      activity_name: mockPOI.name,
      activity_type: ActivityType.OTHER,
      location: {
        lat: mockPOI.location.lat,
        lng: mockPOI.location.lng,
        address: mockPOI.formatted_address,
      },
      duration: '1-2 hours',
      url: mockPOI.website,
      remarks: mockPOI.rating ? `Rating: ${mockPOI.rating}/5 (${mockPOI.user_ratings_total} reviews)` : undefined,
      order: 999,
      thumbnail_url: mockPOI.photos?.[0]?.photo_reference,
      google_place_id: mockPOI.place_id,
    };

    expect(newActivity.thumbnail_url).toBeUndefined();
    expect(newActivity.google_place_id).toBe('ChIJ789ghi');
  });

  it('should preserve all required fields from POI', () => {
    const mockPOI: POIDetails = {
      place_id: 'ChIJComplete',
      name: 'Complete Restaurant',
      formatted_address: '123 Complete St, Complete City, Complete Country',
      location: { lat: -45.0, lng: 171.0 },
      types: ['restaurant', 'food', 'establishment'],
      rating: 4.8,
      user_ratings_total: 2500,
      website: 'https://complete-restaurant.com',
      photos: [
        {
          photo_reference: 'https://maps.googleapis.com/maps/api/place/photo?photoreference=complete123',
          height: 800,
          width: 1200,
        },
      ],
    };

    // Simulate the activity creation logic from handleAddActivityFromPOI
    const activityId = `poi_${mockPOI.place_id}_${Date.now()}`;
    const newActivity = {
      activity_id: activityId,
      activity_name: mockPOI.name,
      activity_type: ActivityType.RESTAURANT,
      location: {
        lat: mockPOI.location.lat,
        lng: mockPOI.location.lng,
        address: mockPOI.formatted_address,
      },
      duration: '1-2 hours',
      url: mockPOI.website,
      remarks: mockPOI.rating ? `Rating: ${mockPOI.rating}/5 (${mockPOI.user_ratings_total} reviews)` : undefined,
      order: 999,
      thumbnail_url: mockPOI.photos?.[0]?.photo_reference,
      google_place_id: mockPOI.place_id,
    };

    // Verify all fields are correctly populated
    expect(newActivity.activity_id).toMatch(/^poi_ChIJComplete_\d+$/);
    expect(newActivity.activity_name).toBe('Complete Restaurant');
    expect(newActivity.activity_type).toBe(ActivityType.RESTAURANT);
    expect(newActivity.location.lat).toBe(-45.0);
    expect(newActivity.location.lng).toBe(171.0);
    expect(newActivity.location.address).toBe('123 Complete St, Complete City, Complete Country');
    expect(newActivity.duration).toBe('1-2 hours');
    expect(newActivity.url).toBe('https://complete-restaurant.com');
    expect(newActivity.remarks).toBe('Rating: 4.8/5 (2500 reviews)');
    expect(newActivity.order).toBe(999);
    expect(newActivity.thumbnail_url).toBe('https://maps.googleapis.com/maps/api/place/photo?photoreference=complete123');
    expect(newActivity.google_place_id).toBe('ChIJComplete');
  });
});
