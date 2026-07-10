import type React from 'react';

interface ErrorMessageProps {
  details?: string;
  fullScreen?: boolean;
  message: string;
  onRetry?: () => void;
  title?: string;
  type?: 'general' | 'network' | 'data' | 'permission';
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, onRetry, fullScreen = false, title, type = 'general', details }) => {
  const containerClass = fullScreen
    ? 'min-h-screen bg-linear-to-br from-sandy-beige to-white flex items-center justify-center p-4'
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
          iconColor: 'text-orange-500',
        };
      case 'data':
        return {
          icon: '📄',
          title: title || 'Data Unavailable',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          iconColor: 'text-blue-500',
        };
      case 'permission':
        return {
          icon: '🔒',
          title: title || 'Access Denied',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          iconColor: 'text-yellow-600',
        };
      default:
        return {
          icon: '⚠️',
          title: title || 'Something Went Wrong',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          iconColor: 'text-red-500',
        };
    }
  };

  const config = getErrorConfig();

  return (
    <div className={containerClass}>
      <div className="w-full max-w-lg rounded-xl border border-gray-100 bg-white p-8 shadow-xl">
        {/* Travel-themed header */}
        <div className="mb-6 text-center">
          <div className="mb-4 text-6xl">{config.icon}</div>
          <h3 className="mb-2 font-bold text-gray-900 text-xl">{config.title}</h3>
          <p className="text-gray-600 leading-relaxed">{message}</p>
        </div>

        {/* Additional details if provided */}
        {details && (
          <div className={`${config.bgColor} ${config.borderColor} mb-6 rounded-lg border p-4`}>
            <h4 className="mb-2 font-semibold text-gray-700 text-sm">Details:</h4>
            <p className="text-gray-600 text-sm">{details}</p>
          </div>
        )}

        {/* Helpful suggestions based on error type */}
        <div className="mb-6 rounded-lg bg-gray-50 p-4">
          <h4 className="mb-2 font-semibold text-gray-700 text-sm">What you can try:</h4>
          <ul className="space-y-1 text-gray-600 text-sm">
            {type === 'network' && (
              <>
                <li>• Check your internet connection</li>
                <li>• Try refreshing the page</li>
                <li>• Wait a moment and try again</li>
              </>
            )}
            {type === 'data' && (
              <>
                <li>• Check your connection and try again</li>
                <li>• The trip might have been moved or deleted</li>
                <li>• Try refreshing the page</li>
              </>
            )}
            {type === 'permission' && (
              <>
                <li>• Make sure you're signed in</li>
                <li>• Ask the trip owner to share access with you</li>
                <li>• Try signing out and back in</li>
              </>
            )}
            {type === 'general' && (
              <>
                <li>• Give it another go — these things usually sort themselves out</li>
                <li>• Try refreshing the page</li>
                <li>• If it keeps happening, sign out and back in</li>
              </>
            )}
          </ul>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-3 sm:flex-row">
          {onRetry && (
            <button
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-alpine-teal px-6 py-3 font-medium text-white transition-all duration-200 hover:bg-alpine-teal/90"
              onClick={onRetry}
            >
              <span>🔄</span>
              Try Again
            </button>
          )}
          <button
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-gray-100 px-6 py-3 font-medium text-gray-700 transition-all duration-200 hover:bg-gray-200"
            onClick={() => window.location.reload()}
          >
            <span>↻</span>
            Refresh Page
          </button>
        </div>

        {/* Help text */}
        <div className="mt-6 text-center">
          <p className="text-gray-500 text-xs leading-relaxed">Still stuck? Try signing out and back in, or refreshing the page.</p>
        </div>
      </div>
    </div>
  );
};
