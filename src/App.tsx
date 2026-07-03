import { useEffect, useMemo, useState } from 'react';
import { ActivitiesPanel } from '@/components/Activities/ActivitiesPanel';
import { LoginForm } from '@/components/Auth/LoginForm';
import { ErrorBoundary } from '@/components/Layout/ErrorBoundary';
import { ErrorMessage } from '@/components/Layout/ErrorMessage';
import { LoadingSpinner } from '@/components/Layout/LoadingSpinner';
import { OfflineIndicator } from '@/components/Layout/OfflineIndicator';
import { Toast, type ToastState } from '@/components/Layout/Toast';
import { MapContainer } from '@/components/Map/MapContainer';
import { TimelineStrip } from '@/components/Timeline/TimelineStrip';
import { useAppStateContext } from '@/contexts/AppStateContext';
import { useAuth } from '@/contexts/AuthContext';
import { useScreenSize } from '@/hooks/useScreenSize';
import { useTripData } from '@/hooks/useTripData';
import { getLastViewedBase, setLastViewedBase } from '@/services/viewStateStorage';
import type { UserModifications } from '@/types';
import { getCurrentStop } from '@/utils/dateUtils';
import { sortActivitiesByOrder } from '@/utils/tripUtils';

const CURRENT_TRIP_ID = '202512_NZ';

// Export merges nothing extra anymore: status/order are canonical in trip data
const EMPTY_MODIFICATIONS: UserModifications = { activityStatus: {}, activityOrders: {} };

function App() {
  const { session, isLoading: isAuthLoading } = useAuth();
  const { tripData, isLoading, error, refetch } = useTripData({ tripId: CURRENT_TRIP_ID });
  const { state, dispatch } = useAppStateContext();
  const { isMobile } = useScreenSize();
  const [toast, setToast] = useState<ToastState>({ message: '', type: 'info', show: false });
  const [isActivitiesPanelVisible, setIsActivitiesPanelVisible] = useState(false);

  // Set initial panel visibility based on screen size
  useEffect(() => {
    setIsActivitiesPanelVisible(!isMobile);
  }, [isMobile]);

  // Track the current trip in UI state
  useEffect(() => {
    dispatch({ type: 'SET_CURRENT_TRIP_ID', payload: CURRENT_TRIP_ID });
  }, [dispatch]);

  // Initialize current base when trip data is available
  useEffect(() => {
    if (tripData && !state.currentBase) {
      const currentStop = getCurrentStop(tripData.stops);
      const lastViewedBase = getLastViewedBase(CURRENT_TRIP_ID);
      const initialBase =
        lastViewedBase && tripData.stops.find((s) => s.stop_id === lastViewedBase)
          ? lastViewedBase
          : currentStop?.stop_id || tripData.stops[0]?.stop_id;

      if (initialBase) {
        dispatch({ type: 'SELECT_BASE', payload: initialBase });
      }
    }
  }, [tripData, state.currentBase, dispatch]);

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

  if (isAuthLoading) {
    return <LoadingSpinner fullScreen message="Loading your adventure..." size="lg" variant="adventure" />;
  }

  if (!session) {
    return <LoginForm />;
  }

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

  const handleActivityToggle = (_activityId: string, _done: boolean) => {
    // Wired to the Supabase mutation in the next task
  };

  const handleActivitySelect = (activityId: string) => {
    const newSelection = state.selectedActivity === activityId ? null : activityId;
    dispatch({ type: 'SELECT_ACTIVITY', payload: newSelection });
  };

  const handleStopSelect = (stopId: string) => {
    dispatch({ type: 'SELECT_BASE', payload: stopId });
    setLastViewedBase(CURRENT_TRIP_ID, stopId);
    // Auto-show activities panel on mobile when stop is selected
    setIsActivitiesPanelVisible(true);
  };

  const handleHideActivitiesPanel = () => {
    setIsActivitiesPanelVisible(false);
  };

  const handleActivityReorder = (_fromIndex: number, _toIndex: number) => {
    // Wired to the Supabase mutation in the next task
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
            userModifications={EMPTY_MODIFICATIONS}
          />
        )}

        {/* Toast Notifications */}
        {toast.show && <Toast message={toast.message} onClose={handleToastClose} show={toast.show} type={toast.type} />}

        {/* Offline Indicator */}
        <OfflineIndicator />
      </div>
    </ErrorBoundary>
  );
}

export default App;
