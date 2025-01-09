// debug-active-fixtures.js
import fs from 'fs/promises';
import { fixtureApiService } from './fixture-api.service.js';

const debugLog = {
  timestamp: new Date().toISOString(),
  logs: [],
  errors: [],
  requestDetails: []
};

// Track request details
const trackRequest = (method, url, headers, response) => {
  debugLog.requestDetails.push({
    timestamp: new Date().toISOString(),
    method,
    url,
    headers: { ...headers, Authorization: '[REDACTED]' }, // Remove sensitive data
    status: response?.status,
    statusText: response?.statusText,
    data: response?.data
  });
};

// Override console.log and console.error
const originalLog = console.log;
const originalError = console.error;

console.log = (...args) => {
  const message = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
  ).join(' ');
  debugLog.logs.push({
    timestamp: new Date().toISOString(),
    message
  });
  originalLog.apply(console, args);
};

console.error = (...args) => {
  const message = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
  ).join(' ');
  debugLog.errors.push({
    timestamp: new Date().toISOString(),
    message
  });
  originalError.apply(console, args);
};

async function debugActiveFixtures() {
  try {
    console.log('Starting debug of active fixtures request');
    
    // Test authentication
    console.log('Testing authentication...');
    const authResult = await fixtureApiService.authenticate();
    console.log('Authentication result:', authResult ? 'Success' : 'Failed');
    
    if (!authResult) {
      throw new Error('Authentication failed');
    }

    // Get and log headers
    const headers = fixtureApiService.getHeaders();
    console.log('Using headers:', {
      ...headers,
      Authorization: '[REDACTED]',
      'x-api-key': '[REDACTED]'
    });

    // Test getting competitions
    console.log('Fetching active fixtures for sport ID: 10');
    const startTime = Date.now();
    const fixtures = await fixtureApiService.getActiveFixtures(10);
    const endTime = Date.now();
    
    console.log(`Request completed in ${endTime - startTime}ms. Found ${fixtures?.length || 0} fixtures`);
    debugLog.fixtures = fixtures;
  } catch (error) {
    console.error('Error during debug:', error);
    debugLog.finalError = {
      message: error.message,
      stack: error.stack,
      response: error.response ? {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      } : null
    };
  }

  // Save debug log to file
  const logFileName = `debug-log-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
  await fs.writeFile(logFileName, JSON.stringify(debugLog, null, 2));
  console.log(`Debug log saved to ${logFileName}`);

  // Restore original console methods
  console.log = originalLog;
  console.error = originalError;
}

// Run the debug
debugActiveFixtures().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});