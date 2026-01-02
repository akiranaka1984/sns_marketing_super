#!/usr/bin/env node
/**
 * 手動テスト用スクリプト: いいね機能
 * 
 * 使い方:
 * node test-like-manual.mjs <deviceId> <postUrl>
 * 
 * 例:
 * node test-like-manual.mjs LVdTJ "https://x.com/AkiraNakam61955/status/1871067074068594946"
 */

import { executeLike } from "./server/like-service.js";

const args = process.argv.slice(2);

if (args.length < 2) {
  console.error("Usage: node test-like-manual.mjs <deviceId> <postUrl>");
  console.error('Example: node test-like-manual.mjs LVdTJ "https://x.com/AkiraNakam61955/status/1871067074068594946"');
  process.exit(1);
}

const [deviceId, postUrl] = args;

console.log("=".repeat(80));
console.log("手動テスト: いいね機能");
console.log("=".repeat(80));
console.log(`デバイスID: ${deviceId}`);
console.log(`投稿URL: ${postUrl}`);
console.log("=".repeat(80));
console.log("");

// いいねを実行
const result = await executeLike(deviceId, postUrl);

console.log("");
console.log("=".repeat(80));
console.log("実行結果:");
console.log("=".repeat(80));
console.log(JSON.stringify(result, null, 2));
console.log("=".repeat(80));

if (result.success) {
  console.log("✅ いいねが成功しました");
  process.exit(0);
} else {
  console.log("❌ いいねが失敗しました");
  console.log(`エラー: ${result.error}`);
  process.exit(1);
}
