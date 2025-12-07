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
    [ActivityType.SHOPPING]: '#10b981', // Emerald-500 - Rich green for shopping and retail
    [ActivityType.OUTDOOR]: '#f59e0b', // Amber-500 - Bright amber for outdoor activities and nature
    [ActivityType.CULTURAL]: '#06b6d4', // Cyan-500 - Vibrant cyan for cultural experiences
    [ActivityType.RECREATION]: '#0ea5e9', // Sky-500 - Bright sky blue for recreation and fun activities
    [ActivityType.SCENIC]: '#8b5cf6', // Violet-500 - Shared with attraction for scenic views
    [ActivityType.BEACH]: '#06b6d4', // Cyan-500 - Ocean blue for beach locations
    [ActivityType.PLAYGROUND]: '#f59e0b', // Amber-500 - Bright amber for playgrounds
    [ActivityType.GROCERY]: '#10b981', // Emerald-500 - Green for grocery shopping
    [ActivityType.TRANSPORT]: '#6366f1', // Indigo-500 - Indigo for transport
    [ActivityType.OTHER]: '#0ea5e9', // Sky-500 - Primary accent blue as default
  };

  return colorMap[activityType] || colorMap[ActivityType.OTHER];
}

/**
 * Gets the SVG path for an activity type icon (for pin styling)
 * Polished Material Design filled icons for modern, sleek appearance
 * @param _activityType - The activity type (unused - all pins now use location icon for consistency)
 * @returns SVG path string for the activity type icon
 */
export function getActivityTypeSvgPath(_activityType: ActivityType): string {
  // All activity pins now use the same location pin icon for visual consistency
  // Material Design place/location pin icon
  return 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z';
}

/**
 * Gets the SVG path for accommodation pin icon
 * Polished Material Design home/lodge icon
 * @returns SVG path string for accommodation icon
 */
export function getAccommodationSvgPath(): string {
  // Material Design home icon - modern house shape
  return 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z';
}

/**
 * Gets the SVG path for scenic waypoint pin icon
 * Polished Material Design landscape icon
 * @returns SVG path string for scenic waypoint icon
 */
export function getScenicWaypointSvgPath(): string {
  // Material Design landscape/image icon - mountains with sun
  return 'M14 6l-3.75 5 2.85 3.8-1.6 1.2C9.81 13.75 7 10 7 10l-6 8h22L14 6zM5 17l2-2.5 1.5 2 2.5-3.5L14 17H5z';
}
