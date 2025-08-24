import { TripStop } from '@/types';

/**
 * Get current date in NZ timezone (Pacific/Auckland)
 */
export const getCurrentNZDate = (): Date => {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Pacific/Auckland" }));
};

/**
 * Parse date string (YYYY-MM-DD) to Date object
 */
export const parseDate = (dateString: string): Date => {
  return new Date(dateString + 'T00:00:00');
};

/**
 * Format date to YYYY-MM-DD string
 */
export const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

/**
 * Check if a date is between two dates (inclusive)
 */
export const isDateBetween = (date: Date, startDate: Date, endDate: Date): boolean => {
  return date >= startDate && date <= endDate;
};

/**
 * Get the current stop based on today's date (NZ time)
 */
export const getCurrentStop = (stops: TripStop[]): TripStop | null => {
  const today = getCurrentNZDate();
  const todayString = formatDate(today);
  
  return stops.find(stop => {
    const fromDate = parseDate(stop.date.from);
    const toDate = parseDate(stop.date.to);
    const currentDate = parseDate(todayString);
    
    return isDateBetween(currentDate, fromDate, toDate);
  }) || null;
};

/**
 * Get stop status relative to today
 */
export const getStopTimeStatus = (stop: TripStop): 'past' | 'current' | 'upcoming' => {
  const today = getCurrentNZDate();
  const todayString = formatDate(today);
  const currentDate = parseDate(todayString);
  
  const fromDate = parseDate(stop.date.from);
  const toDate = parseDate(stop.date.to);
  
  if (currentDate < fromDate) {
    return 'upcoming';
  } else if (currentDate > toDate) {
    return 'past';
  } else {
    return 'current';
  }
};

/**
 * Calculate days until a stop starts
 */
export const getDaysUntilStop = (stop: TripStop): number => {
  const today = getCurrentNZDate();
  const todayString = formatDate(today);
  const currentDate = parseDate(todayString);
  const fromDate = parseDate(stop.date.from);
  
  const diffTime = fromDate.getTime() - currentDate.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Calculate days since a stop ended
 */
export const getDaysSinceStop = (stop: TripStop): number => {
  const today = getCurrentNZDate();
  const todayString = formatDate(today);
  const currentDate = parseDate(todayString);
  const toDate = parseDate(stop.date.to);
  
  const diffTime = currentDate.getTime() - toDate.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};
