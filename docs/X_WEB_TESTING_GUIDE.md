# X Web版投稿機能のテストガイド

## 概要

このガイドでは、X（Twitter）Web版投稿機能の診断テスト、ステップテスト、座標調整の手順を説明します。

## 前提条件

1. **アクティブなデバイス**: 電源がオン（status = 1）のDuoPlusデバイスが必要
2. **Chromeインストール済み**: デバイスにChromeアプリがインストールされている
3. **Xログイン済み**: DuoPlusダッシュボードで手動ログインし、スナップショットを保存

## テスト手順

### Step 1: デバイスIDの確認

まず、テスト対象のデバイスIDを確認します。

```sql
-- データベースで確認
SELECT id, deviceId, deviceName, status 
FROM devices 
WHERE status = 1 
LIMIT 10;
```

または、ダッシュボードの「デバイス管理」ページで確認できます。

### Step 2: 診断テストの実行

ブラウザの開発者ツール（F12）を開き、コンソールで以下を実行:

```javascript
// 診断テストを実行
const diagnosisResult = await window.trpc.xWeb.diagnose.mutate({
  deviceId: 'snap_xxxxx' // 実際のデバイスIDに置き換え
});

console.log('診断結果:', diagnosisResult);
```

#### 診断結果の確認項目

1. **デバイスステータス** (`deviceStatus`)
   - `isOnline`: デバイスが起動しているか
   - `statusCode`: ステータスコード（1 = 起動中）
   - `statusText`: ステータステキスト

2. **画面解像度** (`screenResolution`)
   - `width`: 画面幅（ピクセル）
   - `height`: 画面高さ（ピクセル）
   - `raw`: 解像度文字列（例: "1080x2400"）

3. **Chromeステータス** (`chromeStatus`)
   - `isInstalled`: Chromeがインストールされているか
   - `isRunning`: Chromeが起動しているか

4. **Xログイン状態** (`xLoginStatus`)
   - `isLoggedIn`: Xにログインしているか
   - `currentUrl`: 現在のURL

5. **エラー** (`errors`)
   - エラーメッセージの配列

#### 診断結果の例

```javascript
{
  deviceStatus: {
    isOnline: true,
    statusCode: 1,
    statusText: "Powered on"
  },
  screenResolution: {
    width: 1080,
    height: 2400,
    raw: "1080x2400"
  },
  chromeStatus: {
    isInstalled: true,
    isRunning: false
  },
  xLoginStatus: {
    isLoggedIn: true,
    currentUrl: "https://x.com/home"
  },
  errors: []
}
```

### Step 3: 自動修正の実行（必要な場合）

診断結果にエラーがある場合、自動修正を試みます:

```javascript
// 自動修正を実行
const fixResult = await window.trpc.xWeb.autoFix.mutate({
  deviceId: 'snap_xxxxx'
});

console.log('修正結果:', fixResult);
console.log('修正された問題:', fixResult.fixedIssues);
console.log('残っている問題:', fixResult.remainingIssues);
```

### Step 4: ステップテストの実行

各ステップのスクリーンショットを取得して、どこで失敗しているかを特定します:

```javascript
// ステップテストを実行
const stepResult = await window.trpc.xWeb.testPost.mutate({
  deviceId: 'snap_xxxxx',
  content: 'テスト投稿'
});

console.log('ステップテスト結果:', stepResult);

// 各ステップの結果を表示
stepResult.forEach((step, index) => {
  console.log(`\nステップ ${index + 1}: ${step.step}`);
  console.log(`  成功: ${step.success}`);
  console.log(`  スクリーンショット: ${step.screenshotUrl}`);
  if (step.error) {
    console.log(`  エラー: ${step.error}`);
  }
});
```

#### ステップの説明

1. **step_1_open_chrome**: Chromeを起動してx.comを開く
2. **step_2_navigate_x**: X（Twitter）のホーム画面に移動
3. **step_3_check_login**: ログイン状態を確認
4. **step_4_click_compose**: 投稿ボタンをタップ
5. **step_5_input_text**: テキストを入力
6. **step_6_click_post**: 投稿ボタンをタップ
7. **step_7_verify_success**: 投稿成功を検証

### Step 5: スクリーンショットの分析

各ステップのスクリーンショットURLを開いて、以下を確認します:

1. **投稿ボタンの位置**: `step_4_click_compose`のスクリーンショットで、投稿ボタンが正しくタップされているか
2. **テキスト入力欄の位置**: `step_5_input_text`のスクリーンショットで、テキストが正しく入力されているか
3. **投稿ボタンの位置**: `step_6_click_post`のスクリーンショットで、投稿ボタンが正しくタップされているか

### Step 6: 座標の微調整

スクリーンショットを確認して、タップ座標がずれている場合は、`server/x-web-diagnosis.ts`の`getCoordinates`関数を調整します。

#### 座標調整の手順

1. **現在の座標を確認**

```typescript
// server/x-web-diagnosis.ts の getCoordinates 関数
export function getCoordinates(
  resolution: string, 
  element: 'composeButton' | 'textArea' | 'postButton'
): { x: number; y: number } {
  const coords: Record<string, Record<string, { x: number; y: number }>> = {
    '1080x2400': {
      composeButton: { x: 960, y: 2200 },  // 右下の投稿ボタン
      textArea: { x: 540, y: 800 },        // 中央のテキストエリア
      postButton: { x: 960, y: 140 },      // 右上の投稿ボタン
    },
    // 他の解像度...
  };

  return coords[resolution]?.[element] || coords['1080x2400'][element];
}
```

2. **座標の測定方法**

スクリーンショットを画像編集ソフト（Photoshop、GIMP、オンラインツールなど）で開き、以下の要素の中心座標を測定します:

- **composeButton**: ホーム画面右下の「+」ボタン（新規投稿ボタン）
- **textArea**: 投稿作成画面のテキスト入力エリア
- **postButton**: 投稿作成画面右上の「投稿」ボタン

3. **座標を更新**

`server/x-web-diagnosis.ts`の`getCoordinates`関数を編集して、測定した座標に更新します。

例:
```typescript
'1080x2400': {
  composeButton: { x: 950, y: 2180 },  // 調整後
  textArea: { x: 540, y: 850 },        // 調整後
  postButton: { x: 970, y: 150 },      // 調整後
},
```

4. **再テスト**

座標を更新したら、ステップテストを再実行して、正しくタップされているか確認します。

### Step 7: 本番投稿テスト

診断とステップテストが成功したら、実際に投稿をテストします:

```javascript
// 自動修正付き投稿（推奨）
const postResult = await window.trpc.xWeb.postWithAutoFix.mutate({
  deviceId: 'snap_xxxxx',
  content: 'テスト投稿 from automated system'
});

console.log('投稿結果:', postResult);

if (postResult.success) {
  console.log('✅ 投稿成功');
  console.log('スクリーンショット:', postResult.screenshotUrl);
} else {
  console.log('❌ 投稿失敗');
  console.log('エラー:', postResult.error);
  console.log('メッセージ:', postResult.message);
}
```

## トラブルシューティング

### 問題1: デバイスが起動していない

**症状**: `deviceStatus.isOnline = false`

**解決方法**:
1. 自動修正を実行: `trpc.xWeb.autoFix.mutate({ deviceId })`
2. または、DuoPlusダッシュボードから手動で起動

### 問題2: Chromeがインストールされていない

**症状**: `chromeStatus.isInstalled = false`

**解決方法**:
- DuoPlusダッシュボードから手動でChromeをインストール
- 自動インストールは不可能

### 問題3: Xにログインしていない

**症状**: `xLoginStatus.isLoggedIn = false`

**解決方法**:
- DuoPlusダッシュボードで手動ログイン
- スナップショットを保存してログイン状態を維持
- 自動ログインは不可能（Play Integrity API制限）

### 問題4: 座標がずれている

**症状**: ステップテストで間違った場所をタップしている

**解決方法**:
1. スクリーンショットで正しい座標を測定
2. `getCoordinates`関数を更新
3. 再テスト

### 問題5: テキストが入力されない

**症状**: `step_5_input_text`でテキストが表示されない

**解決方法**:
1. クリップボード機能が有効か確認
2. テキストエリアの座標を調整
3. 日本語テキストの場合、クリップボード経由で入力されているか確認

## 座標調整のベストプラクティス

### 1. 解像度ごとに調整

デバイスの解像度が異なる場合、それぞれの解像度に対応する座標を設定します。

```typescript
const coords: Record<string, Record<string, { x: number; y: number }>> = {
  '1080x2400': {
    composeButton: { x: 960, y: 2200 },
    textArea: { x: 540, y: 800 },
    postButton: { x: 960, y: 140 },
  },
  '1080x1920': {
    composeButton: { x: 960, y: 1700 },
    textArea: { x: 540, y: 600 },
    postButton: { x: 960, y: 120 },
  },
  '1080x2340': {
    composeButton: { x: 960, y: 2150 },
    textArea: { x: 540, y: 780 },
    postButton: { x: 960, y: 135 },
  },
};
```

### 2. 相対座標の使用

画面サイズに応じて動的に座標を計算することもできます:

```typescript
export function getCoordinates(
  resolution: string, 
  element: 'composeButton' | 'textArea' | 'postButton'
): { x: number; y: number } {
  const [width, height] = resolution.split('x').map(Number);
  
  switch (element) {
    case 'composeButton':
      return { x: width * 0.89, y: height * 0.92 }; // 右下
    case 'textArea':
      return { x: width * 0.5, y: height * 0.33 }; // 中央上部
    case 'postButton':
      return { x: width * 0.89, y: height * 0.06 }; // 右上
    default:
      return { x: 0, y: 0 };
  }
}
```

### 3. マージンの追加

タップ座標に少しマージンを持たせることで、ボタンの位置が微妙にずれても対応できます。

```typescript
// 中心座標から少しずらす
composeButton: { x: 960 + 5, y: 2200 - 10 },
```

## まとめ

1. **診断テスト**: デバイスの状態を確認
2. **自動修正**: 問題を自動的に解決
3. **ステップテスト**: 各ステップのスクリーンショットを取得
4. **座標調整**: スクリーンショットを分析して座標を微調整
5. **本番投稿**: 実際に投稿をテスト

このプロセスを繰り返すことで、投稿成功率を最大化できます。
