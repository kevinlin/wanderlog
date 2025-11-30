import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import type React from 'react';

interface LocationWarningProps {
  type: 'activity' | 'accommodation';
  message?: string;
  className?: string;
}

export const LocationWarning: React.FC<LocationWarningProps> = ({ type, message, className = '' }) => {
  const defaultMessage =
    type === 'activity'
      ? 'Location data is missing or invalid. Please check the address information for this activity.'
      : 'Location data is missing or invalid. Please check the address information for this accommodation.';

  const suggestions =
    type === 'activity'
      ? 'Try adding valid coordinates or a complete address to display this activity on the map.'
      : 'Try adding valid coordinates or a complete address to display this accommodation on the map.';

  return (
    <div className={`flex items-start space-x-2 rounded-lg border border-amber-200 bg-amber-50 p-3 ${className}`}>
      <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" />
      <div className="min-w-0 flex-1">
        <div className="mb-1 font-medium text-amber-800 text-sm">Location Warning</div>
        <div className="mb-2 text-amber-700 text-sm">{message || defaultMessage}</div>
        <div className="text-amber-600 text-xs">💡 {suggestions}</div>
      </div>
    </div>
  );
};
