# DuoPlus API 統合ガイド

このドキュメントでは、DuoPlus API の統合方法と使用方法について説明します。

## 📋 概要

DuoPlus は、クラウドベースのモバイルデバイスエミュレーションプラットフォームです。このシステムでは、DuoPlus API を使用して以下の機能を実現しています:

- **クラウドデバイス操作**: 画面タップ、テキスト入力、スクリーンショット取得
- **プロキシ管理**: IP ローテーション、地域設定
- **デバイス管理**: デバイスの作成、削除、ステータス確認
- **アプリ操作**: アプリの起動、停止、インストール

## 🔑 認証設定

### 環境変数の設定

DuoPlus API を使用するには、以下の環境変数を設定する必要があります:

```bash
DUOPLUS_API_KEY=your_api_key_here
DUOPLUS_API_URL=https://api.duoplus.net
```

これらの環境変数は、Manus プラットフォームの Settings → Secrets から設定できます。

### API キーの取得

1. [DuoPlus](https://my.duoplus.net/) にログイン
2. Settings → API Keys に移動
3. 「Create New API Key」をクリック
4. 生成された API キーをコピー
5. Manus プラットフォームの Secrets に追加

## 🛠️ API ラッパーの使用方法

### 基本的な使用例

```typescript
import { DuoPlusClient } from './server/duoplus';

// クライアントの初期化
const client = new DuoPlusClient();

// デバイスの一覧取得
const devices = await client.listDevices();

// デバイスの作成
const device = await client.createDevice({
  name: 'Test Device',
  platform: 'android',
  region: 'us-west',
});

// 画面操作
await client.tap(device.id, { x: 100, y: 200 });
await client.inputText(device.id, 'Hello World');

// スクリーンショット取得
const screenshot = await client.screenshot(device.id);

// デバイスの削除
await client.deleteDevice(device.id);
```

## 📱 アカウント登録フローの実装

### Twitter の登録例

```typescript
import { registerAccount } from './server/accountRegistration';

const result = await registerAccount({
  platform: 'twitter',
  username: 'myusername',
  password: 'mypassword',
  deviceId: 'device-123',
});

if (result.success) {
  console.log('Registration successful!');
} else {
  console.error('Registration failed:', result.error);
}
```

### 登録フローの詳細

1. **デバイスの選定**: 利用可能なデバイスから自動的に選定
2. **プロキシ設定**: IP ローテーションのためのプロキシ設定
3. **アプリ起動**: 対象プラットフォームのアプリを起動
4. **ログイン画面遷移**: ログイン画面に自動遷移
5. **認証情報入力**: ユーザー名とパスワードを自動入力
6. **ログイン実行**: ログインボタンをタップ
7. **成功確認**: ログイン成功を確認
8. **ログ記録**: 結果をデータベースに記録

## 🔄 エラーハンドリング

### リトライロジック

```typescript
async function registerWithRetry(params: RegisterParams, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await registerAccount(params);
      if (result.success) {
        return result;
      }
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error);
      if (attempt === maxRetries) {
        throw error;
      }
      // 指数バックオフ
      await sleep(Math.pow(2, attempt) * 1000);
    }
  }
}
```

### エラーの種類

- **DEVICE_NOT_AVAILABLE**: 利用可能なデバイスがない
- **APP_NOT_FOUND**: アプリが見つからない
- **LOGIN_FAILED**: ログインに失敗
- **NETWORK_ERROR**: ネットワークエラー
- **TIMEOUT**: タイムアウト
- **INVALID_CREDENTIALS**: 認証情報が無効

## 🎯 検出回避のベストプラクティス

### 1. ランダムな待機時間

```typescript
// 30秒～120秒のランダムな待機
const randomDelay = () => Math.floor(Math.random() * 90000) + 30000;

await sleep(randomDelay());
await client.tap(deviceId, { x: 100, y: 200 });
await sleep(randomDelay());
```

### 2. 自然な行動パターン

```typescript
// ゆっくりとしたタイピング
async function naturalTyping(deviceId: string, text: string) {
  for (const char of text) {
    await client.inputText(deviceId, char);
    await sleep(Math.random() * 500 + 200); // 200ms～700ms
  }
}
```

### 3. IP ローテーション

```typescript
// 10アカウントごとにIPを変更
if (accountCount % 10 === 0) {
  await client.rotateDevice(deviceId);
  await sleep(60000); // 1分待機
}
```

### 4. デバイス分散

```typescript
// 複数のデバイスに負荷を分散
const devices = await client.listDevices();
const deviceId = devices[accountCount % devices.length].id;
```

## 📊 パフォーマンス最適化

### 1. デバイス情報のキャッシング

```typescript
// デバイス情報を5分間キャッシュ
const deviceCache = new Map<string, { data: Device; expiry: number }>();

async function getCachedDevice(deviceId: string): Promise<Device> {
  const cached = deviceCache.get(deviceId);
  const now = Date.now();
  
  if (cached && cached.expiry > now) {
    return cached.data;
  }
  
  const device = await client.getDevice(deviceId);
  deviceCache.set(deviceId, {
    data: device,
    expiry: now + 5 * 60 * 1000, // 5分
  });
  
  return device;
}
```

### 2. 並列処理

```typescript
// 複数アカウントを並列で登録
const registrations = accounts.map(account => 
  registerAccount({
    platform: account.platform,
    username: account.username,
    password: account.password,
  })
);

const results = await Promise.allSettled(registrations);
```

### 3. レート制限対策

```typescript
// レート制限を考慮したキューイング
const queue = new PQueue({ concurrency: 5, interval: 60000, intervalCap: 50 });

for (const account of accounts) {
  queue.add(() => registerAccount(account));
}

await queue.onIdle();
```

## 🔐 セキュリティ考慮事項

### 1. API キーの保護

- API キーは環境変数で管理
- コードにハードコードしない
- Git にコミットしない

### 2. 認証情報の暗号化

```typescript
import { createCipher, createDecipher } from 'crypto';

function encryptPassword(password: string): string {
  const cipher = createCipher('aes-256-cbc', process.env.ENCRYPTION_KEY!);
  let encrypted = cipher.update(password, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

function decryptPassword(encrypted: string): string {
  const decipher = createDecipher('aes-256-cbc', process.env.ENCRYPTION_KEY!);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

### 3. ログのサニタイズ

```typescript
// パスワードをログに出力しない
function sanitizeLog(data: any): any {
  const sanitized = { ...data };
  if (sanitized.password) {
    sanitized.password = '***';
  }
  return sanitized;
}

console.log('Registration attempt:', sanitizeLog(params));
```

## 📈 監視とロギング

### 1. 詳細なログ記録

```typescript
await createLog({
  action: 'account_registration',
  status: 'in_progress',
  details: `Starting registration for ${platform} account: ${username}`,
  deviceId,
  accountId,
});
```

### 2. メトリクスの収集

```typescript
// 登録成功率の追跡
const metrics = {
  total: 0,
  success: 0,
  failed: 0,
  successRate: 0,
};

function updateMetrics(success: boolean) {
  metrics.total++;
  if (success) {
    metrics.success++;
  } else {
    metrics.failed++;
  }
  metrics.successRate = (metrics.success / metrics.total) * 100;
}
```

### 3. アラート設定

```typescript
// 失敗率が高い場合にアラート
if (metrics.successRate < 50 && metrics.total > 10) {
  await notifyOwner({
    title: 'High Registration Failure Rate',
    content: `Success rate: ${metrics.successRate.toFixed(2)}%`,
  });
}
```

## 🧪 テスト

### 1. ユニットテスト

```typescript
describe('DuoPlusClient', () => {
  it('should create a device', async () => {
    const client = new DuoPlusClient();
    const device = await client.createDevice({
      name: 'Test Device',
      platform: 'android',
    });
    
    expect(device).toBeDefined();
    expect(device.id).toBeDefined();
  });
});
```

### 2. 統合テスト

```typescript
describe('Account Registration', () => {
  it('should register a Twitter account', async () => {
    const result = await registerAccount({
      platform: 'twitter',
      username: 'test_user',
      password: 'test_password',
    });
    
    expect(result.success).toBe(true);
  });
});
```

## 📚 参考資料

- [DuoPlus 公式ドキュメント](https://docs.duoplus.net/)
- [DuoPlus API リファレンス](https://api.duoplus.net/docs)
- [DuoPlus コミュニティフォーラム](https://community.duoplus.net/)

## 🆘 トラブルシューティング

### 問題: デバイスが作成できない

**解決策**:
1. API キーが正しく設定されているか確認
2. DuoPlus アカウントの残高を確認
3. API レート制限に達していないか確認

### 問題: ログインに失敗する

**解決策**:
1. 認証情報が正しいか確認
2. アプリのバージョンが最新か確認
3. デバイスの地域設定を確認
4. IP がブロックされていないか確認

### 問題: タイムアウトが発生する

**解決策**:
1. ネットワーク接続を確認
2. タイムアウト時間を延長
3. デバイスの負荷を確認
4. 別のデバイスを試す

---

**このガイドは継続的に更新されます。質問や提案がある場合は、プロジェクトの Issue を作成してください。**
