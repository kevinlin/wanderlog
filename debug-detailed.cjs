// Detailed debug of the specific validation functions
const fs = require('fs');

// Read the trip data
const tripData = JSON.parse(fs.readFileSync('./public/trip-data/202512_NZ_trip-plan.json', 'utf8'));

// Copy the validation functions locally to debug
function isValidDateRange(data) {
  if (!data || typeof data !== 'object') {
    console.log('❌ Date range: not an object');
    return false;
  }
  
  const d = data;
  
  const hasFrom = typeof d.from === 'string';
  const hasTo = typeof d.to === 'string';
  
  console.log('Date range validation:');
  console.log('  from:', typeof d.from, '→', d.from);
  console.log('  to:', typeof d.to, '→', d.to);
  
  if (!hasFrom || !hasTo) {
    console.log('❌ Date range: missing from/to');
    return false;
  }
  
  return isValidDateString(d.from) && isValidDateString(d.to);
}

function isValidDateString(dateString) {
  if (typeof dateString !== 'string') {
    console.log('❌ Date string: not a string');
    return false;
  }
  
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) {
    console.log('❌ Date string: wrong format', dateString);
    return false;
  }
  
  const date = new Date(dateString + 'T00:00:00');
  const isValid = !isNaN(date.getTime());
  console.log('Date validation for', dateString, '→', isValid);
  return isValid;
}

function isValidCoordinates(data) {
  if (!data || typeof data !== 'object') {
    console.log('❌ Coordinates: not an object');
    return false;
  }
  
  const d = data;
  
  console.log('Coordinates validation:');
  console.log('  lat:', typeof d.lat, '→', d.lat);
  console.log('  lng:', typeof d.lng, '→', d.lng);
  
  return (
    typeof d.lat === 'number' &&
    typeof d.lng === 'number' &&
    d.lat >= -90 &&
    d.lat <= 90 &&
    d.lng >= -180 &&
    d.lng <= 180
  );
}

function isValidAccommodation(data) {
  if (!data || typeof data !== 'object') {
    console.log('❌ Accommodation: not an object');
    return false;
  }
  
  const d = data;
  
  console.log('Accommodation validation:');
  console.log('  name:', typeof d.name, '→', d.name);
  console.log('  address:', typeof d.address, '→', d.address);
  console.log('  check_in:', typeof d.check_in, '→', d.check_in);
  console.log('  check_out:', typeof d.check_out, '→', d.check_out);
  
  return (
    typeof d.name === 'string' &&
    typeof d.address === 'string' &&
    typeof d.check_in === 'string' &&
    typeof d.check_out === 'string'
  );
}

function isValidActivity(data) {
  if (!data || typeof data !== 'object') {
    console.log('❌ Activity: not an object');
    return false;
  }
  
  const d = data;
  
  console.log('Activity validation:');
  console.log('  activity_id:', typeof d.activity_id, '→', d.activity_id);
  console.log('  activity_name:', typeof d.activity_name, '→', d.activity_name);
  console.log('  location:', typeof d.location, '→', !!d.location);
  
  const hasValidLocation = d.location === undefined || (
    typeof d.location === 'object' &&
    d.location !== null &&
    (
      d.location.lat === undefined || typeof d.location.lat === 'number'
    ) &&
    (
      d.location.lng === undefined || typeof d.location.lng === 'number'
    ) &&
    (
      d.location.address === undefined || typeof d.location.address === 'string'
    )
  );
  
  if (d.location) {
    console.log('  location details:');
    console.log('    lat:', typeof d.location.lat, '→', d.location.lat);
    console.log('    lng:', typeof d.location.lng, '→', d.location.lng);
    console.log('    address:', typeof d.location.address, '→', d.location.address);
  }
  
  const result = (
    typeof d.activity_id === 'string' &&
    typeof d.activity_name === 'string' &&
    hasValidLocation
  );
  
  console.log('Activity validation result:', result);
  return result;
}

function isValidTripBase(data) {
  if (!data || typeof data !== 'object') {
    console.log('❌ Trip base: not an object');
    return false;
  }
  
  const d = data;
  
  console.log('\n=== TRIP BASE VALIDATION ===');
  console.log('stop_id:', typeof d.stop_id, '→', d.stop_id);
  console.log('name:', typeof d.name, '→', d.name);
  console.log('date:', typeof d.date, '→', !!d.date);
  console.log('location:', typeof d.location, '→', !!d.location);
  console.log('duration_days:', typeof d.duration_days, '→', d.duration_days);
  console.log('accommodation:', typeof d.accommodation, '→', !!d.accommodation);
  console.log('activities:', Array.isArray(d.activities) ? `array[${d.activities.length}]` : typeof d.activities);
  
  // Check each component
  console.log('\n--- Date Range Check ---');
  const dateValid = isValidDateRange(d.date);
  
  console.log('\n--- Coordinates Check ---');
  const coordsValid = isValidCoordinates(d.location);
  
  console.log('\n--- Accommodation Check ---');
  const accomValid = isValidAccommodation(d.accommodation);
  
  console.log('\n--- Activities Check ---');
  const activitiesValid = Array.isArray(d.activities) && d.activities.every((activity, i) => {
    console.log(`Activity ${i}:`);
    return isValidActivity(activity);
  });
  
  const result = (
    typeof d.stop_id === 'string' &&
    typeof d.name === 'string' &&
    dateValid &&
    coordsValid &&
    typeof d.duration_days === 'number' &&
    accomValid &&
    activitiesValid
  );
  
  console.log('\n=== TRIP BASE RESULT ===', result);
  return result;
}

function isValidTripData(data) {
  if (!data || typeof data !== 'object') {
    console.log('❌ Trip data: not an object');
    return false;
  }
  
  const d = data;
  
  console.log('\n=== TRIP DATA VALIDATION ===');
  console.log('trip_name:', typeof d.trip_name, '→', d.trip_name);
  console.log('timezone:', typeof d.timezone, '→', d.timezone);
  console.log('stops:', Array.isArray(d.stops) ? `array[${d.stops.length}]` : typeof d.stops);
  
  const result = (
    typeof d.trip_name === 'string' &&
    typeof d.timezone === 'string' &&
    Array.isArray(d.stops) &&
    d.stops.every((stop, i) => {
      console.log(`\nValidating stop ${i}: ${stop.name}`);
      return isValidTripBase(stop);
    })
  );
  
  console.log('\n=== FINAL TRIP DATA RESULT ===', result);
  return result;
}

// Test the validation
console.log('=== TESTING DETAILED VALIDATION ===');
const result = isValidTripData(tripData);
console.log('\nFINAL RESULT:', result);
