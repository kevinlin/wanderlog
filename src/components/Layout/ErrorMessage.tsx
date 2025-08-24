import React from 'react';

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
  fullScreen?: boolean;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ 
  message, 
  onRetry, 
  fullScreen = false 
}) => {
  const containerClass = fullScreen 
    ? 'min-h-screen bg-gray-50 flex items-center justify-center p-4' 
    : 'flex items-center justify-center p-8';

  return (
    <div className={containerClass}>
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
        <div className="text-red-500 text-4xl mb-4">❌</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Error Loading Data
        </h3>
        <p className="text-gray-600 mb-6">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="bg-alpine-teal text-white px-6 py-2 rounded-lg hover:bg-opacity-90 transition-colors"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
};
