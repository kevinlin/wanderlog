import {
  BalloonIcon,
  BankIcon,
  BinocularsIcon,
  CameraIcon,
  CarIcon,
  FlagIcon,
  ForkKnifeIcon,
  MountainsIcon,
  PersonSimpleHikeIcon,
  ShoppingBagIcon,
  ShoppingCartIcon,
  TicketIcon,
  UmbrellaIcon,
} from '@phosphor-icons/react';
import { describe, expect, it } from 'vitest';
import { ActivityType } from '@/types/trip';
import { ACTIVITY_MARKER, getActivityMarker, MARKER_FAMILY_COLOR, type MarkerFamily, WAYPOINT_MARKER } from '../markerCategory';

const EXPECTED: Record<ActivityType, { family: MarkerFamily; Glyph: unknown }> = {
  restaurant: { family: 'food', Glyph: ForkKnifeIcon },
  attraction: { family: 'sights', Glyph: CameraIcon },
  cultural: { family: 'sights', Glyph: BankIcon },
  recreation: { family: 'sights', Glyph: TicketIcon },
  playground: { family: 'sights', Glyph: BalloonIcon },
  outdoor: { family: 'nature', Glyph: PersonSimpleHikeIcon },
  scenic: { family: 'nature', Glyph: BinocularsIcon },
  beach: { family: 'water', Glyph: UmbrellaIcon },
  shopping: { family: 'shopping', Glyph: ShoppingBagIcon },
  grocery: { family: 'shopping', Glyph: ShoppingCartIcon },
  transport: { family: 'transport', Glyph: CarIcon },
  other: { family: 'other', Glyph: FlagIcon },
};

describe('ACTIVITY_MARKER', () => {
  it('has an entry for every activity type', () => {
    for (const type of Object.values(ActivityType)) {
      expect(ACTIVITY_MARKER[type], type).toBeDefined();
      expect(ACTIVITY_MARKER[type].Glyph, type).toBeDefined();
    }
  });

  it.each(Object.entries(EXPECTED))('puts %s in its family with its glyph', (type, expected) => {
    const entry = ACTIVITY_MARKER[type as ActivityType];

    expect(entry.family).toBe(expected.family);
    expect(entry.Glyph).toBe(expected.Glyph);
  });
});

describe('getActivityMarker', () => {
  it('returns the family color and glyph for a known type', () => {
    expect(getActivityMarker('restaurant')).toEqual({ color: 'var(--marker-food)', Glyph: ForkKnifeIcon });
    expect(getActivityMarker('beach').color).toBe(MARKER_FAMILY_COLOR.water);
  });

  it('falls back to other for an undefined or unknown type', () => {
    const other = getActivityMarker('other');

    expect(getActivityMarker(undefined)).toEqual(other);
    expect(getActivityMarker('spaceport' as ActivityType)).toEqual(other);
    expect(other.color).toBe('var(--marker-other)');
    expect(other.Glyph).toBe(FlagIcon);
  });
});

describe('MARKER_FAMILY_COLOR', () => {
  it('names a --marker-* token per family', () => {
    for (const [family, color] of Object.entries(MARKER_FAMILY_COLOR)) {
      expect(color).toBe(`var(--marker-${family})`);
    }
  });

  it('never borrows a functional color name', () => {
    for (const color of Object.values(MARKER_FAMILY_COLOR)) {
      expect(color).not.toMatch(/sky|emerald|orange|red|amber/);
    }
  });
});

describe('WAYPOINT_MARKER', () => {
  it('uses the sights color and the mountains glyph', () => {
    expect(WAYPOINT_MARKER).toEqual({ color: MARKER_FAMILY_COLOR.sights, Glyph: MountainsIcon });
  });
});
