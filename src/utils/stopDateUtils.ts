import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import type { TripBase } from '@/types/trip';

const DATE_FORMAT = 'yyyy-MM-dd';

// Re-anchors the stop chain at tripStartDate, preserving each stop's duration.
// Checkout day = next stop's check-in day, matching the migrated data's
// pattern. Design rule: date shifts cascade to subsequent stops client-side.
export function recalculateStopDates(stops: TripBase[], tripStartDate: string): TripBase[] {
  let cursor = parseISO(tripStartDate);
  return stops.map((stop) => {
    const nights = differenceInCalendarDays(parseISO(stop.date.to), parseISO(stop.date.from));
    const from = cursor;
    const to = addDays(from, nights);
    cursor = to;
    return {
      ...stop,
      date: { from: format(from, DATE_FORMAT), to: format(to, DATE_FORMAT) },
      duration_days: nights,
    };
  });
}
