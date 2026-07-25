import { useState } from 'react';
import { ActivityCard } from '@/components/Cards/ActivityCard';
import { VisitDetailsModal, type VisitFormValues } from '@/components/Editing/VisitDetailsModal';
import { useVisitRecord } from '@/hooks/useVisitRecord';
import { stampIfDuringTrip } from '@/services/visitRecord';
import type { Accommodation, Activity } from '@/types';
import type { TripData } from '@/types/trip';

interface ActivityListItemProps {
  accommodation?: Accommodation;
  activity: Activity;
  isDraggable: boolean;
  isSelected: boolean;
  onDelete?: (activity: Activity) => void;
  onDone: (activityId: string) => void;
  onEdit?: (activity: Activity) => void;
  onSelect: (activityId: string) => void;
  trip: TripData;
  tripId: string;
}

export const ActivityListItem = ({
  activity,
  trip,
  tripId,
  accommodation,
  isDraggable,
  isSelected,
  onSelect,
  onDone,
  onEdit,
  onDelete,
}: ActivityListItemProps) => {
  const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);
  const visitMutation = useVisitRecord(activity.activity_id);
  const isDone = activity.status?.done ?? false;

  // tripId is passed in rather than read off trip.trip_id: that field is
  // optional on TripData, and an empty one would target the wrong query key.
  const base = { tripId, itemId: activity.activity_id, isWaypoint: false };

  const handleToggle = (done: boolean) => {
    visitMutation.mutate({
      ...base,
      isDone: done,
      // Unticking clears the stamp; ticking outside the trip window records no
      // time, since the tick is then a catch-up rather than the moment itself.
      visitedAt: done
        ? stampIfDuringTrip({ now: new Date(), timeZone: trip.timezone, startDate: trip.start_date, endDate: trip.end_date })
        : null,
    });
    if (done) {
      onDone(activity.activity_id);
    }
  };

  const handleSave = (values: VisitFormValues) => {
    visitMutation.mutate({
      ...base,
      visitedAt: values.visitedAt,
      visitDurationMinutes: values.visitDurationMinutes,
      remarks: values.remarks,
    });
  };

  return (
    <>
      <ActivityCard
        accommodation={accommodation}
        activity={activity}
        isDone={isDone}
        isDraggable={isDraggable}
        isSelected={isSelected}
        onDelete={onDelete}
        onEdit={onEdit}
        // Offered only on done items, which is what keeps a visit record from
        // ever existing on an unticked one. Deliberately not gated on
        // useOnlineStatus: this is the one editor that must work offline.
        onLogVisit={isDone ? () => setIsVisitModalOpen(true) : undefined}
        onSelect={onSelect}
        onToggleDone={(_id, done) => handleToggle(done)}
      />
      {isVisitModalOpen && (
        <VisitDetailsModal
          isOpen
          item={activity}
          onClose={() => setIsVisitModalOpen(false)}
          onSave={handleSave}
          tripEndDate={trip.end_date}
          tripStartDate={trip.start_date}
          tripTimezone={trip.timezone}
        />
      )}
    </>
  );
};
