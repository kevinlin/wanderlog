import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TodoWindow, TripSummary } from '@/types/trip';
import { TripLibraryCard } from '../TripLibraryCard';

// useTripToday reads the real clock, so the running trip ends in 2099 and a
// todo that needs no date is ready on whatever day this runs.
const trip = (todos: TodoWindow[] | undefined, over: Partial<TripSummary> = {}): TripSummary => ({
  trip_id: 't1',
  trip_name: 'Sichuan',
  description: null,
  destination: 'China',
  start_date: '2026-12-01',
  end_date: '2099-12-31',
  timezone: 'Asia/Shanghai',
  todos,
  ...over,
});

const renderCard = (summary: TripSummary) =>
  render(<TripLibraryCard isHero={false} onDelete={vi.fn()} onOpen={vi.fn()} status="upcoming" trip={summary} />);

const ready: TodoWindow = { done: false };
const done: TodoWindow = { done: true };

describe('TripLibraryCard todo count', () => {
  it('shows how many todos are ready', () => {
    renderCard(trip([ready, ready, ready, done]));

    expect(screen.getByText('3 to do')).toBeInTheDocument();
  });

  it('is hidden when the count is zero', () => {
    renderCard(trip([done, done]));

    expect(screen.queryByText(/to do/)).not.toBeInTheDocument();
  });

  it('is hidden for a trip with no todos', () => {
    renderCard(trip([]));

    expect(screen.queryByText(/to do/)).not.toBeInTheDocument();
  });

  it('is hidden when the summary carries no todos at all', () => {
    renderCard(trip(undefined));

    expect(screen.queryByText(/to do/)).not.toBeInTheDocument();
  });

  it('does not count a todo that has not opened yet', () => {
    renderCard(trip([ready, { done: false, opens_on: '2099-06-01' }]));

    expect(screen.getByText('1 to do')).toBeInTheDocument();
  });

  it('is hidden once the trip has ended', () => {
    renderCard(trip([ready, ready], { end_date: '2020-01-01' }));

    expect(screen.queryByText(/to do/)).not.toBeInTheDocument();
  });

  it('keeps the trip name and dates alongside', () => {
    renderCard(trip([ready]));

    expect(screen.getByText('Sichuan')).toBeInTheDocument();
    expect(screen.getByText('China')).toBeInTheDocument();
  });
});
