import { describe, expect, it, vi } from 'vitest';
import { tripitFileSchema } from '@/schemas/tripitSchemas';
import { klTripitFile, zurichTripitFile } from '@/testing/fixtures/tripFiles';
import { parseTripFile, parseTripitDateTime, tripitToTripData } from '../tripImportService';

const geocode = vi.fn(async (address: string) => (address.includes('ZURICH') ? { lat: 47.39, lng: 8.49 } : { lat: 49.35, lng: 8.69 }));

describe('parseTripitDateTime', () => {
  it('parses lodging check-in text', () => {
    expect(parseTripitDateTime('Mon, May 12, 2025 3:00 PM CEST')).toEqual({ date: '2025-05-12', time: '15:00' });
    expect(parseTripitDateTime('Fri, Feb 5, 2027 3:00 PM GMT+8')).toEqual({ date: '2027-02-05', time: '15:00' });
    expect(parseTripitDateTime('Tue, May 13, 2025 12:00 PM CEST')).toEqual({ date: '2025-05-13', time: '12:00' });
  });
  it('returns null for unparseable text', () => {
    expect(parseTripitDateTime('whenever')).toBeNull();
  });
});

describe('tripitToTripData', () => {
  it('converts Zurich: lodgings become geocoded stops, flights become transport activities', async () => {
    const file = tripitFileSchema.parse(zurichTripitFile);
    const { tripData, errors } = await tripitToTripData(file, geocode);
    expect(errors).toEqual([]);
    expect(tripData?.trip_name).toBe('Zurich, Switzerland, May 2025');
    expect(tripData?.stops).toHaveLength(2);

    const [mercure, toskana] = tripData!.stops;
    expect(mercure.name).toBe('Mercure Zurich City');
    expect(mercure.date).toEqual({ from: '2025-05-12', to: '2025-05-13' });
    expect(mercure.location).toEqual({ lat: 47.39, lng: 8.49 });
    expect(mercure.accommodation?.check_in).toBe('2025-05-12 15:00');
    expect(mercure.accommodation?.confirmation).toBe('NBK');
    expect(toskana.accommodation?.url).toBe('http://www.hotel-villa-toskana.de/');

    // LX 177 departs May 11 (before any stop) → nearest stop = Mercure;
    // SQ 325 departs May 16 → contained in Villa Toskana's range.
    const mercureFlights = mercure.activities.filter((a) => a.activity_type === 'transport');
    expect(mercureFlights).toHaveLength(1);
    expect(mercureFlights[0].activity_name).toBe('LX 177: SIN → ZRH');
    const toskanaFlights = toskana.activities.filter((a) => a.activity_type === 'transport');
    expect(toskanaFlights).toHaveLength(1);
    expect(toskanaFlights[0].activity_name).toBe('SQ 325: FRA → SIN');
  });

  it('converts KL: falls back to checkInText when checkIn is null', async () => {
    const file = tripitFileSchema.parse(klTripitFile);
    const { tripData, errors } = await tripitToTripData(file, geocode);
    expect(errors).toEqual([]);
    expect(tripData?.stops[0].date).toEqual({ from: '2027-02-05', to: '2027-02-09' });
    expect(tripData?.stops[0].accommodation?.check_in).toBe('2027-02-05 15:00');
  });

  it('reports a blocking error when geocoding fails', async () => {
    const failingGeocode = vi.fn(async () => null);
    const file = tripitFileSchema.parse(klTripitFile);
    const { tripData, errors } = await tripitToTripData(file, failingGeocode);
    expect(tripData).toBeNull();
    expect(errors[0].message).toMatch(/could not locate/i);
    expect(errors[0].message).toContain('St. Giles Gardens Residences Kuala Lumpur');
  });

  it('errors on a file with no lodging', async () => {
    const file = tripitFileSchema.parse({
      trips: [{ name: 'X', startDate: '2027-01-01', endDate: '2027-01-05', lodging: [], flights: [] }],
    });
    const { errors } = await tripitToTripData(file, geocode);
    expect(errors[0].message).toMatch(/no lodging/i);
  });
});

describe('parseTripFile - tripit path end to end', () => {
  it('produces a preview with fresh ids and a device-timezone warning', async () => {
    const result = await parseTripFile(JSON.stringify(zurichTripitFile), geocode);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.preview.format).toBe('tripit');
      expect(result.preview.stopCount).toBe(2);
      expect(result.preview.tripData.timezone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
      expect(result.preview.warnings.some((w) => w.includes('timezone'))).toBe(true);
      expect(result.preview.tripData.stops[0].stop_id).toMatch(/^[0-9a-f-]{36}$/);
    }
  });
});
