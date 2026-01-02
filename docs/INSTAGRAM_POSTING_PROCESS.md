# Instagram投稿プロセスの技術ドキュメント

## 概要

このドキュメントは、SNSマーケティング自動化システムにおけるInstagram投稿プロセスの詳細を説明します。システムはDuoPlus APIを使用してAndroidデバイスを遠隔操作し、Instagramアプリを通じて投稿を実行します。

## アーキテクチャ

### システム構成

```
┌─────────────────┐
│  Web Application │
│  (Node.js/tRPC) │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  DuoPlus API    │
│  (Cloud Service)│
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  Android Device │
│  (Instagram App)│
└─────────────────┘
```

### 主要コンポーネント

1. **スケジューラー** (`server/scheduled-posts.ts`)
   - 定期的にデータベースをチェックし、実行予定の投稿を検出
   - 投稿処理を`executePost`関数で実行

2. **投稿エンジン** (`server/sns-posting.ts`)
   - プラットフォーム別の投稿ロジックを実装
   - `postToInstagram`関数がInstagram投稿を担当

3. **検証モジュール** (`server/post-verification.ts`)
   - 投稿後のスクリーンショット撮影
   - S3へのアップロード
   - UI要素の検出による投稿成功確認

## Instagram投稿プロセスの詳細

### フェーズ1: 事前準備

#### 1.1 メディア検証
```typescript
if (!mediaUrls || mediaUrls.length === 0) {
  return {
    success: false,
    message: 'Instagram requires image/video content.',
    error: 'NO_MEDIA_PROVIDED',
  };
}
```

**重要**: Instagramはテキストのみの投稿をサポートしていないため、画像または動画が必須です。

#### 1.2 デバイス状態確認
- デバイスIDの取得
- デバイスの起動状態確認
- ネットワーク接続確認

### フェーズ2: アプリ起動

#### 2.1 ホーム画面に戻る
```typescript
await makeRequest(deviceId, {
  type: 'adb_shell',
  command: 'input keyevent KEYCODE_HOME',
});
```

**目的**: 前回の操作状態をクリアし、クリーンな状態から開始

#### 2.2 Instagramアプリ強制停止
```typescript
await makeRequest(deviceId, {
  type: 'adb_shell',
  command: 'am force-stop com.instagram.android',
});
```

**目的**: アプリの状態をリセットし、予期しない動作を防止

#### 2.3 Instagramアプリ起動
```typescript
await makeRequest(deviceId, {
  type: 'adb_shell',
  command: 'am start -n com.instagram.android/com.instagram.mainactivity.InstagramMainActivity',
});
```

**待機時間**: 5秒（アプリの完全な起動を待つ）

### フェーズ3: 投稿作成

#### 3.1 新規投稿ボタンをタップ
```typescript
await makeRequest(deviceId, {
  type: 'adb_tap',
  x: 540,  // 画面中央下部
  y: 2200,
});
```

**座標**: デバイスの解像度に依存（1080x2400を想定）

#### 3.2 メディア選択
```typescript
// メディアライブラリから最新の画像/動画を選択
await makeRequest(deviceId, {
  type: 'adb_tap',
  x: 180,
  y: 800,
});
```

**前提条件**: メディアが事前にデバイスにダウンロードされている必要があります

#### 3.3 「次へ」ボタンをタップ
```typescript
await makeRequest(deviceId, {
  type: 'adb_tap',
  x: 960,
  y: 140,
});
```

**待機時間**: 2秒（画像処理の完了を待つ）

#### 3.4 キャプション入力
```typescript
await makeRequest(deviceId, {
  type: 'adb_input_text',
  text: content,  // 投稿テキスト
});
```

**注意**: 特殊文字やハッシュタグが正しくエスケープされる必要があります

#### 3.5 「シェア」ボタンをタップ
```typescript
await makeRequest(deviceId, {
  type: 'adb_tap',
  x: 960,
  y: 140,
});
```

**待機時間**: 5秒（投稿のアップロードを待つ）

### フェーズ4: 投稿検証

#### 4.1 スクリーンショット撮影
```typescript
const screenshotResult = await makeRequest(deviceId, {
  type: 'adb_shell',
  command: 'screencap -p /sdcard/screenshot.png',
});
```

#### 4.2 UI要素検出
```typescript
const uiElements = await makeRequest(deviceId, {
  type: 'adb_shell',
  command: 'uiautomator dump /sdcard/ui.xml && cat /sdcard/ui.xml',
});
```

**検証ポイント**:
- 「投稿しました」メッセージの存在
- エラーダイアログの不在
- ホームフィードへの遷移

#### 4.3 スクリーンショットのS3アップロード
```typescript
const s3Url = await uploadScreenshotToS3(deviceId, screenshotPath);
```

## DuoPlus API仕様

### 認証
```typescript
const DUOPLUS_API_KEY = process.env.DUOPLUS_API_KEY;
const headers = {
  'Authorization': `Bearer ${DUOPLUS_API_KEY}`,
  'Content-Type': 'application/json',
};
```

### エンドポイント
```
POST https://api.duoplus.net/v1/devices/{deviceId}/execute
```

### リクエスト形式

#### ADBシェルコマンド
```json
{
  "type": "adb_shell",
  "command": "input keyevent KEYCODE_HOME"
}
```

#### タップ操作
```json
{
  "type": "adb_tap",
  "x": 540,
  "y": 2200
}
```

#### テキスト入力
```json
{
  "type": "adb_input_text",
  "text": "Hello, Instagram!"
}
```

### レスポンス形式
```json
{
  "success": true,
  "output": "command output",
  "error": null
}
```

## 現在の問題点

### 1. 投稿失敗の主な原因

#### 1.1 メディアがない
- **エラーコード**: `NO_MEDIA_PROVIDED`
- **原因**: Instagramは画像/動画が必須だが、メディアURLが提供されていない
- **解決策**: フロントエンドでメディアアップロードを必須にする

#### 1.2 デバイスがメッセージ画面で止まる
- **症状**: デバイスが「新規メッセージ」画面で停止し、Instagramアプリが開かない
- **原因**: 前回の操作が完了せず、アプリが予期しない状態になっている
- **解決策**: ホーム画面に戻る処理を強化する

#### 1.3 タップ座標のずれ
- **症状**: ボタンをタップしても反応しない
- **原因**: デバイスの解像度が想定と異なる、またはInstagramアプリのUIが変更された
- **解決策**: デバイスの解像度を動的に取得し、座標を計算する

#### 1.4 ネットワークエラー
- **症状**: 投稿のアップロードに失敗する
- **原因**: デバイスのネットワーク接続が不安定
- **解決策**: リトライロジックを実装する

#### 1.5 ログアウト状態
- **症状**: Instagramアプリがログイン画面を表示する
- **原因**: セッションが期限切れになった
- **解決策**: ログイン状態を定期的に確認し、必要に応じて再ログインする

### 2. 検証の課題

#### 2.1 投稿URLの取得ができない
- **現状**: 投稿が成功したかどうかをスクリーンショットでしか確認できない
- **理想**: 投稿URLを自動的に取得し、データベースに保存する
- **実装案**: プロフィールページから最新投稿のURLを抽出する

#### 2.2 スクリーンショットのダウンロードが不安定
- **現状**: base64エンコードとhex dump方式の2つの方法を実装しているが、大きなファイルでは失敗する
- **理想**: DuoPlus APIが直接ファイルダウンロードをサポートする
- **回避策**: スクリーンショットの解像度を下げる

## タイミングとウェイト

### 重要な待機時間

| 操作 | 待機時間 | 理由 |
|------|---------|------|
| アプリ起動後 | 5秒 | アプリの完全な起動を待つ |
| メディア選択後 | 2秒 | 画像処理の完了を待つ |
| 投稿後 | 5秒 | アップロードの完了を待つ |
| タップ操作間 | 1秒 | UIの応答を待つ |

**注意**: デバイスの性能やネットワーク速度によっては、これらの待機時間を調整する必要があります。

## デバッグ方法

### ログの確認
```bash
# サーバーログ
tail -f /tmp/*.log

# データベースのログテーブル
SELECT * FROM logs WHERE scheduledPostId = <投稿ID> ORDER BY createdAt DESC;
```

### スクリーンショットの確認
管理画面の「スケジュール投稿」ページで、各投稿の「検証」列にあるアイコンをクリックすると、投稿時のスクリーンショットを確認できます。

### デバイスの状態確認
```bash
# デバイスの画面を確認
curl -X POST https://api.duoplus.net/v1/devices/{deviceId}/execute \
  -H "Authorization: Bearer ${DUOPLUS_API_KEY}" \
  -d '{"type": "adb_shell", "command": "screencap -p /sdcard/debug.png"}'
```

## 推奨される改善策

### 短期的な改善
1. **リトライロジックの実装**: 投稿失敗時に自動的に1-2回リトライする
2. **ログイン状態の確認**: 投稿前にログイン状態を確認し、必要に応じて再ログインする
3. **エラーハンドリングの強化**: より詳細なエラーメッセージを記録する

### 中期的な改善
1. **動的な座標計算**: デバイスの解像度を取得し、タップ座標を動的に計算する
2. **UI要素の検出**: UIAutomatorを使用してボタンの位置を動的に検出する
3. **投稿URL自動取得**: プロフィールページから最新投稿のURLを抽出する

### 長期的な改善
1. **Instagram Graph API移行**: 公式APIを使用して投稿を実行する（ビジネスアカウントが必要）
2. **機械学習による異常検出**: 投稿失敗のパターンを学習し、予防的に対処する
3. **マルチデバイス対応**: 複数のデバイスで負荷分散し、可用性を向上させる

## 関連ファイル

- `server/sns-posting.ts`: Instagram投稿のメインロジック
- `server/scheduled-posts.ts`: スケジューラーと投稿実行
- `server/post-verification.ts`: 投稿検証とスクリーンショット処理
- `docs/DUOPLUS_API_REFERENCE.md`: DuoPlus API仕様
- `drizzle/schema.ts`: データベーススキーマ

## 参考資料

- [DuoPlus API Documentation](https://docs.duoplus.net)
- [Instagram App Package Info](https://www.apkmirror.com/apk/instagram/instagram-instagram/)
- [Android Debug Bridge (ADB) Reference](https://developer.android.com/studio/command-line/adb)
