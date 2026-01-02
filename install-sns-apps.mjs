/**
 * SNS App Installation Script
 * Installs Twitter/TikTok/Instagram on all DuoPlus cloud phones
 */

import mysql from 'mysql2/promise';
import { config } from 'dotenv';
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

async function getPlatformApps(apiKey) {
  const response = await fetch(`${API_URL}/api/v1/app/list`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'DuoPlus-API-Key': apiKey,
      'Lang': 'en'
    },
    body: JSON.stringify({
      page: 1,
      pagesize: 100
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
      pagesize: 20,
      link_status: ["1"]  // Only powered on devices
    })
  });

  return await response.json();
}

async function installApp(apiKey, imageIds, appId, appVersionId = null) {
  const body = {
    image_ids: imageIds,
    app_id: appId
  };
  
  if (appVersionId) {
    body.app_version_id = appVersionId;
  }

  const response = await fetch(`${API_URL}/api/v1/app/install`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'DuoPlus-API-Key': apiKey,
      'Lang': 'en'
    },
    body: JSON.stringify(body)
  });

  return await response.json();
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  try {
    console.log('=== SNS App Installation Script ===\n');
    
    // Get API key from database
    console.log('Fetching API key from database...');
    const apiKey = await getApiKeyFromDatabase();
    
    if (!apiKey) {
      console.log('No API key found in database');
      return;
    }
    console.log('API key retrieved successfully\n');

    // Step 1: Get list of platform apps
    console.log('--- Step 1: Get list of platform apps ---');
    const appsResult = await getPlatformApps(apiKey);
    
    if (appsResult.code !== 200) {
      console.log('Failed to get platform apps:', JSON.stringify(appsResult, null, 2));
      return;
    }

    const apps = appsResult.data.list;
    console.log(`Found ${apps.length} platform apps\n`);

    // Find SNS apps
    const snsAppNames = ['twitter', 'tiktok', 'instagram', 'facebook', 'x'];
    const snsApps = apps.filter(app => 
      snsAppNames.some(name => 
        app.name.toLowerCase().includes(name) || 
        app.pkg?.toLowerCase().includes(name)
      )
    );

    if (snsApps.length === 0) {
      console.log('No SNS apps found in platform apps list');
      console.log('Available apps:');
      apps.forEach(app => {
        console.log(`  - ${app.name} (${app.pkg}) - ID: ${app.id}`);
      });
      return;
    }

    console.log('Found SNS apps:');
    snsApps.forEach(app => {
      console.log(`  - ${app.name} (${app.pkg})`);
      console.log(`    ID: ${app.id}`);
      if (app.version_list?.length > 0) {
        console.log(`    Versions: ${app.version_list.map(v => v.name).join(', ')}`);
      }
    });
    console.log('');

    // Step 2: Get list of powered on devices
    console.log('--- Step 2: Get list of powered on devices ---');
    const deviceList = await getDeviceList(apiKey);
    
    if (deviceList.code !== 200 || !deviceList.data?.list?.length) {
      console.log('No powered on devices found');
      console.log('Response:', JSON.stringify(deviceList, null, 2));
      return;
    }

    const poweredOnDevices = deviceList.data.list.filter(d => d.status === 1);
    const deviceIds = poweredOnDevices.map(d => d.id);
    
    console.log(`Found ${poweredOnDevices.length} powered on device(s):`);
    poweredOnDevices.forEach(d => {
      console.log(`  - ${d.id}: ${d.name}`);
    });
    console.log('');

    // Step 3: Install each SNS app on all devices
    console.log('--- Step 3: Install SNS apps on all devices ---\n');
    
    for (const app of snsApps) {
      console.log(`Installing ${app.name}...`);
      
      // Get the latest version if available
      const latestVersion = app.version_list?.[0];
      
      const result = await installApp(
        apiKey, 
        deviceIds, 
        app.id,
        latestVersion?.id
      );
      
      if (result.code === 200) {
        console.log(`  ✅ ${app.name} installation started successfully`);
      } else {
        console.log(`  ❌ ${app.name} installation failed: ${result.message}`);
        console.log(`     Response: ${JSON.stringify(result)}`);
      }
      
      // Wait between installations
      await sleep(2000);
    }

    console.log('\n=== Installation Complete ===');
    console.log('Note: App installations may take a few minutes to complete on the devices.');
    console.log('You can check the installation status in the DuoPlus dashboard.');

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

main();
