/**
 * DuoPlus API Test Script v2
 * Tests with corrected parameters based on official documentation
 */

import { config } from 'dotenv';
config();

const DUOPLUS_API_KEY = process.env.DUOPLUS_API_KEY || '';

console.log('=== DuoPlus API Test v2 ===');
console.log(`API Key configured: ${DUOPLUS_API_KEY ? 'Yes (length: ' + DUOPLUS_API_KEY.length + ')' : 'No'}`);
console.log(`API Key (first 8 chars): ${DUOPLUS_API_KEY.substring(0, 8)}...`);
console.log('');

// Test 1: List Cloud Phones with corrected parameters (string array for link_status)
console.log('--- Test 1: List Cloud Phones (corrected params) ---');
try {
  const response = await fetch('https://openapi.duoplus.net/api/v1/cloudPhone/list', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'DuoPlus-API-Key': DUOPLUS_API_KEY,
      'Lang': 'en'
    },
    body: JSON.stringify({
      page: 1,
      pagesize: 10
      // No link_status filter - get all devices
    })
  });

  const data = await response.json();
  console.log('Status:', response.status);
  console.log('Response:', JSON.stringify(data, null, 2));
} catch (error) {
  console.log('Error:', error.message);
}

console.log('');

// Test 2: List Cloud Phones with link_status as string array
console.log('--- Test 2: List Cloud Phones (with link_status as string array) ---');
try {
  const response = await fetch('https://openapi.duoplus.net/api/v1/cloudPhone/list', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'DuoPlus-API-Key': DUOPLUS_API_KEY,
      'Lang': 'en'
    },
    body: JSON.stringify({
      page: 1,
      pagesize: 10,
      link_status: ["1"]  // String array as per documentation
    })
  });

  const data = await response.json();
  console.log('Status:', response.status);
  console.log('Response:', JSON.stringify(data, null, 2));
} catch (error) {
  console.log('Error:', error.message);
}

console.log('');

// Test 3: List Proxies
console.log('--- Test 3: List Proxies ---');
try {
  const response = await fetch('https://openapi.duoplus.net/api/v1/proxy/list', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'DuoPlus-API-Key': DUOPLUS_API_KEY,
      'Lang': 'en'
    },
    body: JSON.stringify({
      page: 1,
      pagesize: 10
    })
  });

  const data = await response.json();
  console.log('Status:', response.status);
  console.log('Response:', JSON.stringify(data, null, 2));
} catch (error) {
  console.log('Error:', error.message);
}

console.log('');

// Test 4: Empty body request
console.log('--- Test 4: List Cloud Phones (empty body) ---');
try {
  const response = await fetch('https://openapi.duoplus.net/api/v1/cloudPhone/list', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'DuoPlus-API-Key': DUOPLUS_API_KEY,
      'Lang': 'en'
    },
    body: JSON.stringify({})
  });

  const data = await response.json();
  console.log('Status:', response.status);
  console.log('Response:', JSON.stringify(data, null, 2));
} catch (error) {
  console.log('Error:', error.message);
}

console.log('');
console.log('=== Test Complete ===');
