import { z } from 'zod';
import type { AgentTool } from './core.js';

const geocodeSchema = z.object({ address: z.string().min(1) }).strict();

const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

interface GeocodeResponse {
  error_message?: string;
  results: { formatted_address: string; geometry: { location: { lat: number; lng: number } } }[];
  status: string;
}

export function buildGeocodeTool(apiKey: string): AgentTool {
  return {
    name: 'geocode',
    description:
      'Look up coordinates for an address or place name. Returns lat/lng and the formatted address, or found: false when there is no match - then retry with a coarser query (e.g. just the town) before giving up. Required before creating stops: never guess coordinates.',
    schema: geocodeSchema,
    execute: async (_client, input) => {
      const url = `${GEOCODE_URL}?address=${encodeURIComponent(input.address as string)}&key=${apiKey}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Geocoding request failed (HTTP ${response.status})`);
      }
      const data = (await response.json()) as GeocodeResponse;
      const first = data.results?.[0];
      if (data.status === 'OK' && first) {
        return {
          found: true,
          lat: first.geometry.location.lat,
          lng: first.geometry.location.lng,
          formatted_address: first.formatted_address,
        };
      }
      if (data.status === 'ZERO_RESULTS') {
        return { found: false, reason: `No match for "${input.address}"` };
      }
      throw new Error(`Geocoding service error: ${data.status}${data.error_message ? ` - ${data.error_message}` : ''}`);
    },
  };
}
