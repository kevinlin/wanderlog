import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetCurrentTripId = vi.fn<() => string | null>();
vi.mock('@/services/viewStateStorage', () => ({
  getCurrentTripId: () => mockGetCurrentTripId(),
}));

import { HomeRedirect } from '../HomeRedirect';

const renderAtRoot = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route element={<HomeRedirect />} path="/" />
        <Route element={<div>trip library</div>} path="/trips" />
        <Route element={<div>trip page</div>} path="/trips/:tripId" />
      </Routes>
    </MemoryRouter>
  );

describe('HomeRedirect', () => {
  beforeEach(() => vi.clearAllMocks());

  it('redirects / to the last selected trip', () => {
    mockGetCurrentTripId.mockReturnValue('my-last-trip');
    renderAtRoot();
    expect(screen.getByText('trip page')).toBeInTheDocument();
  });

  it('redirects / to the trip library when no trip is remembered', () => {
    mockGetCurrentTripId.mockReturnValue(null);
    renderAtRoot();
    expect(screen.getByText('trip library')).toBeInTheDocument();
  });
});
