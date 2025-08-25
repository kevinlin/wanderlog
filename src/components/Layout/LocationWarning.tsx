import React from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface LocationWarningProps {
  type: 'activity' | 'accommodation';
  message?: string;
  className?: string;
}

export const LocationWarning: React.FC<LocationWarningProps> = ({
  type,
  message,
  className = '',
}) => {
  const defaultMessage = type === 'activity' 
    ? 'Location data is missing or invalid. Please check the address information for this activity.'
    : 'Location data is missing or invalid. Please check the address information for this accommodation.';

  const suggestions = type === 'activity'
    ? 'Try adding valid coordinates or a complete address to display this activity on the map.'
    : 'Try adding valid coordinates or a complete address to display this accommodation on the map.';

  return (
    <div className={`flex items-start space-x-2 p-3 bg-amber-50 border border-amber-200 rounded-lg ${className}`}>
      <ExclamationTriangleIcon className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-amber-800 font-medium mb-1">
          Location Warning
        </div>
        <div className="text-sm text-amber-700 mb-2">
          {message || defaultMessage}
        </div>
        <div className="text-xs text-amber-600">
          💡 {suggestions}
        </div>
      </div>
    </div>
  );
};
