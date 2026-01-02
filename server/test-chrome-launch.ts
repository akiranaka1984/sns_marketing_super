/**
 * Test Chrome Browser Launch
 * Test different approaches to launch Chrome browser
 */

import { openBrowser } from './browser-automation';

const DEVICE_ID = 's0t85';
const TEST_URL = 'https://x.com';

async function testChromeLaunch() {
  console.log('='.repeat(60));
  console.log('Testing Chrome Browser Launch');
  console.log('='.repeat(60));
  console.log(`Device ID: ${DEVICE_ID}`);
  console.log(`Test URL: ${TEST_URL}`);
  console.log('='.repeat(60));
  
  try {
    console.log('\n[Test] Starting Chrome browser launch test...\n');
    
    const result = await openBrowser(DEVICE_ID, TEST_URL);
    
    console.log('\n' + '='.repeat(60));
    console.log('Test Result:', result ? '✓ SUCCESS' : '✗ FAILED');
    console.log('='.repeat(60));
    
    if (result) {
      console.log('\n✓ Chrome browser launched successfully!');
      console.log('Please check the device to verify X is loaded.');
    } else {
      console.log('\n✗ All approaches failed to launch Chrome browser.');
      console.log('Please check the logs above for details.');
    }
    
  } catch (error: any) {
    console.error('\n✗ Test failed with error:', error.message);
  }
  
  process.exit(0);
}

testChromeLaunch();
