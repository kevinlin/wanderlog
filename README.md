# Wanderlog

An interactive map-based travel journal for planning and tracking your adventures. Built with React, TypeScript, and Google Maps.

## Features

- 🗺️ **Interactive Google Maps** - View your trip with accommodation and activity markers
- 📅 **Timeline Navigation** - Swipe through your trip timeline with visual progression
- ✅ **Activity Tracking** - Mark activities as complete and track your progress
- 📱 **Mobile-Friendly** - Responsive design optimized for mobile devices
- ☁️ **Cloud Sync** - Trip data and progress stored in Supabase (Postgres + Auth + RLS)
- 💾 **Offline Support** - Persisted query cache serves reads offline; edits require a connection
- 🔄 **Multi-Trip Management** - Create and manage multiple trips
- 🧭 **Navigation** - Direct links to Google Maps for navigation
- 📊 **Export Data** - Download your updated trip data with progress

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- Google Maps API key
- Supabase project (or the local Supabase CLI stack)

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

3. Create a `.env.local` file with your API keys (see `.env.local.example`):
   ```bash
   # Google Maps
   VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key

   # Supabase
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key # script-only (migration)
   ```

4. Set up Supabase:
   - Create a project at [supabase.com](https://supabase.com) (or run `supabase start` for a local stack)
   - Apply the schema and RLS policies: `supabase db push` (migrations live in `supabase/migrations/`)
   - Create a user in Supabase Auth to sign in with

5. Start the development server:
   ```bash
   pnpm dev
   ```

6. Open [http://localhost:5173](http://localhost:5173) in your browser

### Trip Data

Trip data is stored in Supabase Postgres. You can:

1. **Create in the app**: Use the trip library and the in-app itinerary editing (stops, activities, accommodation, waypoints)
2. **Migrate from JSON**: Place JSON files in `local/trip-data/` and run `pnpm migrate:supabase`

Trip data schema is defined in `src/types/trip.ts`; the database schema lives in `supabase/migrations/`.

## Deployment

Production is hosted on Vercel:

1. Pushes to `main` run the test-gated `Vercel Deploy` workflow, which deploys to the Vercel production domain
2. Pull requests get an automatic Vercel preview deployment
3. Requires the `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` repository secrets

The former GitHub Pages URL (https://kevinlin.github.io/wanderlog/) is retired.

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

### Supabase

- Authentication and row-level security are managed by Supabase; policies live in `supabase/migrations/`
- The `SUPABASE_SERVICE_ROLE_KEY` is used only by the migration script and must never reach the client bundle

#### Offline Support

The app persists the TanStack Query cache to IndexedDB:
- Trip and weather reads are served from the cache while offline
- Edit affordances are disabled offline; failed writes surface a retry toast
- Offline indicator shows connection status

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
- **Supabase** - Postgres database, auth, and row-level security
- **TanStack Query** - Server state, optimistic mutations, offline cache
- **Google Maps API** - Maps and directions
- **@react-google-maps/api** - React Google Maps integration
- **@dnd-kit** - Drag and drop for activity reordering

## License

This project is private and proprietary.

## Contributing

This is a personal project. If you'd like to contribute, please fork the repository and submit a pull request.