// Validation utilities for Wanderlog Travel Journal
import { Coordinates, ActivityType } from '@/types';

/**
 * Validates if an object has the basic structure of trip data
 */
export const isValidTripData = (data: unknown, errors: string[], warnings: string[]): boolean => {
  if (!data || typeof data !== 'object') {
    errors.push('data must be a valid JSON object');
    return false;
  }

  const d = data as Record<string, unknown>;

  if (d.trip_name === undefined || typeof d.trip_name !== 'string') {
    errors.push('trip_name must be a string');
  }

  if (d.timezone === undefined || typeof d.timezone !== 'string') {
    errors.push('timezone must be a string');
  }

  if (!Array.isArray(d.stops)) {
    errors.push('stops must be an array');
  } else if (d.stops.length === 0) {
    warnings.push('Trip has no stops defined');
  }

  return (
    typeof d.trip_name === 'string' &&
    typeof d.timezone === 'string' &&
    Array.isArray(d.stops) &&
    d.stops.every(stop => isValidStop(stop, errors, warnings))
  );
};

/**
 * Validates if an object has the structure of a trip base/stop
 */
export const isValidStop = (data: unknown, errors: string[], warnings: string[]): boolean => {
  if (!data || typeof data !== 'object') {
    errors.push('stop must be a valid JSON object');
    return false;
  }

  const d = data as Record<string, unknown>;
  if (d.stop_id === undefined || typeof d.stop_id !== 'string') {
    errors.push('stop_id must be a string');
  }

  if (d.name === undefined || typeof d.name !== 'string') {
    errors.push('name must be a string');
  }

  if (d.date === undefined || !isValidDateRange(d.date)) {
    errors.push('date must be a valid date');
  }

  if (d.location === undefined) {
    warnings.push('location is not defined');
  } else if (!isValidCoordinates(d.location)) {
    errors.push('location must be a valid coordinates');
  }

  if (d.duration_days === undefined) {
    warnings.push('duration_days is not defined');
  } else if (typeof d.duration_days !== 'number') {
    errors.push('duration_days must be a number');
  }

  if (d.accommodation === undefined) {
    warnings.push('accommodation is not defined');
  }

  if (!Array.isArray(d.activities)) {
    errors.push('activities must be an array');
  } else if (d.activities.length === 0) {
    warnings.push('Stop has no activities defined');
  }

  return (
    typeof d.stop_id === 'string' &&
    typeof d.name === 'string' &&
    isValidDateRange(d.date) &&
    isValidCoordinates(d.location) &&
    typeof d.duration_days === 'number' &&
    isValidAccommodation(d.accommodation, errors, warnings) &&
    Array.isArray(d.activities) &&
    d.activities.every(activity => isValidActivity(activity, errors, warnings))
  );
};

/**
 * Validates date range structure
 */
export const isValidDateRange = (data: unknown): boolean => {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const d = data as Record<string, unknown>;

  return (
    typeof d.from === 'string' &&
    typeof d.to === 'string' &&
    isValidDateString(d.from) &&
    isValidDateString(d.to)
  );
};

/**
 * Validates date string format (YYYY-MM-DD)
 */
export const isValidDateString = (dateString: unknown): boolean => {
  if (typeof dateString !== 'string') {
    return false;
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) {
    return false;
  }

  const date = new Date(dateString + 'T00:00:00');
  return !isNaN(date.getTime());
};

/**
 * Validates coordinates structure
 */
export const isValidCoordinates = (data: unknown): data is Coordinates => {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const d = data as Record<string, unknown>;

  return (
    typeof d.lat === 'number' &&
    typeof d.lng === 'number' &&
    d.lat >= -90 &&
    d.lat <= 90 &&
    d.lng >= -180 &&
    d.lng <= 180
  );
};

/**
 * Validates accommodation structure
 */
export const isValidAccommodation = (data: unknown, errors: string[], warnings: string[]): boolean => {
  if (!data || typeof data !== 'object') {
    errors.push('accommodation must be a valid JSON object');
    return false;
  }

  const d = data as Record<string, unknown>;

  if (d.name === undefined || typeof d.name !== 'string') {
    return true;  // Skip validation if name is not present
  }

  if (d.address === undefined || typeof d.address !== 'string') {
    errors.push('address must be a string');
  }

  if (d.check_in === undefined || typeof d.check_in !== 'string') {
    errors.push('check_in must be a string');
  }

  if (d.check_out === undefined || typeof d.check_out !== 'string') {
    errors.push('check_out must be a string');
  }

  if (!d.confirmation) {
    warnings.push('confirmation is not defined');
  } else if (typeof d.confirmation !== 'string') {
    errors.push('confirmation must be a string');
  }

  if (!d.url) {
    warnings.push('url is not defined');
  } else if (typeof d.url !== 'string') {
    errors.push('url must be a string');
  }

  if (!d.thumbnail_url) {
    warnings.push('thumbnail_url is not defined');
  } else if (typeof d.thumbnail_url !== 'string') {
    errors.push('thumbnail_url must be a string');
  }

  const isValid = typeof d.name === 'string' &&
    typeof d.address === 'string' &&
    typeof d.check_in === 'string' &&
    typeof d.check_out === 'string' &&
    // Optional fields
    (!d.confirmation || typeof d.confirmation === 'string') &&
    (!d.url || typeof d.url === 'string') &&
    (!d.thumbnail_url || typeof d.thumbnail_url === 'string');

  if (!isValid) {
    console.log("Invalid accommodation:", d);
  }

  return isValid;
};

/**
 * Validates activity structure
 */
export const isValidActivity = (data: unknown, errors: string[], warnings: string[]): boolean => {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const d = data as Record<string, unknown>;

  if (d.activity_id === undefined || typeof d.activity_id !== 'string') {
    errors.push('activity_id must be a string');
  }

  if (d.activity_name === undefined || typeof d.activity_name !== 'string') {
    errors.push('activity_name must be a string');
  }

  // Optional activity_type field
  if (d.activity_type !== undefined) {
    const validTypes = Object.values(ActivityType);
    if (!validTypes.includes(d.activity_type as ActivityType)) {
      errors.push(`activity_type must be one of: ${validTypes.join(', ')}`);
    }
  }

  // Optional fields - only validate type if present
  if (!d.duration) {
    warnings.push('duration is not present');
  } else if (typeof d.duration !== 'string') {
    errors.push('duration must be a string');
  }

  if (!d.travel_time_from_accommodation) {
    warnings.push('travel_time_from_accommodation is not present');
  } else if (typeof d.travel_time_from_accommodation !== 'string') {
    errors.push('travel_time_from_accommodation must be a string');
  }

  if (!d.url) {
    warnings.push('url is not present');
  } else if (typeof d.url !== 'string') {
    errors.push('url must be a string');
  }

  if (!d.remarks) {
    warnings.push('remarks is not present');
  } else if (typeof d.remarks !== 'string') {
    errors.push('remarks must be a string');
  }

  if (!d.thumbnail_url) {
    warnings.push('thumbnail_url is not present');
  } else if (typeof d.thumbnail_url !== 'string') {
    errors.push('thumbnail_url must be a string');
  }

  if (!d.order) {
    warnings.push('order is not present');
  } else if (typeof d.order !== 'number') {
    errors.push('order must be a number');
  }

  if (!d.status) {
    warnings.push('status is not present');
  } else if (!isValidActivityStatus(d.status)) {
    errors.push('status must be a valid activity status');
  }

  const hasValidLocation = d.location === undefined || (
    typeof d.location === 'object' &&
    d.location !== null &&
    (
      (d.location as Record<string, unknown>).lat === undefined || typeof (d.location as Record<string, unknown>).lat === 'number'
    ) &&
    (
      (d.location as Record<string, unknown>).lng === undefined || typeof (d.location as Record<string, unknown>).lng === 'number'
    ) &&
    (
      (d.location as Record<string, unknown>).address === undefined || typeof (d.location as Record<string, unknown>).address === 'string'
    )
  );
  if (!hasValidLocation) {
    errors.push('location must be a valid coordinates' + JSON.stringify(d.location));
  }

  const isValid = typeof d.activity_id === 'string' &&
    typeof d.activity_name === 'string' &&
    hasValidLocation &&
    (!d.duration || typeof d.duration === 'string') &&
    (!d.travel_time_from_accommodation || typeof d.travel_time_from_accommodation === 'string') &&
    (!d.url || typeof d.url === 'string') &&
    (!d.remarks || typeof d.remarks === 'string') &&
    (!d.thumbnail_url || typeof d.thumbnail_url === 'string') &&
    (!d.order || typeof d.order === 'number') &&
    (!d.status || isValidActivityStatus(d.status));

  if (!isValid) {
    console.log("Invalid activity:", d);
  }

  return isValid;
};

/**
 * Validates activity status structure
 */
export const isValidActivityStatus = (data: unknown): boolean => {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const d = data as Record<string, unknown>;

  return typeof d.done === 'boolean';
};

/**
 * Checks if location data is missing or invalid
 */
export const hasLocationIssues = (location?: { lat?: number; lng?: number; address?: string }): boolean => {
  if (!location) return true;
  
  // Check if coordinates are missing or invalid
  const hasValidCoordinates = typeof location.lat === 'number' && 
                              typeof location.lng === 'number' &&
                              !isNaN(location.lat) && 
                              !isNaN(location.lng) &&
                              location.lat >= -90 && location.lat <= 90 &&
                              location.lng >= -180 && location.lng <= 180;
  
  // Check if address is meaningful (not just empty or whitespace)
  const hasValidAddress = typeof location.address === 'string' && 
                         location.address.trim().length > 0;
  
  // Location has issues if it lacks both valid coordinates AND a meaningful address
  return !hasValidCoordinates && !hasValidAddress;
};

/**
 * Checks if activity has location issues
 */
export const activityHasLocationIssues = (activity: { location?: { lat?: number; lng?: number; address?: string } }): boolean => {
  return hasLocationIssues(activity.location);
};

/**
 * Checks if accommodation has location issues
 */
export const accommodationHasLocationIssues = (accommodation: { location?: { lat?: number; lng?: number } }): boolean => {
  return hasLocationIssues(accommodation.location);
};

/**
 * Validates URL format
 */
export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Validates email format
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Sanitizes string input to prevent XSS
 */
export const sanitizeString = (input: string): string => {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

/**
 * Validates and sanitizes user input
 */
export const validateAndSanitizeInput = (input: unknown, maxLength: number = 1000): string => {
  if (typeof input !== 'string') {
    return '';
  }

  const sanitized = sanitizeString(input);
  return sanitized.length > maxLength ? sanitized.substring(0, maxLength) : sanitized;
};
