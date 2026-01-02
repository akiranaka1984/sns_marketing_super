# 手動テストガイド: いいね・コメント機能

## 実装されているロジック

### いいね機能 (`executeLike`)

1. **投稿URLをChromeで開く**
   - `adb shell am start -a android.intent.action.VIEW -d "<postUrl>" -p com.android.chrome`
   - 待機時間: 5000ms

2. **投稿が正しく表示されているか確認**
   - スクリーンショットを取得
   - GPT-4 Visionで投稿表示を確認

3. **いいねボタンのY座標を動的に検出**
   - テンプレートマッチング（Sobelエッジ検出 + NCC）
   - テンプレート画像: `server/templates/like_icon.png`
   - 固定X座標: 534
   - Y座標: 画面高さの30%から下端まで探索

4. **いいねボタンをタップ**
   - `adb shell input tap <x> <y>`
   - 待機時間: 3000ms

5. **いいね状態を確認**
   - スクリーンショットを取得
   - GPT-4 Visionでいいねボタンの状態を確認（赤色 = いいね済み）

6. **スクリーンショットをS3に保存**
   - Before/Afterのスクリーンショットを保存
   - データベースにURLとキーを記録

### コメント機能 (`executeComment`)

1. **投稿URLをChromeで開く**
   - `adb shell am start -a android.intent.action.VIEW -d "<postUrl>" -p com.android.chrome`
   - 待機時間: 5000ms

2. **コメント実行前のスクリーンショットを取得**
   - リトライロジック（最大3回）
   - S3に保存

3. **コメントボタンのY座標を動的に検出**
   - テンプレートマッチング（Sobelエッジ検出 + NCC）
   - テンプレート画像: `server/templates/comment_icon.png`
   - 固定X座標: 71
   - Y座標: 画面高さの30%から下端まで探索

4. **AIでコメントを生成**
   - GPT-4で投稿内容とペルソナに基づいてコメントを生成

5. **コメントボタンをタップ**
   - `adb shell input tap <x> <y>`
   - 待機時間: 3000ms

6. **コメントを入力**
   - ADBKeyboardを使用: `adb shell am broadcast -a ADB_INPUT_TEXT --es msg '<comment>'`
   - 待機時間: 2000ms

7. **投稿ボタンをタップ**
   - 固定座標: (980, 350)
   - 待機時間: 3000ms

8. **投稿URLに戻って検証**
   - 再度投稿URLを開く
   - 待機時間: 5000ms

9. **コメントが投稿されたか確認**
   - スクリーンショットを取得
   - GPT-4 Visionでコメントが表示されているか確認

10. **スクリーンショットをS3に保存**
    - Before/Afterのスクリーンショットを保存
    - データベースにURLとキーを記録

## 手動テスト方法

### 前提条件

1. **デバイスIDを確認**
   ```bash
   # データベースから利用可能なデバイスIDを確認
   cd /home/ubuntu/sns_marketing_automation
   node -e "import('./server/db.js').then(m => m.db.query.accounts.findMany().then(accounts => console.log(accounts.map(a => ({ id: a.id, deviceId: a.deviceId, username: a.username })))))"
   ```

2. **テスト用の投稿URLを準備**
   - 例: `https://x.com/AkiraNakam61955/status/1871067074068594946`

### いいね機能のテスト

```bash
cd /home/ubuntu/sns_marketing_automation

# 基本的な実行
node test-like-manual.mjs <deviceId> "<postUrl>"

# 例
node test-like-manual.mjs LVdTJ "https://x.com/AkiraNakam61955/status/1871067074068594946"
```

**期待される動作:**
1. コンソールに詳細なログが表示される
2. デバイスでChromeが開き、投稿が表示される
3. いいねボタンがタップされる
4. いいねボタンが赤色（❤️）になる
5. 最終的に `✅ いいねが成功しました` と表示される

**確認ポイント:**
- ログに `[Like] Starting like on ...` が表示される
- ログに `[Like] Detected Y coordinate: XXX (confidence: 0.XXX)` が表示される
- ログに `[Like] Completed successfully and verified` が表示される
- デバイスの画面でいいねボタンが赤色になっている

### コメント機能のテスト

```bash
cd /home/ubuntu/sns_marketing_automation

# 基本的な実行
node test-comment-manual.mjs <deviceId> "<postUrl>" "<postContent>" "<persona>"

# 例
node test-comment-manual.mjs LVdTJ "https://x.com/AkiraNakam61955/status/1871067074068594946" "相互連携テスト投稿です" "フレンドリーなユーザー"
```

**期待される動作:**
1. コンソールに詳細なログが表示される
2. デバイスでChromeが開き、投稿が表示される
3. コメントボタンがタップされる
4. AIが生成したコメントが入力される
5. 投稿ボタンがタップされる
6. コメントが投稿される
7. 最終的に `✅ コメントが成功しました` と表示される

**確認ポイント:**
- ログに `[Comment] Starting comment on ...` が表示される
- ログに `[Comment] Generated: XXX` が表示される（AIが生成したコメント）
- ログに `[Comment] Detected Y coordinate: XXX (confidence: 0.XXX)` が表示される
- ログに `[Comment] Completed successfully and verified` が表示される
- デバイスの画面でコメントが投稿されている

## トラブルシューティング

### エラー: `スクリーンショット取得に失敗しました`
- デバイスが接続されているか確認
- DuoPlusプロキシが正常に動作しているか確認

### エラー: `いいねボタンの座標検出に失敗しました`
- テンプレート画像 `server/templates/like_icon.png` が存在するか確認
- スクリーンショットが正しく取得されているか確認
- 投稿が正しく表示されているか確認（ログインしているか）

### エラー: `いいねが付いていません`
- 座標がずれている可能性
- デバイスがログアウトしている可能性
- ログに表示された検出座標（Y座標）を確認

### エラー: `コメントボタンの座標検出に失敗しました`
- テンプレート画像 `server/templates/comment_icon.png` が存在するか確認
- スクリーンショットが正しく取得されているか確認

### エラー: `ADBKeyboard not found`
- デバイスにADBKeyboardがインストールされているか確認
- ADBKeyboardが有効になっているか確認

## ログの見方

### 成功時のログ例（いいね）

```
================================================================================
手動テスト: いいね機能
================================================================================
デバイスID: LVdTJ
投稿URL: https://x.com/AkiraNakam61955/status/1871067074068594946
================================================================================

[Like] Starting like on https://x.com/AkiraNakam61955/status/1871067074068594946
[Like] Waiting 5000ms for post to load...
[Like] Checking if post is displayed...
[Like] Capturing screenshot for post display check...
[Like] Screenshot captured: success
[Like] Checking post display with vision service...
[Like] Display check result: {"isDisplayed":true}
[Like] Post is displayed correctly
[Like] Detecting like button Y coordinate...
[Like] Temp screenshot path: /tmp/screenshot_1234567890.png
[Like] Base64 data length: 123456
[Like] Temp screenshot file written successfully
[Y-Coordinate Detection] Loading screenshot: /tmp/screenshot_1234567890.png
[Y-Coordinate Detection] Loading template: /home/ubuntu/sns_marketing_automation/server/templates/like_icon.png
[Y-Coordinate Detection] Screenshot size: 1080x1920
[Y-Coordinate Detection] Template size: 48x48
[Y-Coordinate Detection] Edge detection completed
[Y-Coordinate Detection] Screen height: 1920
[Y-Coordinate Detection] Searching Y from 576 to 1870 (from 30% to bottom)
[Y-Coordinate Detection] Found 5 candidates above threshold 0.25
[Y-Coordinate Detection] Selected best candidate: Y=1430, NCC=0.456
[Y-Coordinate Detection] All candidates: Y=1430 NCC=0.456, Y=1428 NCC=0.445, ...
[Like] Detected Y coordinate: 1454 (confidence: 0.456)
[Like] Before screenshot saved: https://...
[Like] Tapping like button at coordinates (534, 1454)
[Like] Waiting 3000ms for like animation...
[Like] Verifying like state...
[Like] Completed successfully and verified
[Like] After screenshot saved: https://...
[Like] Screenshot URLs and keys saved to database

================================================================================
実行結果:
================================================================================
{
  "success": true
}
================================================================================
✅ いいねが成功しました
```

### 失敗時のログ例（座標検出失敗）

```
[Like] Detecting like button Y coordinate...
[Y-Coordinate Detection] Loading screenshot: /tmp/screenshot_1234567890.png
[Y-Coordinate Detection] Loading template: /home/ubuntu/sns_marketing_automation/server/templates/like_icon.png
[Y-Coordinate Detection] Screenshot size: 1080x1920
[Y-Coordinate Detection] Template size: 48x48
[Y-Coordinate Detection] Edge detection completed
[Y-Coordinate Detection] Screen height: 1920
[Y-Coordinate Detection] Searching Y from 576 to 1870 (from 30% to bottom)
[Y-Coordinate Detection] Found 0 candidates above threshold 0.25
[Like] Y coordinate detection failed: テンプレートマッチングの信頼度が低すぎます。閾値0.25以上の候補が見つかりませんでした

================================================================================
実行結果:
================================================================================
{
  "success": false,
  "error": "いいねボタンの座標検出に失敗しました: テンプレートマッチングの信頼度が低すぎます。閾値0.25以上の候補が見つかりませんでした"
}
================================================================================
❌ いいねが失敗しました
エラー: いいねボタンの座標検出に失敗しました: テンプレートマッチングの信頼度が低すぎます。閾値0.25以上の候補が見つかりませんでした
```

## 検証チェックリスト

### いいね機能
- [ ] 投稿URLが正しく開かれる
- [ ] スクリーンショットが取得される
- [ ] Y座標が検出される（ログに表示される）
- [ ] いいねボタンがタップされる
- [ ] いいねボタンが赤色になる
- [ ] スクリーンショットがS3に保存される

### コメント機能
- [ ] 投稿URLが正しく開かれる
- [ ] スクリーンショットが取得される
- [ ] Y座標が検出される（ログに表示される）
- [ ] AIがコメントを生成する（ログに表示される）
- [ ] コメントボタンがタップされる
- [ ] コメントが入力される
- [ ] 投稿ボタンがタップされる
- [ ] コメントが投稿される
- [ ] スクリーンショットがS3に保存される

## 次のステップ

テストが成功した場合:
1. 実装が正しいことを確認
2. フロントエンドとの統合をテスト

テストが失敗した場合:
1. ログを確認してどの段階で失敗したか特定
2. 失敗した原因を報告
3. 必要に応じてロジックを修正
