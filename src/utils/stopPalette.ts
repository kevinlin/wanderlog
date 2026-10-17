export interface StopColor {
  base: string;
  // Tailwind 4 emits --color-*-700 because the timeline's bg-*-700 utilities use it, so the map
  // reads the identical color; a hex copy would drift from Tailwind's OKLCH values.
  color: string;
  ring: string;
  selected: string;
  text: string;
}

// Class strings stay literal so Tailwind's scanner finds them.
export const STOP_PALETTE: StopColor[] = [
  { base: 'bg-blue-700', text: 'text-white', selected: 'bg-blue-800', ring: 'ring-blue-500', color: 'var(--color-blue-700)' },
  { base: 'bg-emerald-700', text: 'text-white', selected: 'bg-emerald-800', ring: 'ring-emerald-500', color: 'var(--color-emerald-700)' },
  { base: 'bg-violet-700', text: 'text-white', selected: 'bg-violet-800', ring: 'ring-violet-500', color: 'var(--color-violet-700)' },
  { base: 'bg-orange-700', text: 'text-white', selected: 'bg-orange-800', ring: 'ring-orange-500', color: 'var(--color-orange-700)' },
  { base: 'bg-rose-700', text: 'text-white', selected: 'bg-rose-800', ring: 'ring-rose-500', color: 'var(--color-rose-700)' },
  { base: 'bg-cyan-700', text: 'text-white', selected: 'bg-cyan-800', ring: 'ring-cyan-500', color: 'var(--color-cyan-700)' },
  { base: 'bg-amber-700', text: 'text-white', selected: 'bg-amber-800', ring: 'ring-amber-500', color: 'var(--color-amber-700)' },
  { base: 'bg-pink-700', text: 'text-white', selected: 'bg-pink-800', ring: 'ring-pink-500', color: 'var(--color-pink-700)' },
  { base: 'bg-indigo-700', text: 'text-white', selected: 'bg-indigo-800', ring: 'ring-indigo-500', color: 'var(--color-indigo-700)' },
  { base: 'bg-teal-700', text: 'text-white', selected: 'bg-teal-800', ring: 'ring-teal-500', color: 'var(--color-teal-700)' },
  { base: 'bg-lime-700', text: 'text-white', selected: 'bg-lime-800', ring: 'ring-lime-500', color: 'var(--color-lime-700)' },
  { base: 'bg-fuchsia-700', text: 'text-white', selected: 'bg-fuchsia-800', ring: 'ring-fuchsia-500', color: 'var(--color-fuchsia-700)' },
];

export const getStopColor = (index: number): StopColor => STOP_PALETTE[index % STOP_PALETTE.length];

export const getStopInitials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
