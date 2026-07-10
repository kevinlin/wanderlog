/**
 * Cinematic camera choreography for hopping between trip stops.
 *
 * The math is pure and framework-free so it can be unit-tested; `flyCamera`
 * is the thin requestAnimationFrame wrapper that drives a real map. A hop
 * eases the centre from one stop to the next while briefly pulling the zoom
 * out at the midpoint — so a long leg shows the whole journey before settling,
 * a short leg stays a quick pan.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

// Standard ease-in-out cubic: accelerate away from the origin, decelerate into
// the destination — the natural "vehicle" feel for a travelling camera.
export const easeInOutCubic = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

// Euclidean distance in degrees. Good enough as a visual heuristic for how far
// a leg is; we don't need geodesic accuracy to decide how much to pull back.
export const legDistance = (from: LatLng, to: LatLng): number => Math.hypot(to.lat - from.lat, to.lng - from.lng);

// How many zoom levels to pull back at the midpoint. Near stops stay flat (a
// plain pan); long legs pull back so both ends are briefly in frame.
export const hopArcDepth = (distance: number): number => clamp((distance - 0.2) * 2.2, 0, 3);

// Longer legs take a little longer, capped so the hop always feels quick.
export const hopDuration = (distance: number): number => clamp(520 + distance * 220, 520, 920);

/**
 * Camera state at eased progress `t` (0..1). `t` should already be eased.
 * The `sin(π·t)` term dips the zoom out at the midpoint and returns it,
 * layered on top of the linear start→end zoom interpolation.
 */
export const cameraAtProgress = (
  from: LatLng,
  to: LatLng,
  fromZoom: number,
  toZoom: number,
  arcDepth: number,
  t: number
): { center: LatLng; zoom: number } => ({
  center: {
    lat: from.lat + (to.lat - from.lat) * t,
    lng: from.lng + (to.lng - from.lng) * t,
  },
  zoom: fromZoom + (toZoom - fromZoom) * t - arcDepth * Math.sin(Math.PI * t),
});

export interface FlyCameraOptions {
  from: LatLng;
  fromZoom: number;
  onDone?: () => void;
  /** Called every frame with the camera state and eased progress `e` (0..1). */
  onFrame: (center: LatLng, zoom: number, e: number) => void;
  to: LatLng;
  toZoom: number;
}

/** Drives a hop over rAF. Returns a cancel function (safe to call any time). */
export function flyCamera({ from, to, fromZoom, toZoom, onFrame, onDone }: FlyCameraOptions): () => void {
  const distance = legDistance(from, to);
  const arcDepth = hopArcDepth(distance);
  const duration = hopDuration(distance);

  let raf = 0;
  let startTs = 0;
  let cancelled = false;

  const step = (ts: number) => {
    if (cancelled) return;
    if (!startTs) startTs = ts;
    const raw = clamp((ts - startTs) / duration, 0, 1);
    const e = easeInOutCubic(raw);
    const { center, zoom } = cameraAtProgress(from, to, fromZoom, toZoom, arcDepth, e);
    onFrame(center, zoom, e);
    if (raw < 1) {
      raf = requestAnimationFrame(step);
    } else {
      onDone?.();
    }
  };

  raf = requestAnimationFrame(step);

  return () => {
    cancelled = true;
    cancelAnimationFrame(raf);
  };
}
