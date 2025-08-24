import { TripData, StopStatus, ExportData, UserModifications } from '@/types';
import { getUserModifications } from '@/services/storageService';

/**
 * Export trip data with current localStorage state
 */
export const exportTripData = (tripData: TripData): void => {
  const userModifications = getUserModifications();
  const exportData = mergeUserModificationsWithTripData(tripData, userModifications);
  
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
 * Export trip data with UserModifications (new format)
 */
export const exportTripDataWithUserModifications = (
  tripData: TripData,
  userModifications: UserModifications
): void => {
  const exportData = mergeUserModificationsWithTripData(tripData, userModifications);
  
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
 * Merge UserModifications back into trip data (new format)
 */
export const mergeUserModificationsWithTripData = (
  tripData: TripData,
  userModifications: UserModifications
): TripData => {
  return {
    ...tripData,
    stops: tripData.stops.map(stop => ({
      ...stop,
      activities: stop.activities.map((activity, index) => {
        const isDone = userModifications.activityStatus[activity.activity_id];
        const customOrder = userModifications.activityOrders[stop.stop_id];
        
        return {
          ...activity,
          status: {
            done: isDone !== undefined ? isDone : (activity.status?.done ?? false),
          },
          manual_order: customOrder ? customOrder[index] : (activity.manual_order ?? index),
        };
      }).sort((a, b) => {
        const orderA = a.manual_order ?? 0;
        const orderB = b.manual_order ?? 0;
        return orderA - orderB;
      }),
    })),
  };
};

/**
 * Merge localStorage status back into trip data (legacy format - for backward compatibility)
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
