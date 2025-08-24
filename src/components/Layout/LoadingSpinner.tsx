import React from 'react';

interface LoadingSpinnerProps {
  message?: string;
  fullScreen?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'adventure' | 'minimal';
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  message = 'Loading...', 
  fullScreen = false,
  size = 'md',
  variant = 'default'
}) => {
  const containerClass = fullScreen 
    ? 'min-h-screen bg-gradient-to-br from-sandy-beige to-white flex items-center justify-center p-4' 
    : 'flex items-center justify-center p-8';

  // Size configurations
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8', 
    lg: 'h-12 w-12'
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  const renderSpinner = () => {
    switch (variant) {
      case 'adventure':
        return (
          <div className="relative">
            {/* Compass-style spinner */}
            <div className={`${sizeClasses[size]} relative`}>
              <div className="absolute inset-0 rounded-full border-2 border-gray-200"></div>
              <div className="absolute inset-0 rounded-full border-2 border-alpine-teal border-t-transparent animate-spin"></div>
              <div className="absolute inset-2 rounded-full bg-gradient-to-br from-alpine-teal to-lake-blue opacity-20"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-alpine-teal font-bold" style={{ fontSize: size === 'lg' ? '8px' : '6px' }}>
                  N
                </div>
              </div>
            </div>
          </div>
        );
      
      case 'minimal':
        return (
          <div className={`${sizeClasses[size]} relative`}>
            <div className="absolute inset-0 rounded-full border border-gray-300 opacity-30"></div>
            <div className="absolute inset-0 rounded-full border border-alpine-teal border-t-transparent animate-spin"></div>
          </div>
        );
        
      default:
        return (
          <div className="relative">
            {/* Multi-ring spinner with travel theme */}
            <div className={`${sizeClasses[size]} relative`}>
              {/* Outer ring */}
              <div className="absolute inset-0 rounded-full border-2 border-gray-200"></div>
              <div className="absolute inset-0 rounded-full border-2 border-alpine-teal border-t-transparent animate-spin"></div>
              
              {/* Inner ring */}
              <div className="absolute inset-1 rounded-full border border-lake-blue border-b-transparent animate-spin" 
                   style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
              
              {/* Center dot */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-1 h-1 bg-fern-green rounded-full animate-pulse"></div>
              </div>
            </div>
          </div>
        );
    }
  };

  const renderMessage = () => {
    if (!message) return null;

    return (
      <div className="mt-4 text-center">
        <p className={`text-gray-600 ${textSizeClasses[size]} font-medium`}>
          {message}
        </p>
        {fullScreen && variant === 'adventure' && (
          <p className="text-xs text-gray-500 mt-2">
            Preparing your adventure...
          </p>
        )}
      </div>
    );
  };

  return (
    <div className={containerClass}>
      <div className="text-center">
        {fullScreen && variant === 'adventure' ? (
          <div className="space-y-6">
            {/* Travel-themed illustration */}
            <div className="text-6xl mb-2">🗺️</div>
            
            {/* Enhanced spinner */}
            {renderSpinner()}
            
            {/* Message with travel theme */}
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-gray-900">
                Loading Your Journey
              </h2>
              <p className="text-gray-600">
                {message}
              </p>
              <div className="flex items-center justify-center space-x-1 text-xs text-gray-500">
                <span className="animate-pulse">📍</span>
                <span>Plotting your course</span>
                <span className="animate-pulse delay-500">🧭</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {renderSpinner()}
            {renderMessage()}
          </div>
        )}
      </div>
    </div>
  );
};
