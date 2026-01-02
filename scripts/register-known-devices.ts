import { db } from '../server/db';
import { devices } from '../drizzle/schema';

const KNOWN_DEVICES = [
  { deviceId: 's0t85', name: 'Device s0t85', status: 'available' as const },
  { deviceId: 'snap_LVdTJ', name: 'Device snap_LVdTJ', status: 'available' as const },
  { deviceId: 'snap_fmnPp', name: 'Device snap_fmnPp', status: 'available' as const },
  { deviceId: 'snap_pJciL', name: 'Device snap_pJciL', status: 'available' as const },
];

async function registerDevices() {
  try {
    console.log('='.repeat(60));
    console.log('既知のデバイスをデータベースに登録');
    console.log('='.repeat(60));
    
    for (const device of KNOWN_DEVICES) {
      try {
        // Check if device already exists
        const existing = await db.query.devices.findFirst({
          where: (d, { eq }) => eq(d.deviceId, device.deviceId),
        });

        if (existing) {
          console.log(`✓ デバイス ${device.deviceId} は既に登録されています`);
          continue;
        }

        // Insert device
        await db.insert(devices).values({
          deviceId: device.deviceId,
          name: device.name,
          status: device.status,
        });

        console.log(`✅ デバイス ${device.deviceId} を登録しました`);
      } catch (error: any) {
        console.error(`❌ デバイス ${device.deviceId} の登録に失敗:`, error.message);
      }
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('登録完了！');
    console.log('');
    
    // Show all devices
    const allDevices = await db.query.devices.findMany();
    console.log(`合計 ${allDevices.length} 台のデバイスが登録されています:`);
    allDevices.forEach((d, index) => {
      console.log(`${index + 1}. ${d.deviceId} (${d.name}) - ${d.status}`);
    });

  } catch (error: any) {
    console.error('❌ エラーが発生しました:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

registerDevices();
