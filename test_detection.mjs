import { detectLikeButtonY, detectCommentButtonY } from './server/detect-y-coordinate.ts';

const screenshotPath = '/home/ubuntu/upload/スクリーンショット2025-12-2716.51.25.png';

console.log('=== いいねボタンY座標検出テスト ===');
const likeResult = await detectLikeButtonY(screenshotPath);
console.log('結果:', likeResult);

console.log('\n=== コメントボタンY座標検出テスト ===');
const commentResult = await detectCommentButtonY(screenshotPath);
console.log('結果:', commentResult);

console.log('\n=== テスト完了 ===');
if (likeResult.success && commentResult.success) {
  console.log('✅ すべてのテストが成功しました！');
  console.log(`いいねボタン: Y=${likeResult.y}, 信頼度=${likeResult.confidence?.toFixed(3)}`);
  console.log(`コメントボタン: Y=${commentResult.y}, 信頼度=${commentResult.confidence?.toFixed(3)}`);
} else {
  console.log('❌ テストに失敗しました');
  if (!likeResult.success) console.log('いいねボタンエラー:', likeResult.error);
  if (!commentResult.success) console.log('コメントボタンエラー:', commentResult.error);
}
