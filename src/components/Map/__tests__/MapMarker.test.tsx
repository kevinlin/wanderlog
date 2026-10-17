import { render } from '@testing-library/react';
import { StrictMode } from 'react';
import { MapMarker } from '@/components/Map/MapMarker';

const harness = vi.hoisted(() => ({ map: null as object | null }));

vi.mock('@react-google-maps/api', () => ({
  useGoogleMap: () => harness.map,
}));

// The real element is a custom element that attaches its content on `map`; this keeps only
// the parts MapMarker touches, and leaks no nodes between tests.
class FakeMarker {
  static instances: FakeMarker[] = [];

  readonly element = document.createElement('div');
  readonly options: google.maps.marker.AdvancedMarkerElementOptions;
  anchorTop?: string | null;
  collisionBehavior?: unknown;
  position?: unknown;
  zIndex?: number | null;
  private mapValue: unknown = null;

  constructor(options: google.maps.marker.AdvancedMarkerElementOptions) {
    this.options = options;
    this.anchorTop = options.anchorTop;
    this.collisionBehavior = options.collisionBehavior;
    this.position = options.position;
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

  addEventListener(type: string, listener: EventListener) {
    this.element.addEventListener(type, listener);
  }

  removeEventListener(type: string, listener: EventListener) {
    this.element.removeEventListener(type, listener);
  }

  get content() {
    return this.options.content as HTMLElement;
  }
}

const mapA = { id: 'map-a' };
const mapB = { id: 'map-b' };

const baseProps = {
  position: { lat: -44.5, lng: 170 },
  title: 'Lunch',
  zIndex: 20,
};

const live = () => FakeMarker.instances.filter((marker) => marker.map);

const pointer = (type: 'pointerenter' | 'pointerleave', pointerType: string) => new PointerEvent(type, { pointerType });

beforeEach(() => {
  FakeMarker.instances = [];
  harness.map = mapA;
  vi.stubGlobal('google', {
    maps: {
      CollisionBehavior: { OPTIONAL_AND_HIDES_LOWER_PRIORITY: 'OPTIONAL_AND_HIDES_LOWER_PRIORITY' },
      marker: { AdvancedMarkerElement: FakeMarker },
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('MapMarker', () => {
  it('creates one marker with every prop applied at construction', () => {
    render(
      <MapMarker {...baseProps} centred collisionBehavior={'OPTIONAL_AND_HIDES_LOWER_PRIORITY' as google.maps.CollisionBehavior}>
        <span>face</span>
      </MapMarker>
    );

    expect(FakeMarker.instances).toHaveLength(1);
    expect(FakeMarker.instances[0].options).toMatchObject({
      map: mapA,
      gmpClickable: true,
      position: baseProps.position,
      title: 'Lunch',
      zIndex: 20,
      collisionBehavior: 'OPTIONAL_AND_HIDES_LOWER_PRIORITY',
      anchorTop: '-50%',
    });
  });

  it('passes the portal content through the constructor and renders children into it', () => {
    render(
      <MapMarker {...baseProps}>
        <span>face</span>
      </MapMarker>
    );

    const { content, element } = FakeMarker.instances[0];
    expect(content).toBeInstanceOf(HTMLDivElement);
    expect(element.contains(content)).toBe(true);
    expect(content).toHaveTextContent('face');
  });

  it('keeps the default bottom-centre anchor for a pin', () => {
    render(
      <MapMarker {...baseProps}>
        <span>face</span>
      </MapMarker>
    );

    expect(FakeMarker.instances[0].options.anchorTop).toBe('-100%');
  });

  it('renders nothing and creates no marker until the map exists', () => {
    harness.map = null;
    const { container, rerender } = render(
      <MapMarker {...baseProps}>
        <span>face</span>
      </MapMarker>
    );
    expect(container).toBeEmptyDOMElement();
    expect(FakeMarker.instances).toHaveLength(0);

    harness.map = mapA;
    rerender(
      <MapMarker {...baseProps}>
        <span>face</span>
      </MapMarker>
    );
    expect(FakeMarker.instances).toHaveLength(1);
  });

  it('updates the same instance when props change', () => {
    const { rerender } = render(
      <MapMarker {...baseProps}>
        <span>face</span>
      </MapMarker>
    );
    const [marker] = FakeMarker.instances;

    rerender(
      <MapMarker
        centred
        collisionBehavior={'OPTIONAL_AND_HIDES_LOWER_PRIORITY' as google.maps.CollisionBehavior}
        position={{ lat: -45, lng: 171 }}
        title="Dinner"
        zIndex={40}
      >
        <span>face</span>
      </MapMarker>
    );

    expect(FakeMarker.instances).toHaveLength(1);
    expect(marker.position).toEqual({ lat: -45, lng: 171 });
    expect(marker.title).toBe('Dinner');
    expect(marker.zIndex).toBe(40);
    expect(marker.collisionBehavior).toBe('OPTIONAL_AND_HIDES_LOWER_PRIORITY');
    expect(marker.anchorTop).toBe('-50%');
  });

  it('does not touch the position when only the object identity changes', () => {
    const { rerender } = render(
      <MapMarker {...baseProps}>
        <span>face</span>
      </MapMarker>
    );
    const [marker] = FakeMarker.instances;
    const before = marker.position;

    rerender(
      <MapMarker {...baseProps} position={{ ...baseProps.position }}>
        <span>face</span>
      </MapMarker>
    );

    expect(marker.position).toBe(before);
  });

  it('calls the latest onClick on gmp-click after a rerender with a new handler', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(
      <MapMarker {...baseProps} onClick={first}>
        <span>face</span>
      </MapMarker>
    );
    rerender(
      <MapMarker {...baseProps} onClick={second}>
        <span>face</span>
      </MapMarker>
    );

    FakeMarker.instances[0].element.dispatchEvent(new Event('gmp-click'));

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('lifts a hovered marker by 100 for a mouse and restores the current zIndex on leave', () => {
    const onHoverChange = vi.fn();
    const { rerender } = render(
      <MapMarker {...baseProps} onHoverChange={onHoverChange}>
        <span>face</span>
      </MapMarker>
    );
    const [marker] = FakeMarker.instances;
    const rect = { left: 10, top: 20, width: 30, height: 40, right: 40, bottom: 60, x: 10, y: 20 } as DOMRect;
    vi.spyOn(marker.content, 'getBoundingClientRect').mockReturnValue(rect);

    marker.content.dispatchEvent(pointer('pointerenter', 'mouse'));

    expect(marker.zIndex).toBe(120);
    expect(onHoverChange).toHaveBeenLastCalledWith(rect);

    rerender(
      <MapMarker {...baseProps} onHoverChange={onHoverChange} zIndex={40}>
        <span>face</span>
      </MapMarker>
    );
    marker.content.dispatchEvent(pointer('pointerleave', 'mouse'));

    expect(marker.zIndex).toBe(40);
    expect(onHoverChange).toHaveBeenLastCalledWith(null);
  });

  it('ignores touch and pen pointers', () => {
    const onHoverChange = vi.fn();
    render(
      <MapMarker {...baseProps} onHoverChange={onHoverChange}>
        <span>face</span>
      </MapMarker>
    );
    const [marker] = FakeMarker.instances;

    for (const pointerType of ['touch', 'pen']) {
      marker.content.dispatchEvent(pointer('pointerenter', pointerType));
      marker.content.dispatchEvent(pointer('pointerleave', pointerType));
    }

    expect(marker.zIndex).toBe(20);
    expect(onHoverChange).not.toHaveBeenCalled();
  });

  it('detaches the marker and its listeners on unmount', () => {
    const onClick = vi.fn();
    const onHoverChange = vi.fn();
    const { unmount } = render(
      <MapMarker {...baseProps} onClick={onClick} onHoverChange={onHoverChange}>
        <span>face</span>
      </MapMarker>
    );
    const [marker] = FakeMarker.instances;

    unmount();

    expect(marker.map).toBeNull();
    expect(document.body).not.toContainElement(marker.element);
    marker.element.dispatchEvent(new Event('gmp-click'));
    marker.content.dispatchEvent(pointer('pointerenter', 'mouse'));
    marker.content.dispatchEvent(pointer('pointerleave', 'mouse'));
    expect(onClick).not.toHaveBeenCalled();
    expect(onHoverChange).not.toHaveBeenCalled();
  });

  it('moves to a new marker, fully configured, when the map changes', () => {
    const { rerender } = render(
      <MapMarker {...baseProps} centred>
        <span>face</span>
      </MapMarker>
    );
    const [first] = FakeMarker.instances;

    harness.map = mapB;
    rerender(
      <MapMarker {...baseProps} centred title="Lunch (moved)">
        <span>face</span>
      </MapMarker>
    );

    expect(first.map).toBeNull();
    expect(live()).toHaveLength(1);
    expect(live()[0].options).toMatchObject({ map: mapB, title: 'Lunch (moved)', zIndex: 20, anchorTop: '-50%' });
  });

  it('leaves exactly one live marker attached under StrictMode', () => {
    render(
      <StrictMode>
        <MapMarker {...baseProps}>
          <span>face</span>
        </MapMarker>
      </StrictMode>
    );

    expect(live()).toHaveLength(1);
    expect(document.querySelectorAll('div[title="Lunch"]')).toHaveLength(1);
  });
});
