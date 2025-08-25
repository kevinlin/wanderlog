
import { useEffect, useState } from 'react';
import { ErrorBoundary } from '@/components/Layout/ErrorBoundary';
import { LoadingSpinner } from '@/components/Layout/LoadingSpinner';
import { ErrorMessage } from '@/components/Layout/ErrorMessage';
import { Toast, ToastState } from '@/components/Layout/Toast';
import { MapContainer } from '@/components/Map/MapContainer';
import { TimelineStrip } from '@/components/Timeline/TimelineStrip';
import { ActivitiesPanel } from '@/components/Activities/ActivitiesPanel';
import { useTripData } from '@/hooks/useTripData';
import { useAppStateContext } from '@/contexts/AppStateContext';
import { sortActivitiesByOrder } from '@/utils/tripUtils';
import { getCurrentStop } from '@/utils/dateUtils';
import { getUserModifications, saveUserModifications } from '@/services/storageService';
import { Activity } from '@/types';

function App() {
  const { tripData, isLoading, error, refetch } = useTripData();
  const { state, dispatch } = useAppStateContext();
  const [toast, setToast] = useState<ToastState>({ message: '', type: 'info', show: false });

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

  // Save user modifications to localStorage whenever they change
  useEffect(() => {
    saveUserModifications(state.userModifications);
  }, [state.userModifications]);

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

        {/* Expandable Activities Panel */}
        {currentStop && state.currentBase && (
          <ActivitiesPanel
            accommodation={currentStop.accommodation}
            activities={sortedActivities}
            stopName={currentStop.name}
            baseId={state.currentBase}
            baseLocation={currentStop.location}
            selectedActivityId={state.selectedActivity}
            activityStatus={state.userModifications.activityStatus}
            tripData={appTripData}
            userModifications={state.userModifications}
            onActivitySelect={handleActivitySelect}
            onToggleDone={handleActivityToggle}
            onReorder={handleActivityReorder}
            onExportSuccess={handleExportSuccess}
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
      </div>
    </ErrorBoundary>
  );
}

export default App;
