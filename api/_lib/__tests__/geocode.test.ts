import { afterEach, describe, expect, it, vi } from 'vitest';
import { dispatchTool } from '../tools';
import { buildGeocodeTool } from '../tools/geocode';
import { createFakeClient } from './fakeSupabaseClient';

const { client } = createFakeClient([]);
const tool = buildGeocodeTool('geo-key');

const geoResponse = (body: unknown, ok = true, status = 200) => ({ ok, status, json: async () => body }) as Response;

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

afterEach(() => fetchMock.mockReset());

describe('geocode', () => {
  it('returns coordinates and the formatted address on a match', async () => {
    fetchMock.mockResolvedValue(
      geoResponse({
        status: 'OK',
        results: [{ formatted_address: 'Shinjuku, Tokyo, Japan', geometry: { location: { lat: 35.69, lng: 139.7 } } }],
      })
    );
    const result = await dispatchTool([tool], client, 'geocode', { address: 'Shinjuku, Tokyo' });
    expect(result.isError).toBe(false);
    expect(JSON.parse(result.content)).toEqual({
      found: true,
      lat: 35.69,
      lng: 139.7,
      formatted_address: 'Shinjuku, Tokyo, Japan',
    });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('address=Shinjuku%2C%20Tokyo');
    expect(url).toContain('key=geo-key');
  });

  it('returns found: false (not an error) on ZERO_RESULTS so the model can retry coarser', async () => {
    fetchMock.mockResolvedValue(geoResponse({ status: 'ZERO_RESULTS', results: [] }));
    const result = await dispatchTool([tool], client, 'geocode', { address: 'Atlantis' });
    expect(result.isError).toBe(false);
    expect(JSON.parse(result.content).found).toBe(false);
  });

  it('surfaces service-level failures as tool errors', async () => {
    fetchMock.mockResolvedValue(geoResponse({ status: 'REQUEST_DENIED', error_message: 'bad key', results: [] }));
    const result = await dispatchTool([tool], client, 'geocode', { address: 'Tokyo' });
    expect(result.isError).toBe(true);
    expect(result.content).toContain('REQUEST_DENIED');
  });

  it('surfaces a non-200 HTTP response as a tool error', async () => {
    fetchMock.mockResolvedValue(geoResponse({}, false, 503));
    const result = await dispatchTool([tool], client, 'geocode', { address: 'Tokyo' });
    expect(result.isError).toBe(true);
    expect(result.content).toContain('503');
  });
});
