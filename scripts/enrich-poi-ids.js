#!/usr/bin/env node

import { readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const GOOGLE_MAPS_API_KEY = process.env.VITE_GOOGLE_MAPS_API_KEY;

if (!GOOGLE_MAPS_API_KEY) {
  console.error('❌ Missing VITE_GOOGLE_MAPS_API_KEY environment variable.');
  process.exit(1);
}
const TRIP_PLAN_PATH = join(__dirname, '../local/trip-data/202512_NZ_trip-plan.json');

async function findPlaceId(name, address, location) {
  const query = `${name}, ${address}`;
  const url = new URL('https://maps.googleapis.com/maps/api/place/findplacefromtext/json');
  url.searchParams.append('input', query);
  url.searchParams.append('inputtype', 'textquery');
  url.searchParams.append('fields', 'place_id,name');
  url.searchParams.append('key', GOOGLE_MAPS_API_KEY);

  if (location?.lat && location?.lng) {
    url.searchParams.append('locationbias', `point:${location.lat},${location.lng}`);
  }

  try {
    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status === 'OK' && data.candidates?.length > 0) {
      return data.candidates[0].place_id;
    }

    console.warn(`⚠️  Could not find place_id for: ${name}`);
    return null;
  } catch (error) {
    console.error(`❌ Error fetching place_id for ${name}:`, error.message);
    return null;
  }
}

function generateActivityId(googlePlaceId) {
  const timestamp = Date.now();
  return `poi_${googlePlaceId}_${timestamp}`;
}

function isValidPoiId(activityId) {
  return activityId && activityId.startsWith('poi_ChIJ');
}

async function enrichItem(item) {
  const name = item.activity_name || item.name;
  const address = item.location?.address || '';

  // If activity_id already has valid POI format, keep it
  if (isValidPoiId(item.activity_id)) {
    console.log(`✓ ${name} already has valid POI ID`);
    return item;
  }

  // If google_place_id exists, use it
  let googlePlaceId = item.google_place_id;

  // If no google_place_id, try to find it via API
  if (!googlePlaceId) {
    console.log(`🔍 Searching for place_id: ${name}`);
    googlePlaceId = await findPlaceId(name, address, item.location);

    if (googlePlaceId) {
      item.google_place_id = googlePlaceId;
      console.log(`✓ Found place_id for ${name}: ${googlePlaceId}`);
    } else {
      console.log(`⚠️  Skipping ${name} - no place_id found`);
      return item;
    }
  }

  // Generate new activity_id
  const oldId = item.activity_id;
  item.activity_id = generateActivityId(googlePlaceId);
  console.log(`✓ Updated ${name}: ${oldId} → ${item.activity_id}`);

  return item;
}

async function enrichTripPlan() {
  console.log('📖 Reading trip plan...\n');
  const content = await readFile(TRIP_PLAN_PATH, 'utf-8');
  const tripPlan = JSON.parse(content);

  let activityCount = 0;
  let waypointCount = 0;

  for (const stop of tripPlan.tripData.stops) {
    console.log(`\n📍 Processing ${stop.name}...`);

    // Enrich activities
    if (stop.activities?.length > 0) {
      for (let i = 0; i < stop.activities.length; i++) {
        const activity = stop.activities[i];
        stop.activities[i] = await enrichItem(activity);
        activityCount++;
        // Rate limit: wait 100ms between API calls
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    // Enrich scenic waypoints
    if (stop.scenic_waypoints?.length > 0) {
      for (let i = 0; i < stop.scenic_waypoints.length; i++) {
        const waypoint = stop.scenic_waypoints[i];
        stop.scenic_waypoints[i] = await enrichItem(waypoint);
        waypointCount++;
        // Rate limit: wait 100ms between API calls
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  }

  // Update export date
  tripPlan.exportDate = new Date().toISOString();

  console.log('\n💾 Writing updated trip plan...');
  await writeFile(TRIP_PLAN_PATH, JSON.stringify(tripPlan, null, 2), 'utf-8');

  console.log('\n✅ Done!');
  console.log(`   Activities processed: ${activityCount}`);
  console.log(`   Scenic waypoints processed: ${waypointCount}`);
}

enrichTripPlan().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
