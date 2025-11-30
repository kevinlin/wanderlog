import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import type React from 'react';
import { useState } from 'react';
import { ImageViewerModal } from '@/components/Layout/ImageViewerModal';
import { LocationWarning } from '@/components/Layout/LocationWarning';
import type { Accommodation } from '@/types';
import { generateGoogleMapsPlaceUrl } from '@/utils/tripUtils';
import { accommodationHasLocationIssues } from '@/utils/validationUtils';

interface AccommodationCardProps {
  accommodation: Accommodation;
  stopName: string;
}

export const AccommodationCard: React.FC<AccommodationCardProps> = ({ accommodation, stopName }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const showLocationWarning = accommodationHasLocationIssues(accommodation);
  const checkInDate = new Date(accommodation.check_in);
  const checkOutDate = new Date(accommodation.check_out);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="rounded-lg border-sky-500 border-l-4 bg-white p-3 shadow-md sm:p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="mb-1 font-semibold text-base text-gray-900 sm:text-lg">{accommodation.name}</h3>
          <p className="mb-2 text-gray-600 text-sm">{stopName}</p>
          {isExpanded && (
            <>
              <p className="mb-2 text-gray-700 text-sm">{accommodation.address}</p>

              <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-4">
                <div>
                  <p className="font-medium text-gray-500 text-xs">Check-in</p>
                  <p className="text-gray-900 text-sm">
                    {checkInDate.toLocaleDateString('en-NZ', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                  <p className="text-gray-700 text-sm">
                    {checkInDate.toLocaleTimeString('en-NZ', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-gray-500 text-xs">Check-out</p>
                  <p className="text-gray-900 text-sm">
                    {checkOutDate.toLocaleDateString('en-NZ', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                  <p className="text-gray-700 text-sm">
                    {checkOutDate.toLocaleTimeString('en-NZ', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>

              {accommodation.confirmation && (
                <div className="mb-2">
                  <p className="font-medium text-gray-500 text-xs">Confirmation</p>
                  <p className="font-mono text-gray-900 text-sm">{accommodation.confirmation}</p>
                </div>
              )}

              {accommodation.room && (
                <div className="mb-2">
                  <p className="font-medium text-gray-500 text-xs">Room</p>
                  <p className="text-gray-900 text-sm">{accommodation.room}</p>
                </div>
              )}

              {accommodation.phone && (
                <div className="mb-2">
                  <p className="font-medium text-gray-500 text-xs">Phone</p>
                  <a className="text-sky-500 text-sm hover:text-sky-600 hover:underline" href={`tel:${accommodation.phone}`}>
                    {accommodation.phone}
                  </a>
                </div>
              )}

              {accommodation.host && (
                <div className="mb-2">
                  <p className="font-medium text-gray-500 text-xs">Host</p>
                  <p className="text-gray-900 text-sm">{accommodation.host}</p>
                </div>
              )}

              {accommodation.rooms && (
                <div className="mb-2">
                  <p className="font-medium text-gray-500 text-xs">Rooms</p>
                  <p className="text-gray-900 text-sm">{accommodation.rooms}</p>
                </div>
              )}

              {/* Location warning */}
              {showLocationWarning && (
                <div className="mb-2">
                  <LocationWarning
                    message="This accommodation cannot be displayed on the map due to missing or invalid location data."
                    type="accommodation"
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Toggle Button */}
        <div className="ml-3 flex-shrink-0 sm:ml-4">
          <button
            aria-label={isExpanded ? 'Collapse accommodation details' : 'Expand accommodation details'}
            className="min-h-[30px] min-w-[44px] touch-manipulation rounded-lg p-2 transition-colors hover:bg-sky-500/20 active:bg-sky-500/30"
            onClick={toggleExpanded}
          >
            {isExpanded ? <ChevronUpIcon className="h-5 w-5 text-gray-600" /> : <ChevronDownIcon className="h-5 w-5 text-gray-600" />}
          </button>
          {accommodation.thumbnail_url && isExpanded && (
            <img
              alt={accommodation.name}
              className="mt-2 h-16 w-16 cursor-pointer rounded-lg object-cover transition-transform hover:scale-105"
              onClick={() => setIsImageViewerOpen(true)}
              src={accommodation.thumbnail_url}
            />
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="flex gap-2 border-gray-100 border-t pt-2">
          <a
            className="flex min-h-[30px] flex-1 touch-manipulation items-center justify-center rounded border border-sky-200 font-medium text-sky-500 text-sm transition-colors hover:border-sky-300 hover:text-sky-600 active:text-sky-700"
            href={accommodation.url}
            rel="noopener noreferrer"
            target="_blank"
          >
            📋 Details
          </a>

          {accommodation.google_place_id && (
            <a
              className="flex min-h-[30px] flex-1 touch-manipulation items-center justify-center rounded border border-sky-200 font-medium text-sky-500 text-sm transition-colors hover:border-sky-300 hover:text-sky-600 active:text-sky-700"
              href={generateGoogleMapsPlaceUrl(accommodation.google_place_id, accommodation.name)}
              rel="noopener noreferrer"
              target="_blank"
            >
              📍 Maps
            </a>
          )}

          <a
            className="flex min-h-[30px] flex-1 touch-manipulation items-center justify-center rounded bg-sky-500 px-3 py-2 text-sm text-white transition-colors hover:bg-sky-600 active:bg-sky-700"
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(accommodation.address)}`}
            rel="noopener noreferrer"
            target="_blank"
          >
            🧭 Direction
          </a>
        </div>
      )}

      {/* Image Viewer Modal */}
      {accommodation.thumbnail_url && (
        <ImageViewerModal
          altText={accommodation.name}
          imageUrl={accommodation.thumbnail_url}
          isOpen={isImageViewerOpen}
          onClose={() => setIsImageViewerOpen(false)}
        />
      )}
    </div>
  );
};
