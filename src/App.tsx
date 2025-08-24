
import { ErrorBoundary } from '@/components/Layout/ErrorBoundary';
import { LoadingSpinner } from '@/components/Layout/LoadingSpinner';
import { ErrorMessage } from '@/components/Layout/ErrorMessage';
import { MapContainer } from '@/components/Map/MapContainer';
import { TimelineStrip } from '@/components/Timeline/TimelineStrip';
import { AccommodationCard } from '@/components/Cards/AccommodationCard';
import { ActivityCard } from '@/components/Cards/ActivityCard';
import { useTripData } from '@/hooks/useTripData';
import { useAppState } from '@/hooks/useAppState';
import { sortActivitiesByOrder, getActivityStatus } from '@/utils/tripUtils';

function App() {
  const { tripData, isLoading, error, refetch } = useTripData();
  const {
    stopStatus,
    currentStopId,
    selectedActivityId,
    updateActivityStatus,
    setCurrentStop,
    setSelectedActivity,
  } = useAppState(tripData?.stops || []);

  if (isLoading) {
    return <LoadingSpinner message="Loading your adventure..." fullScreen />;
  }

  if (error || !tripData) {
    return <ErrorMessage message={error || 'Failed to load trip data'} onRetry={refetch} fullScreen />;
  }

  const currentStop = tripData.stops.find(stop => stop.stop_id === currentStopId);
  const sortedActivities = currentStop ? sortActivitiesByOrder(
    currentStop.activities,
    stopStatus[currentStopId]?.activityOrder
  ) : [];

  const handleActivityToggle = (activityId: string, done: boolean) => {
    updateActivityStatus(currentStopId, activityId, done);
  };

  const handleActivitySelect = (activityId: string) => {
    setSelectedActivity(selectedActivityId === activityId ? null : activityId);
  };

  const handleStopSelect = (stopId: string) => {
    setCurrentStop(stopId);
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 p-4">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900">{tripData.trip_name}</h1>
            <p className="text-sm text-gray-600 mt-1">
              Family of {tripData.travellers.length} • {tripData.vehicle}
            </p>
          </div>
        </header>

        {/* Timeline Strip */}
        <TimelineStrip
          stops={tripData.stops}
          currentStopId={currentStopId}
          onStopSelect={handleStopSelect}
        />

        {/* Main Content */}
        <div className="flex h-[calc(100vh-140px)]">
          {/* Map */}
          <div className="flex-1">
            <MapContainer
              stops={tripData.stops}
              currentStopId={currentStopId}
              selectedActivityId={selectedActivityId}
              onActivitySelect={handleActivitySelect}
              onStopSelect={handleStopSelect}
            />
          </div>

          {/* Sidebar */}
          <div className="w-96 bg-white border-l border-gray-200 overflow-y-auto">
            <div className="p-4">
              {currentStop && (
                <>
                  {/* Accommodation Card */}
                  <AccommodationCard
                    accommodation={currentStop.accommodation}
                    stopName={currentStop.name}
                  />

                  {/* Activities Section */}
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Activities ({sortedActivities.length})
                    </h3>
                    
                    {sortedActivities.length === 0 ? (
                      <p className="text-gray-500 text-center py-8">No activities planned for this stop.</p>
                    ) : (
                      <div className="space-y-3">
                        {sortedActivities.map((activity) => (
                          <ActivityCard
                            key={activity.activity_id}
                            activity={activity}
                            accommodation={currentStop.accommodation}
                            isSelected={activity.activity_id === selectedActivityId}
                            isDone={getActivityStatus(activity, stopStatus, currentStopId)}
                            onToggleDone={handleActivityToggle}
                            onSelect={handleActivitySelect}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default App;
