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
      expect(getActivityTypeColor(ActivityType.RECREATION)).toBe('#0ea5e9'); // Sky-500 (shared with OTHER)
      expect(getActivityTypeColor(ActivityType.SCENIC)).toBe('#8b5cf6'); // Violet-500 (shared with ATTRACTION)
      expect(getActivityTypeColor(ActivityType.BEACH)).toBe('#06b6d4'); // Cyan-500 (shared with CULTURAL)
      expect(getActivityTypeColor(ActivityType.PLAYGROUND)).toBe('#f59e0b'); // Amber-500 (shared with OUTDOOR)
      expect(getActivityTypeColor(ActivityType.GROCERY)).toBe('#10b981'); // Emerald-500 (shared with SHOPPING)
      expect(getActivityTypeColor(ActivityType.TRANSPORT)).toBe('#6366f1'); // Indigo-500
      expect(getActivityTypeColor(ActivityType.OTHER)).toBe('#0ea5e9'); // Sky-500 (shared with RECREATION)
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
    const expectedLocationPinPath =
      'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z';

    it('should return location pin icon for all activity types', () => {
      // Test all activity types return the same location pin icon
      const allTypes = [
        ActivityType.RESTAURANT,
        ActivityType.ATTRACTION,
        ActivityType.SHOPPING,
        ActivityType.OUTDOOR,
        ActivityType.CULTURAL,
        ActivityType.RECREATION,
        ActivityType.SCENIC,
        ActivityType.BEACH,
        ActivityType.PLAYGROUND,
        ActivityType.GROCERY,
        ActivityType.TRANSPORT,
        ActivityType.OTHER,
      ];

      allTypes.forEach((type) => {
        expect(getActivityTypeSvgPath(type)).toBe(expectedLocationPinPath);
      });
    });

    it('should return location pin icon for undefined type', () => {
      const path = getActivityTypeSvgPath(undefined as any);
      expect(path).toBe(expectedLocationPinPath);
    });
  });
});
