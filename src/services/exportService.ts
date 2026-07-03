import type { ExportData, TripData } from '@/types';

/**
 * ExportService - Trip data export functionality
 *
 * Since Supabase, status.done and order are canonical in the trip data itself,
 * so exports serialize the mapped trip directly (no modification merging).
 */
export class ExportService {
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
   * Export and download trip data in one step
   *
   * @param tripData - Trip data to export
   * @param filename - Optional custom filename (without extension)
   */
  static exportAndDownload(tripData: TripData, filename?: string): void {
    ExportService.downloadAsJSON(tripData, filename);
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
