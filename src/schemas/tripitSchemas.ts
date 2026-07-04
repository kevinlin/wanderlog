import { z } from 'zod';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// TripIt website fields are either a string or a {href, text} object
const websiteSchema = z.union([z.string(), z.object({ href: z.string() }).transform((site) => site.href)]).nullish();

const lodgingSchema = z.object({
  title: z.string().min(1),
  address: z.string().nullish(),
  checkIn: z.string().nullish(),
  checkOut: z.string().nullish(),
  checkInText: z.string().nullish(),
  confirmation: z.string().nullish(),
  phone: z.string().nullish(),
  website: websiteSchema,
  notes: z.string().nullish(),
});

const flightSchema = z.object({
  title: z.string().nullish(),
  flightNumber: z.string().nullish(),
  airline: z.string().nullish(),
  route: z.string().nullish(),
  departureText: z.string().nullish(),
  arrivalText: z.string().nullish(),
  confirmation: z.string().nullish(),
});

const tripitTripSchema = z.object({
  name: z.string().min(1),
  startDate: z.string().regex(DATE_RE, 'expected YYYY-MM-DD'),
  endDate: z.string().regex(DATE_RE, 'expected YYYY-MM-DD'),
  primaryLocation: z.string().nullish(),
  lodging: z.array(lodgingSchema).default([]),
  flights: z.array(flightSchema).default([]),
});

export const tripitFileSchema = z.object({
  trips: z.array(tripitTripSchema).min(1, 'file contains no trips'),
});

export type TripitFile = z.infer<typeof tripitFileSchema>;
export type TripitTrip = TripitFile['trips'][number];
export type TripitLodging = TripitTrip['lodging'][number];
export type TripitFlight = TripitTrip['flights'][number];
