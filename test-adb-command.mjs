/**
 * DuoPlus API ADB Command Test Script
 * Tests ADB command execution on cloud phones
 */

import mysql from 'mysql2/promise';
import { config } from 'dotenv';
config();

const DATABASE_URL = process.env.DATABASE_URL;

async function getApiKeyFromDatabase() {
  const url = new URL(DATABASE_URL);
  const connection = await mysql.createConnection({
    host: url.hostname,
    port: parseInt(url.port) || 4000,
    user: url.username,
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    ssl: { rejectUnauthorized: true }
  });

  const [rows] = await connection.execute(
    'SELECT `value` FROM settings WHERE `key` = ?',
    ['DUOPLUS_API_KEY']
  );
  
  await connection.end();
  return rows.length > 0 ? rows[0].value : null;
}

async function executeAdbCommand(apiKey, imageId, command) {
  const response = await fetch('https://openapi.duoplus.net/api/v1/cloudPhone/command', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'DuoPlus-API-Key': apiKey,
      'Lang': 'en'
    },
    body: JSON.stringify({
      image_id: imageId,
      command: command
    })
  });

  return await response.json();
}

async function getDeviceList(apiKey) {
  const response = await fetch('https://openapi.duoplus.net/api/v1/cloudPhone/list', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'DuoPlus-API-Key': apiKey,
      'Lang': 'en'
    },
    body: JSON.stringify({
      page: 1,
      pagesize: 10,
      link_status: ["1"]  // Only powered on devices
    })
  });

  return await response.json();
}

async function main() {
  try {
    console.log('=== DuoPlus ADB Command Test ===\n');
    
    // Get API key from database
    console.log('Fetching API key from database...');
    const apiKey = await getApiKeyFromDatabase();
    
    if (!apiKey) {
      console.log('No API key found in database');
      return;
    }
    console.log('API key retrieved successfully\n');

    // Get list of powered on devices
    console.log('--- Getting powered on devices ---');
    const deviceList = await getDeviceList(apiKey);
    
    if (deviceList.code !== 200 || !deviceList.data?.list?.length) {
      console.log('No powered on devices found');
      console.log('Response:', JSON.stringify(deviceList, null, 2));
      return;
    }

    const poweredOnDevices = deviceList.data.list.filter(d => d.status === 1);
    console.log(`Found ${poweredOnDevices.length} powered on device(s):`);
    poweredOnDevices.forEach(d => {
      console.log(`  - ${d.id}: ${d.name} (${d.os}, ${d.area})`);
    });
    console.log('');

    // Use the first powered on device for testing
    const testDevice = poweredOnDevices[0];
    console.log(`Using device: ${testDevice.id} (${testDevice.name})\n`);

    // Test 1: Simple ls command
    console.log('--- Test 1: ls command ---');
    const lsResult = await executeAdbCommand(apiKey, testDevice.id, 'ls /sdcard');
    console.log('Response:', JSON.stringify(lsResult, null, 2));
    console.log('');

    // Test 2: Get screen resolution
    console.log('--- Test 2: Get screen resolution ---');
    const resolutionResult = await executeAdbCommand(apiKey, testDevice.id, 'wm size');
    console.log('Response:', JSON.stringify(resolutionResult, null, 2));
    console.log('');

    // Test 3: Screen tap (center of screen - approximately 540x960 for typical phone)
    console.log('--- Test 3: Screen tap at center ---');
    const tapResult = await executeAdbCommand(apiKey, testDevice.id, 'input tap 540 960');
    console.log('Response:', JSON.stringify(tapResult, null, 2));
    console.log('');

    // Test 4: Swipe gesture
    console.log('--- Test 4: Swipe up gesture ---');
    const swipeResult = await executeAdbCommand(apiKey, testDevice.id, 'input swipe 540 1500 540 500 500');
    console.log('Response:', JSON.stringify(swipeResult, null, 2));
    console.log('');

    // Test 5: Text input
    console.log('--- Test 5: Text input ---');
    const textResult = await executeAdbCommand(apiKey, testDevice.id, 'input text "Hello"');
    console.log('Response:', JSON.stringify(textResult, null, 2));
    console.log('');

    // Test 6: Press home button
    console.log('--- Test 6: Press home button ---');
    const homeResult = await executeAdbCommand(apiKey, testDevice.id, 'input keyevent KEYCODE_HOME');
    console.log('Response:', JSON.stringify(homeResult, null, 2));
    console.log('');

    // Test 7: Take screenshot (save to device)
    console.log('--- Test 7: Take screenshot ---');
    const screenshotResult = await executeAdbCommand(apiKey, testDevice.id, 'screencap -p /sdcard/test_screenshot.png');
    console.log('Response:', JSON.stringify(screenshotResult, null, 2));
    console.log('');

    // Test 8: List installed packages
    console.log('--- Test 8: List installed packages (first 10) ---');
    const packagesResult = await executeAdbCommand(apiKey, testDevice.id, 'pm list packages | head -10');
    console.log('Response:', JSON.stringify(packagesResult, null, 2));
    console.log('');

    console.log('=== Test Complete ===');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
