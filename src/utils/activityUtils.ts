import { type Activity, ActivityType, type TripData } from '@/types/trip';

// Kept for its cache-shape test coverage; POI adds now persist through the
// useCreateActivity/useCreateWaypoint mutations.
export function addActivityToStop(trip: TripData, stopId: string, activity: Activity): TripData {
  return {
    ...trip,
    stops: trip.stops.map((stop) => (stop.stop_id === stopId ? { ...stop, activities: [...stop.activities, activity] } : stop)),
  };
}

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
  [ActivityType.RECREATION]: [
    'springs',
    'hot pools',
    'gondola',
    'luge',
    'jet',
    'jetboat',
    'cruise',
    'farm tour',
    'animal experience',
    'wildlife',
    'glowworm',
    'caves',
    'puzzling',
    'maze',
  ],
  [ActivityType.SCENIC]: [
    'lookout',
    'viewpoint',
    'view point',
    'summit',
    'bridge walkway',
    'scenic reserve',
    'pass',
    'mirror',
    'lake views',
  ],
  [ActivityType.BEACH]: ['beach', 'pier', 'coastline', 'bay', 'foreshore'],
  [ActivityType.PLAYGROUND]: ['playground', 'play area', 'dinosaur park', 'family playground', 'lakefront playground'],
  [ActivityType.GROCERY]: ['woolworths', 'supermarket', 'grocery', 'food market'],
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
    ActivityType.GROCERY, // Very specific keywords
    ActivityType.PLAYGROUND, // Very specific keywords
    ActivityType.RESTAURANT, // Check before BEACH to avoid false matches on "wharf" etc
    ActivityType.BEACH, // Specific location type
    ActivityType.RECREATION, // Specific activity type
    ActivityType.SCENIC, // Specific viewpoint type
    ActivityType.SHOPPING,
    ActivityType.OUTDOOR,
    ActivityType.CULTURAL,
    ActivityType.TRANSPORT,
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

    // Grocery types (more specific than general shopping)
    supermarket: ActivityType.GROCERY,
    grocery_or_supermarket: ActivityType.GROCERY,
    convenience_store: ActivityType.GROCERY,

    // Playground types
    playground: ActivityType.PLAYGROUND,

    // Beach types
    beach: ActivityType.BEACH,

    // Recreation types
    amusement_park: ActivityType.RECREATION,
    aquarium: ActivityType.RECREATION,
    zoo: ActivityType.RECREATION,
    spa: ActivityType.RECREATION,
    bowling_alley: ActivityType.RECREATION,

    // Scenic types (viewpoints and natural landmarks)
    natural_feature: ActivityType.SCENIC,
    point_of_interest: ActivityType.SCENIC,

    // Attraction types
    tourist_attraction: ActivityType.ATTRACTION,
    museum: ActivityType.ATTRACTION,
    art_gallery: ActivityType.ATTRACTION,
    park: ActivityType.ATTRACTION,
    landmark: ActivityType.ATTRACTION,

    // Shopping types
    shopping_mall: ActivityType.SHOPPING,
    store: ActivityType.SHOPPING,
    clothing_store: ActivityType.SHOPPING,
    shoe_store: ActivityType.SHOPPING,
    jewelry_store: ActivityType.SHOPPING,
    book_store: ActivityType.SHOPPING,
    electronics_store: ActivityType.SHOPPING,
    furniture_store: ActivityType.SHOPPING,
    department_store: ActivityType.SHOPPING,

    // Outdoor types
    campground: ActivityType.OUTDOOR,
    rv_park: ActivityType.OUTDOOR,
    stadium: ActivityType.OUTDOOR,
    gym: ActivityType.OUTDOOR,

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
    airport: ActivityType.TRANSPORT,
    bus_station: ActivityType.TRANSPORT,
    train_station: ActivityType.TRANSPORT,
    transit_station: ActivityType.TRANSPORT,
    car_rental: ActivityType.TRANSPORT,
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
    [ActivityType.RECREATION]: '🎢',
    [ActivityType.SCENIC]: '🌄',
    [ActivityType.BEACH]: '🏖️',
    [ActivityType.PLAYGROUND]: '🎠',
    [ActivityType.GROCERY]: '🛒',
    [ActivityType.TRANSPORT]: '🚗',
    [ActivityType.OTHER]: '📍',
  };

  return iconMap[activityType] || iconMap[ActivityType.OTHER];
}
