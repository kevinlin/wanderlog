import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MapTypeId, OverlayLayers } from '@/services/storageService';

// Re-export types for convenience
export type { MapTypeId, OverlayLayers } from '@/services/storageService';

interface MapLayerPickerProps {
  map: google.maps.Map | null;
  currentMapType: MapTypeId;
  overlayLayers: OverlayLayers;
  onMapTypeChange: (mapType: MapTypeId) => void;
  onOverlayToggle: (layer: keyof OverlayLayers) => void;
}

interface MapTypeOption {
  id: MapTypeId;
  label: string;
  icon: string;
}

interface OverlayOption {
  id: keyof OverlayLayers;
  label: string;
  icon: string;
}

const MAP_TYPE_OPTIONS: MapTypeOption[] = [
  { id: 'roadmap', label: 'Default', icon: '🗺️' },
  { id: 'satellite', label: 'Satellite', icon: '🛰️' },
  { id: 'terrain', label: 'Terrain', icon: '⛰️' },
  { id: 'hybrid', label: 'Hybrid', icon: '🌍' },
];

const OVERLAY_OPTIONS: OverlayOption[] = [
  { id: 'traffic', label: 'Traffic', icon: '🚗' },
  { id: 'transit', label: 'Transit', icon: '🚇' },
  { id: 'bicycling', label: 'Bicycling', icon: '🚴' },
];

export const MapLayerPicker: React.FC<MapLayerPickerProps> = ({ map, currentMapType, overlayLayers, onMapTypeChange, onOverlayToggle }) => {
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close picker on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleMapTypeSelect = useCallback(
    (mapType: MapTypeId) => {
      onMapTypeChange(mapType);
    },
    [onMapTypeChange]
  );

  const handleOverlayToggle = useCallback(
    (layer: keyof OverlayLayers) => {
      onOverlayToggle(layer);
    },
    [onOverlayToggle]
  );

  if (!map) return null;

  return (
    <div className="absolute bottom-4 left-4 z-10" ref={pickerRef}>
      {/* Expanded picker panel */}
      {isOpen && (
        <div className="mb-2 w-48 overflow-hidden rounded-xl border border-white/30 bg-white/90 shadow-lg backdrop-blur-md">
          {/* Map Types Section */}
          <div className="border-gray-200 border-b p-2">
            <div className="mb-2 px-2 font-medium text-gray-600 text-xs uppercase tracking-wide">Map Type</div>
            <div className="grid grid-cols-2 gap-1">
              {MAP_TYPE_OPTIONS.map((option) => (
                <button
                  className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-sm transition-all ${
                    currentMapType === option.id ? 'bg-sky-500 text-white shadow-sm' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  key={option.id}
                  onClick={() => handleMapTypeSelect(option.id)}
                  type="button"
                >
                  <span className="text-base">{option.icon}</span>
                  <span className="truncate font-medium text-xs">{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Overlay Layers Section */}
          <div className="p-2">
            <div className="mb-2 px-2 font-medium text-gray-600 text-xs uppercase tracking-wide">Layers</div>
            <div className="flex flex-col gap-1">
              {OVERLAY_OPTIONS.map((option) => (
                <button
                  className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-all ${
                    overlayLayers[option.id] ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  key={option.id}
                  onClick={() => handleOverlayToggle(option.id)}
                  type="button"
                >
                  <span className="text-base">{option.icon}</span>
                  <span className="font-medium text-xs">{option.label}</span>
                  {overlayLayers[option.id] && <span className="ml-auto font-bold text-xs">✓</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        aria-expanded={isOpen}
        aria-label="Toggle map layers picker"
        className={`flex h-10 w-10 items-center justify-center rounded-xl border shadow-lg backdrop-blur-md transition-all hover:scale-105 active:scale-95 ${
          isOpen ? 'border-sky-300 bg-sky-500 text-white' : 'border-white/30 bg-white/90 text-gray-700 hover:bg-white'
        }`}
        onClick={handleToggle}
        title="Map layers"
        type="button"
      >
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M11.644 1.59a.75.75 0 01.712 0l9.75 5.25a.75.75 0 010 1.32l-9.75 5.25a.75.75 0 01-.712 0l-9.75-5.25a.75.75 0 010-1.32l9.75-5.25z" />
          <path d="M3.265 10.602l7.668 4.129a2.25 2.25 0 002.134 0l7.668-4.13 1.37.739a.75.75 0 010 1.32l-9.75 5.25a.75.75 0 01-.71 0l-9.75-5.25a.75.75 0 010-1.32l1.37-.738z" />
          <path d="M10.933 19.231l-7.668-4.13-1.37.739a.75.75 0 000 1.32l9.75 5.25c.221.12.489.12.71 0l9.75-5.25a.75.75 0 000-1.32l-1.37-.738-7.668 4.13a2.25 2.25 0 01-2.134-.001z" />
        </svg>
      </button>
    </div>
  );
};
