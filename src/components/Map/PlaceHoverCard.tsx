import { CheckCircleIcon, ClockIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolidIcon } from '@heroicons/react/24/solid';
import { BedIcon, type Icon } from '@phosphor-icons/react';
import type React from 'react';
import { getActivityMarker, WAYPOINT_MARKER } from '@/components/Map/markerCategory';
import type { ScenicWaypoint } from '@/types/map';
import type { Accommodation, Activity } from '@/types/trip';

type PlaceType = 'accommodation' | 'activity' | 'scenic_waypoint';

interface PlaceHoverCardProps {
  accommodation?: Accommodation;
  activity?: Activity;
  isDone?: boolean;
  isVisible: boolean;
  placeType: PlaceType;
  position: { x: number; y: number };
  scenicWaypoint?: ScenicWaypoint;
  stopColor?: string;
  stopName?: string;
}

export const PlaceHoverCard: React.FC<PlaceHoverCardProps> = ({
  placeType,
  accommodation,
  activity,
  scenicWaypoint,
  stopColor = 'var(--marker-other)',
  stopName,
  isDone = false,
  position,
  isVisible,
}) => {
  if (!isVisible) return null;

  // Get place details based on type
  const getName = (): string => {
    switch (placeType) {
      case 'accommodation':
        return accommodation?.name || 'Accommodation';
      case 'activity':
        return activity?.activity_name || 'Activity';
      case 'scenic_waypoint':
        return scenicWaypoint?.activity_name || 'Scenic Waypoint';
      default:
        return 'Place';
    }
  };

  const getAddress = (): string | undefined => {
    switch (placeType) {
      case 'accommodation':
        return accommodation?.address;
      case 'activity':
        return activity?.location?.address;
      case 'scenic_waypoint':
        return scenicWaypoint?.location?.address;
      default:
        return;
    }
  };

  const getThumbnailUrl = (): string | undefined | null => {
    switch (placeType) {
      case 'accommodation':
        return accommodation?.thumbnail_url;
      case 'activity':
        return activity?.thumbnail_url;
      case 'scenic_waypoint':
        return scenicWaypoint?.thumbnail_url;
      default:
        return;
    }
  };

  const getDuration = (): string | undefined => {
    switch (placeType) {
      case 'activity':
        return activity?.duration;
      case 'scenic_waypoint':
        return scenicWaypoint?.duration;
      default:
        return;
    }
  };

  // The marker's face in miniature, so the card and the pin read as the same place.
  const getChip = (): { color: string; Glyph: Icon } => {
    switch (placeType) {
      case 'accommodation':
        return { color: stopColor, Glyph: BedIcon };
      case 'activity':
        return getActivityMarker(activity?.activity_type);
      case 'scenic_waypoint':
        return WAYPOINT_MARKER;
      default:
        return getActivityMarker(undefined);
    }
  };

  const getTypeLabel = (): string => {
    switch (placeType) {
      case 'accommodation':
        return 'Accommodation';
      case 'activity':
        return activity?.activity_type ? activity.activity_type.charAt(0).toUpperCase() + activity.activity_type.slice(1) : 'Activity';
      case 'scenic_waypoint':
        return 'Scenic Waypoint';
      default:
        return 'Place';
    }
  };

  const getGlowColor = (): string => {
    switch (placeType) {
      case 'accommodation':
        return 'shadow-orange-500/30';
      case 'activity':
        return isDone ? 'shadow-emerald-500/30' : 'shadow-sky-500/30';
      case 'scenic_waypoint':
        return isDone ? 'shadow-emerald-500/30' : 'shadow-violet-500/30';
      default:
        return 'shadow-sky-500/30';
    }
  };

  const getBorderColor = (): string => {
    switch (placeType) {
      case 'accommodation':
        return 'border-orange-200';
      case 'activity':
        return isDone ? 'border-emerald-200' : 'border-sky-200';
      case 'scenic_waypoint':
        return isDone ? 'border-emerald-200' : 'border-violet-200';
      default:
        return 'border-gray-200';
    }
  };

  const name = getName();
  const address = getAddress();
  const thumbnailUrl = getThumbnailUrl();
  const duration = getDuration();
  const { color: chipColor, Glyph: ChipGlyph } = getChip();
  const typeLabel = getTypeLabel();
  const glowColor = getGlowColor();
  const borderColor = getBorderColor();

  // Position the card slightly above and to the right of the marker
  const cardStyle: React.CSSProperties = {
    position: 'fixed',
    left: `${position.x + 20}px`,
    top: `${position.y - 80}px`,
    zIndex: 1000,
    pointerEvents: 'none',
    transform: 'translateY(-50%)',
  };

  return (
    <div
      className={`w-72 rounded-xl border bg-white/95 p-3 shadow-lg backdrop-blur-xs ${borderColor} ${glowColor} fade-in slide-in-from-left-2 animate-in duration-200`}
      style={cardStyle}
    >
      <div className="flex gap-3">
        {/* Thumbnail */}
        {thumbnailUrl && (
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg">
            <img alt={name} className="h-full w-full object-cover" src={thumbnailUrl} />
          </div>
        )}

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Type badge */}
          <div className="mb-1 flex items-center gap-1">
            <span className="mk-chip" style={{ '--c': chipColor } as React.CSSProperties}>
              <ChipGlyph size={12} weight="fill" />
            </span>
            <span className="text-gray-500 text-xs">{typeLabel}</span>
            {placeType !== 'accommodation' && (
              <span className="ml-auto">
                {isDone ? (
                  <CheckCircleSolidIcon className="h-4 w-4 text-emerald-500" />
                ) : (
                  <CheckCircleIcon className="h-4 w-4 text-gray-300" />
                )}
              </span>
            )}
          </div>

          {/* Name */}
          <h4 className="mb-1 truncate font-semibold text-gray-900 text-sm">{name}</h4>

          {/* Stop name for accommodation */}
          {placeType === 'accommodation' && stopName && <p className="mb-1 truncate text-gray-600 text-xs">{stopName}</p>}

          {/* Address */}
          {address && (
            <div className="mb-1 flex items-start gap-1">
              <MapPinIcon className="mt-0.5 h-3 w-3 shrink-0 text-gray-400" />
              <p className="line-clamp-2 text-gray-500 text-xs">{address}</p>
            </div>
          )}

          {/* Duration */}
          {duration && (
            <div className="flex items-center gap-1">
              <ClockIcon className="h-3 w-3 text-gray-400" />
              <p className="text-gray-500 text-xs">{duration}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
