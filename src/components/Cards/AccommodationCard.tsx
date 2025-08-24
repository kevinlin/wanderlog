import React from 'react';
import { Accommodation } from '@/types';

interface AccommodationCardProps {
  accommodation: Accommodation;
  stopName: string;
}

export const AccommodationCard: React.FC<AccommodationCardProps> = ({
  accommodation,
  stopName,
}) => {
  const checkInDate = new Date(accommodation.check_in);
  const checkOutDate = new Date(accommodation.check_out);

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-4 border-l-4 border-alpine-teal">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {accommodation.name}
          </h3>
          <p className="text-sm text-gray-600 mb-2">{stopName}</p>
          <p className="text-sm text-gray-700 mb-3">{accommodation.address}</p>
          
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div>
              <p className="text-xs text-gray-500 font-medium">Check-in</p>
              <p className="text-sm text-gray-900">
                {checkInDate.toLocaleDateString('en-NZ', { 
                  weekday: 'short',
                  month: 'short', 
                  day: 'numeric' 
                })}
              </p>
              <p className="text-sm text-gray-700">
                {checkInDate.toLocaleTimeString('en-NZ', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Check-out</p>
              <p className="text-sm text-gray-900">
                {checkOutDate.toLocaleDateString('en-NZ', { 
                  weekday: 'short',
                  month: 'short', 
                  day: 'numeric' 
                })}
              </p>
              <p className="text-sm text-gray-700">
                {checkOutDate.toLocaleTimeString('en-NZ', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </p>
            </div>
          </div>

          {accommodation.confirmation && (
            <div className="mb-3">
              <p className="text-xs text-gray-500 font-medium">Confirmation</p>
              <p className="text-sm text-gray-900 font-mono">{accommodation.confirmation}</p>
            </div>
          )}

          {accommodation.room && (
            <div className="mb-3">
              <p className="text-xs text-gray-500 font-medium">Room</p>
              <p className="text-sm text-gray-900">{accommodation.room}</p>
            </div>
          )}

          {accommodation.phone && (
            <div className="mb-3">
              <p className="text-xs text-gray-500 font-medium">Phone</p>
              <a 
                href={`tel:${accommodation.phone}`}
                className="text-sm text-alpine-teal hover:underline"
              >
                {accommodation.phone}
              </a>
            </div>
          )}
        </div>

        {accommodation.thumbnail_url && (
          <div className="ml-4 flex-shrink-0">
            <img 
              src={accommodation.thumbnail_url} 
              alt={accommodation.name}
              className="w-20 h-20 object-cover rounded-lg"
            />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <a
          href={accommodation.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-alpine-teal hover:text-opacity-80 text-sm font-medium"
        >
          View Website →
        </a>
        
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(accommodation.address)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded text-sm transition-colors"
        >
          📍 Directions
        </a>
      </div>
    </div>
  );
};
