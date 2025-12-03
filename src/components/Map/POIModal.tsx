import { ClockIcon, GlobeAltIcon, MapIcon, PhoneIcon, StarIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import type React from 'react';
import type { POIDetails } from '@/types/poi';

interface POIModalProps {
  poi: POIDetails | null;
  isOpen: boolean;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onAddToActivities: (poi: POIDetails) => void;
  onAddToScenicWaypoints: (poi: POIDetails) => void;
}

export const POIModal: React.FC<POIModalProps> = ({ poi, isOpen, loading, error, onClose, onAddToActivities, onAddToScenicWaypoints }) => {
  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleAddToActivities = () => {
    if (poi) {
      onAddToActivities(poi);
      onClose();
    }
  };

  const handleAddToScenicWaypoints = () => {
    if (poi) {
      onAddToScenicWaypoints(poi);
      onClose();
    }
  };

  const getPhotoUrl = (poi: POIDetails): string | null => {
    if (!poi.photos || poi.photos.length === 0) return null;

    const photo = poi.photos[0];
    // The photo_reference now contains the full URL from Google Places API
    return photo.photo_reference || null;
  };

  const renderStarRating = (rating: number, totalRatings: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(<StarIconSolid className="h-4 w-4 text-yellow-400" key={i} />);
      } else if (i === fullStars && hasHalfStar) {
        stars.push(
          <div className="relative h-4 w-4" key={i}>
            <StarIcon className="absolute h-4 w-4 text-gray-300" />
            <div className="w-2 overflow-hidden">
              <StarIconSolid className="absolute h-4 w-4 text-yellow-400" />
            </div>
          </div>
        );
      } else {
        stars.push(<StarIcon className="h-4 w-4 text-gray-300" key={i} />);
      }
    }

    return (
      <div className="flex items-center space-x-1">
        <div className="flex">{stars}</div>
        <span className="text-gray-600 text-sm">
          {rating.toFixed(1)} ({totalRatings} reviews)
        </span>
      </div>
    );
  };

  const getPriceLevel = (priceLevel?: number): string => {
    if (typeof priceLevel !== 'number') return '';
    return '$'.repeat(priceLevel);
  };

  const getGoogleMapsUrl = (poi: POIDetails): string => {
    // Create Google Maps URL using place_id for most accurate results
    if (poi.place_id) {
      return `https://www.google.com/maps/place/?q=place_id:${poi.place_id}`;
    }

    // Fallback to coordinates if place_id is not available
    if (poi.location.lat && poi.location.lng) {
      return `https://www.google.com/maps/search/?api=1&query=${poi.location.lat},${poi.location.lng}`;
    }

    // Final fallback to search by name and address
    const query = poi.formatted_address ? `${poi.name} ${poi.formatted_address}` : poi.name;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4" onClick={handleBackdropClick}>
      <div className="max-h-[90vh] w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-gray-200 border-b p-4">
          <h3 className="font-semibold text-gray-900 text-lg">Place Details</h3>
          <button className="rounded-full p-1 transition-colors hover:bg-gray-100" onClick={onClose}>
            <XMarkIcon className="h-6 w-6 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[calc(90vh-140px)] overflow-y-auto">
          {loading && (
            <div className="p-6 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-sky-500 border-b-2" />
              <p className="mt-2 text-gray-600">Loading place details...</p>
            </div>
          )}

          {error && (
            <div className="p-6 text-center">
              <p className="mb-4 text-red-600">{error}</p>
              <button className="rounded bg-gray-500 px-4 py-2 text-white transition-colors hover:bg-gray-600" onClick={onClose}>
                Close
              </button>
            </div>
          )}

          {poi && !loading && !error && (
            <div className="p-4">
              {/* Photo */}
              {getPhotoUrl(poi) && (
                <div className="mb-4">
                  <img
                    alt={poi.name}
                    className="h-48 w-full rounded-lg object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                    src={getPhotoUrl(poi)!}
                  />
                </div>
              )}

              {/* Name and Type */}
              <div className="mb-4">
                <h4 className="mb-2 font-semibold text-gray-900 text-xl">{poi.name}</h4>
                {poi.types && poi.types.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1">
                    {poi.types.slice(0, 3).map((type, index) => (
                      <span className="rounded-full bg-sky-100 px-2 py-1 text-sky-800 text-xs" key={index}>
                        {type.replace(/_/g, ' ').toLowerCase()}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Address */}
              {poi.formatted_address && (
                <div className="mb-4">
                  <p className="text-gray-600 text-sm">📍 {poi.formatted_address}</p>
                </div>
              )}

              {/* Rating and Price */}
              <div className="mb-4 space-y-2">
                {poi.rating && poi.user_ratings_total && <div>{renderStarRating(poi.rating, poi.user_ratings_total)}</div>}
                {poi.price_level && (
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-gray-500 text-sm">Price:</span>
                    <span className="font-medium text-green-600 text-sm">{getPriceLevel(poi.price_level)}</span>
                  </div>
                )}
              </div>

              {/* Opening Hours */}
              {poi.opening_hours && (
                <div className="mb-4">
                  <div className="mb-2 flex items-center space-x-2">
                    <ClockIcon className="h-4 w-4 text-gray-500" />
                    <span className="font-medium text-gray-700 text-sm">Hours</span>
                    {poi.opening_hours.open_now !== undefined && (
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${
                          poi.opening_hours.open_now ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {poi.opening_hours.open_now ? 'Open Now' : 'Closed'}
                      </span>
                    )}
                  </div>
                  {poi.opening_hours.weekday_text && (
                    <div className="space-y-1 text-gray-600 text-xs">
                      {poi.opening_hours.weekday_text.slice(0, 3).map((day, index) => (
                        <div key={index}>{day}</div>
                      ))}
                      {poi.opening_hours.weekday_text.length > 3 && <div className="text-gray-500 italic">...</div>}
                    </div>
                  )}
                </div>
              )}

              {/* Contact Info */}
              <div className="mb-4 space-y-2">
                {poi.formatted_phone_number && (
                  <div className="flex items-center space-x-2">
                    <PhoneIcon className="h-4 w-4 text-gray-500" />
                    <a className="text-sky-600 text-sm hover:text-sky-700" href={`tel:${poi.formatted_phone_number}`}>
                      {poi.formatted_phone_number}
                    </a>
                  </div>
                )}
                {poi.website && (
                  <div className="flex items-center space-x-2">
                    <GlobeAltIcon className="h-4 w-4 text-gray-500" />
                    <a
                      className="truncate text-sky-600 text-sm hover:text-sky-700"
                      href={poi.website}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      Visit Website
                    </a>
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <MapIcon className="h-4 w-4 text-gray-500" />
                  <a
                    className="text-sky-600 text-sm hover:text-sky-700"
                    href={getGoogleMapsUrl(poi)}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Open in Google Maps
                  </a>
                </div>
              </div>

              {/* Business Status */}
              {poi.business_status && poi.business_status !== 'OPERATIONAL' && (
                <div className="mb-4">
                  <span className="inline-block rounded-full bg-yellow-100 px-2 py-1 text-xs text-yellow-800">
                    {poi.business_status.replace(/_/g, ' ').toLowerCase()}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {poi && !loading && !error && (
          <div className="border-gray-200 border-t bg-gray-50 p-4">
            <div className="flex gap-2">
              <button
                className="min-h-[44px] flex-1 touch-manipulation rounded bg-gray-500 px-4 py-2 text-white transition-colors hover:bg-gray-600 active:bg-gray-700"
                onClick={onClose}
              >
                Close
              </button>
              <button
                className="min-h-[44px] flex-1 touch-manipulation rounded bg-violet-500 px-3 py-2 font-medium text-white transition-colors hover:bg-violet-600 active:bg-violet-700"
                onClick={handleAddToScenicWaypoints}
                title="Add as a scenic waypoint"
              >
                🏞️ Scenic
              </button>
              <button
                className="min-h-[44px] flex-1 touch-manipulation rounded bg-emerald-500 px-3 py-2 font-medium text-white transition-colors hover:bg-emerald-600 active:bg-emerald-700"
                onClick={handleAddToActivities}
                title="Add as an activity"
              >
                ➕ Activity
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
