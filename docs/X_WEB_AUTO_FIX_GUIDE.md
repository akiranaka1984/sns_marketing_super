# X Web版投稿の自動修正機能ガイド

## 概要

X（Twitter）Web版への投稿時に発生する問題を自動的に検出し、修正する機能です。診断機能の実行結果に基づいて、以下の問題を自動的に解決します。

## 自動修正可能な問題

### 1. デバイスの電源がオフ

**問題**: デバイスがシャットダウンまたはスリープ状態

**自動修正**:
- DuoPlus APIを使用してデバイスを起動
- 起動完了まで30秒待機
- 起動後に再診断を実行

**制限事項**: なし（完全自動修正可能）

### 2. Chromeが起動していない

**問題**: Chromeアプリがバックグラウンドで停止している

**自動修正**:
- ADBコマンドでChromeを起動
- 起動完了まで3秒待機

**制限事項**: なし（完全自動修正可能）

### 3. 画面が予期しない状態

**問題**: アプリが開きっぱなし、ダイアログが表示されているなど

**自動修正**:
- ホーム画面に戻る（KEYCODE_HOME）
- 最近使ったアプリをクリア
- クリーンな状態を確保

**制限事項**: なし（完全自動修正可能）

### 4. Chromeがインストールされていない

**問題**: Chromeアプリがデバイスにインストールされていない

**自動修正**: **不可能**

**対処方法**: DuoPlusダッシュボードから手動でChromeをインストール

### 5. Xにログインしていない

**問題**: X（Twitter）のセッションが期限切れまたはログアウト状態

**自動修正**: **不可能**（Play Integrity API制限により自動ログイン不可）

**対処方法**: DuoPlusダッシュボードから手動でログイン

## 使用方法

### 方法1: 診断のみ実行

```typescript
const diagnosis = await trpc.xWeb.diagnose.mutate({
  deviceId: 'snap_xxxxx'
});

console.log('Device status:', diagnosis.deviceStatus);
console.log('Errors:', diagnosis.errors);
```

### 方法2: 自動修正のみ実行

```typescript
const fixResult = await trpc.xWeb.autoFix.mutate({
  deviceId: 'snap_xxxxx'
});

console.log('Fixed issues:', fixResult.fixedIssues);
console.log('Remaining issues:', fixResult.remainingIssues);
console.log('Actions taken:', fixResult.actions);
```

### 方法3: 診断→自動修正→投稿可否判定

```typescript
const workflow = await trpc.xWeb.diagnoseAndFix.mutate({
  deviceId: 'snap_xxxxx'
});

if (workflow.canPost) {
  console.log('Device is ready for posting');
  // 投稿を実行
} else {
  console.log('Cannot post:', workflow.message);
  console.log('Auto-fix result:', workflow.autoFixResult);
}
```

### 方法4: 自動修正付き投稿（推奨）

```typescript
const result = await trpc.xWeb.postWithAutoFix.mutate({
  deviceId: 'snap_xxxxx',
  content: 'テスト投稿'
});

if (result.success) {
  console.log('Posted successfully');
  console.log('Screenshot:', result.screenshotUrl);
} else {
  console.log('Failed to post:', result.message);
  console.log('Auto-fix result:', result.autoFixResult);
}
```

## ワークフロー

### 標準ワークフロー

```
1. 初回診断
   ↓
2. 問題検出
   ↓
3. 自動修正試行
   ├─ デバイス電源オン
   ├─ Chrome起動
   └─ 画面リセット
   ↓
4. 最終診断
   ↓
5. 投稿可否判定
   ├─ OK → 投稿実行
   └─ NG → エラー報告
```

### 自動修正のタイムライン

```
0秒    : 初回診断開始
5秒    : 診断完了、問題検出
5秒    : デバイス電源オン（必要な場合）
35秒   : 電源オン完了待機
35秒   : Chrome起動（必要な場合）
38秒   : Chrome起動完了
38秒   : 画面リセット
40秒   : 最終診断開始
45秒   : 最終診断完了、投稿可否判定
```

## 自動修正結果の構造

```typescript
interface AutoFixResult {
  success: boolean;              // 全ての問題が解決されたか
  fixedIssues: string[];         // 修正された問題のリスト
  remainingIssues: string[];     // 残っている問題のリスト
  actions: FixAction[];          // 実行されたアクションの詳細
  finalDiagnosis?: DiagnosisResult; // 最終診断結果
}

interface FixAction {
  issue: string;                 // 問題の説明
  action: string;                // 実行されたアクション
  success: boolean;              // アクションが成功したか
  error?: string;                // エラーメッセージ（失敗時）
  timestamp: Date;               // アクション実行時刻
}
```

## エラーハンドリング

### 自動修正可能なエラー

これらのエラーは自動的に修正されます:

- `Device powered off` → 自動起動
- `Chrome not running` → 自動起動
- `Screen in unexpected state` → ホーム画面に戻す

### 手動対応が必要なエラー

これらのエラーは手動対応が必要です:

- `Chrome not installed` → DuoPlusダッシュボードから手動インストール
- `Not logged in to X` → DuoPlusダッシュボードから手動ログイン
- `DUOPLUS_API_KEY not found` → 環境変数を設定

## ベストプラクティス

### 1. 常に自動修正付き投稿を使用

```typescript
// ❌ 非推奨: 診断なしで直接投稿
await trpc.xWeb.post.mutate({ deviceId, content });

// ✅ 推奨: 自動修正付き投稿
await trpc.xWeb.postWithAutoFix.mutate({ deviceId, content });
```

### 2. 定期的な診断

投稿前だけでなく、定期的にデバイスの状態を診断することで、問題を早期に発見できます。

```typescript
// 1時間ごとに診断
setInterval(async () => {
  const diagnosis = await trpc.xWeb.diagnose.mutate({ deviceId });
  if (diagnosis.errors.length > 0) {
    // 自動修正を試みる
    await trpc.xWeb.autoFix.mutate({ deviceId });
  }
}, 3600000);
```

### 3. エラーログの保存

自動修正の結果をデータベースに保存し、問題の傾向を分析できるようにします。

```typescript
const result = await trpc.xWeb.autoFix.mutate({ deviceId });

// ログをデータベースに保存
await db.insert(autoFixLogs).values({
  deviceId,
  fixedIssues: result.fixedIssues,
  remainingIssues: result.remainingIssues,
  actions: JSON.stringify(result.actions),
  timestamp: new Date()
});
```

## トラブルシューティング

### 問題: 自動修正後も投稿に失敗する

**原因**: ログイン状態が期限切れ、または座標が不正確

**対処方法**:
1. DuoPlusダッシュボードで手動ログイン
2. `trpc.xWeb.testPost` でステップバイステップテストを実行
3. スクリーンショットを確認して座標を調整

### 問題: デバイスが起動しない

**原因**: デバイスの有効期限切れ、または設定中

**対処方法**:
1. DuoPlusダッシュボードでデバイスの状態を確認
2. 有効期限を更新
3. 設定中の場合は完了まで待機

### 問題: Chromeが起動してもすぐに停止する

**原因**: メモリ不足、またはシステムエラー

**対処方法**:
1. デバイスを再起動
2. 不要なアプリを削除
3. DuoPlusサポートに問い合わせ

## まとめ

自動修正機能により、以下のメリットが得られます:

1. **投稿成功率の向上**: デバイスの問題を自動的に解決
2. **運用コストの削減**: 手動介入が必要なケースを最小化
3. **デバッグの効率化**: 問題の原因を自動的に特定
4. **信頼性の向上**: 投稿前に必ずデバイスの状態を確認

推奨される使用方法は、常に `postWithAutoFix` を使用することです。これにより、診断→修正→投稿のワークフローが自動的に実行され、最も高い成功率が得られます。
