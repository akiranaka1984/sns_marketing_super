import axios from 'axios';
import { db } from './db';
import { settings } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

const API_URL = 'https://openapi.duoplus.net';
const DEVICE_ID = 's0t85';

async function getApiKey(): Promise<string | null> {
  try {
    const result = await db.query.settings.findFirst({
      where: eq(settings.key, 'DUOPLUS_API_KEY'),
    });
    return result?.value || null;
  } catch (error) {
    console.error('Failed to get API key:', error);
    return null;
  }
}

async function testResolution() {
  const apiKey = await getApiKey();
  if (!apiKey) {
    console.error('API key not found');
    return;
  }

  try {
    console.log('Testing wm size command...');
    const response = await axios.post(
      `${API_URL}/api/v1/cloudPhone/command`,
      {
        image_id: DEVICE_ID,
        command: 'wm size',
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'DuoPlus-API-Key': apiKey,
          'Lang': 'en',
        },
        timeout: 60000,
      }
    );
    
    console.log('\n=== Full Response ===');
    console.log(JSON.stringify(response.data, null, 2));
    
    console.log('\n=== Response.data.content ===');
    console.log(JSON.stringify(response.data.content, null, 2));
    console.log('Type:', typeof response.data.content);
    
  } catch (error: any) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
  
  process.exit(0);
}

testResolution();
