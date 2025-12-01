#!/usr/bin/env tsx
/**
 * Script to verify and fix coordinates in trip data using Google Places API
 *
 * Usage:
 *   pnpm tsx scripts/fix-coordinates.ts [filename]
 *
 * Examples:
 *   pnpm tsx scripts/fix-coordinates.ts                              # Fix all trips
 *   pnpm tsx scripts/fix-coordinates.ts 202512_NZ_trip-plan.json    # Fix specific trip
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
const RATE_LIMIT_MS = 200;
const MAX_RETRIES = 3;

// Coordinate tolerance (in degrees) - roughly 10 meters
const COORDINATE_TOLERANCE = 0.0001;

interface PlaceLocation {
  lat: number;
  lng: number;
}

interface PlaceDetailsResult {
  place_id: string;
  name: string;
  location: PlaceLocation;
  formatted_address?: string;
}

interface CoordinateFix {
  name: string;
  type: 'accommodation' | 'activity' | 'waypoint' | 'stop';
  place_id: string;
  old: PlaceLocation;
  new: PlaceLocation;
  distance_meters: number;
}

interface FixStats {
  total_checked: number;
  coordinates_fixed: number;
  skipped_no_place_id: number;
  api_errors: number;
  fixes: CoordinateFix[];
}

/**
 * Load environment variables from .env.local
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
  const googleMapsKey = getGoogleMapsApiKey();
  if (googleMapsKey) {
    const keySource = process.env.GOOGLE_PLACES_API_KEY
      ? 'GOOGLE_PLACES_API_KEY'
      : process.env.VITE_GOOGLE_MAPS_API_KEY
        ? 'VITE_GOOGLE_MAPS_API_KEY'
        : 'GOOGLE_MAPS_API_KEY';
    console.log(`✓ Using API key from: ${keySource}`);
  } else {
    console.error('❌ No Google Maps API key found.');
    console.error('   Set GOOGLE_PLACES_API_KEY, VITE_GOOGLE_MAPS_API_KEY, or GOOGLE_MAPS_API_KEY');
    process.exit(1);
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
 */
function getGoogleMapsApiKey(): string {
  return process.env.GOOGLE_PLACES_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';
}

/**
 * Calculate distance between two coordinates in meters (Haversine formula)
 */
function calculateDistanceMeters(loc1: PlaceLocation, loc2: PlaceLocation): number {
  const R = 6_371_000; // Earth's radius in meters
  const dLat = ((loc2.lat - loc1.lat) * Math.PI) / 180;
  const dLng = ((loc2.lng - loc1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((loc1.lat * Math.PI) / 180) * Math.cos((loc2.lat * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Check if coordinates are significantly different
 */
function coordinatesDiffer(loc1: PlaceLocation, loc2: PlaceLocation): boolean {
  return Math.abs(loc1.lat - loc2.lat) > COORDINATE_TOLERANCE || Math.abs(loc1.lng - loc2.lng) > COORDINATE_TOLERANCE;
}

/**
 * Get place details from Google Places API (New) by place_id
 * Uses the new Places API v1 endpoint
 */
async function getPlaceDetails(placeId: string): Promise<PlaceDetailsResult | null> {
  const apiKey = getGoogleMapsApiKey();

  // Use the new Places API v1 endpoint
  const endpoint = `https://places.googleapis.com/v1/places/${placeId}`;

  for (let retry = 0; retry < MAX_RETRIES; retry++) {
    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'id,displayName,location,formattedAddress',
          // Add referer header to work with browser-restricted API keys
          Referer: 'https://kevinlin.github.io/wanderlog/',
          Origin: 'https://kevinlin.github.io',
        },
      });

      if (response.status === 429) {
        await sleep(1000 * (retry + 1));
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`  ⚠️ Places API error: ${response.status} - ${errorText}`);
        return null;
      }

      const data = await response.json();

      if (!data.location) {
        console.error(`  ⚠️ No location data for place: ${placeId}`);
        return null;
      }

      return {
        place_id: data.id || placeId,
        name: data.displayName?.text || 'Unknown',
        location: {
          lat: data.location.latitude,
          lng: data.location.longitude,
        },
        formatted_address: data.formattedAddress,
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
 * Read and parse a trip data JSON file
 */
async function readTripDataFile(filename: string): Promise<{ tripData: TripData; rawData: unknown }> {
  const tripDataDir = path.join(__dirname, '../local/trip-data');
  const filePath = path.join(tripDataDir, filename);

  console.log(`Reading ${filename}...`);
  const fileContent = await fs.readFile(filePath, 'utf-8');
  const rawData = JSON.parse(fileContent);

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
  const tripDataDir = path.join(__dirname, '../local/trip-data');
  const filePath = path.join(tripDataDir, filename);

  // Update the exportDate
  let dataToWrite: unknown;
  if (typeof rawData === 'object' && rawData !== null && 'tripData' in rawData) {
    dataToWrite = {
      ...rawData,
      tripData,
      exportDate: new Date().toISOString(),
    };
  } else {
    dataToWrite = tripData;
  }

  await fs.writeFile(filePath, JSON.stringify(dataToWrite, null, 2) + '\n', 'utf-8');
  console.log(`✅ Updated ${filename}`);
}

/**
 * Get all trip data files
 */
async function getAllTripDataFiles(): Promise<string[]> {
  const tripDataDir = path.join(__dirname, '../local/trip-data');
  const files = await fs.readdir(tripDataDir);
  return files.filter((file) => file.endsWith('_trip-plan.json'));
}

/**
 * Fix coordinates for accommodation
 */
async function fixAccommodationCoordinates(accommodation: Accommodation, stats: FixStats): Promise<Accommodation> {
  if (!accommodation?.name) return accommodation;

  stats.total_checked++;

  if (!accommodation.google_place_id) {
    stats.skipped_no_place_id++;
    console.log(`  ⏭️  Skipped (no place_id): ${accommodation.name}`);
    return accommodation;
  }

  await sleep(RATE_LIMIT_MS);
  const placeDetails = await getPlaceDetails(accommodation.google_place_id);

  if (!placeDetails) {
    stats.api_errors++;
    console.log(`  ⚠️  API error: ${accommodation.name}`);
    return accommodation;
  }

  const currentLocation = accommodation.location || { lat: 0, lng: 0 };

  if (coordinatesDiffer(currentLocation, placeDetails.location)) {
    const distance = calculateDistanceMeters(currentLocation, placeDetails.location);
    console.log(`  🔧 Fixing: ${accommodation.name}`);
    console.log(`     Old: ${currentLocation.lat}, ${currentLocation.lng}`);
    console.log(`     New: ${placeDetails.location.lat}, ${placeDetails.location.lng}`);
    console.log(`     Distance: ${Math.round(distance)}m`);

    stats.coordinates_fixed++;
    stats.fixes.push({
      name: accommodation.name,
      type: 'accommodation',
      place_id: accommodation.google_place_id,
      old: currentLocation,
      new: placeDetails.location,
      distance_meters: distance,
    });

    return {
      ...accommodation,
      location: placeDetails.location,
    };
  }

  console.log(`  ✓ OK: ${accommodation.name}`);
  return accommodation;
}

/**
 * Fix coordinates for activity
 */
async function fixActivityCoordinates(activity: Activity, stats: FixStats): Promise<Activity> {
  if (!activity?.activity_name) return activity;

  stats.total_checked++;

  if (!activity.google_place_id) {
    stats.skipped_no_place_id++;
    console.log(`  ⏭️  Skipped (no place_id): ${activity.activity_name}`);
    return activity;
  }

  await sleep(RATE_LIMIT_MS);
  const placeDetails = await getPlaceDetails(activity.google_place_id);

  if (!placeDetails) {
    stats.api_errors++;
    console.log(`  ⚠️  API error: ${activity.activity_name}`);
    return activity;
  }

  const currentLocation = activity.location || { lat: 0, lng: 0 };

  if (coordinatesDiffer(currentLocation, placeDetails.location)) {
    const distance = calculateDistanceMeters(currentLocation, placeDetails.location);
    console.log(`  🔧 Fixing: ${activity.activity_name}`);
    console.log(`     Old: ${currentLocation.lat}, ${currentLocation.lng}`);
    console.log(`     New: ${placeDetails.location.lat}, ${placeDetails.location.lng}`);
    console.log(`     Distance: ${Math.round(distance)}m`);

    stats.coordinates_fixed++;
    stats.fixes.push({
      name: activity.activity_name,
      type: 'activity',
      place_id: activity.google_place_id,
      old: currentLocation,
      new: placeDetails.location,
      distance_meters: distance,
    });

    return {
      ...activity,
      location: {
        ...activity.location,
        lat: placeDetails.location.lat,
        lng: placeDetails.location.lng,
      },
    };
  }

  console.log(`  ✓ OK: ${activity.activity_name}`);
  return activity;
}

/**
 * Fix coordinates for scenic waypoint
 */
async function fixWaypointCoordinates(waypoint: ScenicWaypoint, stats: FixStats): Promise<ScenicWaypoint> {
  if (!waypoint?.activity_name) return waypoint;

  stats.total_checked++;

  if (!waypoint.google_place_id) {
    stats.skipped_no_place_id++;
    console.log(`  ⏭️  Skipped (no place_id): ${waypoint.activity_name}`);
    return waypoint;
  }

  await sleep(RATE_LIMIT_MS);
  const placeDetails = await getPlaceDetails(waypoint.google_place_id);

  if (!placeDetails) {
    stats.api_errors++;
    console.log(`  ⚠️  API error: ${waypoint.activity_name}`);
    return waypoint;
  }

  const currentLocation = waypoint.location || { lat: 0, lng: 0 };

  if (coordinatesDiffer(currentLocation, placeDetails.location)) {
    const distance = calculateDistanceMeters(currentLocation, placeDetails.location);
    console.log(`  🔧 Fixing: ${waypoint.activity_name}`);
    console.log(`     Old: ${currentLocation.lat}, ${currentLocation.lng}`);
    console.log(`     New: ${placeDetails.location.lat}, ${placeDetails.location.lng}`);
    console.log(`     Distance: ${Math.round(distance)}m`);

    stats.coordinates_fixed++;
    stats.fixes.push({
      name: waypoint.activity_name,
      type: 'waypoint',
      place_id: waypoint.google_place_id,
      old: currentLocation,
      new: placeDetails.location,
      distance_meters: distance,
    });

    return {
      ...waypoint,
      location: placeDetails.location,
    };
  }

  console.log(`  ✓ OK: ${waypoint.activity_name}`);
  return waypoint;
}

/**
 * Main function to fix coordinates in a trip file
 */
async function fixTripCoordinates(filename: string): Promise<FixStats> {
  const stats: FixStats = {
    total_checked: 0,
    coordinates_fixed: 0,
    skipped_no_place_id: 0,
    api_errors: 0,
    fixes: [],
  };

  const { tripData, rawData } = await readTripDataFile(filename);

  console.log(`\n🌍 Fixing coordinates in: ${tripData.trip_name}`);
  console.log(`   Stops: ${tripData.stops.length}\n`);

  for (const stop of tripData.stops) {
    console.log(`\n📌 Stop: ${stop.name}`);

    // Fix accommodation coordinates
    if (stop.accommodation && stop.accommodation.name) {
      console.log('\n  🏨 Accommodation:');
      stop.accommodation = await fixAccommodationCoordinates(stop.accommodation, stats);
    }

    // Fix activity coordinates
    if (stop.activities && Array.isArray(stop.activities)) {
      console.log('\n  🎯 Activities:');
      for (let i = 0; i < stop.activities.length; i++) {
        stop.activities[i] = await fixActivityCoordinates(stop.activities[i], stats);
      }
    }

    // Fix scenic waypoint coordinates
    if (stop.scenic_waypoints && Array.isArray(stop.scenic_waypoints)) {
      console.log('\n  🚗 Scenic Waypoints:');
      for (let i = 0; i < stop.scenic_waypoints.length; i++) {
        stop.scenic_waypoints[i] = await fixWaypointCoordinates(stop.scenic_waypoints[i], stats);
      }
    }
  }

  // Write updated data
  if (stats.coordinates_fixed > 0) {
    // Update the updated_at timestamp
    tripData.updated_at = new Date().toISOString();
    await writeTripDataFile(filename, rawData, tripData);
  } else {
    console.log('\n✅ No coordinate fixes needed.');
  }

  return stats;
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  console.log('🔧 Wanderlog Coordinate Fixer\n');
  console.log('This script verifies and fixes coordinates using Google Places API.');
  console.log('For each place with a google_place_id, it fetches the official location');
  console.log('and updates coordinates that have drifted.\n');

  // Load environment variables
  await loadEnvFile(path.join(__dirname, '../.env.local'));
  validateEnvConfig();

  // Parse command line arguments
  const args = process.argv.slice(2);
  const filenames = args.filter((arg) => !arg.startsWith('--'));

  try {
    let allFixes: CoordinateFix[] = [];
    let totalStats = {
      total_checked: 0,
      coordinates_fixed: 0,
      skipped_no_place_id: 0,
      api_errors: 0,
    };

    if (filenames.length === 0) {
      console.log('No specific file specified. Processing all trips...\n');
      const allFiles = await getAllTripDataFiles();

      if (allFiles.length === 0) {
        console.log('No trip data files found in local/trip-data/');
        return;
      }

      console.log(`Found ${allFiles.length} trip(s) to process:\n`);

      for (const filename of allFiles) {
        const stats = await fixTripCoordinates(filename);
        totalStats.total_checked += stats.total_checked;
        totalStats.coordinates_fixed += stats.coordinates_fixed;
        totalStats.skipped_no_place_id += stats.skipped_no_place_id;
        totalStats.api_errors += stats.api_errors;
        allFixes = allFixes.concat(stats.fixes);
      }
    } else {
      for (const filename of filenames) {
        const stats = await fixTripCoordinates(filename);
        totalStats = {
          total_checked: stats.total_checked,
          coordinates_fixed: stats.coordinates_fixed,
          skipped_no_place_id: stats.skipped_no_place_id,
          api_errors: stats.api_errors,
        };
        allFixes = stats.fixes;
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Coordinate Fix Summary');
    console.log('='.repeat(60));
    console.log(`Total places checked: ${totalStats.total_checked}`);
    console.log(`  - Coordinates fixed: ${totalStats.coordinates_fixed}`);
    console.log(`  - Skipped (no place_id): ${totalStats.skipped_no_place_id}`);
    console.log(`  - API errors: ${totalStats.api_errors}`);

    if (allFixes.length > 0) {
      console.log('\nFixes applied:');
      for (const fix of allFixes) {
        console.log(`  - ${fix.name} (${fix.type}): moved ${Math.round(fix.distance_meters)}m`);
      }
    }

    console.log('\n✅ Coordinate verification completed!');
  } catch (error) {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  }
}

// Run the script
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
