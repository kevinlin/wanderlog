import { useState } from 'react';

const MINUTES_PER_HOUR = 60;

interface DurationInputProps {
  minutes: number | undefined;
  onChange: (minutes: number | undefined) => void;
}

const box =
  'w-20 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-alpine-teal focus:outline-hidden focus:ring-1 focus:ring-alpine-teal/30';

// Two boxes over one integer. Planned `duration` stays free text elsewhere;
// this only ever edits visit_duration_minutes.
export const DurationInput = ({ minutes, onChange }: DurationInputProps) => {
  // The boxes hold what was typed rather than a re-derived split. Deriving them
  // from the total would make clearing the hours box redisplay a 0, and would
  // leave no way to express "no duration" once either box had been filled.
  const [hours, setHours] = useState(minutes === undefined ? '' : String(Math.floor(minutes / MINUTES_PER_HOUR)));
  const [mins, setMins] = useState(minutes === undefined ? '' : String(minutes % MINUTES_PER_HOUR));

  const update = (nextHours: string, nextMins: string) => {
    setHours(nextHours);
    setMins(nextMins);
    const bothEmpty = nextHours === '' && nextMins === '';
    onChange(bothEmpty ? undefined : (Number(nextHours) || 0) * MINUTES_PER_HOUR + (Number(nextMins) || 0));
  };

  return (
    <div className="flex items-end gap-3">
      <div>
        <label className="mb-1 block font-medium text-gray-700 text-sm" htmlFor="visit-duration-hours">
          Hours
        </label>
        <input
          className={box}
          id="visit-duration-hours"
          min={0}
          onChange={(e) => update(e.target.value, mins)}
          type="number"
          value={hours}
        />
      </div>
      <div>
        <label className="mb-1 block font-medium text-gray-700 text-sm" htmlFor="visit-duration-minutes">
          Minutes
        </label>
        <input
          className={box}
          id="visit-duration-minutes"
          max={59}
          min={0}
          onChange={(e) => update(hours, e.target.value)}
          type="number"
          value={mins}
        />
      </div>
    </div>
  );
};
