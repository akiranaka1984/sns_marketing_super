import { getSetting } from '../server/db';
import axios from 'axios';

async function checkDeviceStatus() {
  console.log('=== デバイス状態確認 ===\n');
  
  const deviceId = 's0t85';
  console.log(`デバイスID: ${deviceId}\n`);
  
  try {
    const apiKey = await getSetting('DUOPLUS_API_KEY') || process.env.DUOPLUS_API_KEY;
    if (!apiKey) {
      throw new Error('DUOPLUS_API_KEY is not set');
    }
    
    const API_URL = process.env.DUOPLUS_API_URL || "https://openapi.duoplus.net";
    
    // デバイス情報を取得
    console.log('1. デバイス情報を取得中...');
    const deviceListResponse = await axios.post(
      `${API_URL}/api/v1/cloudPhone/list`,
      {
        page: 1,
        pagesize: 100
      },
      {
        headers: {
          'DuoPlus-API-Key': apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );
    
    const devices = deviceListResponse.data?.data?.list || [];
    const device = devices.find((d: any) => d.id === deviceId);
    
    if (device) {
      console.log('✅ デバイスが見つかりました');
      console.log(`   名前: ${device.name}`);
      console.log(`   ステータス: ${device.status}`);
      console.log(`   ステータス説明: ${getStatusDescription(device.status)}`);
      console.log(`   OS: ${device.os}`);
      console.log(`   IP: ${device.ip}`);
      console.log('');
      
      if (device.status !== 1) {
        console.log('⚠️ デバイスが起動していません！');
        console.log('   DuoPlusダッシュボードからデバイスを起動してください。');
        return;
      }
    } else {
      console.log('❌ デバイスが見つかりませんでした');
      return;
    }
    
    // 簡単なADBコマンドをテスト
    console.log('2. ADB接続をテスト中...');
    const adbTestResponse = await axios.post(
      `${API_URL}/api/v1/cloudPhone/adb`,
      {
        image_ids: [deviceId],
        command: 'echo "test"'
      },
      {
        headers: {
          'DuoPlus-API-Key': apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );
    
    console.log('ADBレスポンス:', JSON.stringify(adbTestResponse.data, null, 2));
    
  } catch (error: any) {
    console.error('❌ エラーが発生しました:', error.message);
    if (error.response) {
      console.error('APIレスポンス:', JSON.stringify(error.response.data, null, 2));
    }
  }
  
  console.log('\n=== 確認完了 ===');
}

function getStatusDescription(status: number): string {
  const statusMap: Record<number, string> = {
    0: '未設定',
    1: '起動中',
    2: '停止中',
    3: '期限切れ',
    4: '更新期限切れ',
    10: '起動処理中',
    11: '設定中',
    12: '設定失敗'
  };
  return statusMap[status] || `不明 (${status})`;
}

checkDeviceStatus().catch(console.error);
