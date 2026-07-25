import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { AgentButton } from '@/components/Agent';
import { UserMenu } from '@/components/Auth/UserMenu';
import { TripMetadataFormModal } from '@/components/Editing/TripMetadataFormModal';
import { ConfirmDialog } from '@/components/Layout/ConfirmDialog';
import { ErrorMessage } from '@/components/Layout/ErrorMessage';
import { LoadingSpinner } from '@/components/Layout/LoadingSpinner';
import { TripLibraryCard } from '@/components/TripLibrary/TripLibraryCard';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useDeleteTrip } from '@/hooks/useTripLibraryMutations';
import { useTrips } from '@/hooks/useTrips';
import type { TripSummary } from '@/types/trip';
import { deriveTripStatus, pickHeroTrip, sortForLibrary } from '@/utils/tripStatusUtils';

export const TripLibraryPage = () => {
  const { trips, isLoading, error, refetch } = useTrips();
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const [tripPendingDelete, setTripPendingDelete] = useState<TripSummary | null>(null);
  const [tripPendingEdit, setTripPendingEdit] = useState<TripSummary | null>(null);
  const deleteMutation = useDeleteTrip();

  if (isLoading) {
    return <LoadingSpinner fullScreen message="Loading your trips..." size="lg" variant="adventure" />;
  }

  if (error) {
    return <ErrorMessage details={error} fullScreen message={error} onRetry={refetch} title="Trips Unavailable" type="data" />;
  }

  const heroTrip = pickHeroTrip(trips);
  const gridTrips = sortForLibrary(trips).filter((trip) => trip.trip_id !== heroTrip?.trip_id);

  return (
    <div className="min-h-screen bg-sandy-beige/30">
      <UserMenu />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-6 flex items-center justify-between gap-4 sm:mb-8">
          <h1 className="font-bold text-3xl text-gray-900 sm:text-4xl">Our Trips</h1>
          <div className="flex items-center gap-3">
            <AgentButton />
            <Link
              className="rounded-xl bg-alpine-teal px-4 py-2 font-medium text-white shadow-xs transition-colors hover:bg-alpine-teal/90 active:bg-alpine-teal/80"
              to="/trips/new"
            >
              New trip
            </Link>
          </div>
        </div>

        {trips.length === 0 ? (
          <div className="py-16 text-center">
            <p className="font-medium text-gray-900 text-lg">No trips yet. Where to first?</p>
            <p className="mt-1 text-gray-600 text-sm">Name a trip, give it dates, and start filling in the map.</p>
            <Link
              className="mt-6 inline-block rounded-xl bg-alpine-teal px-4 py-2 font-medium text-white shadow-xs transition-colors hover:bg-alpine-teal/90 active:bg-alpine-teal/80"
              to="/trips/new"
            >
              Create your first trip
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {heroTrip && (
              <TripLibraryCard
                isHero
                onDelete={() => setTripPendingDelete(heroTrip)}
                onEdit={isOnline ? () => setTripPendingEdit(heroTrip) : undefined}
                onOpen={() => navigate(`/trips/${heroTrip.trip_id}`)}
                status={deriveTripStatus(heroTrip)}
                trip={heroTrip}
              />
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {gridTrips.map((trip) => (
                <TripLibraryCard
                  isHero={false}
                  key={trip.trip_id}
                  onDelete={() => setTripPendingDelete(trip)}
                  onEdit={isOnline ? () => setTripPendingEdit(trip) : undefined}
                  onOpen={() => navigate(`/trips/${trip.trip_id}`)}
                  status={deriveTripStatus(trip)}
                  trip={trip}
                />
              ))}
            </div>
          </div>
        )}
      </main>
      {tripPendingEdit && (
        <TripMetadataFormModal isOpen key={tripPendingEdit.trip_id} onClose={() => setTripPendingEdit(null)} trip={tripPendingEdit} />
      )}
      {tripPendingDelete && (
        <ConfirmDialog
          confirmLabel="Delete"
          message={`Delete '${tripPendingDelete.trip_name}'? All stops, activities, accommodations and waypoints go with it. This cannot be undone.`}
          onCancel={() => setTripPendingDelete(null)}
          onConfirm={() => {
            deleteMutation.mutate(tripPendingDelete.trip_id);
            setTripPendingDelete(null);
          }}
          title="Delete trip"
        />
      )}
    </div>
  );
};
