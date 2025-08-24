import { TripData, StopStatus, ExportData } from '@/types';
import { getStopStatus } from '@/services/storageService';

/**
 * Export trip data with current localStorage state
 */
export const exportTripData = (tripData: TripData): void => {
  const stopStatus = getStopStatus();
  const exportData = mergeStopStatusWithTripData(tripData, stopStatus);
  
  const exportObj: ExportData = {
    tripData: exportData,
    exportDate: new Date().toISOString(),
    version: '1.0.0',
  };

  const dataStr = JSON.stringify(exportObj, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${tripData.trip_name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_updated.json`;
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Merge localStorage status back into trip data
 */
export const mergeStopStatusWithTripData = (
  tripData: TripData, 
  stopStatus: StopStatus
): TripData => {
  return {
    ...tripData,
    stops: tripData.stops.map(stop => ({
      ...stop,
      activities: stop.activities.map(activity => {
        const statusOverride = stopStatus[stop.stop_id]?.activities[activity.activity_id];
        const orderOverride = stopStatus[stop.stop_id]?.activityOrder[activity.activity_id];
        
        return {
          ...activity,
          status: statusOverride || activity.status,
          manual_order: orderOverride !== undefined ? orderOverride : activity.manual_order,
        };
      }).sort((a, b) => {
        const orderA = stopStatus[stop.stop_id]?.activityOrder[a.activity_id] ?? a.manual_order;
        const orderB = stopStatus[stop.stop_id]?.activityOrder[b.activity_id] ?? b.manual_order;
        return orderA - orderB;
      }),
    })),
  };
};
