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

async function main() {
  console.log('=== インストール済みアプリ確認 ===\n');
  
  const deviceId = 's0t85';
  console.log(`デバイスID: ${deviceId}\n`);
  
  const apiKey = await getSetting('DUOPLUS_API_KEY') || process.env.DUOPLUS_API_KEY;
  if (!apiKey) {
    console.error('DUOPLUS_API_KEY is not set');
    return;
  }
  
  // すべてのインストール済みパッケージを取得
  console.log('すべてのインストール済みパッケージを取得中...\n');
  const allPackages = await executeAdbCommand(apiKey, deviceId, 'pm list packages');
  
  if (allPackages.data) {
    const packages = allPackages.data.split('\n').filter((line: string) => line.includes('package:'));
    console.log(`総パッケージ数: ${packages.length}\n`);
    
    // Instagram関連のパッケージを検索
    console.log('--- Instagram関連のパッケージ ---');
    const instagramPackages = packages.filter((pkg: string) => 
      pkg.toLowerCase().includes('instagram') || 
      pkg.toLowerCase().includes('insta')
    );
    
    if (instagramPackages.length > 0) {
      instagramPackages.forEach((pkg: string) => {
        console.log(pkg);
      });
    } else {
      console.log('Instagram関連のパッケージが見つかりませんでした');
    }
    
    // SNS関連のパッケージを検索
    console.log('\n--- SNS関連のパッケージ ---');
    const snsPackages = packages.filter((pkg: string) => 
      pkg.toLowerCase().includes('facebook') || 
      pkg.toLowerCase().includes('twitter') ||
      pkg.toLowerCase().includes('tiktok') ||
      pkg.toLowerCase().includes('social')
    );
    
    if (snsPackages.length > 0) {
      snsPackages.forEach((pkg: string) => {
        console.log(pkg);
      });
    } else {
      console.log('SNS関連のパッケージが見つかりませんでした');
    }
  } else {
    console.error('パッケージリストの取得に失敗しました');
  }
  
  console.log('\n=== 確認完了 ===');
}

main().catch(console.error);
