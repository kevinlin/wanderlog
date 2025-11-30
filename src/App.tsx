
import { useEffect, useState } from 'react';
import { ErrorBoundary } from '@/components/Layout/ErrorBoundary';
import { LoadingSpinner } from '@/components/Layout/LoadingSpinner';
import { ErrorMessage } from '@/components/Layout/ErrorMessage';
import { Toast, ToastState } from '@/components/Layout/Toast';
import { OfflineIndicator } from '@/components/Layout/OfflineIndicator';
import { MapContainer } from '@/components/Map/MapContainer';
import { TimelineStrip } from '@/components/Timeline/TimelineStrip';
import { ActivitiesPanel } from '@/components/Activities/ActivitiesPanel';
import { useTripData } from '@/hooks/useTripData';
import { useScreenSize } from '@/hooks/useScreenSize';
import { useAppStateContext } from '@/contexts/AppStateContext';
import { sortActivitiesByOrder } from '@/utils/tripUtils';
import { getCurrentStop } from '@/utils/dateUtils';
import { saveUserModifications } from '@/services/storageService';
import { initializeFirebase } from '@/config/firebase';
import { Activity } from '@/types';

function App() {
  const { tripData, isLoading, error, refetch } = useTripData({ tripId: '202512_NZ' });
  const { state, dispatch } = useAppStateContext();
  const { isMobile } = useScreenSize();
  const [toast, setToast] = useState<ToastState>({ message: '', type: 'info', show: false });
  const [isActivitiesPanelVisible, setIsActivitiesPanelVisible] = useState(false);

  // Set initial panel visibility based on screen size
  useEffect(() => {
    setIsActivitiesPanelVisible(!isMobile);
  }, [isMobile]);

  // Initialize Firebase on app mount
  useEffect(() => {
    initializeFirebase();
  }, []);

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

  // Save user modifications whenever they change (async with Firebase + localStorage)
  useEffect(() => {
    // Only save if we have a current trip ID
    if (state.currentTripId) {
      saveUserModifications(state.currentTripId, state.userModifications)
        .catch(err => {
          console.error('Failed to save user modifications:', err);
          // Don't show error to user - modifications are still saved to localStorage
        });
    }
  }, [state.currentTripId, state.userModifications]);

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
    // Auto-show activities panel on mobile when stop is selected
    setIsActivitiesPanelVisible(true);
  };

  const handleHideActivitiesPanel = () => {
    setIsActivitiesPanelVisible(false);
  };

  const handleActivityReorder = (fromIndex: number, toIndex: number) => {
    if (!state.currentBase) return;
    dispatch({ 
      type: 'REORDER_ACTIVITIES', 
      payload: { 
        baseId: state.currentBase, 
        fromIndex, 
        toIndex 
      } 
    });
  };

  const showToast = (message: string, type: ToastState['type'] = 'info') => {
    setToast({ message, type, show: true });
  };

  const handleToastClose = () => {
    setToast(prev => ({ ...prev, show: false }));
  };

  const handleExportSuccess = () => {
    showToast('Trip data exported successfully! 🎉', 'success');
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 relative">
        {/* Full Screen Map */}
        <div className="h-screen w-full">
          <MapContainer
            tripData={appTripData}
            currentBaseId={state.currentBase}
            selectedActivityId={state.selectedActivity}
            activityStatus={state.userModifications.activityStatus}
            onActivitySelect={handleActivitySelect}
            onBaseSelect={handleStopSelect}
          />
        </div>

        {/* Floating Timeline Strip */}
        <TimelineStrip
          stops={appTripData.stops}
          currentStopId={state.currentBase}
          onStopSelect={handleStopSelect}
        />

        {/* Responsive Activities Panel */}
        {currentStop && state.currentBase && (
          <ActivitiesPanel
            accommodation={currentStop.accommodation}
            activities={sortedActivities}
            scenicWaypoints={currentStop.scenic_waypoints || []}
            stopName={currentStop.name}
            baseId={state.currentBase}
            baseLocation={currentStop.location}
            selectedActivityId={state.selectedActivity}
            activityStatus={state.userModifications.activityStatus}
            tripData={appTripData}
            userModifications={state.userModifications}
            isVisible={isActivitiesPanelVisible}
            onActivitySelect={handleActivitySelect}
            onToggleDone={handleActivityToggle}
            onReorder={handleActivityReorder}
            onExportSuccess={handleExportSuccess}
            onHide={handleHideActivitiesPanel}
          />
        )}

        {/* Toast Notifications */}
        {toast.show && (
          <Toast
            message={toast.message}
            type={toast.type}
            show={toast.show}
            onClose={handleToastClose}
          />
        )}

        {/* Offline Indicator */}
        <OfflineIndicator />
      </div>
    </ErrorBoundary>
  );
}

export default App;
