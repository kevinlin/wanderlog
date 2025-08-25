import { TripData, UserModifications, ExportData } from '@/types';
import { mergeUserModificationsWithTripData } from '@/utils/exportUtils';

/**
 * ExportService - Data export functionality with user modifications
 * 
 * Provides high-level interface for exporting trip data with user modifications
 * merged back into the original data format.
 */
export class ExportService {
  /**
   * Export trip data with user modifications merged in
   * 
   * @param originalData - Original trip data
   * @param modifications - User modifications from localStorage
   * @returns Merged trip data with user modifications applied
   */
  static exportTripData(
    originalData: TripData, 
    modifications: UserModifications
  ): TripData {
    return mergeUserModificationsWithTripData(originalData, modifications);
  }

  /**
   * Download trip data as JSON file
   * 
   * @param data - Trip data to export
   * @param filename - Optional custom filename (without extension)
   */
  static downloadAsJSON(data: TripData, filename?: string): void {
    const exportObj: ExportData = {
      tripData: data,
      exportDate: new Date().toISOString(),
      version: '1.0.0',
    };

    const dataStr = JSON.stringify(exportObj, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    
    // Generate filename if not provided
    const defaultFilename = `${data.trip_name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_updated`;
    link.download = `${filename || defaultFilename}.json`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Export and download trip data with user modifications in one step
   * 
   * @param originalData - Original trip data
   * @param modifications - User modifications from localStorage
   * @param filename - Optional custom filename (without extension)
   */
  static exportAndDownload(
    originalData: TripData, 
    modifications: UserModifications,
    filename?: string
  ): void {
    const mergedData = this.exportTripData(originalData, modifications);
    this.downloadAsJSON(mergedData, filename);
  }

  /**
   * Generate export filename based on trip data
   * 
   * @param tripData - Trip data to generate filename from
   * @returns Sanitized filename without extension
   */
  static generateFilename(tripData: TripData): string {
    const tripName = tripData.trip_name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    return `${tripName}_export_${timestamp}`;
  }
}
