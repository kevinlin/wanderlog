import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ActivitiesPanel } from '@/components/Activities/ActivitiesPanel';
import { AgentButton } from '@/components/Agent';
import { UserMenu } from '@/components/Auth/UserMenu';
import { StopsEditor } from '@/components/Editing/StopsEditor';
import { TripMetadataFormModal } from '@/components/Editing/TripMetadataFormModal';
import { ErrorBoundary } from '@/components/Layout/ErrorBoundary';
import { ErrorMessage } from '@/components/Layout/ErrorMessage';
import { LoadingSpinner } from '@/components/Layout/LoadingSpinner';
import { OfflineIndicator } from '@/components/Layout/OfflineIndicator';
import { SyncIndicator } from '@/components/Layout/SyncIndicator';
import { Toast, type ToastState } from '@/components/Layout/Toast';
import { MapContainer } from '@/components/Map/MapContainer';
import { TimelineStrip } from '@/components/Timeline/TimelineStrip';
import { useAppStateContext } from '@/contexts/AppStateContext';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useScreenSize } from '@/hooks/useScreenSize';
import { useTripData } from '@/hooks/useTripData';
import { useReorderActivities, useToggleActivityDone } from '@/hooks/useTripMutations';
import { useTrips } from '@/hooks/useTrips';
import { getLastViewedBase, setCurrentTripId, setLastViewedBase } from '@/services/viewStateStorage';
import { celebrateStopComplete, celebrateTripComplete } from '@/utils/celebrate';
import { getCurrentStop } from '@/utils/dateUtils';
import { runStopTransition } from '@/utils/stopTransition';
import { sortActivitiesByOrder } from '@/utils/tripUtils';

export const TripPage = () => {
  const { tripId: tripIdParam } = useParams<{ tripId: string }>();
  const tripId = tripIdParam ?? '';
  const { tripData, isLoading, error, refetch } = useTripData({ tripId });
  const { trips } = useTrips();
  const { state, dispatch } = useAppStateContext();
  const { isMobile } = useScreenSize();
  const isOnline = useOnlineStatus();
  const toggleDoneMutation = useToggleActivityDone(tripId);
  const reorderMutation = useReorderActivities(tripId);
  const [toast, setToast] = useState<ToastState>({ message: '', type: 'info', show: false });
  const [isActivitiesPanelVisible, setIsActivitiesPanelVisible] = useState(false);
  const [isEditTripModalOpen, setIsEditTripModalOpen] = useState(false);
  const [isStopsEditorOpen, setIsStopsEditorOpen] = useState(false);

  // TripData doesn't carry description/dates at the top level; the library
  // summary does, and the trips query is cached from the library visit.
  const tripSummary = trips?.find((trip) => trip.trip_id === tripId);

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

  // Per-stop done/total so the timeline can visibly fill in as items are checked off
  const stopProgress = useMemo(() => {
    const map: Record<string, { done: number; total: number }> = {};
    for (const stop of tripData?.stops ?? []) {
      const items = [...stop.activities, ...(stop.scenic_waypoints ?? [])];
      const done = items.filter((item) => activityStatus[item.activity_id]).length;
      map[stop.stop_id] = { done, total: items.length };
    }
    return map;
  }, [tripData, activityStatus]);

  if (isLoading) {
    return <LoadingSpinner fullScreen message="Loading your adventure..." size="lg" variant="adventure" />;
  }

  if (error) {
    return <ErrorMessage details={error} fullScreen message={error} onRetry={refetch} title="Adventure Data Unavailable" type="data" />;
  }

  // fetchTripById resolved null: the remembered trip was deleted or never existed
  if (!tripData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-sandy-beige to-white p-4">
        <div className="max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center shadow-xs">
          <h1 className="font-bold text-gray-900 text-xl">This trip no longer exists</h1>
          <p className="mt-2 text-gray-600 text-sm">It may have been deleted. Head back to the library to pick another one.</p>
          <Link
            className="mt-6 inline-block rounded-xl bg-alpine-teal px-4 py-2 font-medium text-white transition-colors hover:bg-alpine-teal/90"
            to="/trips"
          >
            Back to trips
          </Link>
        </div>
      </div>
    );
  }

  // A newly created trip has no stops; the regular UI assumes stops[0] exists
  if (tripData.stops.length === 0) {
    return (
      <ErrorBoundary>
        <div className="relative min-h-screen bg-gray-50">
          <div className="h-screen w-full">
            <MapContainer
              activityStatus={{}}
              currentBaseId={null}
              onActivitySelect={() => undefined}
              onBaseSelect={() => undefined}
              selectedActivityId={null}
              tripData={tripData}
            />
          </div>
          <UserMenu />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
            <div className="pointer-events-auto max-w-md rounded-xl border border-gray-200 bg-white/95 p-8 text-center shadow-lg backdrop-blur-xs">
              <h1 className="font-bold text-gray-900 text-xl">{tripData.trip_name}</h1>
              <p className="mt-2 text-gray-600 text-sm">No stops yet. Add your first stop to start the itinerary.</p>
              <div className="mt-6 flex justify-center gap-3">
                <Link
                  className="inline-block rounded-xl border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50"
                  to="/trips"
                >
                  Back to trips
                </Link>
                {isOnline && (
                  <button
                    className="rounded-xl bg-alpine-teal px-4 py-2 font-medium text-white transition-colors hover:bg-alpine-teal/90"
                    onClick={() => setIsStopsEditorOpen(true)}
                    type="button"
                  >
                    Add stops
                  </button>
                )}
              </div>
            </div>
          </div>
          {isStopsEditorOpen && <StopsEditor onClose={() => setIsStopsEditorOpen(false)} tripData={tripData} />}
        </div>
      </ErrorBoundary>
    );
  }

  const currentStop = tripData.stops.find((stop) => stop.stop_id === state.currentBase);

  // The mapper writes `order` onto each activity, so no custom order map is needed
  const sortedActivities = currentStop ? sortActivitiesByOrder(currentStop.activities) : [];

  // Write failures surface through the shared mutation helper's retry toast
  const handleActivityToggle = (activityId: string, done: boolean) => {
    const stop = tripData.stops.find(
      (s) => s.activities.some((a) => a.activity_id === activityId) || (s.scenic_waypoints ?? []).some((w) => w.activity_id === activityId)
    );
    const isWaypoint = !!stop && (stop.scenic_waypoints ?? []).some((w) => w.activity_id === activityId);

    toggleDoneMutation.mutate({ activityId, isDone: done, isWaypoint });

    // Celebrate only the moment a stop crosses into fully-done on a check (never an uncheck).
    // activityStatus is the pre-toggle snapshot, so override the item we just checked.
    if (!(done && stop)) return;
    const isDoneAfter = (id: string) => (id === activityId ? true : activityStatus[id]);
    const stopItems = [...stop.activities, ...(stop.scenic_waypoints ?? [])];
    const stopComplete = stopItems.length > 0 && stopItems.every((item) => isDoneAfter(item.activity_id));
    if (!stopComplete) return;

    const tripComplete = tripData.stops.every((s) => {
      const items = [...s.activities, ...(s.scenic_waypoints ?? [])];
      return items.length === 0 || items.every((item) => isDoneAfter(item.activity_id));
    });

    if (tripComplete) {
      celebrateTripComplete();
      showToast('Every last stop, done. What a trip. 🌍', 'success');
    } else {
      celebrateStopComplete();
      showToast(`That's all of ${stop.name} ticked off. Onward! 🎉`, 'success');
    }
  };

  const handleActivitySelect = (activityId: string) => {
    const newSelection = state.selectedActivity === activityId ? null : activityId;
    dispatch({ type: 'SELECT_ACTIVITY', payload: newSelection });
  };

  const handleStopSelect = (stopId: string) => {
    setLastViewedBase(tripId, stopId);

    // Re-selecting the current stop only needs the panel back, no page-turn
    if (stopId === state.currentBase) {
      setIsActivitiesPanelVisible(true);
      return;
    }

    const fromIndex = tripData.stops.findIndex((stop) => stop.stop_id === state.currentBase);
    const toIndex = tripData.stops.findIndex((stop) => stop.stop_id === stopId);
    const direction = fromIndex !== -1 && toIndex < fromIndex ? 'backward' : 'forward';

    runStopTransition(direction, () => {
      dispatch({ type: 'SELECT_BASE', payload: stopId });
      // Auto-show activities panel on mobile when stop is selected
      setIsActivitiesPanelVisible(true);
    });
  };

  const handleHideActivitiesPanel = () => {
    setIsActivitiesPanelVisible(false);
  };

  const handleActivityReorder = (fromIndex: number, toIndex: number) => {
    if (!state.currentBase || fromIndex === toIndex) {
      return;
    }
    const previousIds = sortedActivities.map((activity) => activity.activity_id);
    const orderedIds = [...previousIds];
    const [moved] = orderedIds.splice(fromIndex, 1);
    orderedIds.splice(toIndex, 0, moved);
    const stopId = state.currentBase;
    reorderMutation.mutate({ stopId, orderedActivityIds: orderedIds });
    setToast({
      message: 'Activities reordered',
      type: 'info',
      show: true,
      action: {
        label: 'Undo',
        onClick: () => reorderMutation.mutate({ stopId, orderedActivityIds: previousIds }),
      },
    });
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
        <TimelineStrip
          currentStopId={state.currentBase}
          onStopSelect={handleStopSelect}
          stopProgress={stopProgress}
          stops={tripData.stops}
        />

        {/* Floating User Menu - pinned to the top-right corner */}
        <UserMenu
          onEditStops={isOnline ? () => setIsStopsEditorOpen(true) : undefined}
          onEditTrip={isOnline && tripSummary ? () => setIsEditTripModalOpen(true) : undefined}
        />

        {/* Floating agent button - sits left of the user menu, also corner-pinned.
            Named so it keeps floating above the timeline snapshot during the stop page-turn. */}
        <div className="fixed top-2 right-14 z-30 sm:top-4" style={{ viewTransitionName: 'agent-button' }}>
          <AgentButton tripId={tripId} />
        </div>

        {isEditTripModalOpen && tripSummary && (
          <TripMetadataFormModal isOpen onClose={() => setIsEditTripModalOpen(false)} trip={tripSummary} />
        )}

        {isStopsEditorOpen && <StopsEditor onClose={() => setIsStopsEditorOpen(false)} tripData={tripData} />}

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
        {toast.show && (
          <Toast action={toast.action} message={toast.message} onClose={handleToastClose} show={toast.show} type={toast.type} />
        )}

        {/* Offline Indicator */}
        <OfflineIndicator />

        {/* Sync status for shared-plan trust */}
        <SyncIndicator />
      </div>
    </ErrorBoundary>
  );
};
