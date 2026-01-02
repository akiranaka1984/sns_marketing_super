# DuoPlus API Reference

このドキュメントは、DuoPlus Cloud Phone APIの主要なエンドポイントをまとめたものです。

公式ドキュメント: https://help.duoplus.net/docs/api-reference

---

## 認証

**ヘッダー:**
```
DuoPlus-API-Key: YOUR_API_KEY
```

**ベースURL:**
```
https://openapi.duoplus.net
```

---

## Cloud Phone APIs

### 1. デバイス一覧取得

**エンドポイント:** `GET /api/v1/cloudPhone/list`

**レスポンス:**
```json
{
  "code": 200,
  "data": {
    "list": [
      {
        "id": "device_id",
        "name": "device_name",
        "status": 1,  // 0: Powered Off, 1: Powered On, 2: Starting, 4: Stopping
        "model": "model_name"
      }
    ]
  }
}
```

---

### 2. デバイス起動（Batch Power On）

**エンドポイント:** `POST /api/v1/cloudPhone/powerOn`

**リクエスト:**
```json
{
  "image_ids": ["device_id_1", "device_id_2"]
}
```

**レスポンス:**
```json
{
  "code": 200,
  "data": {
    "success": ["device_id_1"],
    "fail": ["device_id_2"]
  },
  "message": "Success"
}
```

**注意事項:**
- 最大20台のデバイスを同時に起動可能
- 非同期操作（起動リクエスト後、ステータスAPIで確認が必要）
- 課金は起動直後から開始
- 停止するには powerOff APIを呼び出す必要がある

---

### 3. デバイス停止（Batch Power Off）

**エンドポイント:** `POST /api/v1/cloudPhone/powerOff`

**リクエスト:**
```json
{
  "image_ids": ["device_id_1", "device_id_2"]
}
```

**レスポンス:**
```json
{
  "code": 200,
  "data": {
    "success": ["device_id_1"],
    "fail": ["device_id_2"]
  },
  "message": "Success"
}
```

**注意事項:**
- 最大20台のデバイスを同時に停止可能
- 停止後は課金が停止

---

### 4. デバイス再起動（Batch Restart）

**エンドポイント:** `POST /api/v1/cloudPhone/restart`

**リクエスト:**
```json
{
  "image_ids": ["device_id_1", "device_id_2"]
}
```

---

### 5. デバイスステータス取得

**エンドポイント:** `GET /api/v1/cloudPhone/status`

**パラメータ:**
- `image_id`: デバイスID

**レスポンス:**
```json
{
  "code": 200,
  "data": {
    "status": 1  // 0: Powered Off, 1: Powered On, 2: Starting, 4: Stopping
  }
}
```

---

### 6. ADBコマンド実行

**エンドポイント:** `POST /api/v1/cloudPhone/executeAdb`

**リクエスト:**
```json
{
  "image_id": "device_id",
  "command": "shell input tap 100 200"
}
```

---

## Proxy APIs

### 1. プロキシ追加

**エンドポイント:** `POST /api/v1/proxy/add`

**リクエスト:**
```json
{
  "host": "proxy.example.com",
  "port": 8080,
  "username": "user",
  "password": "pass"
}
```

**レスポンス:**
```json
{
  "code": 200,
  "data": {
    "id": "proxy_id"
  }
}
```

---

### 2. プロキシ一覧取得

**エンドポイント:** `GET /api/v1/proxy/list`

**レスポンス:**
```json
{
  "code": 200,
  "data": {
    "list": [
      {
        "id": "proxy_id",
        "host": "proxy.example.com",
        "port": 8080
      }
    ]
  }
}
```

---

### 3. デバイスにプロキシ設定

**エンドポイント:** `POST /api/v1/cloudPhone/setProxy`

**リクエスト:**
```json
{
  "image_id": "device_id",
  "proxy_id": "proxy_id"
}
```

---

## ステータスコード

- `0`: Powered Off（停止中）
- `1`: Powered On（起動中）
- `2`: Starting（起動処理中）
- `4`: Stopping（停止処理中）

---

## エラーハンドリング

**共通エラーレスポンス:**
```json
{
  "code": 400,
  "message": "Error description"
}
```

**一般的なエラー:**
- `400`: リクエストパラメータが不正
- `401`: 認証エラー（APIキーが無効）
- `403`: 権限不足
- `404`: リソースが見つからない
- `500`: サーバーエラー

---

## 実装のベストプラクティス

### 1. 非同期操作の処理

デバイスの起動/停止は非同期操作のため、以下の手順で処理：

```typescript
// 1. 起動リクエストを送信
await powerOnDevice(deviceId);

// 2. 数秒待機
await new Promise(resolve => setTimeout(resolve, 3000));

// 3. ステータスを確認
const status = await getDeviceStatus(deviceId);
if (status === 1) {
  console.log("Device powered on successfully");
}
```

### 2. バッチ処理

複数デバイスを操作する場合は、一括APIを使用：

```typescript
// 最大20台まで同時処理可能
const deviceIds = ["device1", "device2", "device3"];
const response = await powerOnDevices(deviceIds);

// 成功/失敗を個別に確認
console.log("Success:", response.data.success);
console.log("Failed:", response.data.fail);
```

### 3. エラーハンドリング

```typescript
try {
  await powerOnDevice(deviceId);
} catch (error) {
  if (error.message.includes("not found")) {
    // デバイスが存在しない
  } else if (error.message.includes("permission")) {
    // 権限不足
  } else {
    // その他のエラー
  }
}
```

---

## 更新履歴

- 2025-12-12: 初版作成（公式ドキュメントv1に基づく）
