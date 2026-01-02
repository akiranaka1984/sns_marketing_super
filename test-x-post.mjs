/**
 * X (Twitter) Post Automation Test Script
 * Creates a new post on X with text content on all devices
 */

import mysql from 'mysql2/promise';
import { config } from 'dotenv';
config();

const DATABASE_URL = process.env.DATABASE_URL;
const API_URL = 'https://openapi.duoplus.net';

// Generate unique test post content for each device
function generatePostContent(deviceName, index) {
  const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const emojis = ['🚀', '✨', '🎯', '💡', '🔥'];
  const emoji = emojis[index % emojis.length];
  
  return `${emoji} DuoPlus API Automation Test ${emoji}

Device: ${deviceName}
Time: ${timestamp}

Testing automated posting via DuoPlus Cloud Phone API!

#duoplus_test #automation #cloudphone`;
}

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

async function postToX(apiKey, device, postContent, index) {
  const deviceId = device.id;
  const deviceName = device.name;
  
  console.log(`\n--- Device: ${deviceName} (${deviceId}) ---`);
  console.log(`Post content preview: "${postContent.substring(0, 50)}..."`);
  
  try {
    // Step 1: Go to home screen first
    console.log('  1. Going to home screen...');
    await executeAdbCommand(apiKey, deviceId, 'input keyevent KEYCODE_HOME');
    await sleep(1000);

    // Step 2: Force stop X to ensure clean start
    console.log('  2. Force stopping X...');
    await executeAdbCommand(apiKey, deviceId, 'am force-stop com.twitter.android');
    await sleep(500);

    // Step 3: Launch X (Twitter)
    console.log('  3. Launching X...');
    await executeAdbCommand(
      apiKey, 
      deviceId, 
      'monkey -p com.twitter.android -c android.intent.category.LAUNCHER 1'
    );
    
    // Wait for X to fully load
    console.log('  4. Waiting for X to load (10 seconds)...');
    await sleep(10000);

    // Step 4: Tap on the compose/new post button (FAB - Floating Action Button)
    // The compose button is typically a blue circular button at bottom right
    // Screen resolution is 1080x1920
    // FAB is usually around (950, 1700) on most X layouts
    console.log('  5. Tapping compose button...');
    await executeAdbCommand(apiKey, deviceId, 'input tap 950 1700');
    await sleep(3000);

    // Step 5: Wait for compose screen to load
    console.log('  6. Waiting for compose screen...');
    await sleep(2000);

    // Step 6: Tap on the text input area
    // The text area is typically in the upper portion of the compose screen
    console.log('  7. Tapping text input area...');
    await executeAdbCommand(apiKey, deviceId, 'input tap 540 400');
    await sleep(1000);

    // Step 7: Input the post content
    // Note: We need to escape special characters and handle multi-line text
    console.log('  8. Inputting post content...');
    
    // Split content into lines and input each line
    const lines = postContent.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim()) {
        // Escape special characters for shell
        const escapedLine = line.replace(/"/g, '\\"').replace(/'/g, "\\'");
        await executeAdbCommand(apiKey, deviceId, `input text "${escapedLine}"`);
      }
      // Add newline between lines (except for the last line)
      if (i < lines.length - 1) {
        await executeAdbCommand(apiKey, deviceId, 'input keyevent KEYCODE_ENTER');
      }
      await sleep(300);
    }
    
    await sleep(1000);

    // Step 8: Tap the Post button
    // The Post button is typically at the top right corner
    console.log('  9. Tapping Post button...');
    await executeAdbCommand(apiKey, deviceId, 'input tap 980 100');
    await sleep(3000);

    // Step 9: Wait for post to be submitted
    console.log('  10. Waiting for post submission...');
    await sleep(3000);

    console.log(`  ✅ ${deviceName}: X post completed`);
    return { success: true, device: deviceName, deviceId };

  } catch (error) {
    console.log(`  ❌ ${deviceName}: Error - ${error.message}`);
    return { success: false, device: deviceName, deviceId, error: error.message };
  }
}

async function main() {
  try {
    console.log('=== X (Twitter) Post Automation Test ===\n');
    
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

    // Execute X post on all devices
    console.log('\n=== Starting X Post on All Devices ===');
    
    const results = [];
    for (let i = 0; i < poweredOnDevices.length; i++) {
      const device = poweredOnDevices[i];
      const postContent = generatePostContent(device.name, i);
      const result = await postToX(apiKey, device, postContent, i);
      results.push(result);
      
      // Delay between devices to avoid rate limiting
      if (i < poweredOnDevices.length - 1) {
        console.log('\n  Waiting 5 seconds before next device...');
        await sleep(5000);
      }
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
    console.log('Note: Please check the DuoPlus dashboard to verify the posts on each device.');
    console.log('Important: Make sure each device is logged into an X account before running this test.');

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

main();
