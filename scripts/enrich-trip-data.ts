#!/usr/bin/env tsx
/**
 * Enrichment script to populate thumbnail_url and google_place_id for all places in trip data
 *
 * Usage:
 *   pnpm tsx scripts/enrich-trip-data.ts [filename]
 *
 * Examples:
 *   pnpm tsx scripts/enrich-trip-data.ts                              # Enrich all trips
 *   pnpm tsx scripts/enrich-trip-data.ts 202512_NZ_trip-plan.json    # Enrich specific trip
 *
 * Image source priority:
 *   1. Existing thumbnail_url (skip if already set)
 *   2. Google Places API photo
 *   3. Web search from place URL (og:image)
 *   4. Web search based on place name
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { Accommodation, Activity, TripData } from '../src/types';
import type { ScenicWaypoint } from '../src/types/map';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Rate limiting configuration
const RATE_LIMIT_MS = 200; // 200ms between API calls
const MAX_RETRIES = 3;

interface PlaceSearchResult {
  place_id?: string;
  photo_url?: string;
  name?: string;
}

interface EnrichmentStats {
  total: number;
  enriched: number;
  skipped: number;
  failed: number;
  details: {
    accommodations: { total: number; enriched: number };
    activities: { total: number; enriched: number };
    waypoints: { total: number; enriched: number };
  };
}

/**
 * Load environment variables from .env.local for Node.js scripts
 */
async function loadEnvFile(envPath: string): Promise<void> {
  try {
    const content = await fs.readFile(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        if (key && !process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  } catch {
    // .env.local might not exist
  }
}

/**
 * Validate required environment variables
 */
function validateEnvConfig(): void {
  const googleMapsKey = process.env.GOOGLE_PLACES_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (googleMapsKey) {
    const keySource = process.env.GOOGLE_PLACES_API_KEY
      ? 'GOOGLE_PLACES_API_KEY'
      : process.env.VITE_GOOGLE_MAPS_API_KEY
        ? 'VITE_GOOGLE_MAPS_API_KEY'
        : 'GOOGLE_MAPS_API_KEY';
    console.log(`✓ Using API key from: ${keySource}`);
    if (keySource.startsWith('VITE_')) {
      console.warn('  Note: VITE_ keys may have HTTP referrer restrictions.');
      console.warn('  For server-side access, create a key with IP restrictions.\n');
    }
  } else {
    console.warn('⚠️  No Google Maps API key found. Will use og:image and Wikipedia fallbacks only.');
    console.warn('   For Google Places photos, set GOOGLE_PLACES_API_KEY with IP restrictions.\n');
  }

  const requiredFirebaseVars = ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_PROJECT_ID'];
  const missingFirebase = requiredFirebaseVars.filter((v) => !process.env[v]);
  if (missingFirebase.length > 0) {
    console.warn('⚠️  Missing Firebase config, will only update local file:', missingFirebase.join(', '));
  }
}

/**
 * Sleep for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get Google Maps API key from environment
 * Priority: GOOGLE_PLACES_API_KEY > VITE_GOOGLE_MAPS_API_KEY > GOOGLE_MAPS_API_KEY
 */
function getGoogleMapsApiKey(): string {
  return process.env.GOOGLE_PLACES_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';
}

/**
 * Search for a place using Google Places Text Search API (Legacy)
 * https://developers.google.com/maps/documentation/places/web-service/search-text
 *
 * Note: Using legacy API as it supports server-side requests without HTTP referrer
 */
async function searchPlaceByText(query: string, location?: { lat: number; lng: number }): Promise<PlaceSearchResult | null> {
  const apiKey = getGoogleMapsApiKey();

  // Build URL for legacy Text Search API
  const params = new URLSearchParams({
    query,
    key: apiKey,
  });

  // Add location bias if coordinates are provided
  if (location && location.lat && location.lng) {
    params.set('location', `${location.lat},${location.lng}`);
    params.set('radius', '5000'); // 5km radius
  }

  const endpoint = `https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`;

  for (let retry = 0; retry < MAX_RETRIES; retry++) {
    try {
      const response = await fetch(endpoint);

      if (response.status === 429) {
        // Rate limited, wait and retry
        await sleep(1000 * (retry + 1));
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`  ⚠️ Places API error: ${response.status} - ${errorText}`);
        return null;
      }

      const data = await response.json();

      if (data.status === 'ZERO_RESULTS' || !data.results || data.results.length === 0) {
        return null;
      }

      if (data.status !== 'OK') {
        console.error(`  ⚠️ Places API status: ${data.status} - ${data.error_message || ''}`);
        return null;
      }

      const place = data.results[0];
      let photoUrl: string | undefined;

      // Get photo URL if available
      if (place.photos && place.photos.length > 0) {
        const photoRef = place.photos[0].photo_reference;
        // Use Places Photo API to get the photo URL
        photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photoRef}&key=${apiKey}`;
      }

      return {
        place_id: place.place_id,
        photo_url: photoUrl,
        name: place.name,
      };
    } catch (error) {
      console.error('  ⚠️ Places API request failed:', error);
      if (retry < MAX_RETRIES - 1) {
        await sleep(500 * (retry + 1));
      }
    }
  }

  return null;
}

/**
 * Try to extract og:image from a website URL
 */
async function fetchOgImageFromUrl(url: string): Promise<string | null> {
  if (!url) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Wanderlog/1.0)',
      },
    });

    clearTimeout(timeout);

    if (!response.ok) return null;

    const html = await response.text();

    // Extract og:image meta tag
    const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
    if (ogImageMatch?.[1]) {
      return ogImageMatch[1];
    }

    // Try twitter:image as fallback
    const twitterImageMatch = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
    if (twitterImageMatch?.[1]) {
      return twitterImageMatch[1];
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Try to get an image from alternative sources
 */
async function searchImageByAlternativeSources(placeName: string, location?: string, url?: string): Promise<string | null> {
  // Try DOC.govt.nz API for NZ places
  if (url?.includes('doc.govt.nz')) {
    const docImage = await fetchOgImageFromUrl(url);
    if (docImage) return docImage;
  }

  // Try to construct a Wikipedia URL for famous places
  const wikiSearchTerms = [placeName, `${placeName} New Zealand`, location ? `${placeName} ${location}` : null].filter(Boolean);

  for (const term of wikiSearchTerms) {
    try {
      const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(term as string)}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(wikiUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Wanderlog/1.0' },
      });

      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        if (data.thumbnail?.source) {
          return data.thumbnail.source;
        }
      }
    } catch {
      // Continue to next source
    }
  }

  return null;
}

/**
 * Enrich a single place with thumbnail_url and google_place_id
 */
async function enrichPlace(
  name: string,
  existingThumbnail: string | null | undefined,
  existingPlaceId: string | null | undefined,
  location?: { lat?: number; lng?: number; address?: string },
  url?: string
): Promise<{ thumbnail_url: string | null; google_place_id: string | null; changed: boolean }> {
  // If both already exist, skip
  if (existingThumbnail && existingPlaceId) {
    return {
      thumbnail_url: existingThumbnail,
      google_place_id: existingPlaceId,
      changed: false,
    };
  }

  let thumbnail_url = existingThumbnail || null;
  let google_place_id = existingPlaceId || null;
  let changed = false;

  // Try Google Places API first
  if (!(thumbnail_url && google_place_id)) {
    const searchQuery = location?.address ? `${name} ${location.address}` : name;
    const coords = location?.lat && location?.lng ? { lat: location.lat, lng: location.lng } : undefined;

    await sleep(RATE_LIMIT_MS);
    const placeResult = await searchPlaceByText(searchQuery, coords);

    if (placeResult) {
      if (!google_place_id && placeResult.place_id) {
        google_place_id = placeResult.place_id;
        changed = true;
      }
      if (!thumbnail_url && placeResult.photo_url) {
        thumbnail_url = placeResult.photo_url;
        changed = true;
      }
    }
  }

  // Try fetching og:image from the place URL
  if (!thumbnail_url && url) {
    const ogImage = await fetchOgImageFromUrl(url);
    if (ogImage) {
      thumbnail_url = ogImage;
      changed = true;
    }
  }

  // Try alternative sources (Wikipedia, etc.)
  if (!thumbnail_url) {
    const altImage = await searchImageByAlternativeSources(name, location?.address, url);
    if (altImage) {
      thumbnail_url = altImage;
      changed = true;
    }
  }

  return { thumbnail_url, google_place_id, changed };
}

/**
 * Enrich accommodation data
 */
async function enrichAccommodation(
  accommodation: Accommodation,
  stopName: string
): Promise<{ accommodation: Accommodation; enriched: boolean }> {
  if (!(accommodation && accommodation.name)) {
    return { accommodation, enriched: false };
  }

  console.log(`  📍 Accommodation: ${accommodation.name}`);

  const result = await enrichPlace(
    accommodation.name,
    accommodation.thumbnail_url,
    accommodation.google_place_id,
    accommodation.location ? { ...accommodation.location, address: accommodation.address } : { address: accommodation.address },
    accommodation.url
  );

  if (result.changed) {
    console.log(`     ✅ Enriched (thumbnail: ${result.thumbnail_url ? 'yes' : 'no'}, place_id: ${result.google_place_id ? 'yes' : 'no'})`);
    return {
      accommodation: {
        ...accommodation,
        thumbnail_url: result.thumbnail_url ?? undefined,
        google_place_id: result.google_place_id ?? undefined,
      },
      enriched: true,
    };
  }

  console.log('     ⏭️  Skipped (already has data or no results)');
  return { accommodation, enriched: false };
}

/**
 * Enrich activity data
 */
async function enrichActivity(activity: Activity): Promise<{ activity: Activity; enriched: boolean }> {
  if (!(activity && activity.activity_name)) {
    return { activity, enriched: false };
  }

  console.log(`  📍 Activity: ${activity.activity_name}`);

  const result = await enrichPlace(
    activity.activity_name,
    activity.thumbnail_url,
    activity.google_place_id,
    activity.location,
    activity.url
  );

  if (result.changed) {
    console.log(`     ✅ Enriched (thumbnail: ${result.thumbnail_url ? 'yes' : 'no'}, place_id: ${result.google_place_id ? 'yes' : 'no'})`);
    return {
      activity: {
        ...activity,
        thumbnail_url: result.thumbnail_url ?? undefined,
        google_place_id: result.google_place_id ?? undefined,
      },
      enriched: true,
    };
  }

  console.log('     ⏭️  Skipped (already has data or no results)');
  return { activity, enriched: false };
}

/**
 * Enrich scenic waypoint data
 */
async function enrichWaypoint(waypoint: ScenicWaypoint): Promise<{ waypoint: ScenicWaypoint; enriched: boolean }> {
  if (!(waypoint && waypoint.activity_name)) {
    return { waypoint, enriched: false };
  }

  console.log(`  📍 Waypoint: ${waypoint.activity_name}`);

  const result = await enrichPlace(
    waypoint.activity_name,
    waypoint.thumbnail_url,
    waypoint.google_place_id,
    waypoint.location,
    waypoint.url
  );

  if (result.changed) {
    console.log(`     ✅ Enriched (thumbnail: ${result.thumbnail_url ? 'yes' : 'no'}, place_id: ${result.google_place_id ? 'yes' : 'no'})`);
    return {
      waypoint: {
        ...waypoint,
        thumbnail_url: result.thumbnail_url ?? undefined,
        google_place_id: result.google_place_id ?? undefined,
      },
      enriched: true,
    };
  }

  console.log('     ⏭️  Skipped (already has data or no results)');
  return { waypoint, enriched: false };
}

/**
 * Read and parse a trip data JSON file
 */
async function readTripDataFile(filename: string): Promise<{ tripData: TripData; rawData: unknown }> {
  const tripDataDir = path.join(__dirname, '../public/trip-data');
  const filePath = path.join(tripDataDir, filename);

  console.log(`Reading ${filename}...`);
  const fileContent = await fs.readFile(filePath, 'utf-8');
  const rawData = JSON.parse(fileContent);

  // Handle both wrapped and unwrapped formats
  const tripData = rawData.tripData || rawData;

  if (!(tripData.trip_name && tripData.timezone && Array.isArray(tripData.stops))) {
    throw new Error('Invalid trip data format');
  }

  return { tripData: tripData as TripData, rawData };
}

/**
 * Write trip data back to JSON file
 */
async function writeTripDataFile(filename: string, rawData: unknown, tripData: TripData): Promise<void> {
  const tripDataDir = path.join(__dirname, '../public/trip-data');
  const filePath = path.join(tripDataDir, filename);

  // Preserve the original structure (wrapped or unwrapped)
  let dataToWrite: unknown;
  if (typeof rawData === 'object' && rawData !== null && 'tripData' in rawData) {
    dataToWrite = { ...rawData, tripData };
  } else {
    dataToWrite = tripData;
  }

  await fs.writeFile(filePath, JSON.stringify(dataToWrite, null, 2) + '\n', 'utf-8');
  console.log(`✅ Updated ${filename}`);
}

/**
 * Generate trip ID from filename
 */
function generateTripId(filename: string): string {
  return filename.replace(/_trip-plan\.json$/, '');
}

/**
 * Get all trip data files
 */
async function getAllTripDataFiles(): Promise<string[]> {
  const tripDataDir = path.join(__dirname, '../public/trip-data');
  const files = await fs.readdir(tripDataDir);
  return files.filter((file) => file.endsWith('_trip-plan.json'));
}

/**
 * Main enrichment function for a single trip
 */
async function enrichTripData(filename: string): Promise<EnrichmentStats> {
  const stats: EnrichmentStats = {
    total: 0,
    enriched: 0,
    skipped: 0,
    failed: 0,
    details: {
      accommodations: { total: 0, enriched: 0 },
      activities: { total: 0, enriched: 0 },
      waypoints: { total: 0, enriched: 0 },
    },
  };

  const { tripData, rawData } = await readTripDataFile(filename);
  const tripId = generateTripId(filename);

  console.log(`\n🌍 Enriching trip: ${tripData.trip_name} (${tripId})`);
  console.log(`   Stops: ${tripData.stops.length}\n`);

  // Process each stop
  for (const stop of tripData.stops) {
    console.log(`\n📌 Stop: ${stop.name}`);

    // Enrich accommodation
    if (stop.accommodation && stop.accommodation.name) {
      stats.total++;
      stats.details.accommodations.total++;
      const { accommodation, enriched } = await enrichAccommodation(stop.accommodation, stop.name);
      stop.accommodation = accommodation;
      if (enriched) {
        stats.enriched++;
        stats.details.accommodations.enriched++;
      } else {
        stats.skipped++;
      }
    }

    // Enrich activities
    if (stop.activities && Array.isArray(stop.activities)) {
      for (let i = 0; i < stop.activities.length; i++) {
        stats.total++;
        stats.details.activities.total++;
        const { activity, enriched } = await enrichActivity(stop.activities[i]);
        stop.activities[i] = activity;
        if (enriched) {
          stats.enriched++;
          stats.details.activities.enriched++;
        } else {
          stats.skipped++;
        }
      }
    }

    // Enrich scenic waypoints
    if (stop.scenic_waypoints && Array.isArray(stop.scenic_waypoints)) {
      for (let i = 0; i < stop.scenic_waypoints.length; i++) {
        stats.total++;
        stats.details.waypoints.total++;
        const { waypoint, enriched } = await enrichWaypoint(stop.scenic_waypoints[i]);
        stop.scenic_waypoints[i] = waypoint;
        if (enriched) {
          stats.enriched++;
          stats.details.waypoints.enriched++;
        } else {
          stats.skipped++;
        }
      }
    }
  }

  // Write updated data to JSON file
  await writeTripDataFile(filename, rawData, tripData);

  // Update Firebase if configured
  const hasFirebaseConfig = process.env.VITE_FIREBASE_API_KEY && process.env.VITE_FIREBASE_PROJECT_ID;
  if (hasFirebaseConfig) {
    try {
      const firebaseConfig = await import('../src/config/firebase.js');
      const firebaseService = await import('../src/services/firebaseService.js');

      firebaseConfig.initializeFirebase();
      await firebaseService.updateTrip(tripId, { stops: tripData.stops });
      console.log(`✅ Updated Firebase: ${tripId}`);
    } catch (error) {
      console.error('⚠️  Failed to update Firebase:', error);
    }
  } else {
    console.log('⚠️  Firebase not configured, skipping cloud update');
  }

  return stats;
}

/**
 * Main function
 */
async function main(): Promise<void> {
  console.log('🚀 Wanderlog Trip Data Enrichment Tool\n');
  console.log('This script enriches trip data with:');
  console.log('  - thumbnail_url: Images for places');
  console.log('  - google_place_id: Google Places IDs\n');
  console.log('Image source priority:');
  console.log('  1. Existing thumbnail_url (skip if already set)');
  console.log('  2. Google Places API photo');
  console.log('  3. og:image from place URL');
  console.log('  4. Web search by place name\n');

  // Load environment variables
  await loadEnvFile(path.join(__dirname, '../.env.local'));
  validateEnvConfig();

  // Parse command line arguments
  const args = process.argv.slice(2);
  const filenames = args.filter((arg) => !arg.startsWith('--'));

  try {
    let totalStats: EnrichmentStats = {
      total: 0,
      enriched: 0,
      skipped: 0,
      failed: 0,
      details: {
        accommodations: { total: 0, enriched: 0 },
        activities: { total: 0, enriched: 0 },
        waypoints: { total: 0, enriched: 0 },
      },
    };

    if (filenames.length === 0) {
      // Enrich all trips
      console.log('No specific file specified. Enriching all trips...\n');
      const allFiles = await getAllTripDataFiles();

      if (allFiles.length === 0) {
        console.log('No trip data files found in public/trip-data/');
        return;
      }

      console.log(`Found ${allFiles.length} trip(s) to enrich:\n`);

      for (const filename of allFiles) {
        const stats = await enrichTripData(filename);
        totalStats.total += stats.total;
        totalStats.enriched += stats.enriched;
        totalStats.skipped += stats.skipped;
        totalStats.failed += stats.failed;
        totalStats.details.accommodations.total += stats.details.accommodations.total;
        totalStats.details.accommodations.enriched += stats.details.accommodations.enriched;
        totalStats.details.activities.total += stats.details.activities.total;
        totalStats.details.activities.enriched += stats.details.activities.enriched;
        totalStats.details.waypoints.total += stats.details.waypoints.total;
        totalStats.details.waypoints.enriched += stats.details.waypoints.enriched;
      }
    } else {
      // Enrich specific trips
      for (const filename of filenames) {
        const stats = await enrichTripData(filename);
        totalStats = stats;
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Enrichment Summary');
    console.log('='.repeat(60));
    console.log(`Total places processed: ${totalStats.total}`);
    console.log(`  - Enriched: ${totalStats.enriched}`);
    console.log(`  - Skipped: ${totalStats.skipped}`);
    console.log(`  - Failed: ${totalStats.failed}`);
    console.log('\nBy category:');
    console.log(`  - Accommodations: ${totalStats.details.accommodations.enriched}/${totalStats.details.accommodations.total}`);
    console.log(`  - Activities: ${totalStats.details.activities.enriched}/${totalStats.details.activities.total}`);
    console.log(`  - Waypoints: ${totalStats.details.waypoints.enriched}/${totalStats.details.waypoints.total}`);
    console.log('\n✅ Enrichment completed!');
  } catch (error) {
    console.error('\n❌ Enrichment failed:', error);
    process.exit(1);
  }
}

// Run the enrichment
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
