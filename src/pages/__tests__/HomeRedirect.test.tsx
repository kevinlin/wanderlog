import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/services/viewStateStorage', () => ({
  getCurrentTripId: vi.fn(() => 'my-last-trip'),
}));

import { HomeRedirect } from '../HomeRedirect';

describe('HomeRedirect', () => {
  it('redirects / to the last selected trip', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<HomeRedirect />} path="/" />
          <Route element={<div>trip page</div>} path="/trips/:tripId" />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('trip page')).toBeInTheDocument();
  });
});
