import { render } from '@testing-library/react';
import { ActivityFace, DotFace, PoiFace, StopFace, WaypointFace } from '@/components/Map/MarkerFaces';
import { getActivityMarker } from '@/components/Map/markerCategory';
import { ActivityType } from '@/types/trip';

const { color, Glyph } = getActivityMarker(ActivityType.RESTAURANT);

const renderActivity = (props: Partial<React.ComponentProps<typeof ActivityFace>> = {}) =>
  render(<ActivityFace color={color} Glyph={Glyph} isDone={false} isNext={false} isSelected={false} name="Lunch" {...props} />);

const rerenderActivity = (rerender: (ui: React.ReactElement) => void, props: Partial<React.ComponentProps<typeof ActivityFace>>) =>
  rerender(<ActivityFace color={color} Glyph={Glyph} isDone={false} isNext={false} isSelected={false} name="Lunch" {...props} />);

describe('ActivityFace', () => {
  it('shows the done badge without the pop animation when it mounts done', () => {
    const { container } = renderActivity({ isDone: true });

    expect(container.querySelector('.mk-check')).toBeInTheDocument();
    expect(container.querySelector('.animate-check-pop')).not.toBeInTheDocument();
    expect(container.querySelector('.mk-ripple')).not.toBeInTheDocument();
  });

  it('animates the badge with a ripple when isDone turns true after mount', () => {
    const { container, rerender } = renderActivity();
    expect(container.querySelector('.mk-check')).not.toBeInTheDocument();

    rerenderActivity(rerender, { isDone: true });

    expect(container.querySelector('.mk-check')).toHaveClass('animate-check-pop');
    expect(container.querySelector('.mk-ripple')).toBeInTheDocument();
  });

  it('animates again when unticked and ticked a second time while mounted', () => {
    const { container, rerender } = renderActivity({ isDone: true });
    expect(container.querySelector('.animate-check-pop')).not.toBeInTheDocument();

    rerenderActivity(rerender, { isDone: false });
    expect(container.querySelector('.mk-check')).not.toBeInTheDocument();

    rerenderActivity(rerender, { isDone: true });
    expect(container.querySelector('.mk-check')).toHaveClass('animate-check-pop');
    expect(container.querySelector('.mk-ripple')).toBeInTheDocument();
  });

  it('marks the selected face', () => {
    const { container, rerender } = renderActivity();
    expect(container.firstElementChild).not.toHaveClass('is-selected');

    rerenderActivity(rerender, { isSelected: true });

    expect(container.firstElementChild).toHaveClass('is-selected');
  });

  it('shows the Next tab only while the item is not done', () => {
    const { container, rerender } = renderActivity({ isNext: true });
    expect(container.querySelector('.mk-next')).toHaveTextContent('Next');

    rerenderActivity(rerender, { isNext: true, isDone: true });

    expect(container.querySelector('.mk-next')).not.toBeInTheDocument();
  });

  it('carries the family color, the done class and the staggered enter index', () => {
    const { container } = renderActivity({ isDone: true, enterIndex: 3 });
    const root = container.firstElementChild as HTMLElement;

    expect(root).toHaveClass('mk', 'mk-pin', 'is-done', 'mk-enter');
    expect(root.style.getPropertyValue('--c')).toBe(color);
    expect(root.style.getPropertyValue('--enter-index')).toBe('3');
  });

  it('plays no entrance without an enter index', () => {
    const { container } = renderActivity();

    expect(container.firstElementChild).not.toHaveClass('mk-enter');
  });

  it('hides its svgs from assistive tech', () => {
    const { container } = renderActivity();

    expect(container.querySelector('.mk-shape')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('WaypointFace', () => {
  it('animates the badge only on a transition after mount', () => {
    const mounted = render(<WaypointFace isDone isSelected={false} name="Lookout" />);
    expect(mounted.container.querySelector('.mk-check')).toBeInTheDocument();
    expect(mounted.container.querySelector('.animate-check-pop')).not.toBeInTheDocument();

    const ticked = render(<WaypointFace isDone={false} isSelected={false} name="Lookout" />);
    ticked.rerender(<WaypointFace isDone isSelected={false} name="Lookout" />);
    expect(ticked.container.querySelector('.mk-check')).toHaveClass('animate-check-pop');
    expect(ticked.container.querySelector('.mk-ripple')).toBeInTheDocument();
  });

  it('is a diamond that takes the selected class', () => {
    const { container } = render(<WaypointFace isDone={false} isSelected name="Lookout" />);

    expect(container.firstElementChild).toHaveClass('mk', 'mk-wp', 'is-selected');
    expect(container.querySelector('.mk-dia')).toBeInTheDocument();
  });
});

describe('StopFace', () => {
  const renderStop = (props: Partial<React.ComponentProps<typeof StopFace>> = {}) =>
    render(
      <StopFace
        color="var(--color-blue-700)"
        initials="LT"
        isLanding={false}
        isViewing={false}
        name="Lake Tekapo"
        showLabel={false}
        status="upcoming"
        {...props}
      />
    );

  it.each([
    ['upcoming', 'is-upcoming'],
    ['current', 'is-today'],
    ['past', 'is-past'],
  ] as const)('maps %s to %s', (status, className) => {
    const { container } = renderStop({ status });

    expect(container.firstElementChild).toHaveClass('mk', 'mk-stop', className);
  });

  it('never draws a check badge, so a past stop does not clash with the timeline seal', () => {
    const { container } = renderStop({ status: 'past' });

    expect(container.querySelector('.mk-check')).not.toBeInTheDocument();
  });

  it('adds has-label only when the label is requested', () => {
    const { container, rerender } = renderStop();
    expect(container.firstElementChild).not.toHaveClass('has-label');

    rerender(
      <StopFace
        color="var(--color-blue-700)"
        initials="LT"
        isLanding={false}
        isViewing={false}
        name="Lake Tekapo"
        showLabel
        status="upcoming"
      />
    );

    expect(container.firstElementChild).toHaveClass('has-label');
  });

  it('adds is-viewing and the drop entrance only when asked', () => {
    const { container } = renderStop({ isViewing: true, isLanding: true });

    expect(container.firstElementChild).toHaveClass('is-viewing', 'mk-drop');
  });

  it('shows the initials and appends today to the pill for the current stop', () => {
    const { container } = renderStop({ status: 'current' });

    expect(container.querySelector('.mk-glyph')).toHaveTextContent('LT');
    expect(container.querySelector('.mk-pill')).toHaveTextContent('Lake Tekapo');
    expect(container.querySelector('.mk-pill em')).toHaveTextContent('today');
  });

  it('draws the stop path twice, selection ring first and body second', () => {
    const { container } = renderStop();
    const paths = container.querySelectorAll('.mk-shape path');

    expect(paths).toHaveLength(2);
    expect(paths[0]).toHaveClass('mk-sel');
    expect(paths[1]).toHaveClass('mk-body');
    expect(container.querySelector('.mk-halo')).toBeInTheDocument();
  });
});

describe('DotFace', () => {
  it('is a circle by default', () => {
    const { container } = render(<DotFace color={color} isDone={false} kind="activity" />);

    expect(container.firstElementChild).toHaveClass('mk', 'mk-dot');
    expect(container.firstElementChild).not.toHaveClass('is-wp');
    expect(container.firstElementChild).not.toHaveClass('is-done');
  });

  it('is a diamond for a waypoint', () => {
    const { container } = render(<DotFace color={color} isDone={false} kind="waypoint" />);

    expect(container.firstElementChild).toHaveClass('is-wp');
  });

  it('is hollow when done', () => {
    const { container } = render(<DotFace color={color} isDone kind="activity" />);

    expect(container.firstElementChild).toHaveClass('is-done');
  });
});

describe('PoiFace', () => {
  it('renders a disc with the glyph and keeps the name as a test hook', () => {
    const { container } = render(<PoiFace Glyph={Glyph} name="Bakery" />);

    expect(container.firstElementChild).toHaveClass('mk', 'mk-poi');
    expect(container.firstElementChild).toHaveAttribute('data-name', 'Bakery');
    expect(container.querySelector('.mk-disc')).toBeInTheDocument();
    expect(container.querySelector('.mk-pill')).not.toBeInTheDocument();
  });
});
