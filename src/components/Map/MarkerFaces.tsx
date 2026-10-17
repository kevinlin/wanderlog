import { BedIcon, CheckFatIcon, type Icon, MountainsIcon } from '@phosphor-icons/react';
import type React from 'react';
import { useState } from 'react';
import { WAYPOINT_MARKER } from '@/components/Map/markerCategory';

const PIN_PATH = 'M15 35L10.9 27.4A13 13 0 1 1 19.1 27.4Z';
const STOP_PATH = 'M12 2H24A10 10 0 0 1 34 12V24A10 10 0 0 1 24 34H22L18 40L14 34H12A10 10 0 0 1 2 24V12A10 10 0 0 1 12 2Z';

const cx = (...names: (string | false | undefined)[]): string => names.filter(Boolean).join(' ');

type FaceStyle = React.CSSProperties & { '--c'?: string; '--enter-index'?: number };

// The badge unmounts while not done, so a fresh tick mounts it fresh and the animation replays.
// Deriving the flag while rendering (rather than in an effect) means the badge never paints
// first without its animation class.
const useDoneAnimation = (isDone: boolean): boolean => {
  const [wasDone, setWasDone] = useState(isDone);
  const [animate, setAnimate] = useState(false);
  if (isDone !== wasDone) {
    setWasDone(isDone);
    setAnimate(isDone);
  }
  return isDone && animate;
};

const DoneBadge: React.FC<{ isDone: boolean }> = ({ isDone }) => {
  const animate = useDoneAnimation(isDone);
  if (!isDone) return null;
  return (
    <>
      <span className={cx('mk-check', animate && 'animate-check-pop')}>
        <CheckFatIcon size={8} weight="bold" />
      </span>
      {animate && <span className="mk-ripple" />}
    </>
  );
};

interface StopFaceProps {
  color: string;
  initials: string;
  isLanding: boolean;
  isViewing: boolean;
  name: string;
  showLabel: boolean;
  status: 'past' | 'current' | 'upcoming';
}

const STOP_STATUS_CLASS = { past: 'is-past', current: 'is-today', upcoming: 'is-upcoming' } as const;

export const StopFace: React.FC<StopFaceProps> = ({ initials, color, status, isViewing, showLabel, name, isLanding }) => (
  <div
    className={cx('mk mk-stop', STOP_STATUS_CLASS[status], isViewing && 'is-viewing', showLabel && 'has-label', isLanding && 'mk-drop')}
    style={{ '--c': color } as FaceStyle}
  >
    <span className="mk-halo" />
    <svg aria-hidden="true" className="mk-shape" height={44} viewBox="-4 -4 44 44" width={44}>
      <path className="mk-sel" d={STOP_PATH} />
      <path className="mk-body" d={STOP_PATH} />
    </svg>
    <span className="mk-glyph">{initials}</span>
    <div className="mk-pill">
      <BedIcon size={13} weight="fill" />
      <span>{name}</span>
      {status === 'current' && <em>· today</em>}
    </div>
  </div>
);

interface ActivityFaceProps {
  color: string;
  enterIndex?: number;
  Glyph: Icon;
  isDone: boolean;
  isNext: boolean;
  isSelected: boolean;
  name: string;
}

export const ActivityFace: React.FC<ActivityFaceProps> = ({ color, Glyph, name, isDone, isSelected, isNext, enterIndex }) => (
  <div
    className={cx('mk mk-pin', isDone && 'is-done', isSelected && 'is-selected', enterIndex !== undefined && 'mk-enter')}
    style={{ '--c': color, '--enter-index': enterIndex } as FaceStyle}
  >
    <svg aria-hidden="true" className="mk-shape" height={39} viewBox="-4 -4 38 39" width={38}>
      <path className="mk-sel" d={PIN_PATH} />
      <path className="mk-body" d={PIN_PATH} />
    </svg>
    <span className="mk-glyph">
      <Glyph size={16} weight="fill" />
    </span>
    <DoneBadge isDone={isDone} />
    <div className="mk-pill">
      <span>{name}</span>
    </div>
    {isNext && !isDone && <span className="mk-next">Next</span>}
  </div>
);

interface WaypointFaceProps {
  enterIndex?: number;
  isDone: boolean;
  isSelected: boolean;
  name: string;
}

export const WaypointFace: React.FC<WaypointFaceProps> = ({ name, isDone, isSelected, enterIndex }) => (
  <div
    className={cx('mk mk-wp', isDone && 'is-done', isSelected && 'is-selected', enterIndex !== undefined && 'mk-enter')}
    style={{ '--c': WAYPOINT_MARKER.color, '--enter-index': enterIndex } as FaceStyle}
  >
    <span className="mk-dia" />
    <span className="mk-glyph">
      <MountainsIcon size={12} weight="fill" />
    </span>
    <DoneBadge isDone={isDone} />
    <div className="mk-pill">
      <span>{name}</span>
    </div>
  </div>
);

interface PoiFaceProps {
  Glyph: Icon;
  name: string;
}

export const PoiFace: React.FC<PoiFaceProps> = ({ Glyph, name }) => (
  <div className="mk mk-poi" data-name={name}>
    <span className="mk-disc" />
    <span className="mk-glyph">
      <Glyph size={14} weight="fill" />
    </span>
  </div>
);

interface DotFaceProps {
  color: string;
  isDone: boolean;
  kind: 'activity' | 'waypoint';
}

export const DotFace: React.FC<DotFaceProps> = ({ color, isDone, kind }) => (
  <div className={cx('mk mk-dot', kind === 'waypoint' && 'is-wp', isDone && 'is-done')} style={{ '--c': color } as FaceStyle} />
);
