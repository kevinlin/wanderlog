import { CheckCircleIcon, ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type React from 'react';
import { useEffect, useState } from 'react';

export interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  onClose?: () => void;
  show?: boolean;
}

export const Toast: React.FC<ToastProps> = ({ message, type = 'info', duration = 4000, onClose, show = true }) => {
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
        return <CheckCircleIcon className="h-5 w-5 text-emerald-600" />;
      case 'error':
        return <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />;
      case 'warning':
        return <ExclamationTriangleIcon className="h-5 w-5 text-amber-600" />;
      default:
        return <CheckCircleIcon className="h-5 w-5 text-sky-600" />;
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
      className={`-translate-x-1/2 slide-in-from-top-2 fixed top-16 left-1/2 z-50 flex min-w-[300px] max-w-md transform animate-in items-center gap-3 rounded-lg border px-4 py-3 shadow-lg duration-300 sm:top-4 ${getStyles()}
      `}
    >
      {getIcon()}
      <p className="flex-1 font-medium text-sm">{message}</p>
      <button aria-label="Close notification" className="rounded-full p-1 transition-colors hover:bg-black/10" onClick={handleClose}>
        <XMarkIcon className="h-4 w-4" />
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
