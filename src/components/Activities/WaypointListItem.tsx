import { useState } from 'react';
import { ScenicWaypointCard } from '@/components/Cards/ScenicWaypointCard';
import { VisitDetailsModal, type VisitFormValues } from '@/components/Editing/VisitDetailsModal';
import { useVisitRecord } from '@/hooks/useVisitRecord';
import { stampIfDuringTrip } from '@/services/visitRecord';
import type { Accommodation } from '@/types';
import type { ScenicWaypoint } from '@/types/map';
import type { TripData } from '@/types/trip';

interface WaypointListItemProps {
  accommodation?: Accommodation;
  isSelected: boolean;
  onDelete?: (waypoint: ScenicWaypoint) => void;
  onDone: (waypointId: string) => void;
  onEdit?: (waypoint: ScenicWaypoint) => void;
  onSelect: (waypointId: string) => void;
  trip: TripData;
  tripId: string;
  waypoint: ScenicWaypoint;
}

// Mirrors ActivityListItem. The two cards take different props, so a shared
// wrapper would need a union neither card wants - the duplication is deliberate.
export const WaypointListItem = ({
  waypoint,
  trip,
  tripId,
  accommodation,
  isSelected,
  onSelect,
  onDone,
  onEdit,
  onDelete,
}: WaypointListItemProps) => {
  const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);
  const visitMutation = useVisitRecord(waypoint.activity_id);
  const isDone = waypoint.status?.done ?? false;

  const base = { tripId, itemId: waypoint.activity_id, isWaypoint: true };

  const handleToggle = (done: boolean) => {
    visitMutation.mutate({
      ...base,
      isDone: done,
      visitedAt: done
        ? stampIfDuringTrip({ now: new Date(), timeZone: trip.timezone, startDate: trip.start_date, endDate: trip.end_date })
        : null,
    });
    if (done) {
      onDone(waypoint.activity_id);
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
      <ScenicWaypointCard
        accommodation={accommodation}
        isDone={isDone}
        isSelected={isSelected}
        onDelete={onDelete}
        onEdit={onEdit}
        onLogVisit={isDone ? () => setIsVisitModalOpen(true) : undefined}
        onSelect={onSelect}
        onToggleDone={(_id, done) => handleToggle(done)}
        waypoint={waypoint}
      />
      {isVisitModalOpen && (
        <VisitDetailsModal
          isOpen
          item={waypoint}
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
