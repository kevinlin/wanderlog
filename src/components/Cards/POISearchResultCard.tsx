import { ClockIcon, GlobeAltIcon, MapIcon, PhoneIcon, StarIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import type React from 'react';
import type { POIDetails } from '@/types/poi';

interface POISearchResultCardProps {
  poi: POIDetails;
  onAddToActivities: (poi: POIDetails) => void;
}

export const POISearchResultCard: React.FC<POISearchResultCardProps> = ({ poi, onAddToActivities }) => {
  const getPhotoUrl = (poi: POIDetails): string | null => {
    if (!poi.photos || poi.photos.length === 0) return null;
    const photo = poi.photos[0];
    return photo.photo_reference || null;
  };

  const renderStarRating = (rating: number, totalRatings?: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(<StarIconSolid className="h-3.5 w-3.5 text-yellow-400" key={i} />);
      } else if (i === fullStars && hasHalfStar) {
        stars.push(
          <div className="relative h-3.5 w-3.5" key={i}>
            <StarIcon className="absolute h-3.5 w-3.5 text-gray-300" />
            <div className="w-1.5 overflow-hidden">
              <StarIconSolid className="absolute h-3.5 w-3.5 text-yellow-400" />
            </div>
          </div>
        );
      } else {
        stars.push(<StarIcon className="h-3.5 w-3.5 text-gray-300" key={i} />);
      }
    }

    return (
      <div className="flex items-center gap-1">
        <div className="flex">{stars}</div>
        <span className="text-gray-600 text-xs">
          {rating.toFixed(1)}
          {totalRatings && ` (${totalRatings})`}
        </span>
      </div>
    );
  };

  const getPriceLevel = (priceLevel?: number): string => {
    if (typeof priceLevel !== 'number') return '';
    return '$'.repeat(priceLevel);
  };

  const getGoogleMapsUrl = (poi: POIDetails): string => {
    if (poi.place_id) {
      return `https://www.google.com/maps/place/?q=place_id:${poi.place_id}`;
    }
    if (poi.location.lat && poi.location.lng) {
      return `https://www.google.com/maps/search/?api=1&query=${poi.location.lat},${poi.location.lng}`;
    }
    const query = poi.formatted_address ? `${poi.name} ${poi.formatted_address}` : poi.name;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  };

  const photoUrl = getPhotoUrl(poi);

  return (
    <div className="overflow-hidden rounded-xl border border-rose-200/50 bg-gradient-to-br from-rose-50/80 to-orange-50/80 shadow-sm transition-all hover:shadow-md">
      {/* Photo Section */}
      {photoUrl && (
        <div className="relative h-32 w-full overflow-hidden">
          <img
            alt={poi.name}
            className="h-full w-full object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.parentElement!.style.display = 'none';
            }}
            src={photoUrl}
          />
          {/* Business Status Badge */}
          {poi.business_status && poi.business_status !== 'OPERATIONAL' && (
            <div className="absolute top-2 left-2">
              <span className="rounded-full bg-yellow-500/90 px-2 py-0.5 text-white text-xs">
                {poi.business_status.replace(/_/g, ' ').toLowerCase()}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Content Section */}
      <div className="p-3">
        {/* Header: Name and Type Tags */}
        <div className="mb-2">
          <h4 className="mb-1 font-semibold text-gray-900">{poi.name}</h4>
          {poi.types && poi.types.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {poi.types.slice(0, 3).map((type, index) => (
                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-rose-700 text-xs" key={index}>
                  {type.replace(/_/g, ' ').toLowerCase()}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Rating and Price Row */}
        <div className="mb-2 flex flex-wrap items-center gap-3">
          {poi.rating && renderStarRating(poi.rating, poi.user_ratings_total)}
          {poi.price_level && <span className="font-medium text-emerald-600 text-sm">{getPriceLevel(poi.price_level)}</span>}
        </div>

        {/* Address */}
        {poi.formatted_address && <p className="mb-2 truncate text-gray-600 text-xs">📍 {poi.formatted_address}</p>}

        {/* Opening Hours Status */}
        {poi.opening_hours && poi.opening_hours.open_now !== undefined && (
          <div className="mb-2 flex items-center gap-2">
            <ClockIcon className="h-3.5 w-3.5 text-gray-500" />
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                poi.opening_hours.open_now ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
              }`}
            >
              {poi.opening_hours.open_now ? 'Open Now' : 'Closed'}
            </span>
          </div>
        )}

        {/* Contact Links */}
        <div className="mb-3 flex flex-wrap items-center gap-3 text-xs">
          {poi.formatted_phone_number && (
            <a className="flex items-center gap-1 text-rose-600 hover:text-rose-700" href={`tel:${poi.formatted_phone_number}`}>
              <PhoneIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Call</span>
            </a>
          )}
          {poi.website && (
            <a
              className="flex items-center gap-1 text-rose-600 hover:text-rose-700"
              href={poi.website}
              rel="noopener noreferrer"
              target="_blank"
            >
              <GlobeAltIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Website</span>
            </a>
          )}
          <a
            className="flex items-center gap-1 text-rose-600 hover:text-rose-700"
            href={getGoogleMapsUrl(poi)}
            rel="noopener noreferrer"
            target="_blank"
          >
            <MapIcon className="h-3.5 w-3.5" />
            <span>Maps</span>
          </a>
        </div>

        {/* Add to Activities Button */}
        <button
          className="min-h-[36px] w-full touch-manipulation rounded-lg border border-emerald-500/30 bg-emerald-500/20 px-3 py-2 font-medium text-emerald-700 text-sm transition-all hover:bg-emerald-500/30 hover:shadow-sm active:bg-emerald-500/40"
          onClick={() => onAddToActivities(poi)}
        >
          ➕ Add to Activities
        </button>
      </div>
    </div>
  );
};
