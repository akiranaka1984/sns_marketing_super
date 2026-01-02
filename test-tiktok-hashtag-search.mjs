/**
 * TikTok Hashtag Search Test Script
 * Launches TikTok on all devices and searches for a specified hashtag
 */

import mysql from 'mysql2/promise';
import { config } from 'dotenv';
config();

const DATABASE_URL = process.env.DATABASE_URL;
const API_URL = 'https://openapi.duoplus.net';
const HASHTAG = '#duoplus_test';

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

async function getDeviceList(apiKey) {
  const response = await fetch(`${API_URL}/api/v1/cloudPhone/list`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'DuoPlus-API-Key': apiKey,
      'Lang': 'en'
    },
    body: JSON.stringify({
      page: 1,
      pagesize: 20,
      link_status: ["1"]
    })
  });

  return await response.json();
}

async function executeAdbCommand(apiKey, imageId, command) {
  const response = await fetch(`${API_URL}/api/v1/cloudPhone/command`, {
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

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function launchTikTokAndSearch(apiKey, device, hashtag) {
  const deviceId = device.id;
  const deviceName = device.name;
  
  console.log(`\n--- Device: ${deviceName} (${deviceId}) ---`);
  
  try {
    // Step 1: Go to home screen first
    console.log('  1. Going to home screen...');
    await executeAdbCommand(apiKey, deviceId, 'input keyevent KEYCODE_HOME');
    await sleep(1000);

    // Step 2: Force stop TikTok to ensure clean start
    console.log('  2. Force stopping TikTok...');
    await executeAdbCommand(apiKey, deviceId, 'am force-stop com.zhiliaoapp.musically');
    await sleep(500);

    // Step 3: Launch TikTok
    console.log('  3. Launching TikTok...');
    const launchResult = await executeAdbCommand(
      apiKey, 
      deviceId, 
      'am start -n com.zhiliaoapp.musically/com.ss.android.ugc.aweme.splash.SplashActivity'
    );
    
    if (launchResult.code !== 200 || !launchResult.data?.success) {
      // Try alternative launch method
      console.log('  3b. Trying alternative launch method...');
      await executeAdbCommand(
        apiKey,
        deviceId,
        'monkey -p com.zhiliaoapp.musically -c android.intent.category.LAUNCHER 1'
      );
    }
    
    // Wait for TikTok to fully load
    console.log('  4. Waiting for TikTok to load (8 seconds)...');
    await sleep(8000);

    // Step 4: Tap on search icon (typically at top right or bottom navigation)
    // TikTok search icon is usually at the top center or in the navigation bar
    // Screen resolution is 1080x1920
    console.log('  5. Tapping search icon...');
    
    // Try tapping the search/discover icon in the bottom navigation bar
    // The search/discover tab is usually the second icon from left
    await executeAdbCommand(apiKey, deviceId, 'input tap 270 1850');
    await sleep(3000);

    // Step 5: Tap on the search bar at the top
    console.log('  6. Tapping search bar...');
    await executeAdbCommand(apiKey, deviceId, 'input tap 540 150');
    await sleep(2000);

    // Step 6: Input the hashtag
    console.log(`  7. Inputting hashtag: ${hashtag}...`);
    // Clear any existing text first
    await executeAdbCommand(apiKey, deviceId, 'input keyevent KEYCODE_MOVE_END');
    await executeAdbCommand(apiKey, deviceId, 'input keyevent --longpress KEYCODE_DEL');
    await sleep(500);
    
    // Input the hashtag (without # as it might cause issues)
    const searchTerm = hashtag.replace('#', '');
    await executeAdbCommand(apiKey, deviceId, `input text "${searchTerm}"`);
    await sleep(1000);

    // Step 7: Press Enter to search
    console.log('  8. Pressing Enter to search...');
    await executeAdbCommand(apiKey, deviceId, 'input keyevent KEYCODE_ENTER');
    await sleep(3000);

    // Step 8: Try to tap on hashtag tab if available
    console.log('  9. Looking for hashtag results...');
    // Tap on "Hashtags" tab if visible (usually around middle of screen)
    await executeAdbCommand(apiKey, deviceId, 'input tap 540 350');
    await sleep(2000);

    console.log(`  ✅ ${deviceName}: TikTok hashtag search completed`);
    return { success: true, device: deviceName, deviceId };

  } catch (error) {
    console.log(`  ❌ ${deviceName}: Error - ${error.message}`);
    return { success: false, device: deviceName, deviceId, error: error.message };
  }
}

async function main() {
  try {
    console.log('=== TikTok Hashtag Search Test ===');
    console.log(`Hashtag: ${HASHTAG}\n`);
    
    // Get API key from database
    console.log('Fetching API key from database...');
    const apiKey = await getApiKeyFromDatabase();
    
    if (!apiKey) {
      console.log('No API key found in database');
      return;
    }
    console.log('API key retrieved successfully');

    // Get list of powered on devices
    console.log('\nGetting powered on devices...');
    const deviceList = await getDeviceList(apiKey);
    
    if (deviceList.code !== 200 || !deviceList.data?.list?.length) {
      console.log('No powered on devices found');
      return;
    }

    const poweredOnDevices = deviceList.data.list.filter(d => d.status === 1);
    console.log(`Found ${poweredOnDevices.length} powered on device(s)`);

    // Execute TikTok launch and search on all devices
    console.log('\n=== Starting TikTok Hashtag Search on All Devices ===');
    
    const results = [];
    for (const device of poweredOnDevices) {
      const result = await launchTikTokAndSearch(apiKey, device, HASHTAG);
      results.push(result);
      
      // Small delay between devices to avoid rate limiting
      await sleep(1000);
    }

    // Summary
    console.log('\n=== Test Summary ===');
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`Total devices: ${results.length}`);
    console.log(`Successful: ${successful}`);
    console.log(`Failed: ${failed}`);
    
    if (failed > 0) {
      console.log('\nFailed devices:');
      results.filter(r => !r.success).forEach(r => {
        console.log(`  - ${r.device}: ${r.error}`);
      });
    }

    console.log('\n=== Test Complete ===');
    console.log('Note: Please check the DuoPlus dashboard to verify the search results on each device.');

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

main();
