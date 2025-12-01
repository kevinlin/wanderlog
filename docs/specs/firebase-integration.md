# Firebase Integration Specification

## Overview

This document describes the Firebase Firestore integration for the Wanderlog app, providing cloud-based storage for trip data and user modifications with offline-first support.

## Architecture

### Design Principles

1. **Offline-First**: App works fully offline with Firebase's IndexedDB persistence
2. **Dual-Write Pattern**: Write to both localStorage (immediate) and Firestore (async) for reliability
3. **Eventual Consistency**: Data syncs on app load/refresh, no real-time listeners
4. **Single-User Mode**: Firebase as cloud storage backend only (no authentication)
5. **Multi-Trip Support**: Each trip is a separate Firestore document

### Technology Stack

- **Firebase SDK**: v12.6.0
- **Firestore**: NoSQL cloud database
- **IndexedDB**: Offline persistence via Firebase
- **localStorage**: Immediate fallback storage

## Data Model

### Firestore Collections

#### 1. `trips` Collection

Stores trip data (stops, activities, accommodations, etc.)

**Document ID**: `{YYYYMM}_{LOCATION}` (e.g., `202512_NZ`)

**Schema**:
```typescript
{
  trip_id: string;           // Document ID
  trip_name: string;         // "New Zealand Adventure"
  timezone: string;          // "Pacific/Auckland"
  stops: TripBase[];         // Array of stops/bases
  created_at: Timestamp;     // Document creation time
  updated_at: Timestamp;     // Last modification time
}
```

#### 2. `user_modifications` Collection

Stores user-specific data (activity status, custom ordering, last viewed base)

**Document ID**: `{trip_id}` (matches trip document ID)

**Schema**:
```typescript
{
  trip_id: string;                          // Reference to trip
  activityStatus: { [activityId: string]: boolean };  // Activity completion status
  activityOrders: { [baseId: string]: number[] };     // Custom activity ordering
  lastViewedBase?: string;                  // Last viewed base ID
  lastViewedDate?: string;                  // ISO timestamp
  updated_at: Timestamp;                    // Last modification time
}
```

#### 3. `weather_cache` Collection

Stores cached weather data with expiration

**Document ID**: `{trip_id}_{base_id}` (e.g., `202512_NZ_queenstown`)

**Schema**:
```typescript
{
  trip_id: string;           // Reference to trip
  base_id: string;           // Reference to base/stop
  data: WeatherData;         // Cached weather information
  fetched_at: Timestamp;     // When data was fetched
  expires_at: Timestamp;     // Expiration time
}
```

## Implementation

### Phase 1: Firebase Setup ✅

**Files Created:**
- [src/config/firebase.ts](../../src/config/firebase.ts) - Firebase initialization
- [.env.local.example](../../.env.local.example) - Environment variables template

**Features:**
- Firebase app initialization
- Firestore database setup
- IndexedDB offline persistence (with fallback handling)
- Environment variable configuration

### Phase 2: Service Layer ✅

**Files Created:**
- [src/services/firebaseService.ts](../../src/services/firebaseService.ts) - Firestore CRUD operations
- [src/services/tripService.ts](../../src/services/tripService.ts) - Trip data management

**Files Modified:**
- [src/services/storageService.ts](../../src/services/storageService.ts) - Dual-write pattern implementation

**Features:**
- **firebaseService**: Core Firestore operations (trips, user modifications, weather cache)
- **tripService**: Trip loading with validation (replaces tripDataService)
- **storageService**: Dual-write to localStorage + Firestore with async API

**Dual-Write Pattern:**
```typescript
// Write to localStorage first (immediate, synchronous)
localStorage.setItem(key, JSON.stringify(data));

// Then sync to Firestore (async, may fail offline)
try {
  await firebaseService.saveUserModifications(tripId, data);
} catch (error) {
  // Queue for retry when back online
}
```

### Phase 3: Data Migration ✅

**Files Created:**
- [scripts/migrate-to-firestore.ts](../../scripts/migrate-to-firestore.ts) - Migration script

**Features:**
- One-time migration from JSON files to Firestore
- Automatic trip ID generation from filename
- Overwrite protection (requires `--overwrite` flag)
- Batch migration support

**Usage:**
```bash
# Migrate all trips
pnpm migrate

# Migrate specific trip
pnpm migrate 202512_NZ_trip-plan.json

# Overwrite existing trip
pnpm migrate 202512_NZ_trip-plan.json --overwrite
```

### Phase 4: State Management ✅

**Files Modified:**
- [src/contexts/AppStateContext.tsx](../../src/contexts/AppStateContext.tsx) - Multi-trip support
- [src/hooks/useTripData.ts](../../src/hooks/useTripData.ts) - Trip ID parameter

**Files Created:**
- [src/hooks/useTrips.ts](../../src/hooks/useTrips.ts) - Trip list management

**New State Properties:**
- `currentTripId: string | null` - Currently loaded trip
- `availableTrips: TripSummary[]` - List of available trips

**New Actions:**
- `SET_CURRENT_TRIP_ID` - Set current trip ID
- `SET_AVAILABLE_TRIPS` - Load trip list
- `LOAD_TRIP` - Load trip with data and user modifications

### Phase 5: UI Components ✅

**Files Created:**
- [src/components/Layout/TripCard.tsx](../../src/components/Layout/TripCard.tsx)
- [src/components/Layout/TripSelectorModal.tsx](../../src/components/Layout/TripSelectorModal.tsx)
- [src/components/Layout/OfflineIndicator.tsx](../../src/components/Layout/OfflineIndicator.tsx)

**Files Modified:**
- [src/App.tsx](../../src/App.tsx) - Firebase initialization and offline indicator

**Features:**
- Trip selection modal with list of available trips
- Trip cards showing trip info (name, timezone, dates)
- Offline status indicator (shows when offline/back online)
- Firebase initialization on app mount

## API Reference

### firebaseService

#### Trip Operations

```typescript
// Get all trips (sorted by created_at DESC)
getAllTrips(): Promise<TripData[]>

// Get trip by ID
getTripById(tripId: string): Promise<TripData | null>

// Create new trip
createTrip(tripData: TripData, tripId?: string): Promise<string>

// Update existing trip
updateTrip(tripId: string, updates: Partial<TripData>): Promise<void>
```

#### User Modifications

```typescript
// Get user modifications for trip
getUserModifications(tripId: string): Promise<UserModifications>

// Save user modifications
saveUserModifications(tripId: string, mods: UserModifications): Promise<void>

// Update single activity status
updateActivityStatus(tripId: string, activityId: string, done: boolean): Promise<void>
```

#### Weather Cache

```typescript
// Get weather cache (with expiration check)
getWeatherCache(tripId: string, baseId: string): Promise<WeatherData | null>

// Save weather cache with TTL
saveWeatherCache(tripId: string, baseId: string, data: WeatherData, ttlHours: number): Promise<void>

// Check if cache is valid
isWeatherCacheValid(tripId: string, baseId: string): Promise<boolean>
```

### tripService

```typescript
// Load all trips from Firestore
loadAllTrips(): Promise<TripData[]>

// Load specific trip by ID
loadTripData(tripId: string): Promise<TripData>

// Validate trip data structure
validateTripData(data: unknown): ValidationResult
```

**Note:** The deprecated `loadTripDataWithFallback()` function has been removed. All trip loading now uses Firestore exclusively.

### storageService

All functions now require `tripId` parameter and are async:

```typescript
// Get current trip ID
getCurrentTripId(): string | null

// Set current trip ID
setCurrentTripId(tripId: string): void

// User modifications (async, dual-write)
getUserModifications(tripId: string): Promise<UserModifications>
saveUserModifications(tripId: string, mods: UserModifications): Promise<void>
updateActivityDoneStatus(tripId: string, activityId: string, done: boolean): Promise<void>
updateActivityOrderForBase(tripId: string, baseId: string, activityIds: string[]): Promise<void>
setLastViewedBase(tripId: string, baseId: string): Promise<void>

// Weather cache (localStorage only, synchronous)
getWeatherCache(): WeatherCache
saveWeatherCache(cache: WeatherCache): void
updateWeatherForBase(baseId: string, weatherData: any, ttlHours?: number): void
isWeatherCacheValid(baseId: string): boolean
getCachedWeather(baseId: string): any | null
```

## Environment Variables

Required environment variables in `.env.local`:

```bash
# Google Maps API (existing)
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# Firebase Configuration (new)
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

## Testing

### Test Coverage

- ✅ **storageService.test.ts**: Updated for async API with Firebase mocks
- ✅ **All existing tests**: Pass with new architecture (162 tests)
- ⏳ **firebaseService tests**: To be added
- ⏳ **tripService tests**: To be added

### Firebase Mocking

Tests mock Firebase to use localStorage fallback:

```typescript
vi.mock('../firebaseService', () => ({
  getUserModifications: vi.fn().mockRejectedValue(new Error('Firebase not available in tests')),
  saveUserModifications: vi.fn().mockRejectedValue(new Error('Firebase not available in tests')),
}));
```

## Deployment

### Prerequisites

1. Create Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable Firestore Database
3. Set up environment variables in `.env.local`

### Firestore Security Rules

**Recommended rules for single-user mode:**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write to all documents (single-user mode)
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

**For production with authentication:**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Trips: Public read, authenticated write
    match /trips/{tripId} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    // User modifications: Per-user access
    match /user_modifications/{tripId} {
      allow read, write: if request.auth != null;
    }

    // Weather cache: Public read/write
    match /weather_cache/{cacheId} {
      allow read, write: if true;
    }
  }
}
```

### Migration Steps

1. **Set up Firebase**:
   ```bash
   # Create .env.local with Firebase credentials
   cp .env.local.example .env.local
   # Edit .env.local and add your Firebase config
   ```

2. **Migrate existing trip data**:
   ```bash
   pnpm migrate
   ```

3. **Verify in Firebase Console**:
   - Check that trips appear in Firestore
   - Verify document structure matches schema

4. **Deploy Firestore rules**:
   - Go to Firebase Console → Firestore Database → Rules
   - Copy security rules from above
   - Publish rules

5. **Deploy application**:
   ```bash
   pnpm build
   # Deploy dist/ to your hosting platform
   # Ensure Firebase env vars are set in production
   ```

## Offline Behavior

### How It Works

1. **On first load**: Firebase SDK downloads data to IndexedDB
2. **Offline**: App reads from IndexedDB, writes to localStorage
3. **Back online**: Firebase SDK syncs changes automatically
4. **Offline indicator**: Shows status in top-right corner

### Data Flow

```
User Action
    ↓
State Update (React Context)
    ↓
saveUserModifications(tripId, data)
    ↓
    ├─→ localStorage.setItem() [immediate]
    └─→ firebaseService.save() [async, may fail]
         ↓
         Firestore (syncs when online)
```

### Conflict Resolution

- **Single-user mode**: No conflicts (one user at a time)
- **Future multi-user**: Last write wins (Firestore default)

## Migration from JSON to Firestore

### Current Status ✅

The application now uses **Firestore exclusively**. Static JSON file loading has been fully removed.

**Removed Components:**
- ❌ `tripDataService.ts` - Static JSON loader (deleted)
- ❌ `loadTripDataWithFallback()` - Fallback function (deleted)
- ✅ `tripService.ts` - Firestore-only loader (active)

### Static Files (Backup/Reference Only)

Static JSON files in `local/trip-data/` are **retained** for:
- Migration scripts (`pnpm migrate`)
- Data maintenance scripts (`scripts/*.ts`)
- Backup/reference purposes

**Important:** These files are **not** loaded by the application at runtime.

### Usage

```typescript
// Load specific trip by ID (Firestore only)
const tripData = await loadTripData('202512_NZ');

// Load all trips (Firestore only)
const trips = await loadAllTrips();
```

## Future Enhancements

### Potential Features

1. **Real-time sync**: Add Firestore `onSnapshot` listeners for live updates
2. **Multi-user support**: Add Firebase Authentication
3. **Collaborative editing**: Multiple users editing same trip
4. **Cloud Functions**: Server-side data validation and processing
5. **Firebase Storage**: Store trip photos and attachments
6. **Sharing**: Share trips with other users via permissions
7. **Trip templates**: Create and share trip templates

### Performance Optimizations

1. **Pagination**: Load trips in batches (currently loads all)
2. **Selective sync**: Only sync changed user modifications
3. **Background sync**: Use Service Workers for offline sync
4. **Caching**: More aggressive caching strategies

## Troubleshooting

### Common Issues

**Issue**: "Firebase not initialized"
- **Solution**: Ensure `.env.local` has all required Firebase variables

**Issue**: "Failed to enable persistence"
- **Reason**: Multiple tabs open or browser doesn't support IndexedDB
- **Impact**: App still works, just won't cache data offline

**Issue**: "Trip not found"
- **Solution**: Run migration script to upload trip to Firestore

**Issue**: Changes not syncing
- **Check**: Network connection and Firebase Console for data
- **Debug**: Check browser console for Firestore errors

### Debugging

Enable Firebase debug logging:

```typescript
// In src/config/firebase.ts
import { setLogLevel } from 'firebase/firestore';
setLogLevel('debug'); // Enable verbose logging
```

## Metrics and Monitoring

### Key Metrics to Track

1. **Firestore reads/writes**: Monitor quota usage
2. **Offline cache hits**: Measure offline functionality
3. **Sync latency**: Time to sync changes when online
4. **Error rates**: Firestore operation failures

### Firebase Console

Monitor usage at: `console.firebase.google.com/{project}/firestore`

- **Usage tab**: Read/write counts, storage size
- **Data tab**: Browse collections and documents
- **Rules tab**: Security rules configuration

## License

This integration follows the same license as the main Wanderlog project.

---

**Document Version**: 1.1
**Last Updated**: 2025-12-01
**Status**: Implementation Complete (Phases 1-5) + Static JSON Fallback Removed
