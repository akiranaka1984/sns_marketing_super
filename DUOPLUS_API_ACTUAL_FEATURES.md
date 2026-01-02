# DuoPlus API 実際の機能（公式ドキュメント確認済み）

## 公式ドキュメント: https://help.duoplus.net/docs/api-reference

---

## 📱 確認できたAPI機能

### 1. Cloud Phone（クラウドフォン管理）
- **Cloud Phone List**: デバイス一覧取得（ページネーション対応、最大100件/ページ）
  - エンドポイント: `POST /api/v1/cloudPhone/list`
  - フィルタ: 名前、グループID、IP、ステータス、プロキシID、ADB状態、タグIDなど
  - ソート: 名前、作成日時、有効期限
  - レスポンス: デバイスID、名前、ステータス、OS、サイズ、IP、ADB情報など

- **Batch Power On**: 一括電源ON
- **Batch Power Off**: 一括電源OFF
- **Batch Restart**: 一括再起動
- **Cloud Phone Status**: デバイス状態確認
- **Details**: デバイス詳細情報
- **Batch Modify Parameters**: 一括パラメータ変更
- **Cloud Phone Model List**: デバイスモデル一覧
- **Reset and Regenerate Device**: デバイスリセット・再生成
- **Batch Set Root**: 一括Root設定
- **Execute the ADB command**: ADBコマンド実行
- **Advanced Commands**: 高度なコマンド
- **Change sharing password**: 共有パスワード変更
- **Batch Enable ADB**: 一括ADB有効化
- **Batch Disable ADB**: 一括ADB無効化
- **Connected Member List**: 接続メンバー一覧
- **Tag List**: タグ一覧
- **Cloud Phone Resource List**: デバイスリソース一覧

### 2. Proxy（プロキシ管理）
- プロキシ設定と管理

### 3. Groups（グループ管理）
- デバイスのグループ化と管理

### 4. Application（アプリケーション管理）
- アプリのインストール・管理

### 5. Best Practices（ベストプラクティス）
- 推奨される使用方法

### 6. Cloud Drive Management（クラウドドライブ管理）
- ファイル管理

---

## 🎯 重要な発見

### ✅ DuoPlus APIは「デバイス管理」に特化
DuoPlus APIは、**クラウドフォン（仮想デバイス）の管理**に特化したAPIです。以下の機能を提供します:

1. **デバイスの電源管理**: 起動、停止、再起動
2. **デバイス情報の取得**: ステータス、IP、OS、ADB情報
3. **ADBコマンドの実行**: 画面操作、アプリ操作
4. **プロキシ設定**: IPアドレスの変更
5. **グループ管理**: 複数デバイスの一括管理

### ❌ SNS操作やデータ取得の専用APIは存在しない
公式ドキュメントを確認した結果、以下の機能は**DuoPlus APIには含まれていません**:

- ❌ SNSアプリの自動操作（投稿、いいね、フォローなど）
- ❌ フォロワー数の自動取得
- ❌ エンゲージメント率の計算
- ❌ アナリティクスデータの取得
- ❌ 投稿スケジューリング

これらの機能を実現するには、**ADBコマンドを使用した画面操作**または**各SNSの公式API**を使用する必要があります。

---

## 💡 実装アプローチの修正

### 現在のシステムの実装方針

#### ✅ 正しい実装（そのまま使用可能）
1. **デバイス一覧取得**: `POST /api/v1/cloudPhone/list`
2. **デバイス電源管理**: Batch Power On/Off/Restart
3. **ADB有効化**: Batch Enable ADB

#### ⚠️ 修正が必要な実装
現在の`server/duoplus.ts`は、**推測に基づいた実装**です。実際のDuoPlus APIエンドポイントに合わせて修正する必要があります:

**修正前（推測実装）:**
```typescript
// これらのエンドポイントは存在しない可能性が高い
await duoplusClient.post(`/devices/${deviceId}/tap`, { x, y });
await duoplusClient.post(`/devices/${deviceId}/input`, { text });
await duoplusClient.get(`/devices/${deviceId}/screenshot`);
```

**修正後（ADBコマンド経由）:**
```typescript
// ADBコマンドを使用して画面操作を実行
await duoplusClient.post(`/api/v1/cloudPhone/executeAdb`, {
  cloudPhoneId: deviceId,
  command: `input tap ${x} ${y}`
});

await duoplusClient.post(`/api/v1/cloudPhone/executeAdb`, {
  cloudPhoneId: deviceId,
  command: `input text "${text}"`
});

await duoplusClient.post(`/api/v1/cloudPhone/executeAdb`, {
  cloudPhoneId: deviceId,
  command: `screencap -p /sdcard/screenshot.png`
});
```

---

## 📊 結論

### DuoPlus APIでできること（確認済み）
1. ✅ **デバイス管理**: 電源ON/OFF、再起動、ステータス確認
2. ✅ **ADBコマンド実行**: 画面タップ、テキスト入力、スクリーンショット
3. ✅ **プロキシ設定**: IPアドレスの変更
4. ✅ **グループ管理**: 複数デバイスの一括管理

### DuoPlus APIだけではできないこと
1. ❌ **SNS操作の高度な自動化**: 投稿、いいね、フォローなど
2. ❌ **データの自動取得**: フォロワー数、エンゲージメント率など
3. ❌ **アナリティクス**: 成長率、レポート生成など

### 次のステップ
1. **DuoPlus API実装の修正**: 公式エンドポイントに合わせて`server/duoplus.ts`を修正
2. **ADBコマンドの活用**: 画面操作をADBコマンド経由で実装
3. **SNS公式API統合**: データ取得と投稿機能の実装
4. **画像認識の導入**: スクリーンショットからデータを抽出

**重要**: DuoPlus APIは「デバイス管理」のためのAPIであり、「SNS自動化」のためのAPIではありません。SNS自動化を実現するには、DuoPlus APIを基盤として、ADBコマンドやSNS公式APIを組み合わせる必要があります。
