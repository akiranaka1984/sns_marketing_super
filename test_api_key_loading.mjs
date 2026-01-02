import { db } from './server/db.js';
import { settings } from './drizzle/schema.js';
import { eq } from 'drizzle-orm';

console.log('=== Testing API Key Loading from Database ===\n');

try {
  // Test database connection
  const result = await db.query.settings.findFirst({
    where: eq(settings.key, 'DUOPLUS_API_KEY'),
  });
  
  if (result) {
    console.log('✅ Successfully loaded API key from database');
    console.log('Key:', result.value);
    console.log('Length:', result.value.length);
    console.log('First 10 chars:', result.value.substring(0, 10) + '...');
    console.log('Last 10 chars:', '...' + result.value.substring(result.value.length - 10));
    
    // Verify it's the correct key
    if (result.value === '9b2f2c48-1e2b-4caa-a329-aec8e6bb7deb') {
      console.log('\n✅ CORRECT API KEY LOADED!');
    } else {
      console.log('\n❌ WRONG API KEY!');
      console.log('Expected: 9b2f2c48-1e2b-4caa-a329-aec8e6bb7deb');
      console.log('Got:', result.value);
    }
  } else {
    console.log('❌ No API key found in database');
  }
} catch (error) {
  console.log('❌ Error:', error.message);
}

process.exit(0);
