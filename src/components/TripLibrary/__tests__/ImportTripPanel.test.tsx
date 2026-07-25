import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { danangFile } from '@/testing/fixtures/tripFiles';

const mockMutate = vi.fn();
vi.mock('@/hooks/useTripLibraryMutations', () => ({
  useImportTrip: () => ({ mutate: mockMutate, isPending: false, error: null }),
}));
vi.mock('@react-google-maps/api', () => ({
  useJsApiLoader: () => ({ isLoaded: true, loadError: undefined }),
}));
vi.mock('@/services/geocodingService', () => ({
  geocodeAddress: vi.fn(async () => ({ lat: 1, lng: 2 })),
}));

import { ImportTripPanel } from '../ImportTripPanel';

const upload = (content: string, name = 'trip.json', type = 'application/json') => {
  const input = screen.getByTestId('trip-file-input');
  const file = new File([content], name, { type });
  fireEvent.change(input, { target: { files: [file] } });
};

describe('ImportTripPanel', () => {
  it('rejects a non-JSON file and offers no import action', async () => {
    render(<ImportTripPanel />);
    upload('hello', 'notes.txt', 'text/plain');
    expect(await screen.findByText(/only json files/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /import trip/i })).not.toBeInTheDocument();
  });

  it('lists field-path validation errors for an invalid trip file', async () => {
    render(<ImportTripPanel />);
    upload(JSON.stringify({ tripData: { trip_name: '', timezone: 'UTC', stops: [] } }));
    expect(await screen.findByText(/trip_name/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /import trip/i })).not.toBeInTheDocument();
  });

  it('previews a valid file and imports on Import trip', async () => {
    render(<ImportTripPanel />);
    upload(JSON.stringify(danangFile));
    expect(await screen.findByText(/Da Nang/)).toBeInTheDocument();
    expect(screen.getByText(/2 stops/i)).toBeInTheDocument();
    const importButton = screen.getByRole('button', { name: /import trip/i });
    expect(importButton).toBeEnabled();
    fireEvent.click(importButton);
    await waitFor(() =>
      expect(mockMutate).toHaveBeenCalledWith(expect.objectContaining({ trip_name: expect.stringContaining('Da Nang') }))
    );
  });

  it('resets to the preview of a newly dropped file after an error', async () => {
    render(<ImportTripPanel />);
    upload('{broken');
    expect(await screen.findByText(/not valid JSON/i)).toBeInTheDocument();
    upload(JSON.stringify(danangFile));
    expect(await screen.findByText(/Da Nang/)).toBeInTheDocument();
  });
});
