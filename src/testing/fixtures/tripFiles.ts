// Trimmed from local/trip-data/202606_DaNang_trip-plan.json (native export wrapper)
export const danangFile = {
  exportDate: '2026-05-29T00:00:00.000Z',
  tripData: {
    trip_name: 'Da Nang, Vietnam — May 30 to Jun 7, 2026',
    timezone: 'Asia/Ho_Chi_Minh',
    created_at: '2026-05-29T08:00:00.000Z',
    stops: [
      {
        stop_id: 'grand-mercure-danang',
        name: 'Grand Mercure Danang',
        date: { from: '2026-05-30', to: '2026-05-31' },
        duration_days: 1,
        location: { lat: 16.048_341_5, lng: 108.226_704_1 },
        accommodation: {
          name: 'Grand Mercure Danang',
          address: 'Lot A1 Zone of the Villas, Green Island, Danang, Vietnam',
          check_in: '2026-05-30 14:00',
          check_out: '2026-05-31 12:00',
          phone: '+84 2363797777',
        },
        activities: [
          {
            activity_id: 'dragon_bridge',
            activity_name: 'Dragon Bridge (Cau Rong)',
            activity_type: 'attraction',
            duration: '~1h',
            location: { lat: 16.061_11, lng: 108.226_67, address: 'Dragon Bridge, Da Nang' },
            order: 2,
            status: { done: false },
            url: '',
          },
        ],
        scenic_waypoints: [],
      },
      {
        stop_id: 'mercure-bana-hills',
        name: 'Mercure Danang French Village Bana Hills',
        date: { from: '2026-05-31', to: '2026-06-02' },
        duration_days: 2,
        location: { lat: 16.045_199_8, lng: 108.113_221_2 },
        activities: [],
      },
    ],
  },
};

// Trimmed from local/trip-data/202505_tripit-zurich-switzerland.json
export const zurichTripitFile = {
  exportDate: '2026-07-04T01:00:00.000Z',
  trips: [
    {
      uuid: '43b83ff3',
      name: 'Zurich, Switzerland, May 2025',
      startDate: '2025-05-11',
      endDate: '2025-05-17',
      primaryLocation: 'Zurich, Switzerland',
      lodging: [
        {
          title: 'Mercure Zurich City',
          address: 'Vulkanstrasse 108b - 8048 ZURICH - Switzerland',
          checkIn: 'Mon, May 12, 2025 3:00 PM CEST',
          checkOut: 'Tue, May 13, 2025 12:00 PM CEST',
          confirmation: 'NBK',
          phone: '+41 435231200',
          website: null,
          notes: 'The 19m² comfort room with double bed.',
        },
        {
          title: 'Hotel Villa Toskana',
          address: 'Hauptstrasse 5, Leimen, Germany',
          checkIn: 'Tue, May 13, 2025 3:00 PM CEST',
          checkOut: 'Fri, May 16, 2025 11:00 AM CEST',
          confirmation: '87201',
          phone: '06224 82920',
          website: { href: 'http://www.hotel-villa-toskana.de/', text: 'http://www.hotel-villa-toskana.de/' },
        },
      ],
      flights: [
        {
          title: 'SIN ZRH',
          flightNumber: 'LX 177',
          airline: 'Swiss',
          route: 'SIN ZRH',
          departureText: 'Singapore May 11Terminal 2 11:30 PM GMT+8',
          arrivalText: 'Zurich May 12 6:15 AM CEST',
          confirmation: '5WK8OF',
        },
        {
          title: 'FRA SIN',
          flightNumber: 'SQ 325',
          airline: 'Singapore Airlines',
          route: 'FRA SIN',
          departureText: 'Frankfurt May 16Terminal 1•Gate B46 9:40 PM CEST',
          arrivalText: 'Singapore May 17Terminal 3•Gate B4 4:05 PM GMT+8',
          confirmation: '5WK8OF',
        },
      ],
      activities: [],
      restaurants: [],
      transport: [],
      rail: [],
    },
  ],
};

// Trimmed from local/trip-data/202702_tripit-kuala-lumpur.json - lodging has NO checkIn/checkOut,
// only checkInText; exercises the fallback parse.
export const klTripitFile = {
  exportDate: '2026-07-04T01:13:41.248Z',
  trips: [
    {
      uuid: '43b83ff3-kl',
      name: 'Kuala Lumpur, Malaysia, February 2027',
      startDate: '2027-02-05',
      endDate: '2027-02-09',
      primaryLocation: 'Kuala Lumpur, Malaysia',
      lodging: [
        {
          title: 'St. Giles Gardens Residences Kuala Lumpur',
          address: 'Lingkaran Syed Putra, Kuala Lumpur, Malaysia, 59200',
          checkIn: null,
          checkOut: null,
          checkInText: 'Check in Fri, Feb 5, 2027 3:00 PM GMT+8 Check out Tue, Feb 9, 2027 11:00 AM GMT+8',
          confirmation: '2024636927',
          website: null,
        },
      ],
      flights: [],
    },
  ],
};
