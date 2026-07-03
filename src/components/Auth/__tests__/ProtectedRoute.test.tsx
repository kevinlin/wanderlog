import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

const mockUseAuth = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => mockUseAuth() }));

const mockFetchTripById = vi.fn();
vi.mock('@/services/supabaseService', () => ({
  fetchTripById: (tripId: string) => mockFetchTripById(tripId),
}));

import { TripPage } from '@/pages/TripPage';
import { ProtectedRoute } from '../ProtectedRoute';

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<div>login page</div>} path="/login" />
        <Route
          element={
            <ProtectedRoute>
              <div>secret</div>
            </ProtectedRoute>
          }
          path="/secret"
        />
      </Routes>
    </MemoryRouter>
  );

describe('ProtectedRoute', () => {
  it('redirects to /login without a session', () => {
    mockUseAuth.mockReturnValue({ session: null, isLoading: false });
    renderAt('/secret');
    expect(screen.getByText('login page')).toBeInTheDocument();
  });

  it('renders children with a session', () => {
    mockUseAuth.mockReturnValue({ session: { user: {} }, isLoading: false });
    renderAt('/secret');
    expect(screen.getByText('secret')).toBeInTheDocument();
  });

  it('shows the spinner while the session is loading', () => {
    mockUseAuth.mockReturnValue({ session: null, isLoading: true });
    renderAt('/secret');
    expect(screen.queryByText('login page')).not.toBeInTheDocument();
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });

  it('never fetches trip data without a session (Req 2.1)', () => {
    mockUseAuth.mockReturnValue({ session: null, isLoading: false });
    render(
      <MemoryRouter initialEntries={['/trips/202512_NZ']}>
        <Routes>
          <Route element={<div>login page</div>} path="/login" />
          <Route
            element={
              <ProtectedRoute>
                <TripPage />
              </ProtectedRoute>
            }
            path="/trips/:tripId"
          />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('login page')).toBeInTheDocument();
    expect(mockFetchTripById).not.toHaveBeenCalled();
  });
});
