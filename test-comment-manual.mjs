#!/usr/bin/env node
/**
 * 手動テスト用スクリプト: コメント機能
 * 
 * 使い方:
 * node test-comment-manual.mjs <deviceId> <postUrl> <postContent> <persona>
 * 
 * 例:
 * node test-comment-manual.mjs LVdTJ "https://x.com/AkiraNakam61955/status/1871067074068594946" "相互連携テスト投稿です" "フレンドリーなユーザー"
 */

import { executeComment } from "./server/comment-service.js";

const args = process.argv.slice(2);

if (args.length < 4) {
  console.error("Usage: node test-comment-manual.mjs <deviceId> <postUrl> <postContent> <persona>");
  console.error('Example: node test-comment-manual.mjs LVdTJ "https://x.com/AkiraNakam61955/status/1871067074068594946" "相互連携テスト投稿です" "フレンドリーなユーザー"');
  process.exit(1);
}

const [deviceId, postUrl, postContent, persona] = args;

console.log("=".repeat(80));
console.log("手動テスト: コメント機能");
console.log("=".repeat(80));
console.log(`デバイスID: ${deviceId}`);
console.log(`投稿URL: ${postUrl}`);
console.log(`投稿内容: ${postContent}`);
console.log(`ペルソナ: ${persona}`);
console.log("=".repeat(80));
console.log("");

// コメントを実行
const result = await executeComment(deviceId, postUrl, postContent, persona);

console.log("");
console.log("=".repeat(80));
console.log("実行結果:");
console.log("=".repeat(80));
console.log(JSON.stringify(result, null, 2));
console.log("=".repeat(80));

if (result.success) {
  console.log("✅ コメントが成功しました");
  console.log(`生成されたコメント: ${result.comment}`);
  process.exit(0);
} else {
  console.log("❌ コメントが失敗しました");
  console.log(`エラー: ${result.error}`);
  process.exit(1);
}
