import React from 'react';
import { POIDetails } from '@/types/poi';
import { XMarkIcon, StarIcon, ClockIcon, PhoneIcon, GlobeAltIcon, MapIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';

interface POIModalProps {
  poi: POIDetails | null;
  isOpen: boolean;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onAddToActivities: (poi: POIDetails) => void;
}

export const POIModal: React.FC<POIModalProps> = ({
  poi,
  isOpen,
  loading,
  error,
  onClose,
  onAddToActivities,
}) => {
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
        stars.push(
          <StarIconSolid key={i} className="w-4 h-4 text-yellow-400" />
        );
      } else if (i === fullStars && hasHalfStar) {
        stars.push(
          <div key={i} className="relative w-4 h-4">
            <StarIcon className="w-4 h-4 text-gray-300 absolute" />
            <div className="overflow-hidden w-2">
              <StarIconSolid className="w-4 h-4 text-yellow-400 absolute" />
            </div>
          </div>
        );
      } else {
        stars.push(
          <StarIcon key={i} className="w-4 h-4 text-gray-300" />
        );
      }
    }

    return (
      <div className="flex items-center space-x-1">
        <div className="flex">{stars}</div>
        <span className="text-sm text-gray-600">
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
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Place Details</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <XMarkIcon className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
          {loading && (
            <div className="p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading place details...</p>
            </div>
          )}

          {error && (
            <div className="p-6 text-center">
              <p className="text-red-600 mb-4">{error}</p>
              <button
                onClick={onClose}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
              >
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
                    src={getPhotoUrl(poi)!}
                    alt={poi.name}
                    className="w-full h-48 object-cover rounded-lg"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                </div>
              )}

              {/* Name and Type */}
              <div className="mb-4">
                <h4 className="text-xl font-semibold text-gray-900 mb-2">
                  {poi.name}
                </h4>
                {poi.types && poi.types.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {poi.types.slice(0, 3).map((type, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-sky-100 text-sky-800 text-xs rounded-full"
                      >
                        {type.replace(/_/g, ' ').toLowerCase()}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Address */}
              {poi.formatted_address && (
                <div className="mb-4">
                  <p className="text-sm text-gray-600">
                    📍 {poi.formatted_address}
                  </p>
                </div>
              )}

              {/* Rating and Price */}
              <div className="mb-4 space-y-2">
                {poi.rating && poi.user_ratings_total && (
                  <div>
                    {renderStarRating(poi.rating, poi.user_ratings_total)}
                  </div>
                )}
                {poi.price_level && (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500 font-medium">Price:</span>
                    <span className="text-sm text-green-600 font-medium">
                      {getPriceLevel(poi.price_level)}
                    </span>
                  </div>
                )}
              </div>

              {/* Opening Hours */}
              {poi.opening_hours && (
                <div className="mb-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <ClockIcon className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">Hours</span>
                    {poi.opening_hours.open_now !== undefined && (
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        poi.opening_hours.open_now 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {poi.opening_hours.open_now ? 'Open Now' : 'Closed'}
                      </span>
                    )}
                  </div>
                  {poi.opening_hours.weekday_text && (
                    <div className="text-xs text-gray-600 space-y-1">
                      {poi.opening_hours.weekday_text.slice(0, 3).map((day, index) => (
                        <div key={index}>{day}</div>
                      ))}
                      {poi.opening_hours.weekday_text.length > 3 && (
                        <div className="text-gray-500 italic">...</div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Contact Info */}
              <div className="mb-4 space-y-2">
                {poi.formatted_phone_number && (
                  <div className="flex items-center space-x-2">
                    <PhoneIcon className="w-4 h-4 text-gray-500" />
                    <a
                      href={`tel:${poi.formatted_phone_number}`}
                      className="text-sm text-sky-600 hover:text-sky-700"
                    >
                      {poi.formatted_phone_number}
                    </a>
                  </div>
                )}
                {poi.website && (
                  <div className="flex items-center space-x-2">
                    <GlobeAltIcon className="w-4 h-4 text-gray-500" />
                    <a
                      href={poi.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-sky-600 hover:text-sky-700 truncate"
                    >
                      Visit Website
                    </a>
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <MapIcon className="w-4 h-4 text-gray-500" />
                  <a
                    href={getGoogleMapsUrl(poi)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-sky-600 hover:text-sky-700"
                  >
                    Open in Google Maps
                  </a>
                </div>
              </div>

              {/* Business Status */}
              {poi.business_status && poi.business_status !== 'OPERATIONAL' && (
                <div className="mb-4">
                  <span className="inline-block px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                    {poi.business_status.replace(/_/g, ' ').toLowerCase()}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {poi && !loading && !error && (
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={onClose}
                className="flex-1 bg-gray-500 hover:bg-gray-600 active:bg-gray-700 text-white px-4 py-2 rounded transition-colors touch-manipulation min-h-[44px]"
              >
                Close
              </button>
              <button
                onClick={handleAddToActivities}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white px-4 py-2 rounded transition-colors touch-manipulation min-h-[44px] font-medium"
              >
                ➕ Add to Activities
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
