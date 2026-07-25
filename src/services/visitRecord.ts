// Pure module shared by the browser toggle and the api/ agent tools (Vercel
// Node ESM): no supabase-js, no @/ imports, no browser globals. It owns the
// wall-clock policy so a check-off made in the UI and one made by the agent
// produce the same value.

export interface StampInput {
  endDate?: string;
  now: Date;
  startDate?: string;
  timeZone?: string;
}

// Locale, calendar, numbering and hour cycle are all pinned: passing only
// timeZone leaves the output at the mercy of the runtime locale, which can
// yield non-Latin digits or render midnight as 24:05.
const formatterFor = (timeZone: string): Intl.DateTimeFormat =>
  new Intl.DateTimeFormat('en-US', {
    timeZone,
    calendar: 'gregory',
    numberingSystem: 'latn',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

export const formatTripLocal = (now: Date, timeZone: string): string => {
  const parts = new Map(
    formatterFor(timeZone)
      .formatToParts(now)
      .map((part) => [part.type, part.value])
  );
  return `${parts.get('year')}-${parts.get('month')}-${parts.get('day')} ${parts.get('hour')}:${parts.get('minute')}`;
};

export const stampIfDuringTrip = ({ now, timeZone, startDate, endDate }: StampInput): string | null => {
  if (!(timeZone && startDate && endDate)) {
    return null;
  }
  const stamp = formatTripLocal(now, timeZone);
  const date = stamp.slice(0, 10);
  return date >= startDate && date <= endDate ? stamp : null;
};

const SHAPE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;

export const isValidTripLocal = (value: string): boolean => {
  if (!SHAPE.test(value)) {
    return false;
  }
  // Round-trip through UTC to reject impossible calendar values: Date would
  // otherwise silently roll 2026-02-30 forward to 2026-03-02.
  const [date, time] = value.split(' ');
  const parsed = new Date(`${date}T${time}:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(`${date}T${time}`);
};
