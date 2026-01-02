import { executeComment } from "./server/comment-service.ts";

async function testCommentScreenshot() {
  console.log("=== Testing Comment Screenshot Feature ===\n");
  
  // テスト用のパラメータ
  const deviceId = "s0t85"; // 既知の有効なデバイス
  const postUrl = "https://x.com/muran95271/status/1870770451682062622";
  const postContent = "Test post content";
  const commenterPersona = "フレンドリーなユーザー";
  const interactionId = 99999; // テスト用のID
  
  console.log("Test parameters:");
  console.log(`- Device ID: ${deviceId}`);
  console.log(`- Post URL: ${postUrl}`);
  console.log(`- Interaction ID: ${interactionId}`);
  console.log("\nExecuting comment...\n");
  
  const result = await executeComment(
    deviceId,
    postUrl,
    postContent,
    commenterPersona,
    interactionId
  );
  
  console.log("\n=== Test Result ===");
  console.log(JSON.stringify(result, null, 2));
  
  // データベースを確認
  const { drizzle } = await import('drizzle-orm/mysql2');
  const mysql = await import('mysql2/promise');
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  
  const [rows] = await connection.query(
    `SELECT id, interactionType, status, beforeScreenshotUrl, afterScreenshotUrl 
     FROM interactions 
     WHERE id = ?`,
    [interactionId]
  );
  
  console.log("\n=== Database Record ===");
  console.log(JSON.stringify(rows, null, 2));
  
  await connection.end();
}

testCommentScreenshot().catch(console.error);
