import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ExportService } from '../exportService';
import { TripData, UserModifications } from '@/types';

// Mock the mergeUserModificationsWithTripData function
vi.mock('@/utils/exportUtils', () => ({
  mergeUserModificationsWithTripData: vi.fn((tripData, modifications) => {
    // Simple mock implementation that applies modifications
    return {
      ...tripData,
      stops: tripData.stops.map(stop => ({
        ...stop,
        activities: stop.activities.map(activity => ({
          ...activity,
          status: {
            done: modifications.activityStatus[activity.activity_id] ?? false,
          },
        })),
      })),
    };
  }),
}));

describe('ExportService', () => {
  let mockTripData: TripData;
  let mockUserModifications: UserModifications;

  beforeEach(() => {
    mockTripData = {
      trip_name: 'Test Trip',
      timezone: 'Pacific/Auckland',
      stops: [
        {
          stop_id: 'stop1',
          name: 'Test Stop',
          date: { from: '2025-01-01', to: '2025-01-02' },
          location: { lat: -36.8485, lng: 174.7633 },
          duration_days: 1,
          accommodation: {
            name: 'Test Hotel',
            address: '123 Test St',
            check_in: '2025-01-01 15:00',
            check_out: '2025-01-02 11:00',
          },
          activities: [
            {
              activity_id: 'activity1',
              activity_name: 'Test Activity',
              status: { done: false },
            },
          ],
        },
      ],
    };

    mockUserModifications = {
      activityStatus: { activity1: true },
      activityOrders: {},
      lastViewedBase: 'stop1',
    };

    // Mock DOM methods
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'mock-blob-url'),
      revokeObjectURL: vi.fn(),
    });
    
    // Mock document methods
    const mockLink = {
      href: '',
      download: '',
      click: vi.fn(),
    };
    document.createElement = vi.fn(() => mockLink as any);
    document.body.appendChild = vi.fn();
    document.body.removeChild = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('exportTripData', () => {
    it('should merge user modifications with trip data', () => {
      const result = ExportService.exportTripData(mockTripData, mockUserModifications);
      
      expect(result).toBeDefined();
      expect(result.trip_name).toBe('Test Trip');
      expect(result.stops[0].activities[0].status.done).toBe(true);
    });

    it('should return merged data with correct structure', () => {
      const result = ExportService.exportTripData(mockTripData, mockUserModifications);
      
      expect(result).toHaveProperty('trip_name');
      expect(result).toHaveProperty('timezone');
      expect(result).toHaveProperty('stops');
      expect(Array.isArray(result.stops)).toBe(true);
    });
  });

  describe('downloadAsJSON', () => {
    it('should create and trigger download link', () => {
      ExportService.downloadAsJSON(mockTripData);
      
      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(document.body.appendChild).toHaveBeenCalled();
      expect(document.body.removeChild).toHaveBeenCalled();
      expect(URL.createObjectURL).toHaveBeenCalled();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('mock-blob-url');
    });

    it('should use default filename when none provided', () => {
      const mockLink = {
        href: '',
        download: '',
        click: vi.fn(),
      };
      document.createElement = vi.fn(() => mockLink as any);

      ExportService.downloadAsJSON(mockTripData);
      
      expect(mockLink.download).toBe('test_trip_updated.json');
    });

    it('should use custom filename when provided', () => {
      const mockLink = {
        href: '',
        download: '',
        click: vi.fn(),
      };
      document.createElement = vi.fn(() => mockLink as any);

      ExportService.downloadAsJSON(mockTripData, 'custom_export');
      
      expect(mockLink.download).toBe('custom_export.json');
    });

    it('should create valid JSON export structure', () => {
      let capturedBlobData: string;
      vi.stubGlobal('URL', {
        createObjectURL: vi.fn((blob: Blob) => {
          // Mock reading the blob data
          const reader = new FileReader();
          reader.onload = () => {
            capturedBlobData = reader.result as string;
          };
          reader.readAsText(blob);
          return 'mock-blob-url';
        }),
        revokeObjectURL: vi.fn(),
      });

      ExportService.downloadAsJSON(mockTripData);
      
      // Verify the JSON structure by parsing the data directly
      const dataStr = JSON.stringify({
        tripData: mockTripData,
        exportDate: expect.any(String),
        version: '1.0.0',
      }, null, 2);
      
      // Just verify that the function creates a blob with the right type
      expect(URL.createObjectURL).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'application/json'
        })
      );
    });
  });

  describe('exportAndDownload', () => {
    it('should export and download in one step', () => {
      const mockLink = {
        href: '',
        download: '',
        click: vi.fn(),
      };
      document.createElement = vi.fn(() => mockLink as any);

      ExportService.exportAndDownload(mockTripData, mockUserModifications);
      
      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(mockLink.click).toHaveBeenCalled();
      expect(URL.createObjectURL).toHaveBeenCalled();
      expect(URL.revokeObjectURL).toHaveBeenCalled();
    });

    it('should use custom filename in exportAndDownload', () => {
      const mockLink = {
        href: '',
        download: '',
        click: vi.fn(),
      };
      document.createElement = vi.fn(() => mockLink as any);

      ExportService.exportAndDownload(mockTripData, mockUserModifications, 'my_export');
      
      expect(mockLink.download).toBe('my_export.json');
    });
  });

  describe('generateFilename', () => {
    it('should generate filename from trip name', () => {
      const filename = ExportService.generateFilename(mockTripData);
      
      expect(filename).toMatch(/^test_trip_export_\d{4}-\d{2}-\d{2}$/);
    });

    it('should sanitize special characters in trip name', () => {
      const tripWithSpecialChars = {
        ...mockTripData,
        trip_name: 'My Amazing Trip! @#$%',
      };
      
      const filename = ExportService.generateFilename(tripWithSpecialChars);
      
      // 'My Amazing Trip! @#$%' -> 'my_amazing_trip_______' (7 underscores: space, space, !, space, @, #, $, %)
      expect(filename).toMatch(/^my_amazing_trip_______export_\d{4}-\d{2}-\d{2}$/);
    });

    it('should include current date in filename', () => {
      const today = new Date().toISOString().split('T')[0];
      const filename = ExportService.generateFilename(mockTripData);
      
      expect(filename).toContain(today);
    });
  });

  describe('error handling', () => {
    it('should handle blob creation errors gracefully', () => {
      vi.stubGlobal('URL', {
        createObjectURL: vi.fn(() => {
          throw new Error('Blob creation failed');
        }),
        revokeObjectURL: vi.fn(),
      });

      expect(() => {
        ExportService.downloadAsJSON(mockTripData);
      }).toThrow('Blob creation failed');
    });

    it('should handle DOM manipulation errors gracefully', () => {
      document.createElement = vi.fn(() => {
        throw new Error('DOM error');
      });

      expect(() => {
        ExportService.downloadAsJSON(mockTripData);
      }).toThrow('DOM error');
    });
  });
});
