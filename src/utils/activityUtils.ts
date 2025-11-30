import { type Activity, ActivityType } from '@/types/trip';

/**
 * Keywords for inferring activity types from activity names
 */
const ACTIVITY_TYPE_KEYWORDS = {
  [ActivityType.RESTAURANT]: [
    'restaurant',
    'cafe',
    'bar',
    'pub',
    'bistro',
    'brewery',
    'winery',
    'dining',
    'food',
    'meal',
    'breakfast',
    'lunch',
    'dinner',
    'eat',
    'drink',
    'coffee',
    'bakery',
    'deli',
    'pizzeria',
    'buffet',
    'kitchen',
    'grill',
    'tavern',
  ],
  [ActivityType.ATTRACTION]: [
    'museum',
    'gallery',
    'park',
    'garden',
    'zoo',
    'aquarium',
    'attraction',
    'monument',
    'landmark',
    'viewpoint',
    'lookout',
    'scenic',
    'sightseeing',
    'tourist',
    'visit',
    'tour',
    'observatory',
    'heritage',
    'historic',
    'castle',
    'palace',
    'cathedral',
    'church',
    'temple',
    'bridge',
    'tower',
    'falls',
    'waterfall',
    'sound',
    'fiord',
    'milford',
    'head',
    'cape',
    'point',
  ],
  [ActivityType.SHOPPING]: [
    'shop',
    'shopping',
    'market visit',
    'store',
    'mall',
    'boutique',
    'outlet',
    'souvenir',
    'craft store',
    'artisan shop',
    'farmers market',
    'buy',
    'purchase',
    'retail',
    'shopping centre',
    'shopping plaza',
  ],
  [ActivityType.OUTDOOR]: [
    'hiking',
    'walk',
    'trail',
    'track',
    'climb',
    'climbing',
    'kayak',
    'rafting',
    'fishing',
    'swimming',
    'beach',
    'surf',
    'bike',
    'cycling',
    'mountain',
    'alpine',
    'glacier',
    'fjord',
    'adventure',
    'outdoor',
    'nature',
    'wildlife',
    'safari',
    'bungee',
    'skydive',
    'zip',
    'jetboat',
    'cruise',
    'sailing',
    'boat trip',
    'whale watching',
    'dolphin',
    'seal',
    'penguin',
    'bird watching',
  ],
  [ActivityType.CULTURAL]: [
    'cultural',
    'culture',
    'maori',
    'indigenous',
    'traditional',
    'performance',
    'show',
    'theatre',
    'concert',
    'festival',
    'event',
    'art exhibition',
    'music',
    'dance',
    'workshop',
    'cultural experience',
    'cultural village',
    'community',
    'hangi',
    'cultural centre',
  ],
  [ActivityType.TRANSPORT]: [
    'drive',
    'driving',
    'flight',
    'ferry',
    'bus',
    'train',
    'transfer',
    'pickup',
    'drop off',
    'rental',
    'car hire',
    'airport',
    'station',
    'terminal',
    'departure',
    'arrival',
    'journey',
    'travel',
    'scenic drive',
    'route',
    'highway',
    'road',
  ],
};

/**
 * Infers activity type from activity name using keyword matching
 * @param activityName - The name of the activity
 * @param existingType - Any existing activity type (takes precedence)
 * @param googlePlaceTypes - Optional Google Places API types for POI inference
 * @returns The inferred ActivityType
 */
export function inferActivityType(activityName: string, existingType?: ActivityType, googlePlaceTypes?: string[]): ActivityType {
  // If activity already has a type, use it
  if (existingType && Object.values(ActivityType).includes(existingType)) {
    return existingType;
  }

  // If Google Places types are provided, use them for inference
  if (googlePlaceTypes && googlePlaceTypes.length > 0) {
    const inferredFromPlaces = inferActivityTypeFromGooglePlaces(googlePlaceTypes);
    if (inferredFromPlaces !== ActivityType.OTHER) {
      return inferredFromPlaces;
    }
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
    ActivityType.ATTRACTION, // Last because it has generic words like "visit"
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
 * Infers activity type from Google Places API types
 * @param placeTypes - Array of Google Places types
 * @returns The inferred ActivityType
 */
export function inferActivityTypeFromGooglePlaces(placeTypes: string[]): ActivityType {
  // Google Places type mappings to our activity types
  const googlePlaceTypeMap: Record<string, ActivityType> = {
    // Restaurant types
    restaurant: ActivityType.RESTAURANT,
    food: ActivityType.RESTAURANT,
    meal_takeaway: ActivityType.RESTAURANT,
    meal_delivery: ActivityType.RESTAURANT,
    cafe: ActivityType.RESTAURANT,
    bar: ActivityType.RESTAURANT,
    bakery: ActivityType.RESTAURANT,
    night_club: ActivityType.RESTAURANT,

    // Attraction types
    tourist_attraction: ActivityType.ATTRACTION,
    museum: ActivityType.ATTRACTION,
    amusement_park: ActivityType.ATTRACTION,
    aquarium: ActivityType.ATTRACTION,
    art_gallery: ActivityType.ATTRACTION,
    zoo: ActivityType.ATTRACTION,
    park: ActivityType.ATTRACTION,
    natural_feature: ActivityType.ATTRACTION,
    point_of_interest: ActivityType.ATTRACTION,

    // Shopping types
    shopping_mall: ActivityType.SHOPPING,
    store: ActivityType.SHOPPING,
    clothing_store: ActivityType.SHOPPING,
    shoe_store: ActivityType.SHOPPING,
    jewelry_store: ActivityType.SHOPPING,
    book_store: ActivityType.SHOPPING,
    electronics_store: ActivityType.SHOPPING,
    furniture_store: ActivityType.SHOPPING,
    supermarket: ActivityType.SHOPPING,
    department_store: ActivityType.SHOPPING,

    // Outdoor types
    campground: ActivityType.OUTDOOR,
    rv_park: ActivityType.OUTDOOR,
    stadium: ActivityType.OUTDOOR,
    gym: ActivityType.OUTDOOR,
    spa: ActivityType.OUTDOOR,

    // Cultural types
    library: ActivityType.CULTURAL,
    university: ActivityType.CULTURAL,
    school: ActivityType.CULTURAL,
    church: ActivityType.CULTURAL,
    hindu_temple: ActivityType.CULTURAL,
    mosque: ActivityType.CULTURAL,
    synagogue: ActivityType.CULTURAL,
    place_of_worship: ActivityType.CULTURAL,

    // Transport types
    gas_station: ActivityType.TRANSPORT,
    car_rental: ActivityType.TRANSPORT,
    subway_station: ActivityType.TRANSPORT,
    train_station: ActivityType.TRANSPORT,
    bus_station: ActivityType.TRANSPORT,
    airport: ActivityType.TRANSPORT,
    taxi_stand: ActivityType.TRANSPORT,
    parking: ActivityType.TRANSPORT,
  };

  // Check each place type and return the first match
  for (const placeType of placeTypes) {
    const activityType = googlePlaceTypeMap[placeType];
    if (activityType) {
      return activityType;
    }
  }

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
    activity_type: inferActivityType(activity.activity_name, activity.activity_type),
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
    [ActivityType.OTHER]: '📍',
  };

  return iconMap[activityType] || iconMap[ActivityType.OTHER];
}

/**
 * Gets the color for an activity type (for pin styling)
 * @param activityType - The activity type
 * @returns Hex color string for the activity type
 */
export function getActivityTypeColor(activityType: ActivityType): string {
  // Modern, vivid, and dynamic color palette using Tailwind Colors v4
  const colorMap = {
    [ActivityType.RESTAURANT]: '#f97316', // Orange-500 - Energetic orange for dining experiences
    [ActivityType.ATTRACTION]: '#8b5cf6', // Violet-500 - Modern violet for sightseeing and attractions
    [ActivityType.SHOPPING]: '#f59e0b', // Amber-500 - Bright amber for shopping and retail
    [ActivityType.OUTDOOR]: '#10b981', // Emerald-500 - Rich green for outdoor activities and nature
    [ActivityType.CULTURAL]: '#06b6d4', // Cyan-500 - Vibrant cyan for cultural experiences
    [ActivityType.TRANSPORT]: '#6366f1', // Indigo-500 - Deep indigo for transportation
    [ActivityType.OTHER]: '#0ea5e9', // Sky-500 - Primary accent blue as default
  };

  return colorMap[activityType] || colorMap[ActivityType.OTHER];
}

/**
 * Gets the SVG path for an activity type icon (for pin styling)
 * @param activityType - The activity type
 * @returns SVG path string for the activity type icon
 */
export function getActivityTypeSvgPath(activityType: ActivityType): string {
  const iconMap = {
    // Restaurant: Fork and knife icon
    [ActivityType.RESTAURANT]: 'M8 2v20h2V2H8zm4 0v20h2v-4h4V2h-6zm2 2h2v12h-2V4z',

    // Attraction: Camera/sightseeing icon
    [ActivityType.ATTRACTION]:
      'M9 2a1 1 0 000 2h2a1 1 0 100-2H9zM4 5a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V7a2 2 0 00-2-2H4zm8 2a4 4 0 100 8 4 4 0 000-8z',

    // Shopping: Shopping bag icon
    [ActivityType.SHOPPING]: 'M6 2a2 2 0 00-2 2v2a2 2 0 002 2h.5L8 22h8l1.5-14H18a2 2 0 002-2V4a2 2 0 00-2-2H6zm2 4V4h8v2H8z',

    // Outdoor: Mountain/hiking icon
    [ActivityType.OUTDOOR]: 'M2.5 16L4 14l1.5 2 3-4 3 4 1.5-2 3 4 3-4L21.5 16H2.5zM12 6a2 2 0 100-4 2 2 0 000 4z',

    // Cultural: Museum/building icon
    [ActivityType.CULTURAL]:
      'M6.5 2a.5.5 0 01.5.5V3h10v-.5a.5.5 0 011 0V3h1a1 1 0 011 1v16a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1h1v-.5a.5.5 0 01.5-.5zM6 5v2h12V5H6zm0 4v2h2V9H6zm4 0v2h2V9h-2zm4 0v2h2V9h-2zM6 13v2h2v-2H6zm4 0v2h2v-2h-2zm4 0v2h2v-2h-2z',

    // Transport: Vehicle icon
    [ActivityType.TRANSPORT]:
      'M5 17a2 2 0 104 0 2 2 0 00-4 0zm10 0a2 2 0 104 0 2 2 0 00-4 0zM4 5a1 1 0 011-1h14a1 1 0 011 1v8a1 1 0 01-1 1H5a1 1 0 01-1-1V5z',

    // Other/Default: Flag icon (primary accent)
    [ActivityType.OTHER]: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1v12z',
  };

  return iconMap[activityType] || iconMap[ActivityType.OTHER];
}
