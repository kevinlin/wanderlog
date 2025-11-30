#!/usr/bin/env tsx
/**
 * Migration script to upload trip data from JSON files to Firestore
 *
 * Usage:
 *   pnpm tsx scripts/migrate-to-firestore.ts [filename]
 *
 * Examples:
 *   pnpm tsx scripts/migrate-to-firestore.ts                              # Migrate all trips
 *   pnpm tsx scripts/migrate-to-firestore.ts 202512_NZ_trip-plan.json   # Migrate specific trip
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { TripData } from '../src/types';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    // .env.local might not exist, continue without it
  }
}

/**
 * Validate Firebase configuration
 */
function validateFirebaseConfig(): void {
  const requiredVars = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID',
  ];

  const missing = requiredVars.filter(
    varName => !process.env[varName]
  );

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(varName => console.error(`   - ${varName}`));
    console.error('\nPlease set these in your .env.local file');
    process.exit(1);
  }
}

/**
 * Read and parse a trip data JSON file
 */
async function readTripDataFile(filename: string): Promise<TripData> {
  try {
    const tripDataDir = path.join(__dirname, '../public/trip-data');
    const filePath = path.join(tripDataDir, filename);

    console.log(`Reading ${filename}...`);
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(fileContent);

    // Handle both wrapped and unwrapped formats
    const tripData = data.tripData || data;

    if (!tripData.trip_name || !tripData.timezone || !Array.isArray(tripData.stops)) {
      throw new Error('Invalid trip data format');
    }

    return tripData as TripData;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to read trip data file: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Generate a trip ID from filename
 * Example: "202512_NZ_trip-plan.json" -> "202512_NZ"
 */
function generateTripId(filename: string): string {
  return filename.replace(/_trip-plan\.json$/, '');
}

/**
 * Get all trip data files in the trip-data directory
 */
async function getAllTripDataFiles(): Promise<string[]> {
  try {
    const tripDataDir = path.join(__dirname, '../public/trip-data');
    const files = await fs.readdir(tripDataDir);
    return files.filter(file => file.endsWith('_trip-plan.json'));
  } catch (error) {
    console.error('❌ Failed to read trip-data directory:', error);
    return [];
  }
}

/**
 * Main migration function
 */
async function main(): Promise<void> {
  console.log('🚀 Wanderlog Firestore Migration Tool\n');

  // Load environment variables first
  await loadEnvFile(path.join(__dirname, '../.env.local'));

  // Validate environment before importing Firebase modules
  validateFirebaseConfig();

  // Dynamic imports after env is loaded
  const firebaseConfig = await import('../src/config/firebase.js');
  const firebaseService = await import('../src/services/firebaseService.js');

  // Initialize Firebase
  try {
    firebaseConfig.initializeFirebase();
    console.log('✓ Firebase initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase:', error);
    process.exit(1);
  }

  // Parse command line arguments
  const args = process.argv.slice(2);
  const overwrite = args.includes('--overwrite');
  const filenames = args.filter(arg => !arg.startsWith('--'));

  /**
   * Migrate a single trip to Firestore
   */
  async function migrateTripToFirestore(
    filename: string,
    shouldOverwrite: boolean = false
  ): Promise<void> {
    // Read trip data from JSON file
    const tripData = await readTripDataFile(filename);
    const tripId = generateTripId(filename);

    console.log(`\n📦 Migrating trip: ${tripData.trip_name} (${tripId})`);

    // Check if trip already exists
    const existingTrip = await firebaseService.getTripById(tripId);
    if (existingTrip && !shouldOverwrite) {
      console.log(`⚠️  Trip ${tripId} already exists in Firestore`);
      console.log('   Use --overwrite flag to replace existing trip');
      return;
    }
    if (existingTrip && shouldOverwrite) {
      console.log('   Overwriting existing trip...');
    }

    // Upload to Firestore
    await firebaseService.createTrip(tripData, tripId);

    console.log(`✓ Successfully migrated trip: ${tripData.trip_name}`);
    console.log(`  - Trip ID: ${tripId}`);
    console.log(`  - Stops: ${tripData.stops.length}`);
    console.log(`  - Total activities: ${tripData.stops.reduce((acc, stop) => acc + (stop.activities?.length || 0), 0)}`);
  }

  try {
    if (filenames.length === 0) {
      // Migrate all trips
      console.log('No specific file specified. Migrating all trips...\n');
      const allFiles = await getAllTripDataFiles();

      if (allFiles.length === 0) {
        console.log('No trip data files found in public/trip-data/');
        return;
      }

      console.log(`Found ${allFiles.length} trip(s) to migrate:\n`);

      for (const filename of allFiles) {
        await migrateTripToFirestore(filename, overwrite);
      }
    } else {
      // Migrate specific trips
      for (const filename of filenames) {
        await migrateTripToFirestore(filename, overwrite);
      }
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Verify your trips in the Firebase Console');
    console.log('2. Update your app to use the new tripService');
    console.log('3. Test the app with the migrated data');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
