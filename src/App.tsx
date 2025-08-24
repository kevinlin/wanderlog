
import { useEffect } from 'react';
import { ErrorBoundary } from '@/components/Layout/ErrorBoundary';
import { LoadingSpinner } from '@/components/Layout/LoadingSpinner';
import { ErrorMessage } from '@/components/Layout/ErrorMessage';
import { MapContainer } from '@/components/Map/MapContainer';
import { TimelineStrip } from '@/components/Timeline/TimelineStrip';
import { AccommodationCard } from '@/components/Cards/AccommodationCard';
import { ActivityCard } from '@/components/Cards/ActivityCard';
import { useTripData } from '@/hooks/useTripData';
import { useAppStateContext } from '@/contexts/AppStateContext';
import { sortActivitiesByOrder } from '@/utils/tripUtils';
import { getCurrentStop } from '@/utils/dateUtils';
import { getUserModifications } from '@/services/storageService';
import { Activity } from '@/types';

function App() {
  const { tripData, isLoading, error, refetch } = useTripData();
  const { state, dispatch } = useAppStateContext();

  // Initialize trip data in global state when loaded
  useEffect(() => {
    if (tripData) {
      dispatch({ type: 'SET_TRIP_DATA', payload: tripData });
    }
  }, [tripData, dispatch]);

  // Initialize user modifications from localStorage
  useEffect(() => {
    const userModifications = getUserModifications();
    if (userModifications) {
      dispatch({ type: 'SET_USER_MODIFICATIONS', payload: userModifications });
    }
  }, [dispatch]);

  // Initialize current base when trip data is available
  useEffect(() => {
    if (tripData && !state.currentBase) {
      const currentStop = getCurrentStop(tripData.stops);
      const lastViewedBase = state.userModifications.lastViewedBase;
      const initialBase = lastViewedBase && tripData.stops.find(s => s.stop_id === lastViewedBase)
        ? lastViewedBase
        : currentStop?.stop_id || tripData.stops[0]?.stop_id;
      
      if (initialBase) {
        dispatch({ type: 'SELECT_BASE', payload: initialBase });
      }
    }
  }, [tripData, state.currentBase, state.userModifications.lastViewedBase, dispatch]);

  // Use global state values
  const loading = isLoading || state.loading;
  const appError = error || state.error;
  const appTripData = state.tripData || tripData;

  if (loading) {
    return <LoadingSpinner message="Loading your adventure..." fullScreen variant="adventure" size="lg" />;
  }

  if (appError || !appTripData) {
    return (
      <ErrorMessage 
        message={appError || 'Failed to load trip data'} 
        onRetry={refetch} 
        fullScreen 
        type="data"
        title="Adventure Data Unavailable"
        details={appError || undefined}
      />
    );
  }

  const currentStop = appTripData.stops.find(stop => stop.stop_id === state.currentBase);
  
  // Convert array-based order to object-based order for utility function
  const getCustomOrder = (activities: Activity[], orderArray?: number[]) => {
    if (!orderArray) return undefined;
    
    const customOrder: { [activityId: string]: number } = {};
    orderArray.forEach((originalIndex, newIndex) => {
      if (activities[originalIndex]) {
        customOrder[activities[originalIndex].activity_id] = newIndex;
      }
    });
    return customOrder;
  };

  const sortedActivities = currentStop && state.currentBase ? sortActivitiesByOrder(
    currentStop.activities,
    getCustomOrder(currentStop.activities, state.userModifications.activityOrders[state.currentBase])
  ) : [];

  const handleActivityToggle = (activityId: string, done: boolean) => {
    dispatch({ 
      type: 'TOGGLE_ACTIVITY_DONE', 
      payload: { activityId, done } 
    });
  };

  const handleActivitySelect = (activityId: string) => {
    const newSelection = state.selectedActivity === activityId ? null : activityId;
    dispatch({ type: 'SELECT_ACTIVITY', payload: newSelection });
  };

  const handleStopSelect = (stopId: string) => {
    dispatch({ type: 'SELECT_BASE', payload: stopId });
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 p-4">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900">{appTripData.trip_name}</h1>
            <p className="text-sm text-gray-600 mt-1">
              {appTripData.travellers && appTripData.vehicle && `Family of ${appTripData.travellers.length} • ${appTripData.vehicle}`}
            </p>
          </div>
        </header>

        {/* Timeline Strip */}
        <TimelineStrip
          stops={appTripData.stops}
          currentStopId={state.currentBase}
          onStopSelect={handleStopSelect}
        />

        {/* Main Content */}
        <div className="flex h-[calc(100vh-140px)]">
          {/* Map */}
          <div className="flex-1">
            <MapContainer
              stops={appTripData.stops}
              currentStopId={state.currentBase}
              selectedActivityId={state.selectedActivity}
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
                            isSelected={activity.activity_id === state.selectedActivity}
                            isDone={state.userModifications.activityStatus[activity.activity_id] || false}
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
