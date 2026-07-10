import { describe, expect, it } from 'vitest';
import { cameraAtProgress, easeInOutCubic, hopArcDepth, hopDuration, legDistance } from '../mapCamera';

describe('mapCamera', () => {
  describe('easeInOutCubic', () => {
    it('pins the endpoints and midpoint', () => {
      expect(easeInOutCubic(0)).toBe(0);
      expect(easeInOutCubic(1)).toBe(1);
      expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 5);
    });

    it('is symmetric about the midpoint', () => {
      expect(easeInOutCubic(0.25)).toBeCloseTo(1 - easeInOutCubic(0.75), 5);
    });
  });

  describe('legDistance', () => {
    it('measures euclidean degrees', () => {
      expect(legDistance({ lat: 0, lng: 0 }, { lat: 3, lng: 4 })).toBe(5);
    });
  });

  describe('hopArcDepth', () => {
    it('stays flat for a near hop', () => {
      expect(hopArcDepth(0.1)).toBe(0);
    });

    it('grows with distance and caps at 3', () => {
      expect(hopArcDepth(0.6)).toBeCloseTo(0.88, 2);
      expect(hopArcDepth(10)).toBe(3);
    });
  });

  describe('hopDuration', () => {
    it('floors at 520ms and caps at 920ms', () => {
      expect(hopDuration(0)).toBe(520);
      expect(hopDuration(100)).toBe(920);
    });
  });

  describe('cameraAtProgress', () => {
    const from = { lat: 0, lng: 0 };
    const to = { lat: 2, lng: 4 };

    it('sits at the start with no arc at t=0', () => {
      const { center, zoom } = cameraAtProgress(from, to, 7, 14, 3, 0);
      expect(center).toEqual({ lat: 0, lng: 0 });
      expect(zoom).toBe(7);
    });

    it('lands exactly on the destination at t=1', () => {
      const { center, zoom } = cameraAtProgress(from, to, 7, 14, 3, 1);
      expect(center).toEqual({ lat: 2, lng: 4 });
      expect(zoom).toBeCloseTo(14, 5);
    });

    it('dips the zoom out at the midpoint by the arc depth', () => {
      const arcDepth = 3;
      const { zoom } = cameraAtProgress(from, to, 14, 14, arcDepth, 0.5);
      // Linear zoom is flat at 14; the sin arc pulls it out by the full depth.
      expect(zoom).toBeCloseTo(14 - arcDepth, 5);
    });
  });
});
