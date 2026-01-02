/**
 * SNS App Operation Test Script
 * Tests actual SNS app operations on DuoPlus cloud phones
 */

import mysql from 'mysql2/promise';
import { config } from 'dotenv';
import fs from 'fs';
config();

const DATABASE_URL = process.env.DATABASE_URL;
const API_URL = 'https://openapi.duoplus.net';

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
      pagesize: 10,
      link_status: ["1"]
    })
  });

  return await response.json();
}

async function getScreenshot(apiKey, imageId) {
  const response = await fetch(`${API_URL}/api/v1/cloudPhone/screenshot`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'DuoPlus-API-Key': apiKey,
      'Lang': 'en'
    },
    body: JSON.stringify({
      image_id: imageId
    })
  });

  return await response.json();
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  try {
    console.log('=== SNS App Operation Test ===\n');
    
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

    // Step 1: Check installed SNS apps
    console.log('--- Step 1: Check installed SNS apps ---');
    const snsPackages = [
      'com.twitter.android',           // Twitter/X
      'com.zhiliaoapp.musically',      // TikTok
      'com.ss.android.ugc.trill',      // TikTok (alternative)
      'com.instagram.android',         // Instagram
      'com.facebook.katana',           // Facebook
      'com.facebook.orca',             // Messenger
      'jp.naver.line.android',         // LINE
      'com.whatsapp',                  // WhatsApp
      'org.telegram.messenger',        // Telegram
      'com.snapchat.android',          // Snapchat
      'com.pinterest',                 // Pinterest
      'com.linkedin.android',          // LinkedIn
      'com.reddit.frontpage',          // Reddit
      'com.discord',                   // Discord
      'com.google.android.youtube',    // YouTube
    ];

    const packagesResult = await executeAdbCommand(apiKey, testDevice.id, 'pm list packages');
    if (packagesResult.code === 200 && packagesResult.data?.success) {
      const installedPackages = packagesResult.data.content.split('\n').map(p => p.replace('package:', '').trim());
      
      console.log('Installed SNS apps:');
      const installedSnsApps = [];
      for (const pkg of snsPackages) {
        if (installedPackages.includes(pkg)) {
          console.log(`  ✅ ${pkg}`);
          installedSnsApps.push(pkg);
        }
      }
      
      if (installedSnsApps.length === 0) {
        console.log('  ❌ No SNS apps found');
        console.log('\nChecking for any social/media apps...');
        const socialKeywords = ['social', 'chat', 'message', 'video', 'photo', 'share'];
        const possibleSocialApps = installedPackages.filter(p => 
          socialKeywords.some(k => p.toLowerCase().includes(k))
        );
        if (possibleSocialApps.length > 0) {
          console.log('Possible social apps:');
          possibleSocialApps.forEach(p => console.log(`  - ${p}`));
        }
      }
      console.log('');
    }

    // Step 2: Go to home screen first
    console.log('--- Step 2: Go to home screen ---');
    await executeAdbCommand(apiKey, testDevice.id, 'input keyevent KEYCODE_HOME');
    await sleep(1000);
    console.log('Home button pressed\n');

    // Step 3: Get initial screenshot
    console.log('--- Step 3: Get initial screenshot ---');
    const initialScreenshot = await getScreenshot(apiKey, testDevice.id);
    if (initialScreenshot.code === 200 && initialScreenshot.data?.screenshot_url) {
      console.log('Screenshot URL:', initialScreenshot.data.screenshot_url);
    } else {
      console.log('Screenshot response:', JSON.stringify(initialScreenshot, null, 2));
    }
    console.log('');

    // Step 4: Try to launch an SNS app (if available)
    console.log('--- Step 4: Try to launch Chrome (for SNS web access) ---');
    const chromePackage = 'com.android.chrome';
    const launchResult = await executeAdbCommand(
      apiKey, 
      testDevice.id, 
      `am start -n ${chromePackage}/com.google.android.apps.chrome.Main`
    );
    console.log('Launch result:', JSON.stringify(launchResult, null, 2));
    await sleep(3000);
    console.log('');

    // Step 5: Get screenshot after launching app
    console.log('--- Step 5: Get screenshot after launching app ---');
    const afterLaunchScreenshot = await getScreenshot(apiKey, testDevice.id);
    if (afterLaunchScreenshot.code === 200 && afterLaunchScreenshot.data?.screenshot_url) {
      console.log('Screenshot URL:', afterLaunchScreenshot.data.screenshot_url);
    } else {
      console.log('Screenshot response:', JSON.stringify(afterLaunchScreenshot, null, 2));
    }
    console.log('');

    // Step 6: Try to open Twitter/X web
    console.log('--- Step 6: Open Twitter/X in browser ---');
    const openUrlResult = await executeAdbCommand(
      apiKey,
      testDevice.id,
      'am start -a android.intent.action.VIEW -d "https://twitter.com"'
    );
    console.log('Open URL result:', JSON.stringify(openUrlResult, null, 2));
    await sleep(5000);
    console.log('');

    // Step 7: Get screenshot of Twitter page
    console.log('--- Step 7: Get screenshot of Twitter page ---');
    const twitterScreenshot = await getScreenshot(apiKey, testDevice.id);
    if (twitterScreenshot.code === 200 && twitterScreenshot.data?.screenshot_url) {
      console.log('Screenshot URL:', twitterScreenshot.data.screenshot_url);
    } else {
      console.log('Screenshot response:', JSON.stringify(twitterScreenshot, null, 2));
    }
    console.log('');

    // Step 8: Test basic interactions
    console.log('--- Step 8: Test basic interactions ---');
    
    // Scroll down
    console.log('Scrolling down...');
    await executeAdbCommand(apiKey, testDevice.id, 'input swipe 540 1500 540 500 500');
    await sleep(1000);
    
    // Scroll up
    console.log('Scrolling up...');
    await executeAdbCommand(apiKey, testDevice.id, 'input swipe 540 500 540 1500 500');
    await sleep(1000);
    
    // Tap center of screen
    console.log('Tapping center...');
    await executeAdbCommand(apiKey, testDevice.id, 'input tap 540 960');
    await sleep(1000);
    console.log('');

    // Step 9: Final screenshot
    console.log('--- Step 9: Final screenshot ---');
    const finalScreenshot = await getScreenshot(apiKey, testDevice.id);
    if (finalScreenshot.code === 200 && finalScreenshot.data?.screenshot_url) {
      console.log('Screenshot URL:', finalScreenshot.data.screenshot_url);
    } else {
      console.log('Screenshot response:', JSON.stringify(finalScreenshot, null, 2));
    }
    console.log('');

    // Step 10: Go back to home
    console.log('--- Step 10: Return to home screen ---');
    await executeAdbCommand(apiKey, testDevice.id, 'input keyevent KEYCODE_HOME');
    console.log('Home button pressed\n');

    console.log('=== SNS App Operation Test Complete ===');

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

main();
