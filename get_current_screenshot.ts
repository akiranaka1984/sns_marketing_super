import { captureScreenshot } from "./server/screenshot-service";
import fs from "fs";

const DEVICE_ID = "s0t85";

async function getCurrentScreenshot() {
  console.log("現在のデバイス画面のスクリーンショットを取得中...");
  
  const screenshot = await captureScreenshot(DEVICE_ID);
  
  if (screenshot) {
    const filename = `/home/ubuntu/current_screen.png`;
    const base64Data = screenshot.replace(/^data:image\/png;base64,/, "");
    fs.writeFileSync(filename, Buffer.from(base64Data, 'base64'));
    console.log(`✓ スクリーンショットを保存: ${filename}`);
  } else {
    console.log(`✗ スクリーンショット取得失敗`);
  }
}

getCurrentScreenshot().catch(console.error);
