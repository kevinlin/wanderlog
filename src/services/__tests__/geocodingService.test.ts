import { afterEach, describe, expect, it, vi } from 'vitest';
import { geocodeAddress } from '../geocodingService';

const mockGeocode = vi.fn();

const stubGoogle = () => {
  vi.stubGlobal('google', {
    maps: {
      Geocoder: class {
        geocode = mockGeocode;
      },
    },
  });
};

afterEach(() => vi.unstubAllGlobals());

describe('geocodeAddress', () => {
  it('returns coordinates for the first result', async () => {
    stubGoogle();
    mockGeocode.mockResolvedValue({
      results: [{ geometry: { location: { lat: () => 47.39, lng: () => 8.49 } } }],
    });
    expect(await geocodeAddress('Vulkanstrasse 108b, Zurich')).toEqual({ lat: 47.39, lng: 8.49 });
    expect(mockGeocode).toHaveBeenCalledWith({ address: 'Vulkanstrasse 108b, Zurich' });
  });

  it('returns null when geocoding rejects (ZERO_RESULTS)', async () => {
    stubGoogle();
    mockGeocode.mockRejectedValue(new Error('ZERO_RESULTS'));
    expect(await geocodeAddress('nowhere')).toBeNull();
  });
});
