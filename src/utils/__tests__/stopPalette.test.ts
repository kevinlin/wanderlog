import { describe, expect, it } from 'vitest';
import { getStopColor, getStopInitials, STOP_PALETTE } from '../stopPalette';

describe('getStopInitials', () => {
  it.each([
    ['Lake Tekapo', 'LT'],
    ['Queenstown', 'Q'],
    ['Mount Cook Village', 'MC'],
    ['Te  Anau', 'TA'],
    ['\tTe Anau', 'TA'],
    ['  Te Anau  ', 'TA'],
    ['lake tekapo', 'LT'],
    ['', ''],
  ])('turns %j into %j', (name, initials) => {
    expect(getStopInitials(name)).toBe(initials);
  });
});

describe('getStopColor', () => {
  it('wraps past the end of the palette', () => {
    expect(STOP_PALETTE).toHaveLength(12);
    expect(getStopColor(12)).toBe(getStopColor(0));
    expect(getStopColor(13)).toBe(getStopColor(1));
  });
});

describe('STOP_PALETTE', () => {
  const entries = STOP_PALETTE.map((entry) => [entry.base, entry] as const);

  it.each(entries)('%s keeps its Tailwind classes and exposes the matching map variable', (base, entry) => {
    const hue = base.match(/^bg-([a-z]+)-700$/)?.[1];

    expect(hue).toBeDefined();
    expect(entry.color).toMatch(/^var\(--color-[a-z]+-700\)$/);
    expect(entry.color).toBe(`var(--color-${hue}-700)`);
    expect(entry.text).toBe('text-white');
    expect(entry.selected).toBe(`bg-${hue}-800`);
    expect(entry.ring).toBe(`ring-${hue}-500`);
  });

  it('gives every stop a distinct hue', () => {
    expect(new Set(STOP_PALETTE.map((entry) => entry.color)).size).toBe(STOP_PALETTE.length);
  });
});
