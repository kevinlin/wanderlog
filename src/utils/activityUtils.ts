import { Activity, ActivityType } from '@/types/trip';

/**
 * Keywords for inferring activity types from activity names
 */
const ACTIVITY_TYPE_KEYWORDS = {
  [ActivityType.RESTAURANT]: [
    'restaurant', 'cafe', 'bar', 'pub', 'bistro', 'brewery', 'winery', 'dining',
    'food', 'meal', 'breakfast', 'lunch', 'dinner', 'eat', 'drink', 'coffee',
    'bakery', 'deli', 'pizzeria', 'buffet', 'kitchen', 'grill', 'tavern'
  ],
  [ActivityType.ATTRACTION]: [
    'museum', 'gallery', 'park', 'garden', 'zoo', 'aquarium', 'attraction',
    'monument', 'landmark', 'viewpoint', 'lookout', 'scenic', 'sightseeing',
    'tourist', 'visit', 'tour', 'observatory', 'heritage', 'historic', 'castle',
    'palace', 'cathedral', 'church', 'temple', 'bridge', 'tower', 'falls',
    'waterfall', 'sound', 'fiord', 'milford', 'head', 'cape', 'point'
  ],
  [ActivityType.SHOPPING]: [
    'shop', 'shopping', 'market visit', 'store', 'mall', 'boutique', 'outlet',
    'souvenir', 'craft store', 'artisan shop', 'farmers market',
    'buy', 'purchase', 'retail', 'shopping centre', 'shopping plaza'
  ],
  [ActivityType.OUTDOOR]: [
    'hiking', 'walk', 'trail', 'track', 'climb', 'climbing', 'kayak', 'rafting',
    'fishing', 'swimming', 'beach', 'surf', 'bike', 'cycling', 'mountain',
    'alpine', 'glacier', 'fjord', 'adventure', 'outdoor', 'nature', 'wildlife',
    'safari', 'bungee', 'skydive', 'zip', 'jetboat', 'cruise', 'sailing',
    'boat trip', 'whale watching', 'dolphin', 'seal', 'penguin', 'bird watching'
  ],
  [ActivityType.CULTURAL]: [
    'cultural', 'culture', 'maori', 'indigenous', 'traditional', 'performance',
    'show', 'theatre', 'concert', 'festival', 'event', 'art exhibition', 'music',
    'dance', 'workshop', 'cultural experience', 'cultural village', 'community',
    'hangi', 'cultural centre'
  ],
  [ActivityType.TRANSPORT]: [
    'drive', 'driving', 'flight', 'ferry', 'bus', 'train',
    'transfer', 'pickup', 'drop off', 'rental', 'car hire', 'airport',
    'station', 'terminal', 'departure', 'arrival', 'journey', 'travel',
    'scenic drive', 'route', 'highway', 'road'
  ]
};

/**
 * Infers activity type from activity name using keyword matching
 * @param activityName - The name of the activity
 * @param existingType - Any existing activity type (takes precedence)
 * @returns The inferred ActivityType
 */
export function inferActivityType(
  activityName: string, 
  existingType?: ActivityType
): ActivityType {
  // If activity already has a type, use it
  if (existingType && Object.values(ActivityType).includes(existingType)) {
    return existingType;
  }

  // Convert activity name to lowercase for case-insensitive matching
  const nameToCheck = activityName.toLowerCase();

  // Check each activity type's keywords in priority order
  // Order matters: more specific types should be checked first
  const typeOrder = [
    ActivityType.RESTAURANT,
    ActivityType.SHOPPING,
    ActivityType.TRANSPORT,
    ActivityType.OUTDOOR,
    ActivityType.CULTURAL,
    ActivityType.ATTRACTION  // Last because it has generic words like "visit"
  ];

  for (const activityType of typeOrder) {
    const keywords = ACTIVITY_TYPE_KEYWORDS[activityType];
    for (const keyword of keywords) {
      if (nameToCheck.includes(keyword.toLowerCase())) {
        return activityType;
      }
    }
  }

  // Default to 'other' if no matches found
  return ActivityType.OTHER;
}

/**
 * Enriches activity data with inferred activity type
 * @param activity - The activity to enrich
 * @returns Activity with activity_type field set
 */
export function enrichActivityWithType(activity: Activity): Activity {
  return {
    ...activity,
    activity_type: inferActivityType(activity.activity_name, activity.activity_type)
  };
}

/**
 * Enriches an array of activities with inferred activity types
 * @param activities - Array of activities to enrich
 * @returns Array of activities with activity_type fields set
 */
export function enrichActivitiesWithTypes(activities: Activity[]): Activity[] {
  return activities.map(enrichActivityWithType);
}

/**
 * Gets the display icon for an activity type
 * @param activityType - The activity type
 * @returns Unicode icon string for the activity type
 */
export function getActivityTypeIcon(activityType: ActivityType): string {
  const iconMap = {
    [ActivityType.RESTAURANT]: '🍽️',
    [ActivityType.ATTRACTION]: '📸',
    [ActivityType.SHOPPING]: '🛍️',
    [ActivityType.OUTDOOR]: '🏔️',
    [ActivityType.CULTURAL]: '🏛️',
    [ActivityType.TRANSPORT]: '🚗',
    [ActivityType.OTHER]: '📍'
  };

  return iconMap[activityType] || iconMap[ActivityType.OTHER];
}

/**
 * Gets the color for an activity type (for pin styling)
 * @param activityType - The activity type
 * @returns Hex color string for the activity type
 */
export function getActivityTypeColor(activityType: ActivityType): string {
  const colorMap = {
    [ActivityType.RESTAURANT]: '#FF6B6B', // Warm red
    [ActivityType.ATTRACTION]: '#4ECDC4', // Teal
    [ActivityType.SHOPPING]: '#FFE66D', // Yellow
    [ActivityType.OUTDOOR]: '#95E1D3', // Mint green
    [ActivityType.CULTURAL]: '#A8E6CF', // Light green
    [ActivityType.TRANSPORT]: '#DDA0DD', // Plum
    [ActivityType.OTHER]: '#87CEEB' // Sky blue
  };

  return colorMap[activityType] || colorMap[ActivityType.OTHER];
}
