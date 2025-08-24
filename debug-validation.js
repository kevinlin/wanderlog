// Quick debug script to test validation
const fs = require('fs');

// Read the trip data
const tripData = JSON.parse(fs.readFileSync('./public/trip-data/202512_NZ_trip-plan.json', 'utf8'));

// Manual validation function (simplified version)
function debugValidation(data) {
  console.log('=== DEBUGGING TRIP DATA VALIDATION ===\n');
  
  if (!data || typeof data !== 'object') {
    console.log('❌ Data is not an object');
    return false;
  }
  
  console.log('✅ Data is an object');
  
  // Check required fields
  console.log('\n--- Required Fields ---');
  console.log('trip_name:', typeof data.trip_name, '→', data.trip_name);
  console.log('timezone:', typeof data.timezone, '→', data.timezone);
  console.log('stops:', Array.isArray(data.stops) ? `array[${data.stops.length}]` : typeof data.stops);
  
  if (typeof data.trip_name !== 'string') {
    console.log('❌ trip_name is not a string');
    return false;
  }
  
  if (typeof data.timezone !== 'string') {
    console.log('❌ timezone is not a string');
    return false;
  }
  
  if (!Array.isArray(data.stops)) {
    console.log('❌ stops is not an array');
    return false;
  }
  
  console.log('✅ Basic structure is valid');
  
  // Check first stop in detail
  if (data.stops.length > 0) {
    console.log('\n--- First Stop Validation ---');
    const stop = data.stops[0];
    console.log('stop_id:', typeof stop.stop_id, '→', stop.stop_id);
    console.log('name:', typeof stop.name, '→', stop.name);
    console.log('date:', typeof stop.date, '→', stop.date);
    console.log('location:', typeof stop.location, '→', stop.location);
    console.log('duration_days:', typeof stop.duration_days, '→', stop.duration_days);
    console.log('accommodation:', typeof stop.accommodation, '→', !!stop.accommodation);
    console.log('activities:', Array.isArray(stop.activities) ? `array[${stop.activities.length}]` : typeof stop.activities);
    
    // Check location structure
    if (stop.location) {
      console.log('\n--- Location Validation ---');
      console.log('location.lat:', typeof stop.location.lat, '→', stop.location.lat);
      console.log('location.lng:', typeof stop.location.lng, '→', stop.location.lng);
      
      if (typeof stop.location.lat !== 'number' || typeof stop.location.lng !== 'number') {
        console.log('❌ Invalid location coordinates');
        return false;
      }
    }
    
    // Check accommodation structure
    if (stop.accommodation) {
      console.log('\n--- Accommodation Validation ---');
      console.log('name:', typeof stop.accommodation.name, '→', stop.accommodation.name);
      console.log('address:', typeof stop.accommodation.address, '→', stop.accommodation.address);
      console.log('check_in:', typeof stop.accommodation.check_in, '→', stop.accommodation.check_in);
      console.log('check_out:', typeof stop.accommodation.check_out, '→', stop.accommodation.check_out);
      
      if (typeof stop.accommodation.name !== 'string' ||
          typeof stop.accommodation.address !== 'string' ||
          typeof stop.accommodation.check_in !== 'string' ||
          typeof stop.accommodation.check_out !== 'string') {
        console.log('❌ Invalid accommodation structure');
        return false;
      }
    }
    
    // Check first activity
    if (stop.activities && stop.activities.length > 0) {
      console.log('\n--- First Activity Validation ---');
      const activity = stop.activities[0];
      console.log('activity_id:', typeof activity.activity_id, '→', activity.activity_id);
      console.log('activity_name:', typeof activity.activity_name, '→', activity.activity_name);
      console.log('location:', typeof activity.location, '→', !!activity.location);
      
      if (typeof activity.activity_id !== 'string' || typeof activity.activity_name !== 'string') {
        console.log('❌ Invalid activity structure');
        return false;
      }
    }
  }
  
  console.log('\n✅ All validation checks passed!');
  return true;
}

// Run the debug validation
const result = debugValidation(tripData);
console.log('\n=== FINAL RESULT ===');
console.log('Validation result:', result);
