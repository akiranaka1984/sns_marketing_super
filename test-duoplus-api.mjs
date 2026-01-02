/**
 * DuoPlus API Test Script
 * Tests the actual API response with the configured API key
 */

import { config } from 'dotenv';
config();

const DUOPLUS_API_KEY = process.env.DUOPLUS_API_KEY || '';

console.log('=== DuoPlus API Test ===');
console.log(`API Key configured: ${DUOPLUS_API_KEY ? 'Yes (length: ' + DUOPLUS_API_KEY.length + ')' : 'No'}`);
console.log(`API Key (first 8 chars): ${DUOPLUS_API_KEY.substring(0, 8)}...`);
console.log('');

// Test 1: List Cloud Phones
console.log('--- Test 1: List Cloud Phones ---');
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
      page_size: 10
    })
  });

  const data = await response.json();
  console.log('Status:', response.status);
  console.log('Response:', JSON.stringify(data, null, 2));
} catch (error) {
  console.log('Error:', error.message);
}

console.log('');

// Test 2: List Proxies
console.log('--- Test 2: List Proxies ---');
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

// Test 3: Get Account Info (if available)
console.log('--- Test 3: Get Account Info ---');
try {
  const response = await fetch('https://openapi.duoplus.net/api/v1/user/info', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'DuoPlus-API-Key': DUOPLUS_API_KEY,
      'Lang': 'en'
    }
  });

  const data = await response.json();
  console.log('Status:', response.status);
  console.log('Response:', JSON.stringify(data, null, 2));
} catch (error) {
  console.log('Error:', error.message);
}

console.log('');
console.log('=== Test Complete ===');
