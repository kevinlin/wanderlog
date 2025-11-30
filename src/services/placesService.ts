import type { POIDetails } from '@/types/poi';

/**
 * Service for interacting with Google Places API
 */
export class PlacesService {
  private static instance: PlacesService;
  private placesService: google.maps.places.PlacesService | null = null;

  private constructor() {}

  static getInstance(): PlacesService {
    if (!PlacesService.instance) {
      PlacesService.instance = new PlacesService();
    }
    return PlacesService.instance;
  }

  /**
   * Initialize the Places service with a map instance
   */
  initialize(map: google.maps.Map): void {
    this.placesService = new google.maps.places.PlacesService(map);
  }

  /**
   * Get place details by place ID
   */
  async getPlaceDetails(placeId: string): Promise<POIDetails> {
    return new Promise((resolve, reject) => {
      if (!this.placesService) {
        reject(new Error('Places service not initialized'));
        return;
      }

      const request: google.maps.places.PlaceDetailsRequest = {
        placeId,
        fields: [
          'place_id',
          'name',
          'formatted_address',
          'geometry',
          'types',
          'rating',
          'user_ratings_total',
          'price_level',
          'opening_hours',
          'photos',
          'website',
          'formatted_phone_number',
          'international_phone_number',
          'business_status',
          'vicinity',
          'icon',
          'icon_background_color',
          'icon_mask_base_uri',
        ],
      };

      this.placesService.getDetails(request, (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place) {
          const poiDetails: POIDetails = {
            place_id: place.place_id || placeId,
            name: place.name || 'Unknown Place',
            formatted_address: place.formatted_address,
            location: {
              lat: place.geometry?.location?.lat() || 0,
              lng: place.geometry?.location?.lng() || 0,
            },
            types: place.types,
            rating: place.rating,
            user_ratings_total: place.user_ratings_total,
            price_level: place.price_level,
            opening_hours: place.opening_hours
              ? {
                  open_now: place.opening_hours.open_now,
                  periods: place.opening_hours.periods,
                  weekday_text: place.opening_hours.weekday_text,
                }
              : undefined,
            photos: place.photos?.map((photo) => ({
              photo_reference: photo.getUrl({ maxWidth: 400 }),
              height: photo.height,
              width: photo.width,
            })),
            website: place.website,
            formatted_phone_number: place.formatted_phone_number,
            international_phone_number: place.international_phone_number,
            business_status: place.business_status,
            geometry: place.geometry
              ? {
                  location: {
                    lat: place.geometry.location?.lat() || 0,
                    lng: place.geometry.location?.lng() || 0,
                  },
                  viewport: place.geometry.viewport
                    ? {
                        northeast: {
                          lat: place.geometry.viewport.getNorthEast().lat(),
                          lng: place.geometry.viewport.getNorthEast().lng(),
                        },
                        southwest: {
                          lat: place.geometry.viewport.getSouthWest().lat(),
                          lng: place.geometry.viewport.getSouthWest().lng(),
                        },
                      }
                    : undefined,
                }
              : undefined,
            vicinity: place.vicinity,
            icon: place.icon,
            icon_background_color: place.icon_background_color,
            icon_mask_base_uri: place.icon_mask_base_uri,
          };

          resolve(poiDetails);
        } else {
          reject(new Error(`Failed to get place details: ${status}`));
        }
      });
    });
  }

  /**
   * Search for nearby places
   */
  async searchNearby(
    location: google.maps.LatLng | google.maps.LatLngLiteral,
    radius = 1000,
    type?: string
  ): Promise<google.maps.places.PlaceResult[]> {
    return new Promise((resolve, reject) => {
      if (!this.placesService) {
        reject(new Error('Places service not initialized'));
        return;
      }

      const request: google.maps.places.PlaceSearchRequest = {
        location,
        radius,
        type,
      };

      this.placesService.nearbySearch(request, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          resolve(results);
        } else {
          reject(new Error(`Failed to search nearby places: ${status}`));
        }
      });
    });
  }

  /**
   * Text search for places
   */
  async textSearch(query: string): Promise<google.maps.places.PlaceResult[]> {
    return new Promise((resolve, reject) => {
      if (!this.placesService) {
        reject(new Error('Places service not initialized'));
        return;
      }

      const request: google.maps.places.TextSearchRequest = {
        query,
      };

      this.placesService.textSearch(request, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          resolve(results);
        } else {
          reject(new Error(`Failed to search places: ${status}`));
        }
      });
    });
  }
}
