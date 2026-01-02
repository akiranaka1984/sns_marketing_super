import { getSetting } from '../server/db';
import axios from 'axios';

async function executeAdbCommand(apiKey: string, deviceId: string, command: string): Promise<any> {
  const API_URL = process.env.DUOPLUS_API_URL || "https://openapi.duoplus.net";
  
  try {
    const response = await axios.post(
      `${API_URL}/api/v1/cloudPhone/adb`,
      {
        image_ids: [deviceId],
        command: command
      },
      {
        headers: {
          'DuoPlus-API-Key': apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );
    
    if (response.data && response.data.data && response.data.data.length > 0) {
      const result = response.data.data[0];
      return {
        success: result.success || false,
        data: result.content || result.message || '',
        message: result.message || ''
      };
    }
    
    return {
      success: false,
      data: '',
      message: 'No data returned from API'
    };
  } catch (error: any) {
    console.error(`[executeAdbCommand] Error:`, error.message);
    return {
      success: false,
      data: '',
      message: error.message
    };
  }
}

async function verifyInstallation() {
  console.log('='.repeat(60));
  console.log('インストール確認');
  console.log('='.repeat(60));
  
  const deviceId = 's0t85';
  console.log(`デバイスID: ${deviceId}\n`);
  
  try {
    const apiKey = await getSetting('DUOPLUS_API_KEY') || process.env.DUOPLUS_API_KEY;
    if (!apiKey) {
      throw new Error('DUOPLUS_API_KEY is not set');
    }
    
    const apps = [
      { name: 'X (Twitter)', package: 'com.twitter.android' },
      { name: 'Instagram', package: 'com.instagram.android' },
      { name: 'TikTok', package: 'com.zhiliaoapp.musically' },
    ];
    
    console.log('インストール済みアプリを確認中...\n');
    
    for (const app of apps) {
      const result = await executeAdbCommand(
        apiKey,
        deviceId,
        `pm list packages | grep ${app.package.split('.')[0]}`
      );
      
      const isInstalled = result.data && result.data.includes(app.package);
      
      if (isInstalled) {
        console.log(`✅ [${app.name}] インストール済み`);
        console.log(`   パッケージ: ${app.package}`);
      } else {
        console.log(`❌ [${app.name}] 未インストール`);
        console.log(`   検索結果: ${result.data || '(なし)'}`);
      }
      console.log('');
    }
    
    console.log('='.repeat(60));
    console.log('確認完了');
    console.log('='.repeat(60));
    
  } catch (error: any) {
    console.error('❌ エラーが発生しました:', error.message);
  }
}

verifyInstallation().catch(console.error);
