import { describe, expect, it } from 'vitest';
import type { ScenicWaypoint } from '@/types/map';
import type { Activity } from '@/types/trip';
import { applyPlannedOrder, formatVisitDay, partitionByVisit } from '../tripUtils';

const act = (id: string, over: Partial<Activity> = {}): Activity => ({
  activity_id: id,
  activity_name: id,
  order: 0,
  ...over,
});

const wp = (id: string, over: Partial<ScenicWaypoint> = {}): ScenicWaypoint => ({
  activity_id: id,
  activity_name: id,
  location: {},
  order: 0,
  ...over,
});

const done = (visitedAt?: string) => ({ status: { done: true }, visited_at: visitedAt });

describe('partitionByVisit', () => {
  it('splits both lists on done', () => {
    const { planned, plannedWaypoints, visitedGroups } = partitionByVisit(
      [act('a1', { order: 0 }), act('a2', { order: 1, ...done('2026-07-15 09:00') })],
      [wp('w1', { order: 0 }), wp('w2', { order: 1, ...done('2026-07-15 10:00') })]
    );

    expect(planned.map((a) => a.activity_id)).toEqual(['a1']);
    expect(plannedWaypoints.map((w) => w.activity_id)).toEqual(['w1']);
    expect(visitedGroups).toHaveLength(1);
    expect(visitedGroups[0].items.map((entry) => entry.item.activity_id)).toEqual(['a2', 'w2']);
  });

  it('merges activities and waypoints into one chronology per day', () => {
    const { visitedGroups } = partitionByVisit(
      [act('a1', { order: 0, ...done('2026-07-16 08:00') }), act('a2', { order: 1, ...done('2026-07-15 18:00') })],
      [wp('w1', { order: 0, ...done('2026-07-15 09:30') })]
    );

    expect(visitedGroups.map((group) => group.date)).toEqual(['2026-07-15', '2026-07-16']);
    expect(visitedGroups[0].items.map((entry) => entry.item.activity_id)).toEqual(['w1', 'a2']);
    expect(visitedGroups[1].items.map((entry) => entry.item.activity_id)).toEqual(['a1']);
  });

  it('breaks ties on colliding order values by kind then id', () => {
    // The two tables number sort_order independently, so an activity and a
    // waypoint both holding 0 is routine, and visited_at has minute precision.
    const { visitedGroups } = partitionByVisit(
      [act('a-second', { order: 0, ...done('2026-07-15 09:00') }), act('a-first', { order: 0, ...done('2026-07-15 09:00') })],
      [wp('w1', { order: 0, ...done('2026-07-15 09:00') })]
    );

    expect(visitedGroups[0].items.map((entry) => entry.item.activity_id)).toEqual(['a-first', 'a-second', 'w1']);
  });

  it('groups undated visited items last, in plan order', () => {
    const { visitedGroups } = partitionByVisit(
      [act('a1', { order: 2, ...done() }), act('a2', { order: 0, ...done() }), act('a3', { order: 1, ...done('2026-07-15 09:00') })],
      [wp('w1', { order: 1, ...done() })]
    );

    expect(visitedGroups.map((group) => group.date)).toEqual(['2026-07-15', null]);
    expect(visitedGroups[1].items.map((entry) => entry.item.activity_id)).toEqual(['a2', 'w1', 'a1']);
  });

  it('tags each entry with its kind and its domain order', () => {
    const { visitedGroups } = partitionByVisit(
      [act('a1', { order: 7, ...done('2026-07-15 09:00') })],
      [wp('w1', { order: 4, ...done('2026-07-15 10:00') })]
    );

    expect(visitedGroups[0].items[0]).toMatchObject({ kind: 'activity', order: 7 });
    expect(visitedGroups[0].items[1]).toMatchObject({ kind: 'waypoint', order: 4 });
  });

  it('sorts the planned halves by order', () => {
    const { planned, plannedWaypoints } = partitionByVisit(
      [act('a2', { order: 1 }), act('a1', { order: 0 })],
      [wp('w2', { order: 1 }), wp('w1', { order: 0 })]
    );

    expect(planned.map((a) => a.activity_id)).toEqual(['a1', 'a2']);
    expect(plannedWaypoints.map((w) => w.activity_id)).toEqual(['w1', 'w2']);
  });
});

describe('applyPlannedOrder', () => {
  it('substitutes reordered planned ids into the slots they already held', () => {
    expect(applyPlannedOrder(['a1', 'v1', 'a2', 'a3'], ['a3', 'a1', 'a2'])).toEqual(['a3', 'v1', 'a1', 'a2']);
  });

  it('leaves a visited item in its slot so unticking returns it there', () => {
    // v1 sits second. Whatever the planned half does, v1 keeps index 1, so the
    // reorder write renumbers it back to sort_order 1 and an untick returns it
    // to its original position instead of the bottom of the plan.
    expect(applyPlannedOrder(['a1', 'v1', 'a2'], ['a2', 'a1'])).toEqual(['a2', 'v1', 'a1']);
  });

  it('ignores ids that are no longer in the list', () => {
    expect(applyPlannedOrder(['a1', 'a2'], ['gone', 'a2', 'a1'])).toEqual(['a2', 'a1']);
  });
});

describe('formatVisitDay', () => {
  it('renders a day heading with a pinned locale', () => {
    expect(formatVisitDay('2026-07-15')).toBe('Wed 15 Jul');
  });
});
