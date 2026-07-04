import { useState } from 'react';
import { useNavigate } from 'react-router';
import { UserMenu } from '@/components/Auth/UserMenu';
import { TripMetadataFormModal } from '@/components/Editing/TripMetadataFormModal';
import { ConfirmDialog } from '@/components/Layout/ConfirmDialog';
import { ErrorMessage } from '@/components/Layout/ErrorMessage';
import { LoadingSpinner } from '@/components/Layout/LoadingSpinner';
import { ImportTripModal } from '@/components/TripLibrary/ImportTripModal';
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
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
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
          <button
            className="rounded-xl bg-alpine-teal px-4 py-2 font-medium text-white shadow-xs transition-colors hover:bg-alpine-teal/90"
            onClick={() => setIsCreateModalOpen(true)}
            type="button"
          >
            New trip
          </button>
        </div>

        {trips.length === 0 ? (
          <p className="py-16 text-center text-gray-500">No trips yet - create your first one.</p>
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
      <ImportTripModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
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
