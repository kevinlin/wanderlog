import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { POIDetails } from '@/types/poi';
import { POISearchResultCard } from '../POISearchResultCard';

describe('POISearchResultCard', () => {
  const mockOnAddToActivities = vi.fn();

  const basePOI: POIDetails = {
    place_id: 'test_place_1',
    name: 'Test Restaurant',
    formatted_address: '123 Test Street, Test City',
    location: { lat: -44.5, lng: 170.0 },
    types: ['restaurant', 'food', 'establishment'],
    rating: 4.5,
    user_ratings_total: 150,
    price_level: 2,
    opening_hours: {
      open_now: true,
      weekday_text: ['Monday: 9:00 AM – 10:00 PM'],
    },
    photos: [
      {
        photo_reference: 'https://example.com/photo.jpg',
        height: 400,
        width: 600,
      },
    ],
    formatted_phone_number: '+1 234 567 8900',
    website: 'https://example.com',
    business_status: 'OPERATIONAL',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic rendering', () => {
    it('should render place name', () => {
      render(<POISearchResultCard onAddToActivities={mockOnAddToActivities} poi={basePOI} />);

      expect(screen.getByText('Test Restaurant')).toBeInTheDocument();
    });

    it('should render formatted address', () => {
      render(<POISearchResultCard onAddToActivities={mockOnAddToActivities} poi={basePOI} />);

      expect(screen.getByText(/123 Test Street, Test City/)).toBeInTheDocument();
    });

    it('should render type tags (max 3)', () => {
      render(<POISearchResultCard onAddToActivities={mockOnAddToActivities} poi={basePOI} />);

      expect(screen.getByText('restaurant')).toBeInTheDocument();
      expect(screen.getByText('food')).toBeInTheDocument();
      expect(screen.getByText('establishment')).toBeInTheDocument();
    });

    it('should render Add to Activities button', () => {
      render(<POISearchResultCard onAddToActivities={mockOnAddToActivities} poi={basePOI} />);

      expect(screen.getByRole('button', { name: /add to activities/i })).toBeInTheDocument();
    });
  });

  describe('Rating display', () => {
    it('should display rating with review count', () => {
      render(<POISearchResultCard onAddToActivities={mockOnAddToActivities} poi={basePOI} />);

      expect(screen.getByText(/4.5/)).toBeInTheDocument();
      expect(screen.getByText(/150/)).toBeInTheDocument();
    });

    it('should not display rating when not available', () => {
      const poiWithoutRating: POIDetails = {
        ...basePOI,
        rating: undefined,
        user_ratings_total: undefined,
      };

      render(<POISearchResultCard onAddToActivities={mockOnAddToActivities} poi={poiWithoutRating} />);

      expect(screen.queryByText(/4.5/)).not.toBeInTheDocument();
    });
  });

  describe('Price level display', () => {
    it('should display price level indicators', () => {
      render(<POISearchResultCard onAddToActivities={mockOnAddToActivities} poi={basePOI} />);

      // Price level 2 = $$
      expect(screen.getByText('$$')).toBeInTheDocument();
    });

    it('should not display price level when not available', () => {
      const poiWithoutPrice: POIDetails = {
        ...basePOI,
        price_level: undefined,
      };

      render(<POISearchResultCard onAddToActivities={mockOnAddToActivities} poi={poiWithoutPrice} />);

      expect(screen.queryByText(/^\$+$/)).not.toBeInTheDocument();
    });
  });

  describe('Opening hours', () => {
    it('should display "Open Now" when open', () => {
      render(<POISearchResultCard onAddToActivities={mockOnAddToActivities} poi={basePOI} />);

      expect(screen.getByText('Open Now')).toBeInTheDocument();
    });

    it('should display "Closed" when not open', () => {
      const closedPOI: POIDetails = {
        ...basePOI,
        opening_hours: {
          open_now: false,
        },
      };

      render(<POISearchResultCard onAddToActivities={mockOnAddToActivities} poi={closedPOI} />);

      expect(screen.getByText('Closed')).toBeInTheDocument();
    });

    it('should not display opening hours when not available', () => {
      const poiWithoutHours: POIDetails = {
        ...basePOI,
        opening_hours: undefined,
      };

      render(<POISearchResultCard onAddToActivities={mockOnAddToActivities} poi={poiWithoutHours} />);

      expect(screen.queryByText('Open Now')).not.toBeInTheDocument();
      expect(screen.queryByText('Closed')).not.toBeInTheDocument();
    });
  });

  describe('Contact links', () => {
    it('should render phone link when available', () => {
      render(<POISearchResultCard onAddToActivities={mockOnAddToActivities} poi={basePOI} />);

      const phoneLink = screen.getByRole('link', { name: /call/i });
      expect(phoneLink).toHaveAttribute('href', 'tel:+1 234 567 8900');
    });

    it('should render website link when available', () => {
      render(<POISearchResultCard onAddToActivities={mockOnAddToActivities} poi={basePOI} />);

      const websiteLink = screen.getByRole('link', { name: /website/i });
      expect(websiteLink).toHaveAttribute('href', 'https://example.com');
      expect(websiteLink).toHaveAttribute('target', '_blank');
    });

    it('should render Google Maps link', () => {
      render(<POISearchResultCard onAddToActivities={mockOnAddToActivities} poi={basePOI} />);

      const mapsLink = screen.getByRole('link', { name: /maps/i });
      expect(mapsLink).toHaveAttribute('href');
      expect(mapsLink.getAttribute('href')).toContain('google.com/maps');
    });

    it('should not render phone link when not available', () => {
      const poiWithoutPhone: POIDetails = {
        ...basePOI,
        formatted_phone_number: undefined,
      };

      render(<POISearchResultCard onAddToActivities={mockOnAddToActivities} poi={poiWithoutPhone} />);

      expect(screen.queryByRole('link', { name: /call/i })).not.toBeInTheDocument();
    });

    it('should not render website link when not available', () => {
      const poiWithoutWebsite: POIDetails = {
        ...basePOI,
        website: undefined,
      };

      render(<POISearchResultCard onAddToActivities={mockOnAddToActivities} poi={poiWithoutWebsite} />);

      expect(screen.queryByRole('link', { name: /website/i })).not.toBeInTheDocument();
    });
  });

  describe('Photo display', () => {
    it('should render photo when available', () => {
      render(<POISearchResultCard onAddToActivities={mockOnAddToActivities} poi={basePOI} />);

      const photo = screen.getByRole('img', { name: basePOI.name });
      expect(photo).toHaveAttribute('src', 'https://example.com/photo.jpg');
    });

    it('should not render photo section when no photos', () => {
      const poiWithoutPhotos: POIDetails = {
        ...basePOI,
        photos: undefined,
      };

      render(<POISearchResultCard onAddToActivities={mockOnAddToActivities} poi={poiWithoutPhotos} />);

      expect(screen.queryByRole('img', { name: basePOI.name })).not.toBeInTheDocument();
    });
  });

  describe('Business status', () => {
    it('should display non-operational business status', () => {
      const closedBusiness: POIDetails = {
        ...basePOI,
        business_status: 'CLOSED_TEMPORARILY',
      };

      render(<POISearchResultCard onAddToActivities={mockOnAddToActivities} poi={closedBusiness} />);

      expect(screen.getByText(/closed temporarily/i)).toBeInTheDocument();
    });

    it('should not display business status when operational', () => {
      render(<POISearchResultCard onAddToActivities={mockOnAddToActivities} poi={basePOI} />);

      expect(screen.queryByText(/operational/i)).not.toBeInTheDocument();
    });
  });

  describe('Add to Activities interaction', () => {
    it('should call onAddToActivities when button is clicked', () => {
      render(<POISearchResultCard onAddToActivities={mockOnAddToActivities} poi={basePOI} />);

      const addButton = screen.getByRole('button', { name: /add to activities/i });
      fireEvent.click(addButton);

      expect(mockOnAddToActivities).toHaveBeenCalledTimes(1);
      expect(mockOnAddToActivities).toHaveBeenCalledWith(basePOI);
    });
  });

  describe('Google Maps URL generation', () => {
    it('should generate URL with place_id when available', () => {
      render(<POISearchResultCard onAddToActivities={mockOnAddToActivities} poi={basePOI} />);

      const mapsLink = screen.getByRole('link', { name: /maps/i });
      expect(mapsLink.getAttribute('href')).toContain(basePOI.place_id);
    });

    it('should fall back to coordinates when place_id not available', () => {
      const poiWithoutPlaceId: POIDetails = {
        ...basePOI,
        place_id: '',
      };

      render(<POISearchResultCard onAddToActivities={mockOnAddToActivities} poi={poiWithoutPlaceId} />);

      const mapsLink = screen.getByRole('link', { name: /maps/i });
      const href = mapsLink.getAttribute('href');
      expect(href).toContain('-44.5');
      expect(href).toContain('170');
    });
  });

  describe('Minimal POI data', () => {
    it('should render with minimal required data', () => {
      const minimalPOI: POIDetails = {
        place_id: 'minimal_place',
        name: 'Minimal Place',
        location: { lat: -44.5, lng: 170.0 },
      };

      render(<POISearchResultCard onAddToActivities={mockOnAddToActivities} poi={minimalPOI} />);

      expect(screen.getByText('Minimal Place')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add to activities/i })).toBeInTheDocument();
    });
  });
});
