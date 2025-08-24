# Wanderlog

An interactive map-based travel journal for planning and tracking your adventures. Built with React, TypeScript, and Google Maps.

## Features

- 🗺️ **Interactive Google Maps** - View your trip with accommodation and activity markers
- 📅 **Timeline Navigation** - Swipe through your trip timeline with visual progression
- ✅ **Activity Tracking** - Mark activities as complete and track your progress
- 📱 **Mobile-Friendly** - Responsive design optimized for mobile devices
- 💾 **Local Storage** - Your progress is automatically saved locally
- 🧭 **Navigation** - Direct links to Google Maps for navigation
- 📊 **Export Data** - Download your updated trip data with progress

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Google Maps API key

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/wanderlog.git
   cd wanderlog
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file with your Google Maps API key:
   ```bash
   VITE_GOOGLE_MAPS_API_KEY=your_api_key_here
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:5173](http://localhost:5173) in your browser

### Trip Data

Place your trip data JSON file in `public/trip-data/` with the filename format: `YYYYMM_LOCATION_trip-plan.json`

The trip data should follow the schema defined in `src/types/trip.ts`.

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
- **Google Maps API** - Maps and directions
- **@react-google-maps/api** - React Google Maps integration
- **@dnd-kit** - Drag and drop for activity reordering

## License

This project is private and proprietary.

## Contributing

This is a personal project. If you'd like to contribute, please fork the repository and submit a pull request.