import { CheckCircleIcon, ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type React from 'react';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastProps {
  action?: ToastAction;
  duration?: number;
  message: string;
  onClose?: () => void;
  show?: boolean;
  type?: 'success' | 'error' | 'warning' | 'info';
}

export const Toast: React.FC<ToastProps> = ({ message, type = 'info', duration = 4000, onClose, show = true, action }) => {
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

  const handleAction = () => {
    action?.onClick();
    handleClose();
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
      className={`slide-in-from-top-2 fixed top-16 left-1/2 z-50 flex min-w-[300px] max-w-md -translate-x-1/2 transform animate-in items-center gap-3 rounded-lg border px-4 py-3 shadow-lg duration-300 sm:top-4 ${getStyles()}
      `}
    >
      {getIcon()}
      <p className="flex-1 font-medium text-sm">{message}</p>
      {action && (
        <button
          className="shrink-0 font-semibold text-sm underline underline-offset-2 hover:opacity-75"
          onClick={handleAction}
          type="button"
        >
          {action.label}
        </button>
      )}
      <button aria-label="Close notification" className="rounded-full p-1 transition-colors hover:bg-black/10" onClick={handleClose}>
        <XMarkIcon className="h-4 w-4" />
      </button>
    </div>
  );
};

// Simple toast state interface for App component integration
export interface ToastState {
  message: string;
  show: boolean;
  type: 'success' | 'error' | 'warning' | 'info';
}

export interface ShowToastOptions {
  action?: ToastAction;
  duration?: number;
  message: string;
  type?: ToastProps['type'];
}

interface ToastContextValue {
  showToast: (options: ShowToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

interface ActiveToast extends ShowToastOptions {
  id: number;
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<ActiveToast | null>(null);

  const showToast = useCallback((options: ShowToastOptions) => {
    setToast((previous) => ({ ...options, id: (previous?.id ?? 0) + 1 }));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <Toast
          action={toast.action}
          duration={toast.duration}
          key={toast.id}
          message={toast.message}
          onClose={() => setToast(null)}
          type={toast.type ?? 'error'}
        />
      )}
    </ToastContext.Provider>
  );
};

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
