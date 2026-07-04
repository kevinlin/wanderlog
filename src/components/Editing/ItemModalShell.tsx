import { XMarkIcon } from '@heroicons/react/24/outline';
import type React from 'react';

interface ItemModalShellProps {
  children: React.ReactNode;
  error?: string | null;
  isOpen: boolean;
  isPending?: boolean;
  onClose: () => void;
  onSubmit: () => void;
  title: string;
}

// Generic editing dialog: title bar, scrollable form body, Save/Cancel footer.
export const ItemModalShell = ({ title, isOpen, onClose, onSubmit, isPending = false, error, children }: ItemModalShellProps) => {
  if (!isOpen) {
    return null;
  }

  const handleBackdropClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={handleBackdropClick}>
      <form className="flex max-h-[90vh] w-full max-w-md flex-col rounded-xl bg-white shadow-xl" onSubmit={handleSubmit}>
        <div className="flex items-center justify-between border-gray-200 border-b px-6 py-4">
          <h2 className="font-bold text-gray-900 text-xl">{title}</h2>
          <button
            aria-label="Close"
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            onClick={onClose}
            type="button"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-6">{children}</div>

        <div className="border-gray-200 border-t px-6 py-4">
          {error && <p className="mb-3 text-red-600 text-sm">{error}</p>}
          <div className="flex justify-end gap-3">
            <button
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50"
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="rounded-lg bg-alpine-teal px-4 py-2 font-medium text-white transition-colors hover:bg-alpine-teal/90 disabled:opacity-50"
              disabled={isPending}
              type="submit"
            >
              {isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
