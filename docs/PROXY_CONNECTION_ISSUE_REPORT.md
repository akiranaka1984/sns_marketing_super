# プロキシ接続問題の調査レポート

## 問題の概要

DuoPlusに設定しているプロキシが頻繁に接続が切れる問題が発生しています。

エラーメッセージ:
```
Connection test failed! Please ensure the proxy information is correct and the IP is available.
```

## 調査結果

### 1. データベースのプロキシ設定状況

- **総プロキシ数**: 12個
- **割り当て済み**: 12個（100%）
- **DuoPlus登録済み**: 12個（100%）
- **ステータス**: すべて`assigned`（エラーステータスなし）

### 2. プロキシサーバーの詳細

すべてのプロキシが同じプロバイダー（922s5.net）を使用しています:

- **ホスト**: `sg.922s5.net:6300`
- **プロトコル**: SOCKS5（推測）
- **認証**: ユーザー名/パスワード認証
- **セッションID**: 各プロキシに固有のセッションID（例: `SXPc5lpV`, `QhYKpAR1`）

### 3. 問題の特定

#### 3.1 プロキシサーバー側の問題（最も可能性が高い）

**922s5.netプロキシの特性**:
- 住宅用IPプロキシサービス
- セッションベースのローテーションプロキシ
- IPが頻繁に変更される可能性がある
- 同時接続数に制限がある可能性

**考えられる原因**:
1. **IPローテーション**: セッションIDベースのプロキシは、一定時間後または一定リクエスト数後にIPが変更される
2. **接続タイムアウト**: 長時間接続を維持すると、プロキシサーバー側でタイムアウトする
3. **同時接続制限**: 複数のデバイスが同じプロキシを使用している場合、同時接続数の制限に達する
4. **プロキシサーバーの不安定性**: 922s5.netのサーバーが一時的にダウンまたは過負荷状態

#### 3.2 DuoPlus側の問題

- DuoPlusのプロキシ設定は正常（12個すべて登録済み）
- プロキシIDは正しく保存されている（`3lhD0`, `9H73j`, `lyD40`など）

#### 3.3 ネットワーク設定の問題

- プロキシポート: `6300`（標準的なSOCKS5ポート）
- 認証情報: ユーザー名は正しい形式（`10644873LJ-zone-custom-region-JP-sessid-XXX`）

## 根本原因の推測

**最も可能性が高い原因**: **プロキシサーバーのIPローテーションとセッション管理**

922s5.netのようなセッションベースのプロキシは、以下の特性があります:
1. セッションIDごとにIPが割り当てられる
2. 一定時間（例: 5分、10分）後にIPが自動的に変更される
3. IPが変更されると、既存の接続が切断される
4. DuoPlusデバイスは新しいIPで再接続を試みるが、認証情報が変更されていないため失敗する

## 推奨される解決策

### 即座に実施可能な対策

#### 1. プロキシの再接続機能を実装

```typescript
// server/duoplus-proxy-health.ts
export async function reconnectProxy(deviceId: string, proxyId: string) {
  // 1. デバイスからプロキシを削除
  await removeProxyFromDevice(deviceId);
  
  // 2. 3秒待機
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // 3. プロキシを再設定
  await setDeviceProxy(deviceId, proxyId);
}
```

#### 2. プロキシヘルスチェック機能を実装

```typescript
// 定期的にプロキシの接続状況をチェック（5分ごと）
setInterval(async () => {
  const devices = await getDevicesWithProxy();
  
  for (const device of devices) {
    const isConnected = await checkProxyConnection(device.id);
    
    if (!isConnected) {
      console.log(`[ProxyHealth] Device ${device.id} proxy disconnected, reconnecting...`);
      await reconnectProxy(device.id, device.proxyId);
    }
  }
}, 5 * 60 * 1000); // 5分ごと
```

#### 3. プロキシプロバイダーの変更を検討

**より安定したプロキシサービス**:
- **Bright Data (Luminati)**: エンタープライズグレード、99.9%アップタイム
- **Oxylabs**: 高品質住宅用プロキシ、スティッキーセッション対応
- **Smartproxy**: 長時間セッション対応（最大30分）
- **IPRoyal**: コストパフォーマンスが良い、安定性も高い

### 中長期的な対策

#### 4. プロキシプールの実装

複数のプロキシを用意し、接続が切れた場合に自動的に別のプロキシに切り替える:

```typescript
// 1つのデバイスに対して3つのバックアッププロキシを用意
const proxyPool = [
  { id: 'primary', host: 'sg.922s5.net:6300', ... },
  { id: 'backup1', host: 'sg.922s5.net:6300', ... },
  { id: 'backup2', host: 'sg.922s5.net:6300', ... },
];

// 接続失敗時に次のプロキシに切り替え
if (!isConnected) {
  const nextProxy = getNextProxyFromPool(device.id);
  await setDeviceProxy(device.id, nextProxy.id);
}
```

#### 5. スティッキーセッションの使用

922s5.netがスティッキーセッション（長時間同じIPを維持）をサポートしている場合、セッションパラメータを調整:

```
10644873LJ-zone-custom-region-JP-sessid-XXX-sesstime-30
```

`sesstime-30`を追加することで、30分間同じIPを維持できる可能性があります（プロバイダーのドキュメントを確認）。

## 次のステップ

1. **即座に実施**: プロキシ再接続機能を実装
2. **今日中**: プロキシヘルスチェック機能を実装
3. **今週中**: プロキシプロバイダーに問い合わせ（スティッキーセッションの設定方法）
4. **来週**: より安定したプロキシサービスへの移行を検討

## 参考情報

- 922s5.net公式ドキュメント: https://www.922s5.net/
- DuoPlus APIドキュメント: https://help.duoplus.net/docs/api-reference
- プロキシ設定ガイド: `/docs/DUOPLUS_INTEGRATION.md`
