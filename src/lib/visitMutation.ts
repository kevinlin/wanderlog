import type { QueryClient } from '@tanstack/react-query';
import { tripKeys } from '@/lib/queryClient';
import { writeVisitFields } from '@/services/supabaseService';
import type { ScenicWaypoint } from '@/types/map';
import type { Activity, TripData } from '@/types/trip';

export const VISIT_MUTATION_KEY = ['visit-record'] as const;

export interface VisitVariables {
  isDone?: boolean;
  isWaypoint: boolean;
  itemId: string;
  remarks?: string | null;
  tripId: string;
  visitDurationMinutes?: number | null;
  visitedAt?: string | null;
}

export interface VisitSnapshot {
  is_done: boolean;
  remarks?: string;
  visit_duration_minutes?: number;
  visited_at?: string;
}

export interface VisitContext {
  itemId: string;
  previous: VisitSnapshot | null;
}

type VisitItem = Activity | ScenicWaypoint;

const findItem = (trip: TripData, itemId: string): VisitItem | undefined => {
  for (const stop of trip.stops) {
    const match = [...stop.activities, ...(stop.scenic_waypoints ?? [])].find((item) => item.activity_id === itemId);
    if (match) {
      return match;
    }
  }
  return;
};

// undefined means "not supplied, leave alone"; null means "clear it".
const assign = <T>(current: T | undefined, next: T | null | undefined): T | undefined =>
  next === undefined ? current : (next ?? undefined);

export const snapshotVisit = (trip: TripData | undefined, itemId: string): VisitSnapshot | null => {
  const item = trip && findItem(trip, itemId);
  if (!item) {
    return null;
  }
  return {
    is_done: item.status?.done ?? false,
    visited_at: item.visited_at,
    visit_duration_minutes: item.visit_duration_minutes,
    remarks: item.remarks,
  };
};

export const applyVisitPatch = (trip: TripData, vars: VisitVariables): TripData => {
  const next = structuredClone(trip);
  const item = findItem(next, vars.itemId);
  if (!item) {
    return next;
  }
  if (vars.isDone !== undefined) {
    item.status = { done: vars.isDone };
  }
  item.visited_at = assign(item.visited_at, vars.visitedAt);
  item.visit_duration_minutes = assign(item.visit_duration_minutes, vars.visitDurationMinutes);
  item.remarks = assign(item.remarks, vars.remarks);
  return next;
};

export const revertVisitPatch = (trip: TripData, context: VisitContext): TripData => {
  if (!context.previous) {
    return trip;
  }
  const next = structuredClone(trip);
  const item = findItem(next, context.itemId);
  if (!item) {
    return next;
  }
  item.status = { done: context.previous.is_done };
  item.visited_at = context.previous.visited_at;
  item.visit_duration_minutes = context.previous.visit_duration_minutes;
  item.remarks = context.previous.remarks;
  return next;
};

// Module-scope bridge: a mutation resumed from IndexedDB runs outside React,
// so it cannot reach the toast provider. ToastProvider subscribes to this.
type VisitErrorListener = (failure: { variables: VisitVariables }) => void;
const listeners = new Set<VisitErrorListener>();

export const onVisitWriteError = (listener: VisitErrorListener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const toRow = (vars: VisitVariables) => ({
  ...(vars.isDone !== undefined && { is_done: vars.isDone }),
  ...(vars.visitedAt !== undefined && { visited_at: vars.visitedAt }),
  ...(vars.visitDurationMinutes !== undefined && { visit_duration_minutes: vars.visitDurationMinutes }),
  ...(vars.remarks !== undefined && { remarks: vars.remarks }),
});

// Every callback lives here, not in a hook closure, so the live path and the
// path resumed after a browser restart are the same code (Phase 4 Req 5.4).
export const buildVisitMutationDefaults = (queryClient: QueryClient) => ({
  mutationFn: (vars: VisitVariables) => writeVisitFields(vars.isWaypoint ? 'scenic_waypoints' : 'activities', vars.itemId, toRow(vars)),
  onMutate: async (vars: VisitVariables): Promise<VisitContext> => {
    await queryClient.cancelQueries({ queryKey: tripKeys.detail(vars.tripId) });
    const current = queryClient.getQueryData<TripData>(tripKeys.detail(vars.tripId));
    // Only the item's four prior scalars: the context is dehydrated with the
    // mutation, and a trip tree per queued write would bloat IndexedDB.
    const previous = snapshotVisit(current, vars.itemId);
    queryClient.setQueryData<TripData>(tripKeys.detail(vars.tripId), (old) => (old ? applyVisitPatch(old, vars) : old));
    return { itemId: vars.itemId, previous };
  },
  onError: (_error: Error, vars: VisitVariables, context: VisitContext | undefined) => {
    if (context) {
      queryClient.setQueryData<TripData>(tripKeys.detail(vars.tripId), (old) => (old ? revertVisitPatch(old, context) : old));
    }
    for (const listener of listeners) {
      listener({ variables: vars });
    }
  },
  onSettled: (_data: undefined, _error: Error | null, vars: VisitVariables) =>
    queryClient.invalidateQueries({ queryKey: tripKeys.detail(vars.tripId) }),
});
