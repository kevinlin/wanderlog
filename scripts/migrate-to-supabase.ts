#!/usr/bin/env tsx

/**
 * Migration script to upload trip data from JSON files into Supabase
 * Postgres tables.
 *
 * Usage:
 *   pnpm migrate:supabase                             # Migrate all trips
 *   pnpm migrate:supabase 202512_NZ_trip-plan.json    # Migrate specific trip
 *
 * Upserts make the script idempotent (Req 1.2). The Firestore user-modifications
 * overlay was removed with the Firebase decommission (Req 8.4).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { buildRows } from '../src/services/supabaseMappers';
import type { TripData } from '../src/types/trip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    // .env.local might not exist, continue without it
  }
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    console.error(`❌ Missing required environment variable: ${key}`);
    process.exit(1);
  }
  return value;
}

async function readTripDataFile(filename: string): Promise<TripData> {
  const tripDataDir = path.join(__dirname, '../local/trip-data');
  const filePath = path.join(tripDataDir, filename);

  console.log(`Reading ${filename}...`);
  const fileContent = await fs.readFile(filePath, 'utf-8');
  const data = JSON.parse(fileContent);
  const tripData = data.tripData || data;

  if (!(tripData.trip_name && tripData.timezone && Array.isArray(tripData.stops))) {
    throw new Error(`Invalid trip data format in ${filename}`);
  }
  return tripData as TripData;
}

function generateTripId(filename: string): string {
  return filename.replace(/_trip-plan\.json$/, '');
}

async function getAllTripDataFiles(): Promise<string[]> {
  const tripDataDir = path.join(__dirname, '../local/trip-data');
  const files = await fs.readdir(tripDataDir);
  return files.filter((file) => file.endsWith('_trip-plan.json'));
}

async function migrateTrip(supabase: SupabaseClient, tripId: string, tripData: TripData): Promise<void> {
  const bundle = buildRows(tripData, tripId);
  const upsert = async (table: string, rows: object[]) => {
    if (rows.length === 0) {
      return;
    }
    const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' });
    if (error) {
      throw new Error(`${table}: ${error.message}`);
    }
  };
  await upsert('trips', [bundle.trip]);
  await upsert('stops', bundle.stops);
  await upsert('accommodations', bundle.accommodations);
  await upsert('activities', bundle.activities);
  await upsert('scenic_waypoints', bundle.scenicWaypoints);
  console.log(
    `${tripId}: ${bundle.stops.length} stops, ${bundle.activities.length} activities, ` +
      `${bundle.scenicWaypoints.length} waypoints, ${bundle.accommodations.length} accommodations`
  );
}

async function main(): Promise<void> {
  console.log('🚀 Wanderlog Supabase Migration Tool\n');

  await loadEnvFile(path.join(__dirname, '../.env.local'));

  const supabase = createClient(
    requireEnv('VITE_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY') // bypasses RLS; script-only
  );

  const args = process.argv.slice(2);
  const filenames = args.filter((arg) => !arg.startsWith('--'));

  try {
    const files = filenames.length > 0 ? filenames : await getAllTripDataFiles();
    if (files.length === 0) {
      console.log('No trip data files found in local/trip-data/');
      return;
    }

    for (const filename of files) {
      const tripData = await readTripDataFile(filename);
      const tripId = generateTripId(filename);
      await migrateTrip(supabase, tripId, tripData);
    }

    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
