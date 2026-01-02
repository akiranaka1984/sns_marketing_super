import { db } from './server/db.ts';
import { devices } from './drizzle/schema.ts';
import { eq } from 'drizzle-orm';

const activeDevices = await db
  .select()
  .from(devices)
  .where(eq(devices.status, 1))
  .limit(5);

console.log('Active devices:');
activeDevices.forEach(device => {
  console.log(`  - ${device.deviceId} (${device.deviceName || 'No name'})`);
});

if (activeDevices.length > 0) {
  console.log(`\nUsing first device for testing: ${activeDevices[0].deviceId}`);
}
