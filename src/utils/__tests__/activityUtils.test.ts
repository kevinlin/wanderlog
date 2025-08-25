import { describe, it, expect } from 'vitest';
import { 
  inferActivityType, 
  enrichActivityWithType, 
  enrichActivitiesWithTypes, 
  getActivityTypeIcon, 
  getActivityTypeColor,
  getActivityTypeSvgPath
} from '../activityUtils';
import { Activity, ActivityType } from '@/types/trip';

describe('ActivityUtils', () => {
  describe('inferActivityType', () => {
    it('should infer RESTAURANT type from restaurant keywords', () => {
      expect(inferActivityType('Fisherman\'s Wharf Restaurant')).toBe(ActivityType.RESTAURANT);
      expect(inferActivityType('Coffee at Beans Cafe')).toBe(ActivityType.RESTAURANT);
      expect(inferActivityType('Dinner at Local Bistro')).toBe(ActivityType.RESTAURANT);
      expect(inferActivityType('Brewery Tour and Tasting')).toBe(ActivityType.RESTAURANT);
      expect(inferActivityType('Pub Lunch')).toBe(ActivityType.RESTAURANT);
    });

    it('should infer ATTRACTION type from attraction keywords', () => {
      expect(inferActivityType('Visit Milford Sound')).toBe(ActivityType.ATTRACTION);
      expect(inferActivityType('Museum of Transport')).toBe(ActivityType.ATTRACTION);
      expect(inferActivityType('Scenic Lookout Point')).toBe(ActivityType.ATTRACTION);
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
      expect(inferActivityType('Beach Swimming')).toBe(ActivityType.OUTDOOR);
      expect(inferActivityType('Glacier Walk')).toBe(ActivityType.OUTDOOR);
      expect(inferActivityType('Jetboat Ride')).toBe(ActivityType.OUTDOOR);
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
        location: { lat: -45.0, lng: 170.0 }
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
        location: { lat: -45.0, lng: 170.0 }
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
        remarks: 'Bring camera'
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
        { activity_id: '3', activity_name: 'Museum Visit' }
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
      expect(getActivityTypeColor(ActivityType.TRANSPORT)).toMatch(hexColorRegex);
      expect(getActivityTypeColor(ActivityType.OTHER)).toMatch(hexColorRegex);
    });

    it('should return distinct colors for different types', () => {
      const colors = [
        getActivityTypeColor(ActivityType.RESTAURANT),
        getActivityTypeColor(ActivityType.ATTRACTION),
        getActivityTypeColor(ActivityType.SHOPPING),
        getActivityTypeColor(ActivityType.OUTDOOR),
        getActivityTypeColor(ActivityType.CULTURAL),
        getActivityTypeColor(ActivityType.TRANSPORT),
        getActivityTypeColor(ActivityType.OTHER)
      ];

      const uniqueColors = new Set(colors);
      expect(uniqueColors.size).toBe(colors.length);
    });

    it('should return specific expected colors from Tailwind Colors v4 palette', () => {
      expect(getActivityTypeColor(ActivityType.RESTAURANT)).toBe('#f97316'); // Orange-500
      expect(getActivityTypeColor(ActivityType.ATTRACTION)).toBe('#8b5cf6'); // Violet-500
      expect(getActivityTypeColor(ActivityType.SHOPPING)).toBe('#f59e0b'); // Amber-500
      expect(getActivityTypeColor(ActivityType.OUTDOOR)).toBe('#10b981'); // Emerald-500
      expect(getActivityTypeColor(ActivityType.CULTURAL)).toBe('#06b6d4'); // Cyan-500
      expect(getActivityTypeColor(ActivityType.TRANSPORT)).toBe('#6366f1'); // Indigo-500
      expect(getActivityTypeColor(ActivityType.OTHER)).toBe('#0ea5e9'); // Sky-500
    });
  });

  describe('getActivityTypeSvgPath', () => {
    it('should return restaurant icon path for restaurant type', () => {
      const path = getActivityTypeSvgPath(ActivityType.RESTAURANT);
      expect(path).toBe('M8 2v20h2V2H8zm4 0v20h2v-4h4V2h-6zm2 2h2v12h-2V4z');
    });

    it('should return attraction icon path for attraction type', () => {
      const path = getActivityTypeSvgPath(ActivityType.ATTRACTION);
      expect(path).toBe('M9 2a1 1 0 000 2h2a1 1 0 100-2H9zM4 5a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V7a2 2 0 00-2-2H4zm8 2a4 4 0 100 8 4 4 0 000-8z');
    });

    it('should return shopping icon path for shopping type', () => {
      const path = getActivityTypeSvgPath(ActivityType.SHOPPING);
      expect(path).toBe('M6 2a2 2 0 00-2 2v2a2 2 0 002 2h.5L8 22h8l1.5-14H18a2 2 0 002-2V4a2 2 0 00-2-2H6zm2 4V4h8v2H8z');
    });

    it('should return outdoor icon path for outdoor type', () => {
      const path = getActivityTypeSvgPath(ActivityType.OUTDOOR);
      expect(path).toBe('M2.5 16L4 14l1.5 2 3-4 3 4 1.5-2 3 4 3-4L21.5 16H2.5zM12 6a2 2 0 100-4 2 2 0 000 4z');
    });

    it('should return cultural icon path for cultural type', () => {
      const path = getActivityTypeSvgPath(ActivityType.CULTURAL);
      expect(path).toBe('M6.5 2a.5.5 0 01.5.5V3h10v-.5a.5.5 0 011 0V3h1a1 1 0 011 1v16a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1h1v-.5a.5.5 0 01.5-.5zM6 5v2h12V5H6zm0 4v2h2V9H6zm4 0v2h2V9h-2zm4 0v2h2V9h-2zM6 13v2h2v-2H6zm4 0v2h2v-2h-2zm4 0v2h2v-2h-2z');
    });

    it('should return transport icon path for transport type', () => {
      const path = getActivityTypeSvgPath(ActivityType.TRANSPORT);
      expect(path).toBe('M5 17a2 2 0 104 0 2 2 0 00-4 0zm10 0a2 2 0 104 0 2 2 0 00-4 0zM4 5a1 1 0 011-1h14a1 1 0 011 1v8a1 1 0 01-1 1H5a1 1 0 01-1-1V5z');
    });

    it('should return flag icon path for other type', () => {
      const path = getActivityTypeSvgPath(ActivityType.OTHER);
      expect(path).toBe('M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1v12z');
    });

    it('should return flag icon path for undefined type', () => {
      const path = getActivityTypeSvgPath(undefined as any);
      expect(path).toBe('M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1v12z');
    });
  });
});
