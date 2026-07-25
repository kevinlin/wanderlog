# Visited Section (Phase 4, M2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A stop's completed activities and scenic waypoints leave the planned lists and read back as one chronological record, grouped by the day they happened (Phase 4 Requirement 3).

**Architecture:** Two pure functions in `src/utils/tripUtils.ts` carry the whole rule: `partitionByVisit` splits both item lists on `is_done` and merges the done ones into day groups under a total order, and `applyPlannedOrder` translates a drag over the planned subset back into a full-list id order so visited items keep their `sort_order` slots. `ActivitiesPanel` renders planned activities and planned waypoints exactly as today over the filtered lists, and a new collapsible `VisitedSection` renders the groups with no drag context. No schema change, no new query key, no mutation change.

**Tech Stack:** React 19, @dnd-kit (existing sortable list), TanStack Query v5 (read from cache only), Vitest 4 + @testing-library/react, Tailwind 4.

## Global Constraints

- Requirement 3 only. M3 (agent check-off) stays out of scope; M1 shipped everything this milestone reads.
- No migration, no mapper change, no cache `buster` bump: every field this milestone needs (`visited_at`, `visit_duration_minutes`, `order` on waypoints) already reaches the cache from M1.
- Ordering keys come from the domain `order` field, never from array position (`Activity.order`, `ScenicWaypoint.order`, both mapped from `sort_order`).
- The merged order must be **total and deterministic** (Req 3.6): `visited_at`, then `order`, then kind with activities before waypoints, then `activity_id`. Two items of different types routinely both hold `order: 0`, because the two tables number `sort_order` independently.
- The visit-details affordance stays ungated on `useOnlineStatus` (M1's Req 5.1 carve-out). `ActivityListItem`/`WaypointListItem` own `onLogVisit`; do not add an `isOnline ?` wrapper around it while moving items into the new section.
- Drag stays disabled while offline in the planned list (`isDragDisabled={!isOnline}`, unchanged) and absent entirely in the visited section (Req 3.4).
- The map, timeline, and trip library read the full stop lists from `tripData` and must keep doing so (Req 3.10). Nothing in `TripPage`'s `activityStatus`/`stopProgress` or `MapContainer`'s props changes.
- Ultracite owns formatting (`npx ultracite fix`); no hand-formatting, no JSDoc on new code — comments explain *why*.
- Run the full suite with `pnpm test:run`; a single file with `pnpm vitest run <path>`. Husky runs the full suite on commit.

---

## File Structure

| File | | Responsibility |
|------|---|----------------|
| `src/utils/tripUtils.ts` | Modify | `partitionByVisit`, `applyPlannedOrder`, `formatVisitDay` and the `VisitedItem`/`VisitedGroup` types. The whole ordering rule lives here. |
| `src/utils/__tests__/tripUtils.test.ts` | Create | Pure tests over plain arrays: split, merge, day groups, tie-breaks, undated group, slot substitution. |
| `src/components/Activities/VisitedSection.tsx` | Create | Collapsible visited list: a heading per day group, the same item containers, no `DndContext`. |
| `src/components/Activities/DraggableActivity.tsx` | Modify | `onReorder` emits the reordered planned ids; optional `emptyMessage`. |
| `src/components/Activities/ActivitiesPanel.tsx` | Modify | Feed the planned halves to the existing lists, count them, render `VisitedSection` below. |
| `src/pages/TripPage.tsx` | Modify | `handleActivityReorder` takes ids and runs them through `applyPlannedOrder`. |
| `src/components/Activities/__tests__/ActivitiesPanel.test.tsx` | Create | The panel-level split: planned-only groups and counts, day headings, drag handles only in planned, ticking moves an item. |

---

## Implementation Plan

### Task 1: Partition and reorder helpers

The entire milestone's logic, as pure functions over plain arrays. Everything after this is wiring.

**Files:**
- Modify: `src/utils/tripUtils.ts`
- Test: `src/utils/__tests__/tripUtils.test.ts` (create)

**Interfaces:**
- Consumes: `Activity` (`@/types/trip`), `ScenicWaypoint` (`@/types/map`) — both already carry `order`, `visited_at`, `visit_duration_minutes` from M1.
- Produces:
  - `type VisitedItem = { kind: 'activity'; order: number; item: Activity } | { kind: 'waypoint'; order: number; item: ScenicWaypoint }`
  - `interface VisitedGroup { date: string | null; items: VisitedItem[] }`
  - `interface VisitPartition { planned: Activity[]; plannedWaypoints: ScenicWaypoint[]; visitedGroups: VisitedGroup[] }`
  - `partitionByVisit(activities: Activity[], waypoints: ScenicWaypoint[]): VisitPartition`
  - `applyPlannedOrder(currentOrderIds: string[], reorderedPlannedIds: string[]): string[]`
  - `formatVisitDay(date: string): string`

- [ ] **Step 1: Write the failing tests**

Create `src/utils/__tests__/tripUtils.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run src/utils/__tests__/tripUtils.test.ts`
Expected: FAIL — `partitionByVisit`, `applyPlannedOrder`, and `formatVisitDay` are not exported.

- [ ] **Step 3: Implement the helpers**

Append to `src/utils/tripUtils.ts`, and add `import type { ScenicWaypoint } from '@/types/map';` to the existing type imports:

```ts
export type VisitedItem =
  | { kind: 'activity'; order: number; item: Activity }
  | { kind: 'waypoint'; order: number; item: ScenicWaypoint };

export interface VisitedGroup {
  date: string | null;
  items: VisitedItem[];
}

export interface VisitPartition {
  planned: Activity[];
  plannedWaypoints: ScenicWaypoint[];
  visitedGroups: VisitedGroup[];
}

const isDone = (item: { status?: { done: boolean } }): boolean => item.status?.done ?? false;

const byOrderThenId = (a: { activity_id: string; order?: number }, b: { activity_id: string; order?: number }): number =>
  (a.order ?? 0) - (b.order ?? 0) || (a.activity_id < b.activity_id ? -1 : 1);

// Total and deterministic (Req 3.6). visited_at has minute precision and the two
// tables number sort_order independently, so an activity and a waypoint sharing
// both a minute and an order value is routine - without the kind and id
// tie-breaks the render would depend on how the two arrays were concatenated.
// Undated entries compare equal on the first key and fall through to plan order.
const compareVisited = (a: VisitedItem, b: VisitedItem): number => {
  const timeA = a.item.visited_at ?? '';
  const timeB = b.item.visited_at ?? '';
  if (timeA !== timeB) {
    return timeA < timeB ? -1 : 1;
  }
  if (a.order !== b.order) {
    return a.order - b.order;
  }
  if (a.kind !== b.kind) {
    return a.kind === 'activity' ? -1 : 1;
  }
  return a.item.activity_id < b.item.activity_id ? -1 : 1;
};

/**
 * Split a stop's items into the planned halves and the merged visited groups.
 */
export const partitionByVisit = (activities: Activity[], waypoints: ScenicWaypoint[]): VisitPartition => {
  const visited: VisitedItem[] = [
    ...activities.filter(isDone).map((item): VisitedItem => ({ kind: 'activity', order: item.order ?? 0, item })),
    ...waypoints.filter(isDone).map((item): VisitedItem => ({ kind: 'waypoint', order: item.order ?? 0, item })),
  ];

  const dated = visited.filter((entry) => entry.item.visited_at).sort(compareVisited);
  const undated = visited.filter((entry) => !entry.item.visited_at).sort(compareVisited);

  const visitedGroups: VisitedGroup[] = [];
  for (const entry of dated) {
    const date = (entry.item.visited_at ?? '').slice(0, 10);
    const last = visitedGroups.at(-1);
    if (last?.date === date) {
      last.items.push(entry);
    } else {
      visitedGroups.push({ date, items: [entry] });
    }
  }
  if (undated.length > 0) {
    visitedGroups.push({ date: null, items: undated });
  }

  return {
    planned: activities.filter((activity) => !isDone(activity)).sort(byOrderThenId),
    plannedWaypoints: waypoints.filter((waypoint) => !isDone(waypoint)).sort(byOrderThenId),
    visitedGroups,
  };
};

/**
 * Fold a drag over the planned subset back into a full-list id order.
 */
export const applyPlannedOrder = (currentOrderIds: string[], reorderedPlannedIds: string[]): string[] => {
  // Filtering keeps the slot count and the queue length in step if an id was
  // deleted between the render that started the drag and this call.
  const queue = reorderedPlannedIds.filter((id) => currentOrderIds.includes(id));
  const slots = new Set(queue);
  let next = 0;
  return currentOrderIds.map((id) => (slots.has(id) ? queue[next++] : id));
};

/**
 * Render a visited-group heading ('2026-07-15' -> 'Wed 15 Jul').
 */
// Locale pinned so the heading keeps one shape whatever the device is set to.
export const formatVisitDay = (date: string): string =>
  new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
```

Drop the `/** … */` wrappers if Ultracite objects to them; the surrounding file uses them, so they are kept for consistency with the neighbours rather than as documentation.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run src/utils/__tests__/tripUtils.test.ts`
Expected: PASS, all twelve cases.

- [ ] **Step 5: Commit**

```bash
git add src/utils/tripUtils.ts src/utils/__tests__/tripUtils.test.ts
git commit -m "feat: add visited partition and planned-order helpers"
```

---

### Task 2: Id-based reorder

Drag will soon cover only the planned subset, so `(fromIndex, toIndex)` stops indexing the list the write renumbers. This task changes the signature while the lists are still whole, so it is behaviour-neutral and reviewable on its own: the same order goes to Supabase before and after.

**Files:**
- Modify: `src/components/Activities/DraggableActivity.tsx`, `src/components/Activities/ActivitiesPanel.tsx`, `src/pages/TripPage.tsx`
- Test: covered by `applyPlannedOrder` in Task 1 plus `tsc`; the drag gesture itself is verified in Task 4.

**Interfaces:**
- Consumes: `applyPlannedOrder` (Task 1).
- Produces: `DraggableActivitiesListProps.onReorder: (orderedActivityIds: string[]) => void` and the same prop shape on `ActivitiesPanelProps`; `DraggableActivitiesListProps.emptyMessage?: string`.

- [ ] **Step 1: Emit ids from the drag handler**

In `src/components/Activities/DraggableActivity.tsx`, change the prop type:

```ts
  emptyMessage?: string;
  onReorder: (orderedActivityIds: string[]) => void;
```

destructure `emptyMessage` alongside the rest, and replace `handleDragEnd`:

```tsx
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = activities.findIndex((activity) => activity.activity_id === active.id);
      const newIndex = activities.findIndex((activity) => activity.activity_id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        // Ids, not indices: this list holds only the planned subset, so an index
        // into it means nothing to the write that renumbers the whole stop.
        const orderedIds = activities.map((activity) => activity.activity_id);
        const [moved] = orderedIds.splice(oldIndex, 1);
        orderedIds.splice(newIndex, 0, moved);
        onReorder(orderedIds);
      }
    }
  };
```

and use the message prop in the empty state:

```tsx
        <p className="text-gray-500">{emptyMessage ?? 'No activities planned for this stop.'}</p>
```

- [ ] **Step 2: Widen the panel prop**

In `src/components/Activities/ActivitiesPanel.tsx`, change the prop declaration to `onReorder: (orderedActivityIds: string[]) => void;`. It is a pass-through, so nothing else in the panel changes in this task.

- [ ] **Step 3: Substitute into held slots in TripPage**

In `src/pages/TripPage.tsx`, replace `handleActivityReorder`:

```tsx
  const handleActivityReorder = (orderedPlannedIds: string[]) => {
    if (!state.currentBase) {
      return;
    }
    const previousIds = sortedActivities.map((activity) => activity.activity_id);
    // Drag covers the planned half only. Substituting into the slots those items
    // already held leaves every visited item's sort_order alone, so unticking
    // one returns it to its original position.
    const orderedIds = applyPlannedOrder(previousIds, orderedPlannedIds);
    if (orderedIds.every((id, index) => id === previousIds[index])) {
      return;
    }
    const stopId = state.currentBase;
    reorderMutation.mutate({ stopId, orderedActivityIds: orderedIds });
    setToast({
      message: 'Activities reordered',
      type: 'info',
      show: true,
      action: {
        label: 'Undo',
        onClick: () => reorderMutation.mutate({ stopId, orderedActivityIds: previousIds }),
      },
    });
  };
```

Add `applyPlannedOrder` to the existing `@/utils/tripUtils` import.

- [ ] **Step 4: Typecheck and run the suite**

Run: `pnpm build && pnpm test:run`
Expected: `tsc -b` clean and the suite green. Nothing yet renders differently.

- [ ] **Step 5: Commit**

```bash
git add src/components/Activities/DraggableActivity.tsx src/components/Activities/ActivitiesPanel.tsx src/pages/TripPage.tsx
git commit -m "refactor: reorder activities by id so drag can cover a subset"
```

---

### Task 3: The visited section and the panel split

The visible half of the milestone. `VisitedSection` is its own file: `ActivitiesPanel` is already 626 lines, and the grouped render is self-contained.

**Files:**
- Create: `src/components/Activities/VisitedSection.tsx`
- Modify: `src/components/Activities/ActivitiesPanel.tsx`
- Test: `src/components/Activities/__tests__/ActivitiesPanel.test.tsx` (create)

**Interfaces:**
- Consumes: `partitionByVisit`, `formatVisitDay`, `VisitedGroup` (Task 1); `ActivityListItem`, `WaypointListItem` (shipped in M1).
- Produces: `<VisitedSection accommodation groups onDeleteActivity onDeleteWaypoint onEditActivity onEditWaypoint onItemDone onSelect selectedActivityId trip tripId />`.

- [ ] **Step 1: Write the failing panel tests**

Create `src/components/Activities/__tests__/ActivitiesPanel.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { registerMutationDefaults } from '@/lib/mutationDefaults';
import { tripKeys } from '@/lib/queryClient';
import type { ScenicWaypoint } from '@/types/map';
import type { Activity, TripData } from '@/types/trip';
import { ActivitiesPanel } from '../ActivitiesPanel';

vi.mock('@/services/supabaseService', () => ({ writeVisitFields: vi.fn() }));
vi.mock('@/hooks/useWeather', () => ({ useWeather: () => ({ weather: null, isStale: false, updatedAt: null }) }));
vi.mock('@/hooks/useScreenSize', () => ({ useScreenSize: () => ({ isMobile: false }) }));
vi.mock('@/hooks/useTripMutations', () => ({
  useCreateActivity: () => ({ mutate: vi.fn() }),
  useDeleteActivity: () => ({ mutate: vi.fn() }),
  useDeleteWaypoint: () => ({ mutate: vi.fn() }),
}));
vi.mock('@/services/placesService', () => ({
  PlacesService: { getInstance: () => ({ textSearchWithLocationBias: vi.fn().mockResolvedValue([]) }) },
}));
vi.mock('@/contexts/AppStateContext', () => ({
  useAppStateContext: () => ({
    state: { poiSearch: { query: '', results: [], loading: false, error: null } },
    dispatch: vi.fn(),
  }),
}));
// The item editors load a Places search; none of them is under test here.
vi.mock('@/components/Editing/ActivityFormModal', () => ({ ActivityFormModal: () => null }));
vi.mock('@/components/Editing/AccommodationFormModal', () => ({ AccommodationFormModal: () => null }));
vi.mock('@/components/Editing/WaypointFormModal', () => ({ WaypointFormModal: () => null }));

const trip: TripData = {
  trip_id: 't1',
  trip_name: 'Japan',
  timezone: 'Asia/Tokyo',
  start_date: '2026-07-12',
  end_date: '2026-07-19',
  stops: [],
};

const act = (name: string, over: Partial<Activity> = {}): Activity => ({
  activity_id: name,
  activity_name: name,
  order: 0,
  ...over,
});

const wp = (name: string, over: Partial<ScenicWaypoint> = {}): ScenicWaypoint => ({
  activity_id: name,
  activity_name: name,
  location: {},
  order: 0,
  ...over,
});

const baseProps = {
  activities: [] as Activity[],
  baseId: 's1',
  baseLocation: { lat: 1, lng: 2 },
  onActivitySelect: vi.fn(),
  onItemDone: vi.fn(),
  onReorder: vi.fn(),
  scenicWaypoints: [] as ScenicWaypoint[],
  selectedActivityId: null,
  stopName: 'Tokyo',
  tripData: trip,
};

const renderPanel = (overrides: Partial<typeof baseProps> = {}) => {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  registerMutationDefaults(client);
  client.setQueryData(tripKeys.detail('t1'), structuredClone(trip));
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const { rerender } = render(<ActivitiesPanel {...baseProps} {...overrides} />, { wrapper });
  return {
    // RTL's rerender skips the wrapper, so it is applied by hand here.
    rerender: (next: Partial<typeof baseProps>) =>
      rerender(
        <QueryClientProvider client={client}>
          <ActivitiesPanel {...baseProps} {...overrides} {...next} />
        </QueryClientProvider>
      ),
  };
};

// Card titles sit in the same element as a type icon, so the emoji is part of
// their text content. The card's own aria-label is the clean handle: 'Ramen',
// 'Ramen, done', 'Lake, scenic waypoint, done'. The checkbox label is
// `Mark "Ramen" done`, which the comma in this pattern excludes.
const cardLabels = () => screen.getAllByLabelText(/, done$/).map((element) => element.getAttribute('aria-label'));

describe('ActivitiesPanel planned/visited split', () => {
  it('counts and lists only planned waypoints in the scenic group', async () => {
    const user = userEvent.setup();
    renderPanel({
      scenicWaypoints: [wp('Lake'), wp('Bridge', { status: { done: true }, visited_at: '2026-07-15 09:00' })],
    });

    await user.click(screen.getByRole('button', { name: /Scenic Waypoints \(1\)/ }));

    expect(screen.getByLabelText('Lake, scenic waypoint')).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Bridge/)).not.toBeInTheDocument();
  });

  it('counts and lists only planned activities in the activities section', async () => {
    const user = userEvent.setup();
    renderPanel({
      activities: [act('Ramen'), act('Museum', { order: 1, status: { done: true }, visited_at: '2026-07-15 09:00' })],
    });

    await user.click(screen.getByRole('button', { name: /Activities \(1\)/ }));

    expect(screen.getByLabelText('Ramen')).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Museum/)).not.toBeInTheDocument();
  });

  it('groups visited activities and waypoints by day in visit order', async () => {
    const user = userEvent.setup();
    renderPanel({
      activities: [
        act('Museum', { order: 0, status: { done: true }, visited_at: '2026-07-15 09:10' }),
        act('Ramen', { order: 1, status: { done: true }, visited_at: '2026-07-16 12:00' }),
      ],
      scenicWaypoints: [wp('Lake', { order: 0, status: { done: true }, visited_at: '2026-07-15 14:00' })],
    });

    await user.click(screen.getByRole('button', { name: /Visited \(3\)/ }));

    expect(screen.getByText('Wed 15 Jul')).toBeInTheDocument();
    expect(screen.getByText('Thu 16 Jul')).toBeInTheDocument();
    expect(cardLabels()).toEqual(['Museum, done', 'Lake, scenic waypoint, done', 'Ramen, done']);
  });

  it('puts undated visited items in a final group', async () => {
    const user = userEvent.setup();
    renderPanel({
      activities: [
        act('Museum', { order: 0, status: { done: true }, visited_at: '2026-07-15 09:10' }),
        act('Ramen', { order: 1, status: { done: true } }),
      ],
    });

    await user.click(screen.getByRole('button', { name: /Visited \(2\)/ }));

    expect(screen.getByText('Time not recorded')).toBeInTheDocument();
    expect(cardLabels()).toEqual(['Museum, done', 'Ramen, done']);
  });

  it('offers drag handles in the planned list and none in the visited one', async () => {
    const user = userEvent.setup();
    renderPanel({
      activities: [
        act('Ramen'),
        act('Museum', { order: 1, status: { done: true }, visited_at: '2026-07-15 09:10' }),
        act('Shrine', { order: 2, status: { done: true }, visited_at: '2026-07-15 11:00' }),
      ],
    });

    await user.click(screen.getByRole('button', { name: /Activities \(1\)/ }));
    await user.click(screen.getByRole('button', { name: /Visited \(2\)/ }));

    expect(screen.getAllByLabelText('Drag to reorder activity')).toHaveLength(1);
    expect(cardLabels()).toHaveLength(2);
  });

  it('moves an item between the sections when it becomes done', async () => {
    const user = userEvent.setup();
    const { rerender } = renderPanel({ activities: [act('Ramen')] });

    await user.click(screen.getByRole('button', { name: /Activities \(1\)/ }));
    expect(screen.queryByRole('button', { name: /Visited/ })).not.toBeInTheDocument();

    rerender({ activities: [act('Ramen', { status: { done: true }, visited_at: '2026-07-15 09:10' })] });

    // Expanded, the count lives in the section's h3 rather than the toggle.
    expect(screen.getByRole('heading', { name: /Activities \(0\)/ })).toBeInTheDocument();
    expect(screen.getByText('Everything here is ticked off.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Visited \(1\)/ })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run src/components/Activities/__tests__/ActivitiesPanel.test.tsx`
Expected: FAIL — the counts still include done items, there is no Visited button, and both done and planned items render in one list.

- [ ] **Step 3: Build VisitedSection**

Create `src/components/Activities/VisitedSection.tsx`:

```tsx
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { ActivityListItem } from '@/components/Activities/ActivityListItem';
import { WaypointListItem } from '@/components/Activities/WaypointListItem';
import type { Accommodation, Activity } from '@/types';
import type { ScenicWaypoint } from '@/types/map';
import type { TripData } from '@/types/trip';
import { formatVisitDay, type VisitedGroup } from '@/utils/tripUtils';

interface VisitedSectionProps {
  accommodation?: Accommodation;
  groups: VisitedGroup[];
  onDeleteActivity?: (activity: Activity) => void;
  onDeleteWaypoint?: (waypoint: ScenicWaypoint) => void;
  onEditActivity?: (activity: Activity) => void;
  onEditWaypoint?: (waypoint: ScenicWaypoint) => void;
  onItemDone: (itemId: string) => void;
  onSelect: (itemId: string) => void;
  selectedActivityId?: string | null;
  trip: TripData;
  tripId: string;
}

// Chronology owns this order, so there is no DndContext here and every item is
// rendered undraggable (Req 3.4). The cards are the same ones the planned lists
// use, so a visited item can still be unticked, edited, and re-noted.
export const VisitedSection = ({
  groups,
  accommodation,
  selectedActivityId,
  trip,
  tripId,
  onSelect,
  onItemDone,
  onEditActivity,
  onDeleteActivity,
  onEditWaypoint,
  onDeleteWaypoint,
}: VisitedSectionProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const total = groups.reduce((count, group) => count + group.items.length, 0);

  if (total === 0) {
    return null;
  }

  return (
    <div className="px-3 pb-3">
      <button
        className="flex min-h-[30px] w-full touch-manipulation items-center justify-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/20 px-4 py-3 font-medium text-emerald-700 transition-all duration-200 hover:bg-emerald-500/30 hover:shadow-md active:bg-emerald-500/40"
        onClick={() => setIsExpanded(!isExpanded)}
        type="button"
      >
        <span>🗓️ Visited ({total})</span>
        {isExpanded ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-4">
          {groups.map((group) => (
            <div key={group.date ?? 'undated'}>
              <h4 className="mb-2 font-semibold text-emerald-800 text-xs uppercase tracking-wide">
                {group.date ? formatVisitDay(group.date) : 'Time not recorded'}
              </h4>
              <div className="space-y-3">
                {group.items.map((entry) =>
                  entry.kind === 'activity' ? (
                    <ActivityListItem
                      accommodation={accommodation}
                      activity={entry.item}
                      isDraggable={false}
                      isSelected={selectedActivityId === entry.item.activity_id}
                      key={entry.item.activity_id}
                      onDelete={onDeleteActivity}
                      onDone={onItemDone}
                      onEdit={onEditActivity}
                      onSelect={onSelect}
                      trip={trip}
                      tripId={tripId}
                    />
                  ) : (
                    <WaypointListItem
                      accommodation={accommodation}
                      isSelected={selectedActivityId === entry.item.activity_id}
                      key={entry.item.activity_id}
                      onDelete={onDeleteWaypoint}
                      onDone={onItemDone}
                      onEdit={onEditWaypoint}
                      onSelect={onSelect}
                      trip={trip}
                      tripId={tripId}
                      waypoint={entry.item}
                    />
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 4: Split the panel**

In `src/components/Activities/ActivitiesPanel.tsx`, add the imports:

```tsx
import { VisitedSection } from '@/components/Activities/VisitedSection';
import { partitionByVisit } from '@/utils/tripUtils';
```

Below the editing state, derive the split:

```tsx
  // Done items leave both planned lists and reappear in the Visited section,
  // ordered by when they happened (Req 3.1). The full arrays stay untouched for
  // the map, the timeline, and the sort orders new items are appended with.
  const { planned, plannedWaypoints, visitedGroups } = partitionByVisit(activities, scenicWaypoints);
```

Then five edits inside the JSX. Leave every `sortOrder={activities.length}` / `sortOrder={scenicWaypoints.length}` and the POI handler's `sortOrder: activities.length` on the **full** arrays — a new item's `sort_order` has to clear the visited ones too:

1. Scenic waypoints group — gate, count, and list on the planned half:

```tsx
          {plannedWaypoints.length > 0 && (
```
```tsx
                <span>🏞️ Scenic Waypoints ({plannedWaypoints.length})</span>
```
```tsx
                  {plannedWaypoints.map((waypoint) => (
```

2. The standalone add-waypoint affordance below it — `{scenicWaypoints.length === 0 && isOnline && (` becomes `{plannedWaypoints.length === 0 && isOnline && (`, so it still appears when the group is empty because everything is visited.

3. Both activity counts — `📋 Activities ({activities.length})` in the collapsed toggle and `📋 Activities ({activities.length})` in the expanded header both become `{planned.length}`.

4. The list itself:

```tsx
                <DraggableActivitiesList
                  accommodation={accommodation}
                  activities={planned}
                  emptyMessage={activities.length > 0 ? 'Everything here is ticked off.' : undefined}
                  isDragDisabled={!isOnline}
                  key={baseId}
                  onActivitySelect={onActivitySelect}
                  onDeleteActivity={isOnline ? setDeletingActivity : undefined}
                  onDone={onItemDone}
                  onEditActivity={isOnline ? (activity) => setActivityModal({ mode: 'edit', activity }) : undefined}
                  onReorder={onReorder}
                  selectedActivityId={selectedActivityId}
                  trip={tripData}
                  tripId={tripId}
                />
```

5. The visited section, directly after the closing `)}` of the `{isExpanded && (` activities block and before the POI search results — it carries its own collapse state, so it stays reachable while the activities section is collapsed:

```tsx
          <VisitedSection
            accommodation={accommodation}
            groups={visitedGroups}
            onDeleteActivity={isOnline ? setDeletingActivity : undefined}
            onDeleteWaypoint={isOnline ? setDeletingWaypoint : undefined}
            onEditActivity={isOnline ? (activity) => setActivityModal({ mode: 'edit', activity }) : undefined}
            onEditWaypoint={isOnline ? (waypoint) => setWaypointModal({ mode: 'edit', waypoint }) : undefined}
            onItemDone={onItemDone}
            onSelect={onActivitySelect}
            selectedActivityId={selectedActivityId}
            trip={tripData}
            tripId={tripId}
          />
```

- [ ] **Step 5: Run the panel tests to verify they pass**

Run: `pnpm vitest run src/components/Activities/__tests__/ActivitiesPanel.test.tsx`
Expected: PASS, all six cases.

- [ ] **Step 6: Run the full suite, lint, and build**

Run: `pnpm test:run && npx ultracite fix && pnpm build`
Expected: suite green, no lint findings left, `tsc -b` clean.

- [ ] **Step 7: Commit**

```bash
git add src/components/Activities src/utils/tripUtils.ts
git commit -m "feat: split planned and visited items in the activities panel"
```

---

### Task 4: M2 verification gate

Manual verification against a Vercel preview. No code; record the results in this plan's changelog. M2 adds no migration, so nothing has to reach the database first.

- [ ] **Step 1: Verify a multi-day visited section**

On a trip with a stop spanning more than one night, tick items across two days (using the visit form to set times on different dates). Confirm the Visited section shows one heading per day, in date order, with items inside each day in time order.

- [ ] **Step 2: Verify the merged chronology**

Tick both an activity and a scenic waypoint on the same day with different times. Confirm both appear in the one visited list, interleaved by time, and that the waypoint is gone from the Scenic Waypoints group and its count.

- [ ] **Step 3: Verify the undated group**

Tick an item on a trip whose dates are in the past, so no stamp is recorded. Confirm it lands in a final "Time not recorded" group below every dated group.

- [ ] **Step 4: Verify the drag rules**

Drag two planned activities to reorder them and confirm the new order survives a reload. Confirm no drag handle appears on any card inside the Visited section.

- [ ] **Step 5: Verify untick returns an item to its slot**

Note the position of a planned activity, tick it, reorder the remaining planned items, then untick it. Confirm it returns to its original position rather than the bottom of the list.

- [ ] **Step 6: Verify nothing else moved**

Confirm the map still pins visited items, the timeline still counts them in its per-stop progress, and the trip library is unchanged.

- [ ] **Step 7: Record the results**

Add a changelog entry to this plan naming what was verified and anything deferred.

---

## Design Decisions

- **Two pure functions carry the rule.** `partitionByVisit` and `applyPlannedOrder` take plain arrays and return plain data, so every ordering case — colliding `order` values, undated items, an untick returning to its slot — is a unit test rather than a drag simulation.
- **The order is total by construction.** `visited_at` then `order` then kind then id. The last two are not defensive padding: the two tables number `sort_order` independently, so `0` collides constantly, and without the id tie-break the render would depend on the order the two arrays were concatenated in.
- **Reorder speaks ids.** With drag covering only the planned subset, an index into that subset means nothing to a write that renumbers the whole stop. Substituting the reordered ids into the slots the planned items already held leaves visited items' `sort_order` untouched, which is what makes an untick return an item to its original position.
- **`VisitedSection` is its own file and its own collapsible.** `ActivitiesPanel` is already 626 lines; the grouped render is self-contained and testable. Making it collapsible follows the Scenic Waypoints idiom and keeps a long record from pushing the planned list off a phone screen.
- **The counts follow the sections.** `Activities (n)` and `Scenic Waypoints (n)` count what is in them — the planned halves — with the visited total on its own button. A count that included items rendered in a different section would be a lie.
- **Panel order left as shipped.** The design doc lists planned activities, then the waypoints group, then Visited. The shipped panel puts the waypoints group above activities; that order is kept and Visited is appended last. The requirement is that planned sits above visited (Req 3.2), and reshuffling two existing sections is a UI change this milestone was not asked for.
- **The full arrays stay in play.** New activities and waypoints are still numbered off `activities.length` / `scenicWaypoints.length`, so a fresh item's `sort_order` clears the visited ones. The map, timeline, and library keep reading the whole stop from `tripData` (Req 3.10).
- **The drag gesture itself is not unit-tested.** Simulating a dnd-kit pointer drag in jsdom tests the sensor, not this change; the id math is covered by `applyPlannedOrder` and the gesture by Task 4 Step 4.

## Critical Files - Summary

| Path | Why it matters |
|------|----------------|
| `src/utils/tripUtils.ts` | The only definition of the visited split and its total order; everything else is wiring. |
| `src/pages/TripPage.tsx` | `applyPlannedOrder` runs here. Skip it and a planned drag renumbers visited items, so unticking drops them to the bottom of the plan. |
| `src/components/Activities/VisitedSection.tsx` | No `DndContext`, `isDraggable={false}`: the two things Req 3.4 asks for. |
| `src/components/Activities/ActivitiesPanel.tsx` | Where the planned halves and the counts have to stay in step with the sections they label. |

## Changelog

- 2026-07-26: Initial plan, written from [requirements_phase-4.md](requirements_phase-4.md) Requirement 3 and [design_phase-4.md](design_phase-4.md), against the code shipped by [plan_p4m1_data-model-and-capture.md](plan_p4m1_data-model-and-capture.md).
