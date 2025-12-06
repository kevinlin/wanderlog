import { describe, expect, it } from 'vitest';
import { type Activity, ActivityType } from '@/types/trip';
import {
  enrichActivitiesWithTypes,
  enrichActivityWithType,
  getActivityTypeColor,
  getActivityTypeIcon,
  getActivityTypeSvgPath,
  inferActivityType,
} from '../activityUtils';

describe('ActivityUtils', () => {
  describe('inferActivityType', () => {
    it('should infer RESTAURANT type from restaurant keywords', () => {
      expect(inferActivityType("Fisherman's Wharf Restaurant")).toBe(ActivityType.RESTAURANT);
      expect(inferActivityType('Coffee at Beans Cafe')).toBe(ActivityType.RESTAURANT);
      expect(inferActivityType('Dinner at Local Bistro')).toBe(ActivityType.RESTAURANT);
      expect(inferActivityType('Brewery Tour and Tasting')).toBe(ActivityType.RESTAURANT);
      expect(inferActivityType('Pub Lunch')).toBe(ActivityType.RESTAURANT);
    });

    it('should infer ATTRACTION type from attraction keywords', () => {
      expect(inferActivityType('Visit Milford Sound')).toBe(ActivityType.ATTRACTION);
      expect(inferActivityType('Museum of Transport')).toBe(ActivityType.ATTRACTION);
      expect(inferActivityType('Queenstown Gardens')).toBe(ActivityType.ATTRACTION);
      expect(inferActivityType('Heritage Castle Tour')).toBe(ActivityType.ATTRACTION);
      expect(inferActivityType('Waterfall Viewing')).toBe(ActivityType.ATTRACTION);
    });

    it('should infer SHOPPING type from shopping keywords', () => {
      expect(inferActivityType('Souvenir Shopping')).toBe(ActivityType.SHOPPING);
      expect(inferActivityType('Shopping Mall Trip')).toBe(ActivityType.SHOPPING);
      expect(inferActivityType('Craft Store Browse')).toBe(ActivityType.SHOPPING);
      expect(inferActivityType('Farmers Market Shopping')).toBe(ActivityType.SHOPPING);
    });

    it('should infer OUTDOOR type from outdoor keywords', () => {
      expect(inferActivityType('Hiking Trail Adventure')).toBe(ActivityType.OUTDOOR);
      expect(inferActivityType('Kayaking Activity')).toBe(ActivityType.OUTDOOR);
      expect(inferActivityType('Mountain Climbing')).toBe(ActivityType.OUTDOOR);
      expect(inferActivityType('Lake Swimming')).toBe(ActivityType.OUTDOOR);
      expect(inferActivityType('Glacier Walk')).toBe(ActivityType.OUTDOOR);
      expect(inferActivityType('Bike Trail Ride')).toBe(ActivityType.OUTDOOR);
      expect(inferActivityType('Whale Watching Tour')).toBe(ActivityType.OUTDOOR);
    });

    it('should infer CULTURAL type from cultural keywords', () => {
      expect(inferActivityType('Maori Cultural Experience')).toBe(ActivityType.CULTURAL);
      expect(inferActivityType('Traditional Hangi Feast')).toBe(ActivityType.CULTURAL);
      expect(inferActivityType('Cultural Performance Show')).toBe(ActivityType.CULTURAL);
      expect(inferActivityType('Music Concert')).toBe(ActivityType.CULTURAL);
      expect(inferActivityType('Cultural Centre Visit')).toBe(ActivityType.CULTURAL);
    });

    it('should infer TRANSPORT type from transport keywords', () => {
      expect(inferActivityType('Driving to Christchurch')).toBe(ActivityType.TRANSPORT);
      expect(inferActivityType('Ferry to Stewart Island')).toBe(ActivityType.TRANSPORT);
      expect(inferActivityType('Flight to Auckland')).toBe(ActivityType.TRANSPORT);
      expect(inferActivityType('Scenic Drive Route')).toBe(ActivityType.TRANSPORT);
      expect(inferActivityType('Airport Transfer')).toBe(ActivityType.TRANSPORT);
    });

    it('should infer SCENIC type from scenic keywords', () => {
      expect(inferActivityType('Scenic Lookout Point')).toBe(ActivityType.SCENIC);
      expect(inferActivityType('Mountain Summit Viewpoint')).toBe(ActivityType.SCENIC);
      expect(inferActivityType('Mirror Lakes')).toBe(ActivityType.SCENIC);
      expect(inferActivityType('Bridge Walkway')).toBe(ActivityType.SCENIC);
    });

    it('should infer BEACH type from beach keywords', () => {
      expect(inferActivityType('Caroline Bay Beach')).toBe(ActivityType.BEACH);
      expect(inferActivityType('Brighton Pier')).toBe(ActivityType.BEACH);
      expect(inferActivityType('Coastline Walk')).toBe(ActivityType.BEACH);
      expect(inferActivityType('Bay Foreshore')).toBe(ActivityType.BEACH);
    });

    it('should infer PLAYGROUND type from playground keywords', () => {
      expect(inferActivityType('Margaret Mahy Family Playground')).toBe(ActivityType.PLAYGROUND);
      expect(inferActivityType('Lakefront Playground')).toBe(ActivityType.PLAYGROUND);
      expect(inferActivityType('Dinosaur Park')).toBe(ActivityType.PLAYGROUND);
      expect(inferActivityType('Kids Play Area')).toBe(ActivityType.PLAYGROUND);
    });

    it('should infer GROCERY type from grocery keywords', () => {
      expect(inferActivityType('Woolworths Supermarket')).toBe(ActivityType.GROCERY);
      expect(inferActivityType('Grocery Shopping')).toBe(ActivityType.GROCERY);
      expect(inferActivityType('Food Market')).toBe(ActivityType.GROCERY);
    });

    it('should infer RECREATION type from recreation keywords', () => {
      expect(inferActivityType('Tekapo Springs Hot Pools')).toBe(ActivityType.RECREATION);
      expect(inferActivityType('Skyline Gondola and Luge')).toBe(ActivityType.RECREATION);
      expect(inferActivityType('Glowworm Caves')).toBe(ActivityType.RECREATION);
      expect(inferActivityType('Puzzling World Maze')).toBe(ActivityType.RECREATION);
    });

    it('should default to OTHER type for unrecognized activities', () => {
      expect(inferActivityType('Random Activity Name')).toBe(ActivityType.OTHER);
      expect(inferActivityType('Something Unusual')).toBe(ActivityType.OTHER);
      expect(inferActivityType('')).toBe(ActivityType.OTHER);
    });

    it('should preserve existing type when provided', () => {
      expect(inferActivityType('Restaurant Visit', ActivityType.CULTURAL)).toBe(ActivityType.CULTURAL);
      expect(inferActivityType('Museum Visit', ActivityType.RESTAURANT)).toBe(ActivityType.RESTAURANT);
    });

    it('should be case insensitive', () => {
      expect(inferActivityType('RESTAURANT DINING')).toBe(ActivityType.RESTAURANT);
      expect(inferActivityType('hiking adventure')).toBe(ActivityType.OUTDOOR);
      expect(inferActivityType('MuSeUm ToUr')).toBe(ActivityType.ATTRACTION);
    });

    it('should handle partial keyword matches', () => {
      expect(inferActivityType('Fantastic Restaurant Experience')).toBe(ActivityType.RESTAURANT);
      expect(inferActivityType('Amazing Hiking Trail')).toBe(ActivityType.OUTDOOR);
      expect(inferActivityType('Beautiful Garden Visit')).toBe(ActivityType.ATTRACTION);
    });
  });

  describe('enrichActivityWithType', () => {
    it('should add activity_type to activity without existing type', () => {
      const activity: Activity = {
        activity_id: '1',
        activity_name: 'Restaurant Dinner',
        location: { lat: -45.0, lng: 170.0 },
      };

      const enriched = enrichActivityWithType(activity);
      expect(enriched.activity_type).toBe(ActivityType.RESTAURANT);
      expect(enriched.activity_id).toBe('1');
      expect(enriched.activity_name).toBe('Restaurant Dinner');
    });

    it('should preserve existing activity_type', () => {
      const activity: Activity = {
        activity_id: '1',
        activity_name: 'Restaurant Dinner',
        activity_type: ActivityType.CULTURAL,
        location: { lat: -45.0, lng: 170.0 },
      };

      const enriched = enrichActivityWithType(activity);
      expect(enriched.activity_type).toBe(ActivityType.CULTURAL);
    });

    it('should not modify other activity properties', () => {
      const activity: Activity = {
        activity_id: '1',
        activity_name: 'Museum Visit',
        location: { lat: -45.0, lng: 170.0, address: '123 Main St' },
        duration: '2 hours',
        url: 'https://example.com',
        remarks: 'Bring camera',
      };

      const enriched = enrichActivityWithType(activity);
      expect(enriched.location).toEqual(activity.location);
      expect(enriched.duration).toBe(activity.duration);
      expect(enriched.url).toBe(activity.url);
      expect(enriched.remarks).toBe(activity.remarks);
    });
  });

  describe('enrichActivitiesWithTypes', () => {
    it('should enrich array of activities', () => {
      const activities: Activity[] = [
        { activity_id: '1', activity_name: 'Restaurant Dinner' },
        { activity_id: '2', activity_name: 'Hiking Trail' },
        { activity_id: '3', activity_name: 'Museum Visit' },
      ];

      const enriched = enrichActivitiesWithTypes(activities);
      expect(enriched).toHaveLength(3);
      expect(enriched[0].activity_type).toBe(ActivityType.RESTAURANT);
      expect(enriched[1].activity_type).toBe(ActivityType.OUTDOOR);
      expect(enriched[2].activity_type).toBe(ActivityType.ATTRACTION);
    });

    it('should handle empty array', () => {
      const enriched = enrichActivitiesWithTypes([]);
      expect(enriched).toEqual([]);
    });
  });

  describe('getActivityTypeIcon', () => {
    it('should return correct icons for each activity type', () => {
      expect(getActivityTypeIcon(ActivityType.RESTAURANT)).toBe('🍽️');
      expect(getActivityTypeIcon(ActivityType.ATTRACTION)).toBe('📸');
      expect(getActivityTypeIcon(ActivityType.SHOPPING)).toBe('🛍️');
      expect(getActivityTypeIcon(ActivityType.OUTDOOR)).toBe('🏔️');
      expect(getActivityTypeIcon(ActivityType.CULTURAL)).toBe('🏛️');
      expect(getActivityTypeIcon(ActivityType.TRANSPORT)).toBe('🚗');
      expect(getActivityTypeIcon(ActivityType.OTHER)).toBe('📍');
    });
  });

  describe('getActivityTypeColor', () => {
    it('should return valid hex colors for each activity type', () => {
      const hexColorRegex = /^#[0-9A-F]{6}$/i;

      expect(getActivityTypeColor(ActivityType.RESTAURANT)).toMatch(hexColorRegex);
      expect(getActivityTypeColor(ActivityType.ATTRACTION)).toMatch(hexColorRegex);
      expect(getActivityTypeColor(ActivityType.SHOPPING)).toMatch(hexColorRegex);
      expect(getActivityTypeColor(ActivityType.OUTDOOR)).toMatch(hexColorRegex);
      expect(getActivityTypeColor(ActivityType.CULTURAL)).toMatch(hexColorRegex);
      expect(getActivityTypeColor(ActivityType.RECREATION)).toMatch(hexColorRegex);
      expect(getActivityTypeColor(ActivityType.SCENIC)).toMatch(hexColorRegex);
      expect(getActivityTypeColor(ActivityType.BEACH)).toMatch(hexColorRegex);
      expect(getActivityTypeColor(ActivityType.PLAYGROUND)).toMatch(hexColorRegex);
      expect(getActivityTypeColor(ActivityType.GROCERY)).toMatch(hexColorRegex);
      expect(getActivityTypeColor(ActivityType.TRANSPORT)).toMatch(hexColorRegex);
      expect(getActivityTypeColor(ActivityType.OTHER)).toMatch(hexColorRegex);
    });

    it('should return specific expected colors from Tailwind Colors v4 palette', () => {
      expect(getActivityTypeColor(ActivityType.RESTAURANT)).toBe('#f97316'); // Orange-500
      expect(getActivityTypeColor(ActivityType.ATTRACTION)).toBe('#8b5cf6'); // Violet-500
      expect(getActivityTypeColor(ActivityType.SHOPPING)).toBe('#10b981'); // Emerald-500
      expect(getActivityTypeColor(ActivityType.OUTDOOR)).toBe('#f59e0b'); // Amber-500
      expect(getActivityTypeColor(ActivityType.CULTURAL)).toBe('#06b6d4'); // Cyan-500
      expect(getActivityTypeColor(ActivityType.RECREATION)).toBe('#6366f1'); // Indigo-500 (shared with TRANSPORT)
      expect(getActivityTypeColor(ActivityType.SCENIC)).toBe('#8b5cf6'); // Violet-500 (shared with ATTRACTION)
      expect(getActivityTypeColor(ActivityType.BEACH)).toBe('#06b6d4'); // Cyan-500 (shared with CULTURAL)
      expect(getActivityTypeColor(ActivityType.PLAYGROUND)).toBe('#f59e0b'); // Amber-500 (shared with OUTDOOR)
      expect(getActivityTypeColor(ActivityType.GROCERY)).toBe('#10b981'); // Emerald-500 (shared with SHOPPING)
      expect(getActivityTypeColor(ActivityType.TRANSPORT)).toBe('#6366f1'); // Indigo-500 (shared with RECREATION)
      expect(getActivityTypeColor(ActivityType.OTHER)).toBe('#0ea5e9'); // Sky-500
    });

    it('should use a limited color palette with shared colors across related types', () => {
      // The color palette uses 7 distinct colors shared across 12 activity types
      const allColors = [
        getActivityTypeColor(ActivityType.RESTAURANT),
        getActivityTypeColor(ActivityType.ATTRACTION),
        getActivityTypeColor(ActivityType.SHOPPING),
        getActivityTypeColor(ActivityType.OUTDOOR),
        getActivityTypeColor(ActivityType.CULTURAL),
        getActivityTypeColor(ActivityType.RECREATION),
        getActivityTypeColor(ActivityType.SCENIC),
        getActivityTypeColor(ActivityType.BEACH),
        getActivityTypeColor(ActivityType.PLAYGROUND),
        getActivityTypeColor(ActivityType.GROCERY),
        getActivityTypeColor(ActivityType.TRANSPORT),
        getActivityTypeColor(ActivityType.OTHER),
      ];

      const uniqueColors = new Set(allColors);
      expect(uniqueColors.size).toBe(7); // 7 distinct colors across 12 types
    });
  });

  describe('getActivityTypeSvgPath', () => {
    it('should return restaurant icon path for restaurant type', () => {
      const path = getActivityTypeSvgPath(ActivityType.RESTAURANT);
      // Material Design utensils icon
      expect(path).toBe(
        'M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z'
      );
    });

    it('should return attraction icon path for attraction type', () => {
      const path = getActivityTypeSvgPath(ActivityType.ATTRACTION);
      // Material Design star icon
      expect(path).toBe('M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z');
    });

    it('should return shopping icon path for shopping type', () => {
      const path = getActivityTypeSvgPath(ActivityType.SHOPPING);
      // Material Design shopping bag icon
      expect(path).toBe(
        'M18 6h-2c0-2.21-1.79-4-4-4S8 3.79 8 6H6c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6-2c1.1 0 2 .9 2 2h-4c0-1.1.9-2 2-2zm6 16H6V8h2v2c0 .55.45 1 1 1s1-.45 1-1V8h4v2c0 .55.45 1 1 1s1-.45 1-1V8h2v12z'
      );
    });

    it('should return outdoor icon path for outdoor type', () => {
      const path = getActivityTypeSvgPath(ActivityType.OUTDOOR);
      // Material Design terrain/mountain icon
      expect(path).toBe('M14 6l-3.75 5 2.85 3.8-1.6 1.2C9.81 13.75 7 10 7 10l-6 8h22L14 6z');
    });

    it('should return cultural icon path for cultural type', () => {
      const path = getActivityTypeSvgPath(ActivityType.CULTURAL);
      // Material Design museum/account balance icon
      expect(path).toBe('M4 10v7h3v-7H4zm6 0v7h3v-7h-3zM2 22h19v-3H2v3zm14-12v7h3v-7h-3zm-4.5-9L2 6v2h19V6l-9.5-5z');
    });

    it('should return transport icon path for transport type', () => {
      const path = getActivityTypeSvgPath(ActivityType.TRANSPORT);
      // Material Design car icon
      expect(path).toBe(
        'M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z'
      );
    });

    it('should return location pin icon path for other type', () => {
      const path = getActivityTypeSvgPath(ActivityType.OTHER);
      // Material Design place/location pin icon
      expect(path).toBe(
        'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z'
      );
    });

    it('should return location pin icon path for undefined type', () => {
      const path = getActivityTypeSvgPath(undefined as any);
      // Material Design place/location pin icon (fallback)
      expect(path).toBe(
        'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z'
      );
    });
  });
});
