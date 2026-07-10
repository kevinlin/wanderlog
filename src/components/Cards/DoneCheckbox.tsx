import type React from 'react';
import { useState } from 'react';

type Accent = 'emerald' | 'violet';

interface DoneCheckboxProps {
  accent?: Accent;
  ariaLabel: string;
  checked: boolean;
  onToggle: (done: boolean) => void;
}

// Explicit maps so Tailwind keeps the classes (no dynamic `bg-${accent}` purge risk).
const ACCENT: Record<Accent, { fill: string; ring: string }> = {
  emerald: { fill: 'border-emerald-500 bg-emerald-500', ring: 'peer-focus-visible:ring-emerald-500/40' },
  violet: { fill: 'border-violet-500 bg-violet-500', ring: 'peer-focus-visible:ring-violet-500/40' },
};

/**
 * The core "check it off" moment. A real checkbox (keyboard + screen-reader
 * intact) wrapped so the box springs and the tick draws in on toggle-on.
 * The pop is JS-gated so items that are already done don't all pop on mount.
 */
export const DoneCheckbox: React.FC<DoneCheckboxProps> = ({ checked, onToggle, accent = 'emerald', ariaLabel }) => {
  const [pop, setPop] = useState(false);
  const colors = ACCENT[accent];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const next = e.target.checked;
    if (next) {
      setPop(true);
    }
    onToggle(next);
  };

  return (
    <label
      className="relative flex cursor-pointer touch-manipulation items-center justify-center p-0.5"
      onClick={(e) => e.stopPropagation()}
    >
      <input aria-label={ariaLabel} checked={checked} className="peer sr-only" onChange={handleChange} type="checkbox" />
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-md border-2 transition-colors duration-150 ${
          checked ? colors.fill : 'border-gray-300 bg-white'
        } ${colors.ring} peer-focus-visible:ring-2 peer-focus-visible:ring-offset-1 ${pop ? 'animate-check-pop' : ''}`}
        onAnimationEnd={() => setPop(false)}
      >
        <svg
          aria-hidden="true"
          className={`h-3.5 w-3.5 text-white transition-opacity duration-150 ${checked ? 'opacity-100' : 'opacity-0'} ${
            pop ? 'animate-check-draw' : ''
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          viewBox="0 0 24 24"
        >
          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </label>
  );
};
