# Wanderlog

An interactive map-based travel journal for planning and tracking your adventures. Built with React, TypeScript, and Google Maps.

## Features

- 🗺️ **Interactive Google Maps** - View your trip with accommodation and activity markers
- 📅 **Timeline Navigation** - Swipe through your trip timeline with visual progression
- ✅ **Activity Tracking** - Mark activities as complete and track your progress
- 📱 **Mobile-Friendly** - Responsive design optimized for mobile devices
- ☁️ **Cloud Sync** - Trip data and progress synced to Firebase Firestore
- 💾 **Offline Support** - Works fully offline with automatic sync when online
- 🔄 **Multi-Trip Management** - Create and manage multiple trips
- 🧭 **Navigation** - Direct links to Google Maps for navigation
- 📊 **Export Data** - Download your updated trip data with progress

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- Google Maps API key
- Firebase project with Firestore enabled

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/kevinlin/wanderlog.git
   cd wanderlog
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Create a `.env.local` file with your API keys:
   ```bash
   # Google Maps
   VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key

   # Firebase Configuration
   VITE_FIREBASE_API_KEY=your_firebase_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   ```

4. Set up Firebase:
   - Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
   - Enable Firestore Database
   - Copy your Firebase config to `.env.local`
   - Deploy Firestore security rules (see [Firebase Configuration](#firebase-configuration))

5. Migrate your trip data to Firestore:
   ```bash
   # Place trip JSON in public/trip-data/ (format: YYYYMM_LOCATION_trip-plan.json)
   # Then run migration
   pnpm migrate
   ```

6. Start the development server:
   ```bash
   pnpm dev
   ```

7. Open [http://localhost:5173](http://localhost:5173) in your browser

### Trip Data

Trip data is stored in Firebase Firestore. You can:

1. **Migrate from JSON**: Place JSON files in `public/trip-data/` and run `pnpm migrate`
2. **Create directly**: Use the Firestore Console to create trip documents
3. **API**: Use the `firebaseService` to programmatically create trips

Trip data schema is defined in `src/types/trip.ts`.

## Deployment

This project is configured for GitHub Pages deployment:

1. Set up a GitHub repository
2. Add your Google Maps API key as a repository secret: `GOOGLE_MAPS_API_KEY`
3. Push to the `main` branch to trigger automatic deployment

## Project Structure

```
src/
├── components/          # React components
│   ├── Cards/          # Activity and accommodation cards
│   ├── Layout/         # Layout and UI components
│   ├── Map/            # Google Maps integration
│   └── Timeline/       # Timeline navigation
├── hooks/              # Custom React hooks
├── services/           # Data services (API, localStorage)
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
└── App.tsx            # Main application component
```

## Configuration

### Firebase

#### Firestore Security Rules

For single-user mode (development):
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

For production with authentication:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /trips/{tripId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /user_modifications/{tripId} {
      allow read, write: if request.auth != null;
    }
    match /weather_cache/{cacheId} {
      allow read, write: if true;
    }
  }
}
```

#### Offline Support

The app uses Firebase's IndexedDB persistence for offline functionality:
- Data is cached locally when online
- App works fully offline
- Changes sync automatically when back online
- Offline indicator shows connection status

See [docs/specs/firebase-integration.md](docs/specs/firebase-integration.md) for detailed Firebase architecture and API documentation.

### Google Maps

- Create a Google Cloud Project
- Enable the Maps JavaScript API and Directions API
- Restrict your API key to your domain
- Set up billing (required for Directions API)

### Tailwind CSS

The project uses a custom color palette for the travel theme:
- Alpine Teal: `#4A9E9E`
- Lake Blue: `#6BB6D6`
- Fern Green: `#5B8C5A`
- Sandy Beige: `#F2E7D5`

## Technologies Used

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **Firebase Firestore** - Cloud database and offline sync
- **Google Maps API** - Maps and directions
- **@react-google-maps/api** - React Google Maps integration
- **@dnd-kit** - Drag and drop for activity reordering

## License

This project is private and proprietary.

## Contributing

This is a personal project. If you'd like to contribute, please fork the repository and submit a pull request.