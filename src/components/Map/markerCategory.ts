import {
  BalloonIcon,
  BankIcon,
  BinocularsIcon,
  CameraIcon,
  CarIcon,
  FlagIcon,
  ForkKnifeIcon,
  type Icon,
  MountainsIcon,
  PersonSimpleHikeIcon,
  ShoppingBagIcon,
  ShoppingCartIcon,
  TicketIcon,
  UmbrellaIcon,
} from '@phosphor-icons/react';
import type { ActivityType } from '@/types/trip';

export type MarkerFamily = 'food' | 'sights' | 'nature' | 'water' | 'shopping' | 'transport' | 'other';

export const MARKER_FAMILY_COLOR: Record<MarkerFamily, string> = {
  food: 'var(--marker-food)',
  sights: 'var(--marker-sights)',
  nature: 'var(--marker-nature)',
  water: 'var(--marker-water)',
  shopping: 'var(--marker-shopping)',
  transport: 'var(--marker-transport)',
  other: 'var(--marker-other)',
};

// Callers pass weight="fill"; the glyph carries the type so color is never the only cue.
export const ACTIVITY_MARKER: Record<ActivityType, { family: MarkerFamily; Glyph: Icon }> = {
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

export const getActivityMarker = (type: ActivityType | undefined): { color: string; Glyph: Icon } => {
  const { family, Glyph } = (type && ACTIVITY_MARKER[type]) || ACTIVITY_MARKER.other;
  return { color: MARKER_FAMILY_COLOR[family], Glyph };
};

export const WAYPOINT_MARKER = { color: MARKER_FAMILY_COLOR.sights, Glyph: MountainsIcon };
