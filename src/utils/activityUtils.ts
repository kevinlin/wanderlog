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
 * @param activityType - The activity type
 * @returns SVG path string for the activity type icon
 */
export function getActivityTypeSvgPath(activityType: ActivityType): string {
  const iconMap = {
    // Restaurant: Elegant utensils icon (Material Design restaurant)
    [ActivityType.RESTAURANT]:
      'M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z',

    // Attraction: Star/landmark icon (Material Design star)
    [ActivityType.ATTRACTION]: 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',

    // Shopping: Modern shopping bag icon (Material Design shopping bag)
    [ActivityType.SHOPPING]:
      'M18 6h-2c0-2.21-1.79-4-4-4S8 3.79 8 6H6c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6-2c1.1 0 2 .9 2 2h-4c0-1.1.9-2 2-2zm6 16H6V8h2v2c0 .55.45 1 1 1s1-.45 1-1V8h4v2c0 .55.45 1 1 1s1-.45 1-1V8h2v12z',

    // Outdoor: Mountain peaks icon (Material Design terrain)
    [ActivityType.OUTDOOR]: 'M14 6l-3.75 5 2.85 3.8-1.6 1.2C9.81 13.75 7 10 7 10l-6 8h22L14 6z',

    // Cultural: Temple/museum pillars icon (Material Design account balance)
    [ActivityType.CULTURAL]: 'M4 10v7h3v-7H4zm6 0v7h3v-7h-3zM2 22h19v-3H2v3zm14-12v7h3v-7h-3zm-4.5-9L2 6v2h19V6l-9.5-5z',

    // Recreation: Amusement park icon (Material Design attractions)
    [ActivityType.RECREATION]:
      'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5.5-2.5l7.51-3.49L17.5 6.5 9.99 9.99 6.5 17.5zm5.5-6.6c.61 0 1.1.49 1.1 1.1s-.49 1.1-1.1 1.1-1.1-.49-1.1-1.1.49-1.1 1.1-1.1z',

    // Scenic: Landscape icon (Material Design landscape)
    [ActivityType.SCENIC]: 'M14 6l-3.75 5 2.85 3.8-1.6 1.2C9.81 13.75 7 10 7 10l-6 8h22L14 6z',

    // Beach: Beach icon (Material Design beach access)
    [ActivityType.BEACH]:
      'M13.127 14.56l1.43-1.43 6.44 6.443L19.57 21zm4.293-5.73l2.86-2.86c-3.95-3.95-10.35-3.96-14.3-.02 3.93-1.3 8.31-.25 11.44 2.88zM5.95 5.98c-3.94 3.95-3.93 10.35.02 14.3l2.86-2.86C5.7 14.29 4.65 9.91 5.95 5.98zm.02-.02l-.01.01c-.38 3.01 1.17 6.88 4.3 10.02l5.73-5.73c-3.13-3.13-7.01-4.68-10.02-4.3z',

    // Playground: Child friendly icon (Material Design child friendly)
    [ActivityType.PLAYGROUND]:
      'M13 2v8h8c0-4.42-3.58-8-8-8zm6.32 13.89C20.37 14.54 21 12.84 21 11H6.44l-.95-2H2v2h2.22s1.89 4.07 2.12 4.42c-1.1.59-1.84 1.75-1.84 3.08C4.5 20.43 6.07 22 8 22c1.76 0 3.22-1.3 3.46-3h2.08c.24 1.7 1.7 3 3.46 3 1.93 0 3.5-1.57 3.5-3.5 0-1.04-.46-1.97-1.18-2.61zM8 20c-.83 0-1.5-.67-1.5-1.5S7.17 17 8 17s1.5.67 1.5 1.5S8.83 20 8 20zm9 0c-.83 0-1.5-.67-1.5-1.5S16.17 17 17 17s1.5.67 1.5 1.5S17.83 20 17 20z',

    // Grocery: Shopping cart icon (Material Design shopping cart)
    [ActivityType.GROCERY]:
      'M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z',

    // Transport: Directions car icon (Material Design directions car)
    [ActivityType.TRANSPORT]:
      'M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z',

    // Other/Default: Location pin icon (Material Design place)
    [ActivityType.OTHER]:
      'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
  };

  return iconMap[activityType] || iconMap[ActivityType.OTHER];
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
