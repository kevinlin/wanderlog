// Test the actual trip data with the validation functions
const fs = require('fs');

// Read the actual trip data file
const tripData = JSON.parse(fs.readFileSync('./public/trip-data/202512_NZ_trip-plan.json', 'utf8'));

console.log('=== TESTING ACTUAL TRIP DATA ===');
console.log('Trip name:', tripData.trip_name);
console.log('Timezone:', tripData.timezone);
console.log('Number of stops:', tripData.stops?.length || 'N/A');

// Simplified validation to see what might be different
function basicValidation(data) {
  console.log('\n--- Basic Validation Checks ---');
  
  console.log('typeof data:', typeof data);
  console.log('data is object:', data && typeof data === 'object');
  console.log('trip_name type:', typeof data.trip_name);
  console.log('timezone type:', typeof data.timezone);
  console.log('stops is array:', Array.isArray(data.stops));
  
  if (Array.isArray(data.stops)) {
    console.log('First stop exists:', !!data.stops[0]);
    if (data.stops[0]) {
      const stop = data.stops[0];
      console.log('First stop structure:');
      console.log('  stop_id:', typeof stop.stop_id);
      console.log('  name:', typeof stop.name);
      console.log('  date:', typeof stop.date);
      console.log('  location:', typeof stop.location);
      console.log('  duration_days:', typeof stop.duration_days);
      console.log('  accommodation:', typeof stop.accommodation);
      console.log('  activities:', Array.isArray(stop.activities) ? 'array' : typeof stop.activities);
    }
  }
  
  return (
    data &&
    typeof data === 'object' &&
    typeof data.trip_name === 'string' &&
    typeof data.timezone === 'string' &&
    Array.isArray(data.stops)
  );
}

const result = basicValidation(tripData);
console.log('\n=== VALIDATION RESULT ===');
console.log('Passed basic validation:', result);

// Test the browser environment simulation
console.log('\n=== BROWSER SIMULATION ===');

// Simulate what happens in the browser with fetch
const simulatedResponse = {
  json: () => Promise.resolve(tripData)
};

simulatedResponse.json().then(data => {
  console.log('Data from simulated fetch:');
  console.log('typeof:', typeof data);
  console.log('basic validation:', basicValidation(data));
}).catch(err => {
  console.error('Error:', err);
});
