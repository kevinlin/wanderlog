import { useState } from 'react';
import { DurationInput } from '@/components/Editing/DurationInput';
import { ItemModalShell } from '@/components/Editing/ItemModalShell';
import { formatTripLocal } from '@/services/visitRecord';

export interface VisitFormValues {
  remarks: string | null;
  visitDurationMinutes: number | null;
  visitedAt: string | null;
}

// Structurally satisfied by both Activity and ScenicWaypoint.
interface VisitItem {
  activity_id: string;
  activity_name: string;
  remarks?: string;
  visit_duration_minutes?: number;
  visited_at?: string;
}

interface VisitDetailsModalProps {
  isOpen: boolean;
  item: VisitItem;
  onClose: () => void;
  onSave: (values: VisitFormValues) => void;
  tripEndDate?: string;
  tripStartDate?: string;
  tripTimezone: string;
}

const field =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-alpine-teal focus:outline-hidden focus:ring-1 focus:ring-alpine-teal/30';

export const VisitDetailsModal = ({ item, isOpen, onClose, onSave, tripTimezone, tripStartDate, tripEndDate }: VisitDetailsModalProps) => {
  const stored = item.visited_at ?? formatTripLocal(new Date(), tripTimezone);
  const [date, setDate] = useState(stored.slice(0, 10));
  const [time, setTime] = useState(stored.slice(11, 16));
  const [minutes, setMinutes] = useState(item.visit_duration_minutes);
  const [notes, setNotes] = useState(item.remarks ?? '');

  // Deliberately no min/max on the date input: ItemModalShell submits through a
  // native <form>, and constraint validation would block the out-of-range save
  // that Req 2.9 requires to succeed. The range is guidance, not a gate.
  const outOfRange = Boolean(date && tripStartDate && tripEndDate && (date < tripStartDate || date > tripEndDate));

  const handleSubmit = () => {
    onSave({
      visitedAt: date ? `${date} ${time || '00:00'}` : null,
      visitDurationMinutes: minutes ?? null,
      remarks: notes.trim() || null,
    });
    onClose();
  };

  return (
    <ItemModalShell isOpen={isOpen} onClose={onClose} onSubmit={handleSubmit} title={`Visit: ${item.activity_name}`}>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="mb-1 block font-medium text-gray-700 text-sm" htmlFor="visit-date">
            Date
          </label>
          <input
            aria-describedby="visit-date-help"
            className={field}
            id="visit-date"
            onChange={(e) => setDate(e.target.value)}
            type="date"
            value={date}
          />
        </div>
        <div>
          <label className="mb-1 block font-medium text-gray-700 text-sm" htmlFor="visit-time">
            Time
          </label>
          <input className={field} id="visit-time" onChange={(e) => setTime(e.target.value)} type="time" value={time} />
        </div>
      </div>
      <p className="text-gray-500 text-xs" id="visit-date-help">
        {tripStartDate && tripEndDate ? `This trip runs ${tripStartDate} to ${tripEndDate}.` : 'This trip has no stored date range.'}
      </p>
      {outOfRange && <p className="text-amber-600 text-sm">That date is outside this trip. Saving it anyway.</p>}

      <DurationInput minutes={minutes} onChange={setMinutes} />

      <div>
        <label className="mb-1 block font-medium text-gray-700 text-sm" htmlFor="visit-notes">
          Notes
        </label>
        <textarea className={field} id="visit-notes" onChange={(e) => setNotes(e.target.value)} rows={3} value={notes} />
      </div>
    </ItemModalShell>
  );
};
