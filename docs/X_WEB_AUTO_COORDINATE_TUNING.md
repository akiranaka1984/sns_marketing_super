# X Web版投稿の座標自動調整機能

## 概要

ステップテストの結果に基づいて、X（Twitter）Web版投稿のタップ座標を自動的に学習・調整する機能です。機械学習的なアプローチで、成功率の高い座標を自動的に特定します。

## 仕組み

### 1. 学習データの収集

ステップテストを実行するたびに、以下のデータをデータベースに記録します:

- **デバイスID**: テストを実行したデバイス
- **解像度**: 画面解像度（例: "1080x2400"）
- **要素**: タップした要素（`composeButton`, `textArea`, `postButton`）
- **成功/失敗**: そのステップが成功したか（1 = 成功, 0 = 失敗）
- **スクリーンショットURL**: そのステップのスクリーンショット
- **タイムスタンプ**: テスト実行日時

### 2. 最適座標の計算

学習データから、各要素の成功率を計算します:

```
成功率 = (成功回数 / 総テスト回数) × 100
```

- **成功率 ≥ 80%**: 現在の座標を維持（最適）
- **成功率 < 80%**: 座標の調整を推奨

### 3. 座標調整アルゴリズム

成功率が低い場合、以下のロジックで座標を調整します:

```typescript
adjustmentFactor = max(0.95, 1 - (100 - successRate) / 100)

// 例: 成功率70%の場合
// adjustmentFactor = max(0.95, 1 - (100 - 70) / 100) = max(0.95, 0.7) = 0.95

adjustedX = currentX × adjustmentFactor
adjustedY = currentY × adjustmentFactor
```

### 4. 推奨事項の生成

失敗したステップに対して、具体的な推奨事項を生成します:

- 調整後の座標値
- 成功率（信頼度）
- 手動調整が必要な場合の指示

## 使用方法

### 方法1: 自動調整のみ実行

```javascript
// ブラウザコンソールで実行
const result = await window.trpc.xWebCoordinate.autoTune.mutate({
  deviceId: 'snap_xxxxx',
  resolution: '1080x2400',
  testContent: 'テスト投稿 for coordinate tuning'
});

console.log('調整結果:', result);
console.log('成功率:', result.learningData.successRate + '%');
console.log('推奨座標:', result.adjustedCoordinates);
console.log('推奨事項:', result.recommendations);
```

### 方法2: 座標を設定ファイルに適用

```javascript
// Step 1: 自動調整を実行
const tuningResult = await window.trpc.xWebCoordinate.autoTune.mutate({
  deviceId: 'snap_xxxxx',
  resolution: '1080x2400'
});

// Step 2: 調整後の座標を適用
if (tuningResult.adjustedCoordinates) {
  const applyResult = await window.trpc.xWebCoordinate.applyAdjustments.mutate({
    resolution: '1080x2400',
    coordinates: {
      composeButton: tuningResult.adjustedCoordinates.composeButton,
      textArea: tuningResult.adjustedCoordinates.textArea,
      postButton: tuningResult.adjustedCoordinates.postButton
    }
  });

  console.log('適用結果:', applyResult);
}
```

### 方法3: 複数回テストして学習

```javascript
// 5回テストを実行して学習データを蓄積
for (let i = 0; i < 5; i++) {
  console.log(`テスト ${i + 1}/5 実行中...`);
  
  const result = await window.trpc.xWebCoordinate.autoTune.mutate({
    deviceId: 'snap_xxxxx',
    resolution: '1080x2400',
    testContent: `テスト投稿 ${i + 1}`
  });

  console.log(`テスト ${i + 1} 完了: 成功率 ${result.learningData.successRate}%`);
  
  // 次のテストまで10秒待機
  await new Promise(resolve => setTimeout(resolve, 10000));
}

// 最終的な推奨座標を取得
const finalResult = await window.trpc.xWebCoordinate.autoTune.mutate({
  deviceId: 'snap_xxxxx',
  resolution: '1080x2400'
});

console.log('最終推奨座標:', finalResult.adjustedCoordinates);
console.log('最終成功率:', finalResult.learningData.successRate + '%');
```

## 自動調整結果の構造

```typescript
interface CoordinateTuningResult {
  success: boolean;              // 全ステップが成功したか
  resolution: string;            // 解像度
  adjustedCoordinates: {
    composeButton?: {
      x: number;                 // 調整後のX座標
      y: number;                 // 調整後のY座標
      confidence: number;        // 信頼度（成功率%）
    };
    textArea?: { ... };
    postButton?: { ... };
  };
  learningData: {
    totalTests: number;          // 総テスト回数
    successfulTests: number;     // 成功したテスト回数
    successRate: number;         // 成功率（%）
  };
  recommendations: string[];     // 推奨事項のリスト
}
```

## 座標設定ファイル

調整された座標は `server/x-web-coordinates.json` に保存されます:

```json
{
  "1080x2400": {
    "composeButton": { "x": 960, "y": 2200 },
    "textArea": { "x": 540, "y": 800 },
    "postButton": { "x": 960, "y": 140 }
  },
  "1080x1920": {
    "composeButton": { "x": 960, "y": 1700 },
    "textArea": { "x": 540, "y": 600 },
    "postButton": { "x": 960, "y": 120 }
  }
}
```

**注意**: 座標を適用した後は、サーバーを再起動して変更を反映してください。

## ワークフロー

### 初回セットアップ

```
1. デバイスの準備
   - 電源オン
   - Chromeインストール
   - Xログイン
   ↓
2. 初回テスト実行
   - autoTune を実行
   - 成功率を確認
   ↓
3. 学習データの蓄積
   - 5〜10回テストを実行
   - 成功率が80%以上になるまで繰り返し
   ↓
4. 座標の適用
   - applyAdjustments で設定ファイルに保存
   - サーバー再起動
   ↓
5. 本番投稿テスト
   - postWithAutoFix で実際に投稿
```

### 継続的な改善

```
1. 定期的なテスト
   - 週1回程度、autoTune を実行
   - 成功率の推移を監視
   ↓
2. 成功率が低下した場合
   - スクリーンショットを確認
   - UI変更の有無をチェック
   - 必要に応じて座標を再調整
   ↓
3. 新しい解像度のデバイス追加時
   - その解像度で初回テストを実行
   - 学習データを蓄積
   - 座標を適用
```

## 学習データの管理

### データベーステーブル

```sql
CREATE TABLE coordinate_learning_data (
  id INT AUTO_INCREMENT PRIMARY KEY,
  deviceId VARCHAR(100) NOT NULL,
  resolution VARCHAR(50) NOT NULL,
  element VARCHAR(50) NOT NULL,
  success INT NOT NULL,
  screenshotUrl TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 学習データの確認

```sql
-- 解像度ごとの成功率を確認
SELECT 
  resolution,
  element,
  COUNT(*) as total_tests,
  SUM(success) as successful_tests,
  ROUND(SUM(success) * 100.0 / COUNT(*), 2) as success_rate
FROM coordinate_learning_data
GROUP BY resolution, element
ORDER BY resolution, element;
```

### 学習データのクリア

```sql
-- 古いデータを削除（30日以上前）
DELETE FROM coordinate_learning_data
WHERE createdAt < DATE_SUB(NOW(), INTERVAL 30 DAY);
```

## ベストプラクティス

### 1. 十分な学習データを蓄積

最低5回、できれば10回以上のテストを実行してから座標を適用します。

```javascript
// ❌ 悪い例: 1回のテストで判断
const result = await autoTune(...);
await applyAdjustments(...); // データ不足

// ✅ 良い例: 10回テストしてから判断
for (let i = 0; i < 10; i++) {
  await autoTune(...);
  await sleep(10000);
}
const finalResult = await autoTune(...);
if (finalResult.learningData.successRate >= 80) {
  await applyAdjustments(...);
}
```

### 2. 解像度ごとに個別に調整

異なる解像度のデバイスは、それぞれ個別に学習データを蓄積します。

```javascript
// デバイスごとに解像度を確認
const diagnosis = await window.trpc.xWeb.diagnose.mutate({
  deviceId: 'snap_xxxxx'
});

const resolution = diagnosis.screenResolution.raw;

// その解像度で自動調整
await window.trpc.xWebCoordinate.autoTune.mutate({
  deviceId: 'snap_xxxxx',
  resolution: resolution
});
```

### 3. 成功率の閾値を設定

成功率が一定以上になるまで、座標を適用しないようにします。

```javascript
const MIN_SUCCESS_RATE = 80;
const MIN_TEST_COUNT = 5;

const result = await autoTune(...);

if (result.learningData.totalTests >= MIN_TEST_COUNT &&
    result.learningData.successRate >= MIN_SUCCESS_RATE) {
  // 座標を適用
  await applyAdjustments(...);
} else {
  console.log('まだデータが不足しています。もっとテストを実行してください。');
}
```

### 4. 推奨事項を確認

自動調整の推奨事項を必ず確認し、手動調整が必要な場合は対応します。

```javascript
const result = await autoTune(...);

result.recommendations.forEach(rec => {
  console.log('推奨事項:', rec);
});

// 手動調整が必要な場合
if (result.recommendations.some(r => r.includes('manually adjust'))) {
  console.log('手動調整が必要です。スクリーンショットを確認してください。');
}
```

## トラブルシューティング

### 問題1: 成功率が上がらない

**原因**: 座標が大きくずれている、またはUI構造が変わった

**対処方法**:
1. スクリーンショットを確認して、要素の位置を目視で確認
2. `getCoordinates`関数を手動で調整
3. 再度テストを実行

### 問題2: 学習データが保存されない

**原因**: データベース接続エラー、またはテーブルが存在しない

**対処方法**:
1. `pnpm db:push` でスキーマを更新
2. データベース接続を確認
3. エラーログを確認

### 問題3: 座標適用後も失敗する

**原因**: サーバーが再起動されていない、または設定ファイルが読み込まれていない

**対処方法**:
1. サーバーを再起動
2. `server/x-web-coordinates.json` が正しく作成されているか確認
3. `getCoordinates`関数が設定ファイルを読み込むように修正

## まとめ

座標自動調整機能により、以下のメリットが得られます:

1. **投稿成功率の向上**: 最適な座標を自動的に学習
2. **運用コストの削減**: 手動調整の頻度を最小化
3. **継続的な改善**: テストを重ねるごとに精度が向上
4. **複数解像度対応**: デバイスごとに最適な座標を自動設定

推奨される使用方法は、定期的に `autoTune` を実行して学習データを蓄積し、成功率が80%以上になったら `applyAdjustments` で座標を適用することです。
