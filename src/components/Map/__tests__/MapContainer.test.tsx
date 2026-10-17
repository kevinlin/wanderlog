import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import React from 'react';
import { ToastProvider } from '@/components/Layout/Toast';
import { AppStateProvider, useAppStateContext } from '@/contexts/AppStateContext';
import type { POIDetails } from '@/types/poi';
import { ActivityType, type TripBase, type TripData } from '@/types/trip';
import { MapContainer } from '../MapContainer';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const Providers = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <ToastProvider>
      <AppStateProvider>{children}</AppStateProvider>
    </ToastProvider>
  </QueryClientProvider>
);

const harness = vi.hoisted(() => ({
  hops: [] as { cancel: ReturnType<typeof vi.fn>; opts: { onDone?: () => void; to: { lat: number; lng: number } } }[],
  reduceMotion: false,
  today: '2024-01-02',
  zoomListeners: [] as { event: string; handler: () => void; remove: ReturnType<typeof vi.fn> }[],
}));

const mockMap = {
  fitBounds: vi.fn(),
  panTo: vi.fn(),
  setZoom: vi.fn(),
  setCenter: vi.fn(),
  moveCamera: vi.fn(),
  setMapTypeId: vi.fn(),
  getCenter: vi.fn(() => ({ lat: () => -44.5, lng: () => 170 })),
  getZoom: vi.fn(() => 14),
  addListener: vi.fn((event: string, handler: () => void) => {
    const remove = vi.fn();
    harness.zoomListeners.push({ event, handler, remove });
    return { remove };
  }),
};

vi.mock('@react-google-maps/api', () => ({
  GoogleMap: ({ children, onLoad }: any) => {
    React.useEffect(() => {
      if (onLoad) {
        onLoad(mockMap);
      }
    }, [onLoad]);
    return <div data-testid="google-map">{children}</div>;
  },
  useGoogleMap: () => mockMap,
  useJsApiLoader: () => ({ isLoaded: true, loadError: undefined }),
  DirectionsRenderer: ({ options }: { options?: { preserveViewport?: boolean } }) => (
    <div data-preserve-viewport={String(options?.preserveViewport)} data-testid="directions-renderer" />
  ),
  Polyline: () => <div data-testid="polyline" />,
}));

// A controllable flyCamera: each hop is recorded, and the test lands it by calling its onDone.
vi.mock('@/utils/mapCamera', () => ({
  flyCamera: vi.fn((opts: { onDone?: () => void; to: { lat: number; lng: number } }) => {
    const cancel = vi.fn();
    harness.hops.push({ cancel, opts });
    return cancel;
  }),
}));

vi.mock('@/hooks/useTripToday', () => ({
  useTripToday: vi.fn(() => harness.today),
}));

vi.stubGlobal(
  'matchMedia',
  vi.fn(() => ({
    matches: harness.reduceMotion,
    media: '',
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
);

// The real element is a custom element that attaches its content on `map`; this keeps only
// the parts MapMarker touches, and detaches on `map = null` so no node leaks across tests.
class FakeMarker {
  static instances: FakeMarker[] = [];

  readonly element = document.createElement('div');
  readonly options: any;
  anchorTop?: string | null;
  collisionBehavior?: unknown;
  zIndex?: number | null;
  private mapValue: unknown = null;

  constructor(options: any) {
    this.options = options;
    this.anchorTop = options.anchorTop;
    this.collisionBehavior = options.collisionBehavior;
    this.zIndex = options.zIndex;
    this.title = options.title ?? '';
    if (options.content) {
      this.element.appendChild(options.content);
    }
    this.map = options.map ?? null;
    FakeMarker.instances.push(this);
  }

  get title() {
    return this.element.title;
  }

  set title(value: string) {
    this.element.title = value;
  }

  get map() {
    return this.mapValue;
  }

  set map(value: unknown) {
    this.mapValue = value;
    if (value) {
      document.body.appendChild(this.element);
    } else {
      this.element.remove();
    }
  }

  get content() {
    return this.options.content as HTMLElement;
  }

  addEventListener(type: string, listener: EventListener) {
    this.element.addEventListener(type, listener);
  }

  removeEventListener(type: string, listener: EventListener) {
    this.element.removeEventListener(type, listener);
  }
}

// Travel-viz APIs the stop hop still uses (legacy Marker dot and halo, plus the trail Polyline).
const travelMarkerMock = vi.fn(function TravelMarkerMock() {
  return { setMap: vi.fn(), setPosition: vi.fn(), setOpacity: vi.fn() };
});
const polylineMock = vi.fn(function PolylineMock() {
  return { setMap: vi.fn(), setPath: vi.fn(), setOptions: vi.fn() };
});

Object.defineProperty(window, 'google', {
  value: {
    maps: {
      CollisionBehavior: { OPTIONAL_AND_HIDES_LOWER_PRIORITY: 'OPTIONAL_AND_HIDES_LOWER_PRIORITY' },
      marker: { AdvancedMarkerElement: FakeMarker },
      Marker: travelMarkerMock,
      SymbolPath: { CIRCLE: 0 },
      Polyline: polylineMock,
      // Vitest 4: constructor mocks must use the function keyword (arrow functions are not constructible)
      LatLngBounds: vi.fn(function LatLngBoundsMock() {
        return { extend: vi.fn() };
      }),
      LatLng: vi.fn(),
      DirectionsService: vi.fn(function DirectionsServiceMock() {
        return { route: vi.fn() };
      }),
      TravelMode: {
        DRIVING: 'DRIVING',
      },
      DirectionsStatus: {
        OK: 'OK',
      },
      places: {
        PlacesService: vi.fn(function PlacesServiceMock() {
          return {
            getDetails: vi.fn(),
            nearbySearch: vi.fn(),
            textSearch: vi.fn(),
          };
        }),
        PlacesServiceStatus: {
          OK: 'OK',
        },
      },
    },
  },
  writable: true,
});

const stop1: TripBase = {
  stop_id: 'stop1',
  name: 'Test Stop 1',
  date: { from: '2024-01-01', to: '2024-01-02' },
  location: { lat: -44.5, lng: 170.0 },
  duration_days: 1,
  accommodation: {
    name: 'Test Hotel',
    address: '123 Test St',
    check_in: '2024-01-01 15:00',
    check_out: '2024-01-02 11:00',
    location: { lat: -44.5, lng: 170.0 },
  },
  activities: [
    {
      activity_id: 'activity1',
      activity_name: 'Test Activity',
      activity_type: ActivityType.ATTRACTION,
      location: { lat: -44.6, lng: 170.1 },
      order: 0,
      status: { done: true },
    },
    {
      // No stored type: the marker, title and hover card must all use the inferred restaurant.
      activity_id: 'activity2',
      activity_name: 'Harbour Bistro',
      location: { lat: -44.62, lng: 170.12, address: '1 Wharf Rd' },
      order: 1,
    },
    {
      activity_id: 'activity3',
      activity_name: 'Later Walk',
      activity_type: ActivityType.OUTDOOR,
      location: { lat: -44.64, lng: 170.14 },
      order: 2,
    },
    {
      activity_id: 'no-location',
      activity_name: 'Unplaced Idea',
      activity_type: ActivityType.OTHER,
      order: 3,
    },
  ],
  scenic_waypoints: [
    {
      activity_id: 'waypoint1',
      activity_name: 'Test Scenic Waypoint',
      location: { lat: -44.7, lng: 170.2, address: 'Scenic Lookout' },
      duration: '15 min',
      order: 0,
    },
    {
      activity_id: 'waypoint2',
      activity_name: 'Ticked Lookout',
      location: { lat: -44.72, lng: 170.22 },
      order: 1,
      status: { done: true },
    },
  ],
};

const stop2: TripBase = {
  stop_id: 'stop2',
  name: 'Test Stop 2',
  date: { from: '2024-01-03', to: '2024-01-04' },
  location: { lat: -45.0, lng: 170.8 },
  duration_days: 1,
  activities: [
    {
      activity_id: 'activity-b1',
      activity_name: 'Second Stop Activity',
      activity_type: ActivityType.BEACH,
      location: { lat: -45.1, lng: 170.9 },
      order: 0,
    },
  ],
  scenic_waypoints: [],
};

const mockTripData: TripData = {
  trip_name: 'Test Trip',
  timezone: 'Pacific/Auckland',
  stops: [stop1, stop2],
};

const defaultProps = {
  tripData: mockTripData,
  currentBaseId: 'stop1' as string | null,
  selectedActivityId: null as string | null,
  activityStatus: { activity1: true, waypoint2: false } as Record<string, boolean>,
  onActivitySelect: vi.fn(),
  onBaseSelect: vi.fn(),
};

const ui = (props: Partial<React.ComponentProps<typeof MapContainer>> = {}, extra?: React.ReactNode) => (
  <Providers>
    <MapContainer {...defaultProps} {...props} />
    {extra}
  </Providers>
);

const liveMarkers = () => FakeMarker.instances.filter((marker) => marker.map);

const findMarker = (title: string | RegExp) =>
  liveMarkers().find((marker) => (typeof title === 'string' ? marker.title === title : title.test(marker.title)));

const getMarker = (title: string | RegExp): FakeMarker => {
  const marker = findMarker(title);
  if (!marker) {
    throw new Error(
      `No live marker titled ${title}. Live: ${liveMarkers()
        .map((m) => m.title)
        .join(' | ')}`
    );
  }
  return marker;
};

const faceOf = (title: string | RegExp) => getMarker(title).content.firstElementChild as HTMLElement;

const clickMarker = (title: string | RegExp) =>
  act(() => {
    getMarker(title).element.dispatchEvent(new Event('gmp-click'));
  });

const land = (hopIndex = harness.hops.length - 1) =>
  act(() => {
    harness.hops[hopIndex].opts.onDone?.();
  });

const mouse = (type: 'pointerenter' | 'pointerleave') => new PointerEvent(type, { pointerType: 'mouse' });

const SeedSearchResults = ({ results }: { results: POIDetails[] }) => {
  const { dispatch } = useAppStateContext();
  React.useEffect(() => {
    dispatch({ type: 'SET_POI_SEARCH_RESULTS', payload: results });
  }, [dispatch, results]);
  return null;
};

beforeEach(() => {
  vi.clearAllMocks();
  FakeMarker.instances = [];
  harness.hops.length = 0;
  harness.zoomListeners.length = 0;
  harness.reduceMotion = false;
  harness.today = '2024-01-02';
  mockMap.getZoom.mockReturnValue(14);
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY = 'test-api-key';
});

describe('MapContainer', () => {
  it('renders the map container', () => {
    render(ui());

    expect(screen.getByTestId('google-map')).toBeInTheDocument();
  });

  it('handles missing Google Maps API key gracefully', () => {
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY = '';

    render(ui());

    expect(screen.getByText('Map Unavailable')).toBeInTheDocument();
    expect(screen.getByText('Google Maps API key not configured')).toBeInTheDocument();
  });

  describe('stop markers', () => {
    it('renders a marker per stop, titled with the accommodation and the trip-local status', () => {
      render(ui());

      expect(findMarker('Test Stop 1 - Test Hotel, today')).toBeDefined();
      expect(findMarker('Test Stop 2, upcoming')).toBeDefined();
    });

    it('judges every stop against the trip-local date from useTripToday', async () => {
      const { useTripToday } = await import('@/hooks/useTripToday');
      harness.today = '2024-01-09';

      render(ui());

      expect(useTripToday).toHaveBeenCalledWith('Pacific/Auckland');
      expect(findMarker('Test Stop 1 - Test Hotel, past')).toBeDefined();
      expect(findMarker('Test Stop 2, past')).toBeDefined();
      expect(faceOf(/^Test Stop 1/)).toHaveClass('is-past');
    });

    it('marks status and initials on the face, with the timeline color', () => {
      render(ui());

      const today = faceOf(/^Test Stop 1/);
      const upcoming = faceOf(/^Test Stop 2/);
      expect(today).toHaveClass('mk-stop', 'is-today');
      expect(upcoming).toHaveClass('is-upcoming');
      expect(today.querySelector('.mk-glyph')).toHaveTextContent('TS');
      expect(today.style.getPropertyValue('--c')).toBe('var(--color-blue-700)');
      expect(upcoming.style.getPropertyValue('--c')).toBe('var(--color-emerald-700)');
    });

    it('calls onBaseSelect on gmp-click', () => {
      const onBaseSelect = vi.fn();
      render(ui({ onBaseSelect }));

      clickMarker(/^Test Stop 2/);

      expect(onBaseSelect).toHaveBeenCalledWith('stop2');
    });

    it('lifts the viewed stop above the others and keeps the default pin anchor', () => {
      render(ui());

      expect(getMarker(/^Test Stop 1/).zIndex).toBe(30);
      expect(getMarker(/^Test Stop 2/).zIndex).toBe(10);
      expect(getMarker(/^Test Stop 1/).options.anchorTop).toBe('-100%');
      expect(faceOf(/^Test Stop 1/)).toHaveClass('is-viewing');
      expect(faceOf(/^Test Stop 2/)).not.toHaveClass('is-viewing');
    });

    it('shows the name pill on the viewed stop only when zoomed out', () => {
      const { rerender } = render(ui());
      expect(faceOf(/^Test Stop 1/)).not.toHaveClass('has-label');

      mockMap.getZoom.mockReturnValue(9);
      act(() => {
        for (const listener of harness.zoomListeners) listener.handler();
      });
      rerender(ui());

      expect(faceOf(/^Test Stop 1/)).toHaveClass('has-label');
      expect(faceOf(/^Test Stop 2/)).not.toHaveClass('has-label');
    });
  });

  describe('arrival gate', () => {
    it('renders activities and waypoints only after the hop lands', () => {
      render(ui());

      expect(harness.hops).toHaveLength(1);
      expect(findMarker('Test Activity, done')).toBeUndefined();
      expect(findMarker('Test Scenic Waypoint')).toBeUndefined();
      expect(findMarker(/^Test Stop 1/)).toBeDefined();

      land();

      expect(findMarker('Test Activity, done')).toBeDefined();
      expect(findMarker('Harbour Bistro, next up')).toBeDefined();
      expect(findMarker('Test Scenic Waypoint')).toBeDefined();
    });

    it('drops the stop on landing and not before', () => {
      render(ui());
      expect(faceOf(/^Test Stop 1/)).not.toHaveClass('mk-drop');

      land();

      expect(faceOf(/^Test Stop 1/)).toHaveClass('mk-drop');
      expect(faceOf(/^Test Stop 2/)).not.toHaveClass('mk-drop');
    });

    it('hides the old stop activities as soon as a new hop starts', () => {
      const { rerender } = render(ui());
      land();
      expect(findMarker('Test Activity, done')).toBeDefined();

      rerender(ui({ currentBaseId: 'stop2' }));

      expect(findMarker('Test Activity, done')).toBeUndefined();
      expect(findMarker(/^Second Stop Activity/)).toBeUndefined();

      land();

      expect(findMarker(/^Second Stop Activity/)).toBeDefined();
      expect(findMarker('Test Activity, done')).toBeUndefined();
    });

    it('waits for the stop it returns to when going A to B to A before B lands', () => {
      const { rerender } = render(ui());
      land(0);

      rerender(ui({ currentBaseId: 'stop2' }));
      expect(harness.hops).toHaveLength(2);

      rerender(ui({ currentBaseId: 'stop1' }));
      expect(harness.hops).toHaveLength(3);
      expect(harness.hops[1].cancel).toHaveBeenCalled();
      expect(findMarker('Test Activity, done')).toBeUndefined();
      expect(findMarker(/^Second Stop Activity/)).toBeUndefined();

      land(2);

      expect(findMarker('Test Activity, done')).toBeDefined();
      expect(findMarker(/^Second Stop Activity/)).toBeUndefined();
    });

    it('renders activities with no camera hop under reduced motion', () => {
      harness.reduceMotion = true;

      render(ui());

      expect(harness.hops).toHaveLength(0);
      expect(mockMap.moveCamera).toHaveBeenCalledWith({ center: { lat: -44.5, lng: 170 }, zoom: 14 });
      expect(findMarker('Test Activity, done')).toBeDefined();
      expect(findMarker('Test Scenic Waypoint')).toBeDefined();
    });

    it('renders no activity markers while no stop is selected', () => {
      render(ui({ currentBaseId: null }));

      expect(harness.hops).toHaveLength(0);
      expect(liveMarkers().map((marker) => marker.title)).toEqual(['Test Stop 1 - Test Hotel, today', 'Test Stop 2, upcoming']);
    });
  });

  describe('stop-hop travel viz', () => {
    it('draws the legacy dot, halo and trail from the previous stop, and clears them when the next hop starts', () => {
      const { rerender } = render(ui());
      land(0);
      expect(travelMarkerMock).not.toHaveBeenCalled();

      rerender(ui({ currentBaseId: 'stop2' }));

      expect(travelMarkerMock).toHaveBeenCalledTimes(2);
      expect(polylineMock).toHaveBeenCalledTimes(1);
      expect(travelMarkerMock.mock.calls[0][0]).toMatchObject({ position: { lat: -44.5, lng: 170 }, clickable: false });
      // The dot and halo are not advanced markers.
      expect(FakeMarker.instances.some((marker) => marker.options.icon)).toBe(false);

      rerender(ui({ currentBaseId: 'stop1' }));

      const [dot, halo] = travelMarkerMock.mock.results.map((result) => result.value);
      expect(dot.setMap).toHaveBeenCalledWith(null);
      expect(halo.setMap).toHaveBeenCalledWith(null);
    });
  });

  describe('route', () => {
    it('draws the route without re-fitting the camera, since every trip edit re-fetches it', async () => {
      const directionsService = window.google.maps.DirectionsService as unknown as ReturnType<typeof vi.fn>;
      directionsService.mockImplementationOnce(function DirectionsServiceOk() {
        return { route: vi.fn((_request, callback) => callback({ routes: [] }, 'OK')) };
      });

      render(ui());

      expect(await screen.findByTestId('directions-renderer')).toHaveAttribute('data-preserve-viewport', 'true');
    });
  });

  describe('activity and waypoint markers', () => {
    it('only renders items that have a location', () => {
      render(ui());
      land();

      expect(findMarker(/Unplaced Idea/)).toBeUndefined();
    });

    it('calls onActivitySelect on gmp-click for an activity and for a waypoint', () => {
      const onActivitySelect = vi.fn();
      render(ui({ onActivitySelect }));
      land();

      clickMarker('Test Activity, done');
      clickMarker('Test Scenic Waypoint');

      expect(onActivitySelect).toHaveBeenNthCalledWith(1, 'activity1');
      expect(onActivitySelect).toHaveBeenNthCalledWith(2, 'waypoint1');
    });

    it('marks a selected activity with is-selected and no other', () => {
      render(ui({ selectedActivityId: 'activity3' }));
      land();

      expect(faceOf('Later Walk')).toHaveClass('is-selected');
      expect(faceOf('Harbour Bistro, next up')).not.toHaveClass('is-selected');
    });

    it('ends a done activity title in ", done" and the first planned one in ", next up"', () => {
      render(ui());
      land();

      expect(findMarker('Test Activity, done')).toBeDefined();
      expect(findMarker('Harbour Bistro, next up')).toBeDefined();
      expect(findMarker('Later Walk')).toBeDefined();
      expect(faceOf('Harbour Bistro, next up').querySelector('.mk-next')).toHaveTextContent('Next');
      expect(faceOf('Test Activity, done').querySelector('.mk-check')).toBeInTheDocument();
    });

    it('treats a waypoint as done from its own status as well as from activityStatus', () => {
      render(ui());
      land();

      expect(findMarker('Ticked Lookout, done')).toBeDefined();
      expect(faceOf('Ticked Lookout, done')).toHaveClass('is-done');
      expect(faceOf('Test Scenic Waypoint')).not.toHaveClass('is-done');
    });

    it('uses the inferred type for the glyph family, and the stored type otherwise', () => {
      render(ui());
      land();

      expect(faceOf('Harbour Bistro, next up').style.getPropertyValue('--c')).toBe('var(--marker-food)');
      expect(faceOf('Later Walk').style.getPropertyValue('--c')).toBe('var(--marker-nature)');
      expect(faceOf('Test Scenic Waypoint').style.getPropertyValue('--c')).toBe('var(--marker-sights)');
    });

    it('stacks selected above done above the rest, and centres waypoints on their point', () => {
      render(ui({ selectedActivityId: 'activity3' }));
      land();

      expect(getMarker('Later Walk').zIndex).toBe(40);
      expect(getMarker('Test Activity, done').zIndex).toBe(15);
      expect(getMarker('Harbour Bistro, next up').zIndex).toBe(20);
      expect(getMarker('Test Scenic Waypoint').options.anchorTop).toBe('-50%');
      expect(getMarker('Harbour Bistro, next up').options.anchorTop).toBe('-100%');
    });

    it('staggers the entrance across activities, then waypoints, in render order', () => {
      render(ui());
      land();

      const indexOf = (title: string) => faceOf(title).style.getPropertyValue('--enter-index');
      expect(indexOf('Test Activity, done')).toBe('0');
      expect(indexOf('Harbour Bistro, next up')).toBe('1');
      expect(indexOf('Later Walk')).toBe('2');
      expect(indexOf('Test Scenic Waypoint')).toBe('3');
      expect(indexOf('Ticked Lookout, done')).toBe('4');
      expect(faceOf('Later Walk')).toHaveClass('mk-enter');
    });

    it('does not construct a new marker when only the selected activity changes', () => {
      const { rerender } = render(ui());
      land();
      const constructed = FakeMarker.instances.length;

      rerender(ui({ selectedActivityId: 'activity3' }));

      expect(FakeMarker.instances).toHaveLength(constructed);
      expect(faceOf('Later Walk')).toHaveClass('is-selected');
      expect(mockMap.panTo).toHaveBeenCalledWith({ lat: -44.64, lng: 170.14 });
    });

    it('does not re-zoom when the same activity is selected again', () => {
      const { rerender } = render(ui({ selectedActivityId: 'activity3' }));
      land();
      mockMap.panTo.mockClear();

      rerender(ui({ selectedActivityId: 'activity3' }));

      expect(mockMap.panTo).not.toHaveBeenCalled();
    });
  });

  describe('zoom dots', () => {
    it('renders an unselected activity as a dot at zoom 9, and a selected one as a full marker', () => {
      mockMap.getZoom.mockReturnValue(9);
      const { rerender } = render(ui());
      land();

      expect(faceOf('Harbour Bistro, next up')).toHaveClass('mk-dot');
      expect(faceOf('Test Scenic Waypoint')).toHaveClass('mk-dot', 'is-wp');
      expect(faceOf('Test Activity, done')).toHaveClass('mk-dot', 'is-done');
      expect(getMarker('Harbour Bistro, next up').options.anchorTop).toBe('-50%');

      rerender(ui({ selectedActivityId: 'activity2' }));

      expect(faceOf('Harbour Bistro, next up')).not.toHaveClass('mk-dot');
      expect(faceOf('Harbour Bistro, next up')).toHaveClass('mk-pin', 'is-selected');
    });

    it('switches between dots and pins as the camera crosses zoom 11, and unhooks on unmount', () => {
      const { unmount } = render(ui());
      land();
      expect(faceOf('Harbour Bistro, next up')).toHaveClass('mk-pin');
      expect(harness.zoomListeners.map((listener) => listener.event)).toEqual(['zoom_changed']);

      mockMap.getZoom.mockReturnValue(10.9);
      act(() => harness.zoomListeners[0].handler());
      expect(faceOf('Harbour Bistro, next up')).toHaveClass('mk-dot');

      mockMap.getZoom.mockReturnValue(11);
      act(() => harness.zoomListeners[0].handler());
      expect(faceOf('Harbour Bistro, next up')).toHaveClass('mk-pin');

      unmount();
      expect(harness.zoomListeners[0].remove).toHaveBeenCalled();
    });
  });

  describe('search results', () => {
    const results: POIDetails[] = [
      { place_id: 'p1', name: 'Corner Cafe', location: { lat: -44.55, lng: 170.05 }, types: ['cafe'] },
      { place_id: 'p2', name: 'Mystery Spot', location: { lat: -44.56, lng: 170.06 } },
    ];

    it('renders a centred disc with optional collision behaviour above the planned items', () => {
      render(ui({}, <SeedSearchResults results={results} />));

      const marker = getMarker('Corner Cafe, search result');
      expect(marker.options.collisionBehavior).toBe('OPTIONAL_AND_HIDES_LOWER_PRIORITY');
      expect(marker.options.anchorTop).toBe('-50%');
      expect(marker.zIndex).toBe(25);
      expect(faceOf('Corner Cafe, search result')).toHaveClass('mk-poi');
      expect(faceOf('Corner Cafe, search result')).toHaveAttribute('data-name', 'Corner Cafe');
      expect(findMarker('Mystery Spot, search result')).toBeDefined();
    });

    it('centres the map on the result when clicked', () => {
      render(ui({}, <SeedSearchResults results={results} />));

      clickMarker('Corner Cafe, search result');

      expect(mockMap.panTo).toHaveBeenCalledWith({ lat: -44.55, lng: 170.05 });
      expect(mockMap.setZoom).toHaveBeenCalledWith(14);
    });
  });

  describe('hover card', () => {
    it('shows the enriched activity with its inferred glyph chip while a mouse is over it', () => {
      render(ui());
      land();
      const { content } = getMarker('Harbour Bistro, next up');

      act(() => {
        content.dispatchEvent(mouse('pointerenter'));
      });

      expect(screen.getByRole('heading', { name: 'Harbour Bistro' })).toBeInTheDocument();
      expect(screen.getByText('Restaurant')).toBeInTheDocument();
      // Faces never use .mk-chip, so the only chip in the document is the card's.
      expect((document.querySelector('.mk-chip') as HTMLElement).style.getPropertyValue('--c')).toBe('var(--marker-food)');

      act(() => {
        content.dispatchEvent(mouse('pointerleave'));
      });

      expect(screen.queryByRole('heading', { name: 'Harbour Bistro' })).not.toBeInTheDocument();
    });

    it('ignores a touch pointer', () => {
      render(ui());
      land();
      const { content } = getMarker('Harbour Bistro, next up');

      act(() => {
        content.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'touch' }));
      });

      expect(screen.queryByRole('heading', { name: 'Harbour Bistro' })).not.toBeInTheDocument();
    });

    it('shows the accommodation with the stop color chip', () => {
      render(ui());
      const { content } = getMarker(/^Test Stop 1/);

      act(() => {
        content.dispatchEvent(mouse('pointerenter'));
      });

      expect(screen.getByRole('heading', { name: 'Test Hotel' })).toBeInTheDocument();
      expect((document.querySelector('.mk-chip') as HTMLElement).style.getPropertyValue('--c')).toBe('var(--color-blue-700)');
    });
  });
});
