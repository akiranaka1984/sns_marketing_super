# Instagram投稿失敗の修正計画

## 検証結果に基づく問題点

### 🔴 優先度1: メディアが設定されていない（確定）

**問題**: すべての失敗した投稿で`mediaUrls`が`NULL`

**影響**: Instagramは画像または動画が必須だが、投稿作成時にメディアが設定されていなかった

**修正内容**:
1. **フロントエンド**: スケジュール投稿作成時にInstagram投稿にはメディアを必須にする
2. **バックエンド**: Instagram投稿の検証を強化（mediaUrlsが空の場合は早期にエラーを返す）
3. **UI改善**: メディアアップロード機能を追加

### 🟡 優先度2: タップ座標が解像度に依存している

**問題**: 固定座標（1080x2400想定）を使用しており、デバイスの実際の解像度と異なる場合に失敗する

**修正内容**:
1. **動的座標計算**: デバイスの解像度を取得し、座標を動的に計算
2. **座標の正規化**: 相対座標（パーセンテージ）を使用

### 🟡 優先度3: デバイスが別の画面で止まっている

**問題**: デバイスが予期しない画面で停止している可能性

**修正内容**:
1. **ホーム画面への強制復帰**: 投稿前に必ずホーム画面に戻る
2. **画面状態の確認**: スクリーンショットを撮影して現在の画面を確認

### 🟢 優先度4: Instagramアプリがログアウト状態

**問題**: ログイン画面が表示される可能性

**修正内容**:
1. **ログイン状態の確認**: 投稿前にログイン状態を確認
2. **自動再ログイン**: ログアウトしている場合は自動的に再ログイン

### 🟢 優先度5: ネットワークエラー

**問題**: 投稿のアップロードに失敗する可能性

**修正内容**:
1. **リトライロジック**: ネットワークエラー時に自動的にリトライ（最大3回）
2. **タイムアウト設定**: 適切なタイムアウト設定

---

## 実装計画

### フェーズ1: 即座に実施（優先度1）

#### 1.1 フロントエンド修正

**ファイル**: `client/src/pages/ScheduledPosts.tsx`

**修正内容**:
- Instagram投稿作成時にメディアを必須にする
- メディアアップロード機能を追加
- メディアプレビュー機能を追加

**検証**:
```typescript
// Instagram投稿の場合、mediaUrlsが必須
if (platform === 'instagram' && (!mediaUrls || mediaUrls.length === 0)) {
  toast.error('Instagram requires at least one image or video');
  return;
}
```

#### 1.2 バックエンド修正

**ファイル**: `server/sns-posting.ts`

**修正内容**:
- `postToInstagram`関数の検証を強化
- エラーメッセージを改善
- ログ出力を追加

**実装**:
```typescript
// 既存の検証を維持
if (!mediaUrls || mediaUrls.length === 0) {
  console.error(`[SNSPosting] Instagram post failed: NO_MEDIA_PROVIDED`);
  return {
    success: false,
    message: 'Instagram requires image/video content. Please provide a media URL.',
    error: 'NO_MEDIA_PROVIDED',
  };
}

// 追加の検証: mediaUrlsが空配列でないことを確認
if (Array.isArray(mediaUrls) && mediaUrls.every(url => !url || url.trim() === '')) {
  console.error(`[SNSPosting] Instagram post failed: INVALID_MEDIA_URLS`);
  return {
    success: false,
    message: 'Instagram requires valid media URLs. All URLs are empty.',
    error: 'INVALID_MEDIA_URLS',
  };
}
```

### フェーズ2: 短期改善（優先度2）

#### 2.1 動的座標計算の実装

**ファイル**: `server/sns-posting.ts`

**修正内容**:
- デバイスの解像度を取得する関数を追加
- 座標を動的に計算する関数を追加
- すべてのタップ座標を動的計算に変更

**実装**:
```typescript
/**
 * Get device resolution
 */
async function getDeviceResolution(apiKey: string, deviceId: string): Promise<{ width: number; height: number }> {
  try {
    const result = await executeAdbCommand(apiKey, deviceId, 'wm size');
    // Parse output: "Physical size: 1080x2400"
    const match = result.output?.match(/(\d+)x(\d+)/);
    if (match) {
      return { width: parseInt(match[1]), height: parseInt(match[2]) };
    }
  } catch (error) {
    console.error('[SNSPosting] Failed to get device resolution:', error);
  }
  // Default to 1080x2400
  return { width: 1080, height: 2400 };
}

/**
 * Calculate tap coordinates based on device resolution
 */
function calculateCoordinates(
  baseWidth: number,
  baseHeight: number,
  targetWidth: number,
  targetHeight: number,
  x: number,
  y: number
): { x: number; y: number } {
  return {
    x: Math.round((x / baseWidth) * targetWidth),
    y: Math.round((y / baseHeight) * targetHeight),
  };
}

// 使用例
const resolution = await getDeviceResolution(apiKey, deviceId);
const createButton = calculateCoordinates(1080, 2400, resolution.width, resolution.height, 540, 1850);
await executeAdbCommand(apiKey, deviceId, `input tap ${createButton.x} ${createButton.y}`);
```

### フェーズ3: 中期改善（優先度3-5）

#### 3.1 ホーム画面への強制復帰

**実装**:
```typescript
// 投稿前に必ずホーム画面に戻る
await executeAdbCommand(apiKey, deviceId, 'input keyevent KEYCODE_HOME');
await sleep(2000);

// スクリーンショットを撮影して確認
const homeScreenshot = await takeScreenshot(apiKey, deviceId, 'home_screen');
```

#### 3.2 ログイン状態の確認

**実装**:
```typescript
// Instagramアプリを起動
await executeAdbCommand(apiKey, deviceId, 'monkey -p com.instagram.android -c android.intent.category.LAUNCHER 1');
await sleep(5000);

// スクリーンショットを撮影
const screenshot = await takeScreenshot(apiKey, deviceId, 'after_launch');

// ログイン画面かどうかを確認（OCRまたは画像認識）
// 簡易的な実装: 特定の座標の色を確認
```

#### 3.3 リトライロジック

**実装**:
```typescript
async function postToInstagramWithRetry(
  deviceId: string,
  content: string,
  mediaUrls?: string[],
  maxRetries: number = 3
): Promise<PostResult> {
  let lastError: string | undefined;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`[SNSPosting] Instagram post attempt ${attempt}/${maxRetries}`);
    
    const result = await postToInstagram(deviceId, content, mediaUrls);
    
    if (result.success) {
      return result;
    }
    
    lastError = result.error;
    
    // ネットワークエラーの場合のみリトライ
    if (result.error === 'NETWORK_ERROR' && attempt < maxRetries) {
      console.log(`[SNSPosting] Retrying in 5 seconds...`);
      await sleep(5000);
      continue;
    }
    
    // その他のエラーはリトライしない
    return result;
  }
  
  return {
    success: false,
    message: `Failed after ${maxRetries} attempts`,
    error: lastError,
  };
}
```

---

## テスト計画

### 1. 単体テスト

- [ ] `postToInstagram`関数のmediaUrls検証テスト
- [ ] 動的座標計算関数のテスト
- [ ] リトライロジックのテスト

### 2. 統合テスト

- [ ] デバッグ用テスト投稿で各ステップを確認
- [ ] 実際のデバイスで投稿テスト
- [ ] 複数の解像度でテスト

### 3. エンドツーエンドテスト

- [ ] スケジュール投稿作成からInstagram投稿まで
- [ ] エラーハンドリングの確認
- [ ] スクリーンショットの保存確認

---

## 実装優先順位

1. **即座に実施**: フロントエンドとバックエンドのmediaUrls検証強化（30分）
2. **短期改善**: 動的座標計算の実装（1時間）
3. **中期改善**: ホーム画面復帰、ログイン確認、リトライロジック（2時間）

---

## 期待される効果

### 優先度1の修正後

- Instagram投稿時にメディアが必須になり、`NO_MEDIA_PROVIDED`エラーが防止される
- ユーザーがメディアをアップロードできるUIが提供される

### 優先度2の修正後

- デバイスの解像度に依存せず、正しい座標でタップできる
- 異なる解像度のデバイスでも投稿が成功する

### 優先度3-5の修正後

- デバイスが予期しない画面で停止していても、ホーム画面に復帰できる
- ログアウト状態でも自動的に再ログインできる
- ネットワークエラー時に自動的にリトライされる

---

## 関連ドキュメント

- [検証レポート](./VERIFICATION_REPORT.md)
- [Instagram投稿プロセスの技術ドキュメント](./INSTAGRAM_POSTING_PROCESS.md)
- [失敗パターン分析レポート](./FAILURE_ANALYSIS.md)
