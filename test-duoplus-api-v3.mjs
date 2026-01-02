/**
 * DuoPlus API Test Script v3
 * Reads API key from database and tests the API
 */

import mysql from 'mysql2/promise';
import { config } from 'dotenv';
config();

const DATABASE_URL = process.env.DATABASE_URL;

async function getApiKeyFromDatabase() {
  // Parse DATABASE_URL
  const url = new URL(DATABASE_URL);
  const connection = await mysql.createConnection({
    host: url.hostname,
    port: parseInt(url.port) || 4000,
    user: url.username,
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    ssl: {
      rejectUnauthorized: true
    }
  });

  const [rows] = await connection.execute(
    'SELECT `value` FROM settings WHERE `key` = ?',
    ['DUOPLUS_API_KEY']
  );
  
  await connection.end();
  
  if (rows.length > 0) {
    return rows[0].value;
  }
  return null;
}

async function testDuoPlusAPI(apiKey) {
  console.log('=== DuoPlus API Test v3 (from database) ===');
  console.log(`API Key configured: ${apiKey ? 'Yes (length: ' + apiKey.length + ')' : 'No'}`);
  console.log(`API Key (first 8 chars): ${apiKey ? apiKey.substring(0, 8) + '...' : 'N/A'}`);
  console.log('');

  // Test 1: List Cloud Phones
  console.log('--- Test 1: List Cloud Phones ---');
  try {
    const response = await fetch('https://openapi.duoplus.net/api/v1/cloudPhone/list', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'DuoPlus-API-Key': apiKey,
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

  // Test 2: List Proxies
  console.log('--- Test 2: List Proxies ---');
  try {
    const response = await fetch('https://openapi.duoplus.net/api/v1/proxy/list', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'DuoPlus-API-Key': apiKey,
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
  console.log('=== Test Complete ===');
}

// Main
async function main() {
  try {
    console.log('Fetching API key from database...');
    const apiKey = await getApiKeyFromDatabase();
    
    if (!apiKey) {
      console.log('No API key found in database');
      return;
    }
    
    console.log('API key retrieved from database');
    console.log('');
    
    await testDuoPlusAPI(apiKey);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
