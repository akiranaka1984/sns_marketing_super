import { executeAdb } from "./duoplus";

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * デバイスのスクリーンショットをBase64で取得
 * ※デバイス画面のみ（1080x1920）を取得する
 * 
 * DuoPlus APIのレート制限対策:
 * - 最大3回リトライ
 * - リトライ間隔: 3秒、5秒、10秒
 */
export async function captureScreenshot(deviceId: string, maxRetries: number = 3): Promise<string | null> {
  const retryDelays = [3000, 5000, 10000]; // リトライ間隔（ミリ秒）
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`[Screenshot] Attempt ${attempt + 1}/${maxRetries} for device ${deviceId}`);
      
      // 1. スクリーンショットを撮影
      await executeAdb(deviceId, "screencap -p /sdcard/screen.png");
      await sleep(500);

      // 2. Base64で取得
      const result = await executeAdb(deviceId, "base64 /sdcard/screen.png");

      // 改行を除去して返す
      const base64 = result.content?.replace(/\n/g, "").trim();
      
      if (!base64 || base64.length === 0) {
        throw new Error("Empty screenshot data received");
      }
      
      console.log(`[Screenshot] Success on attempt ${attempt + 1}, size: ${base64.length} bytes`);
      return base64;
    } catch (error: any) {
      console.error(`[Screenshot] Attempt ${attempt + 1} failed:`, error.message);
      
      // レート制限エラーの場合
      if (error.message?.includes("Please do not repeat the operation")) {
        console.log(`[Screenshot] Rate limit detected, waiting ${retryDelays[attempt] / 1000}s before retry...`);
        
        // 最後の試行でない場合はリトライ
        if (attempt < maxRetries - 1) {
          await sleep(retryDelays[attempt]);
          continue;
        }
      }
      
      // 最後の試行でも失敗した場合
      if (attempt === maxRetries - 1) {
        console.error(`[Screenshot] All ${maxRetries} attempts failed for device ${deviceId}`);
        return null;
      }
      
      // その他のエラーの場合も短い待機後にリトライ
      await sleep(retryDelays[attempt]);
    }
  }
  
  return null;
}
