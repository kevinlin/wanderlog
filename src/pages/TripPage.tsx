import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { ActivitiesPanel } from '@/components/Activities/ActivitiesPanel';
import { ErrorBoundary } from '@/components/Layout/ErrorBoundary';
import { ErrorMessage } from '@/components/Layout/ErrorMessage';
import { LoadingSpinner } from '@/components/Layout/LoadingSpinner';
import { OfflineIndicator } from '@/components/Layout/OfflineIndicator';
import { Toast, type ToastState } from '@/components/Layout/Toast';
import { MapContainer } from '@/components/Map/MapContainer';
import { TimelineStrip } from '@/components/Timeline/TimelineStrip';
import { useAppStateContext } from '@/contexts/AppStateContext';
import { useScreenSize } from '@/hooks/useScreenSize';
import { useTripData } from '@/hooks/useTripData';
import { useReorderActivities, useToggleActivityDone } from '@/hooks/useTripMutations';
import { getLastViewedBase, setCurrentTripId, setLastViewedBase } from '@/services/viewStateStorage';
import { getCurrentStop } from '@/utils/dateUtils';
import { sortActivitiesByOrder } from '@/utils/tripUtils';

export const TripPage = () => {
  const { tripId: tripIdParam } = useParams<{ tripId: string }>();
  const tripId = tripIdParam ?? '';
  const { tripData, isLoading, error, refetch } = useTripData({ tripId });
  const { state, dispatch } = useAppStateContext();
  const { isMobile } = useScreenSize();
  const toggleDoneMutation = useToggleActivityDone(tripId);
  const reorderMutation = useReorderActivities(tripId);
  const [toast, setToast] = useState<ToastState>({ message: '', type: 'info', show: false });
  const [isActivitiesPanelVisible, setIsActivitiesPanelVisible] = useState(false);

  // Set initial panel visibility based on screen size
  useEffect(() => {
    setIsActivitiesPanelVisible(!isMobile);
  }, [isMobile]);

  // Remember the trip for the / redirect on the next visit
  useEffect(() => {
    if (tripId) {
      setCurrentTripId(tripId);
    }
  }, [tripId]);

  // Track the current trip in UI state
  useEffect(() => {
    dispatch({ type: 'SET_CURRENT_TRIP_ID', payload: tripId });
  }, [dispatch, tripId]);

  // Initialize current base when trip data is available
  useEffect(() => {
    if (tripData && !state.currentBase) {
      const currentStop = getCurrentStop(tripData.stops);
      const lastViewedBase = getLastViewedBase(tripId);
      const initialBase =
        lastViewedBase && tripData.stops.find((s) => s.stop_id === lastViewedBase)
          ? lastViewedBase
          : currentStop?.stop_id || tripData.stops[0]?.stop_id;

      if (initialBase) {
        dispatch({ type: 'SELECT_BASE', payload: initialBase });
      }
    }
  }, [tripData, state.currentBase, dispatch, tripId]);

  // Done-status map derived from trip data (status.done is canonical since Supabase)
  const activityStatus = useMemo(() => {
    const status: Record<string, boolean> = {};
    for (const stop of tripData?.stops ?? []) {
      for (const activity of stop.activities) {
        status[activity.activity_id] = activity.status?.done ?? false;
      }
      for (const waypoint of stop.scenic_waypoints ?? []) {
        status[waypoint.activity_id] = waypoint.status?.done ?? false;
      }
    }
    return status;
  }, [tripData]);

  if (isLoading) {
    return <LoadingSpinner fullScreen message="Loading your adventure..." size="lg" variant="adventure" />;
  }

  if (error || !tripData) {
    return (
      <ErrorMessage
        details={error || undefined}
        fullScreen
        message={error || 'Failed to load trip data'}
        onRetry={refetch}
        title="Adventure Data Unavailable"
        type="data"
      />
    );
  }

  const currentStop = tripData.stops.find((stop) => stop.stop_id === state.currentBase);

  // The mapper writes `order` onto each activity, so no custom order map is needed
  const sortedActivities = currentStop ? sortActivitiesByOrder(currentStop.activities) : [];

  const handleActivityToggle = (activityId: string, done: boolean) => {
    const isWaypoint = tripData.stops.some((stop) => (stop.scenic_waypoints ?? []).some((waypoint) => waypoint.activity_id === activityId));
    toggleDoneMutation.mutate(
      { activityId, isDone: done, isWaypoint },
      {
        onError: (mutationError) => {
          showToast(`Failed to save: ${mutationError.message}`, 'error');
        },
      }
    );
  };

  const handleActivitySelect = (activityId: string) => {
    const newSelection = state.selectedActivity === activityId ? null : activityId;
    dispatch({ type: 'SELECT_ACTIVITY', payload: newSelection });
  };

  const handleStopSelect = (stopId: string) => {
    dispatch({ type: 'SELECT_BASE', payload: stopId });
    setLastViewedBase(tripId, stopId);
    // Auto-show activities panel on mobile when stop is selected
    setIsActivitiesPanelVisible(true);
  };

  const handleHideActivitiesPanel = () => {
    setIsActivitiesPanelVisible(false);
  };

  const handleActivityReorder = (fromIndex: number, toIndex: number) => {
    if (!state.currentBase || fromIndex === toIndex) {
      return;
    }
    const orderedIds = sortedActivities.map((activity) => activity.activity_id);
    const [moved] = orderedIds.splice(fromIndex, 1);
    orderedIds.splice(toIndex, 0, moved);
    reorderMutation.mutate(
      { stopId: state.currentBase, orderedActivityIds: orderedIds },
      {
        onError: (mutationError) => {
          showToast(`Failed to save order: ${mutationError.message}`, 'error');
        },
      }
    );
  };

  const showToast = (message: string, type: ToastState['type'] = 'info') => {
    setToast({ message, type, show: true });
  };

  const handleToastClose = () => {
    setToast((prev) => ({ ...prev, show: false }));
  };

  const handleExportSuccess = () => {
    showToast('Trip data exported successfully! 🎉', 'success');
  };

  return (
    <ErrorBoundary>
      <div className="relative min-h-screen bg-gray-50">
        {/* Full Screen Map */}
        <div className="h-screen w-full">
          <MapContainer
            activityStatus={activityStatus}
            currentBaseId={state.currentBase}
            onActivitySelect={handleActivitySelect}
            onBaseSelect={handleStopSelect}
            selectedActivityId={state.selectedActivity}
            tripData={tripData}
          />
        </div>

        {/* Floating Timeline Strip */}
        <TimelineStrip currentStopId={state.currentBase} onStopSelect={handleStopSelect} stops={tripData.stops} />

        {/* Responsive Activities Panel */}
        {currentStop && state.currentBase && (
          <ActivitiesPanel
            accommodation={currentStop.accommodation}
            activities={sortedActivities}
            activityStatus={activityStatus}
            baseId={state.currentBase}
            baseLocation={currentStop.location}
            isVisible={isActivitiesPanelVisible}
            onActivitySelect={handleActivitySelect}
            onExportSuccess={handleExportSuccess}
            onHide={handleHideActivitiesPanel}
            onReorder={handleActivityReorder}
            onToggleDone={handleActivityToggle}
            scenicWaypoints={currentStop.scenic_waypoints || []}
            selectedActivityId={state.selectedActivity}
            stopName={currentStop.name}
            tripData={tripData}
          />
        )}

        {/* Toast Notifications */}
        {toast.show && <Toast message={toast.message} onClose={handleToastClose} show={toast.show} type={toast.type} />}

        {/* Offline Indicator */}
        <OfflineIndicator />
      </div>
    </ErrorBoundary>
  );
};
