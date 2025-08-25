import React, { useEffect, useState } from 'react';
import { CheckCircleIcon, ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';

export interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  onClose?: () => void;
  show?: boolean;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'info',
  duration = 4000,
  onClose,
  show = true,
}) => {
  const [isVisible, setIsVisible] = useState(show);

  useEffect(() => {
    setIsVisible(show);
  }, [show]);

  useEffect(() => {
    if (isVisible && duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        onClose?.();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  const handleClose = () => {
    setIsVisible(false);
    onClose?.();
  };

  if (!isVisible) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircleIcon className="w-5 h-5 text-emerald-600" />;
      case 'error':
        return <ExclamationTriangleIcon className="w-5 h-5 text-red-600" />;
      case 'warning':
        return <ExclamationTriangleIcon className="w-5 h-5 text-amber-600" />;
      default:
        return <CheckCircleIcon className="w-5 h-5 text-sky-600" />;
    }
  };

  const getStyles = () => {
    switch (type) {
      case 'success':
        return 'bg-emerald-50 border-emerald-200 text-emerald-800';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return 'bg-amber-50 border-amber-200 text-amber-800';
      default:
        return 'bg-sky-50 border-sky-200 text-sky-800';
    }
  };

  return (
    <div
      className={`
        fixed top-4 left-1/2 transform -translate-x-1/2 z-50
        flex items-center gap-3 px-4 py-3
        rounded-lg border shadow-lg
        animate-in slide-in-from-top-2 duration-300
        max-w-md min-w-[300px]
        ${getStyles()}
      `}
    >
      {getIcon()}
      <p className="flex-1 text-sm font-medium">{message}</p>
      <button
        onClick={handleClose}
        className="p-1 hover:bg-black/10 rounded-full transition-colors"
        aria-label="Close notification"
      >
        <XMarkIcon className="w-4 h-4" />
      </button>
    </div>
  );
};

// Simple toast state interface for App component integration
export interface ToastState {
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  show: boolean;
}
