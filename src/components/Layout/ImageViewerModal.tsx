import { XMarkIcon } from '@heroicons/react/24/outline';
import type React from 'react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface ImageViewerModalProps {
  imageUrl: string;
  altText: string;
  isOpen: boolean;
  onClose: () => void;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({ imageUrl, altText, isOpen, onClose }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Reset states when modal opens with new image
  useEffect(() => {
    if (isOpen) {
      setImageLoaded(false);
      setImageError(false);
    }
  }, [isOpen, imageUrl]);

  // Handle ESC key and body scroll prevention
  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const modalContent = (
    <div
      aria-labelledby="image-viewer-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 p-4"
      onClick={handleBackdropClick}
      role="dialog"
    >
      {/* Close button - top-right corner */}
      <button
        aria-label="Close image viewer"
        className="absolute top-4 right-4 z-10 min-h-[44px] min-w-[44px] touch-manipulation rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20 active:bg-white/30"
        onClick={onClose}
        type="button"
      >
        <XMarkIcon className="h-6 w-6" />
      </button>

      {/* Image container */}
      <div className="relative h-[95vh] w-[95vw]">
        {/* Loading spinner */}
        {!(imageLoaded || imageError) && (
          <div className="flex h-full w-full items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-white border-b-2" />
          </div>
        )}

        {/* Error message */}
        {imageError && (
          <div className="flex h-full w-full flex-col items-center justify-center text-white">
            <p className="mb-2 text-lg">Failed to load image</p>
            <button
              className="min-h-[44px] touch-manipulation rounded bg-white/20 px-4 py-2 transition-colors hover:bg-white/30 active:bg-white/40"
              onClick={onClose}
              type="button"
            >
              Close
            </button>
          </div>
        )}

        {/* Image */}
        <img
          alt={altText}
          className={`h-full w-full rounded-lg object-contain shadow-2xl ${imageLoaded ? 'block' : 'hidden'}`}
          onError={() => setImageError(true)}
          onLoad={() => setImageLoaded(true)}
          src={imageUrl}
        />
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
