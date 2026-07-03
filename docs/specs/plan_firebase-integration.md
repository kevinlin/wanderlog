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
  trip_id: string;                                    // Reference to trip
  activityStatus: { [activityId: string]: boolean };  // Activity completion status
  activityOrders: { [baseId: string]: number[] };     // Custom activity ordering
  lastViewedBase?: string;                            // Last viewed base ID
  lastViewedDate?: string;                            // ISO timestamp
  updated_at: Timestamp;                              // Last modification time
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

Shipped in five phases: (1) Firebase setup with IndexedDB persistence, (2) service layer with the dual-write pattern, (3) one-time JSON→Firestore migration, (4) multi-trip state management, and (5) trip-selection + offline-indicator UI. The dual-write pattern writes to localStorage synchronously first, then attempts an async Firestore write that is allowed to fail offline (see Design Principles and Offline Behavior).

### Critical Files — Summary

| Path | Role |
|---|---|
| `src/config/firebase.ts` | Firebase app + Firestore init; IndexedDB offline persistence with fallback |
| `.env.local.example` | Firebase/Google Maps environment variable template |
| `src/services/firebaseService.ts` | Core Firestore CRUD (trips, user modifications, weather cache) |
| `src/services/tripService.ts` | Firestore trip loading + validation (replaced the deleted `tripDataService`) |
| `src/services/storageService.ts` | Dual-write (localStorage + Firestore) async user-modification API |
| `scripts/migrate-to-firestore.ts` | One-time JSON→Firestore migration (`pnpm migrate`) |
| `src/contexts/AppStateContext.tsx` | Multi-trip state: `currentTripId`, `availableTrips`; actions `SET_CURRENT_TRIP_ID`, `SET_AVAILABLE_TRIPS`, `LOAD_TRIP` |
| `src/hooks/useTripData.ts` | Trip loading by trip ID |
| `src/hooks/useTrips.ts` | Trip list management |
| `src/components/Layout/TripSelectorModal.tsx` | Trip selection modal (lists available trips) |
| `src/components/Layout/TripCard.tsx` | Trip summary card (name, timezone, dates) |
| `src/components/Layout/OfflineIndicator.tsx` | Offline/back-online status indicator |
| `src/App.tsx` | Firebase init on mount + offline indicator wiring |

## API Reference

Signatures are the source of truth in the linked files; this is a forward-looking inventory only.

### firebaseService (`src/services/firebaseService.ts`)

- **Trips**: `getAllTrips()`, `getTripById(tripId)`, `createTrip(tripData, tripId?)`, `updateTrip(tripId, updates)`
- **User modifications**: `getUserModifications(tripId)`, `saveUserModifications(tripId, mods)`, `updateActivityStatus(tripId, activityId, done)`
- **Weather cache**: `getWeatherCache(tripId, baseId)`, `saveWeatherCache(tripId, baseId, data, ttlHours)`, `isWeatherCacheValid(tripId, baseId)`

### tripService (`src/services/tripService.ts`)

- `loadAllTrips()`, `loadTripData(tripId)`, `validateTripData(data)` — Firestore-only. The deprecated `loadTripDataWithFallback()` has been removed.

### storageService (`src/services/storageService.ts`)

- **Trip ID**: `getCurrentTripId()`, `setCurrentTripId(tripId)`
- **User modifications** (async, dual-write): `getUserModifications(tripId)`, `saveUserModifications(tripId, mods)`, `updateActivityDoneStatus(tripId, activityId, done)`, `updateActivityOrderForBase(tripId, baseId, activityIds)`, `setLastViewedBase(tripId, baseId)`
- **Weather cache** (localStorage only, sync): `getWeatherCache()`, `saveWeatherCache(cache)`, `updateWeatherForBase(baseId, data, ttlHours?)`, `isWeatherCacheValid(baseId)`, `getCachedWeather(baseId)`

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

- `storageService.test.ts` updated for the async API with Firebase mocks; all existing tests pass with the new architecture (162 tests).
- Tests mock the Firebase service to reject, forcing the localStorage fallback path.
- Outstanding: dedicated `firebaseService` and `tripService` test suites.

## Deployment

### Prerequisites

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
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

1. **Set up Firebase**: copy `.env.local.example` to `.env.local` and add your Firebase config.
2. **Migrate existing trip data**: `pnpm migrate` (accepts a specific filename and `--overwrite`).
3. **Verify in Firebase Console**: confirm trips appear and document structure matches the schema.
4. **Deploy Firestore rules**: paste the rules above into Firebase Console → Firestore Database → Rules and publish.
5. **Deploy application**: `pnpm build`, deploy `dist/`, and ensure Firebase env vars are set in production.

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

The application uses **Firestore exclusively**. Static JSON file loading has been fully removed: `tripDataService.ts` and `loadTripDataWithFallback()` are deleted; `tripService.ts` is the active Firestore-only loader.

Static JSON files in `local/trip-data/` are **retained** for the migration/maintenance scripts and as backup/reference only — they are **not** loaded by the application at runtime.

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

Enable Firebase debug logging in `src/config/firebase.ts` via `setLogLevel('debug')` from `firebase/firestore`.

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

## Status

- 2026-07-03 — **Compacted post-implementation.** Collapsed the Phase 1–5 implementation walkthrough into a Critical Files summary, trimmed the API Reference to a function inventory with source links, and removed illustrative code examples (dual-write, test mocks, usage snippets). Preserved the data model, security rules, deployment steps, offline behavior, and troubleshooting. Full detail is recoverable via git history.
- **Document Version**: 1.1 — **Last Updated**: 2025-12-01 — Implementation Complete (Phases 1–5) + Static JSON Fallback Removed
