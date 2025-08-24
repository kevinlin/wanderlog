import React from 'react';

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
  fullScreen?: boolean;
  title?: string;
  type?: 'general' | 'network' | 'data' | 'permission';
  details?: string;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ 
  message, 
  onRetry, 
  fullScreen = false,
  title,
  type = 'general',
  details
}) => {
  const containerClass = fullScreen 
    ? 'min-h-screen bg-gradient-to-br from-sandy-beige to-white flex items-center justify-center p-4' 
    : 'flex items-center justify-center p-8';

  // Get appropriate icon and styling based on error type
  const getErrorConfig = () => {
    switch (type) {
      case 'network':
        return {
          icon: '📡',
          title: title || 'Connection Lost',
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200',
          iconColor: 'text-orange-500'
        };
      case 'data':
        return {
          icon: '📄',
          title: title || 'Data Unavailable',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          iconColor: 'text-blue-500'
        };
      case 'permission':
        return {
          icon: '🔒',
          title: title || 'Access Denied',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          iconColor: 'text-yellow-600'
        };
      default:
        return {
          icon: '⚠️',
          title: title || 'Something Went Wrong',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          iconColor: 'text-red-500'
        };
    }
  };

  const config = getErrorConfig();

  return (
    <div className={containerClass}>
      <div className="bg-white rounded-xl shadow-xl border border-gray-100 p-8 max-w-lg w-full">
        {/* Travel-themed header */}
        <div className="text-center mb-6">
          <div className="text-6xl mb-4">{config.icon}</div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            {config.title}
          </h3>
          <p className="text-gray-600 leading-relaxed">
            {message}
          </p>
        </div>

        {/* Additional details if provided */}
        {details && (
          <div className={`${config.bgColor} ${config.borderColor} border rounded-lg p-4 mb-6`}>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Details:</h4>
            <p className="text-sm text-gray-600">
              {details}
            </p>
          </div>
        )}

        {/* Helpful suggestions based on error type */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">What you can try:</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            {type === 'network' && (
              <>
                <li>• Check your internet connection</li>
                <li>• Try refreshing the page</li>
                <li>• Wait a moment and try again</li>
              </>
            )}
            {type === 'data' && (
              <>
                <li>• Verify the trip data file exists</li>
                <li>• Check the file format is correct</li>
                <li>• Try reloading the page</li>
              </>
            )}
            {type === 'permission' && (
              <>
                <li>• Check if you have the required permissions</li>
                <li>• Try logging in again</li>
                <li>• Contact support if the issue persists</li>
              </>
            )}
            {type === 'general' && (
              <>
                <li>• Try refreshing the page</li>
                <li>• Clear your browser cache</li>
                <li>• Check the browser console for more details</li>
              </>
            )}
          </ul>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex-1 bg-alpine-teal text-white px-6 py-3 rounded-lg hover:bg-opacity-90 transition-all duration-200 font-medium flex items-center justify-center gap-2"
            >
              <span>🔄</span>
              Try Again
            </button>
          )}
          <button
            onClick={() => window.location.reload()}
            className="flex-1 bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 transition-all duration-200 font-medium flex items-center justify-center gap-2"
          >
            <span>↻</span>
            Refresh Page
          </button>
        </div>

        {/* Help text */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500 leading-relaxed">
            If this problem continues, try clearing your browser's cache and cookies for this site.
          </p>
        </div>
      </div>
    </div>
  );
};
