import { executeAdb } from "./server/duoplus";
import { captureScreenshot } from "./server/screenshot-service";
import fs from "fs";

const DEVICE_ID = "s0t85";
const POST_URL = "https://x.com/muran95271/status/2002812882019668163";

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testPostScreenshot() {
  console.log("=== 投稿表示スクリーンショットテスト ===\n");
  
  // 1. 投稿URLを開く
  console.log(`1. 投稿URLを開く: ${POST_URL}`);
  await executeAdb(
    DEVICE_ID,
    `am start -a android.intent.action.VIEW -d "${POST_URL}" -p com.android.chrome`
  );
  
  // 2. 異なる待機時間でスクリーンショットを取得
  const delays = [3000, 5000, 8000];
  
  for (const delay of delays) {
    console.log(`\n2. ${delay/1000}秒待機...`);
    await sleep(delay);
    
    console.log(`3. スクリーンショットを取得（${delay/1000}秒後）...`);
    const screenshot = await captureScreenshot(DEVICE_ID);
    
    if (screenshot) {
      const filename = `/home/ubuntu/post_screenshot_${delay}ms.png`;
      // Base64をデコードしてファイルに保存
      const base64Data = screenshot.replace(/^data:image\/png;base64,/, "");
      fs.writeFileSync(filename, Buffer.from(base64Data, 'base64'));
      console.log(`✓ スクリーンショットを保存: ${filename}`);
    } else {
      console.log(`✗ スクリーンショット取得失敗（${delay/1000}秒後）`);
    }
  }
  
  console.log("\n=== テスト完了 ===");
  console.log("スクリーンショットを確認して、投稿が正しく表示されているか確認してください。");
}

testPostScreenshot().catch(console.error);
