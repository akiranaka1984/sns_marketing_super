# SNSマーケティング自動化プラットフォーム - プロジェクト設定

## プロジェクト概要
究極のSNSマーケティング自動化プラットフォーム（バーチャル携帯統合版）
DuoPlus APIを活用したバーチャルAndroidデバイスでSNS操作を自動化

## 技術スタック

### フロントエンド
- React 19 + TypeScript
- Tailwind CSS 4 + shadcn/ui
- Wouter（ルーティング）

### バックエンド
- Node.js + Express 4
- tRPC 11（型安全API）
- Drizzle ORM

### データベース
- MySQL 8.0（Docker）
- Redis（キャッシュ/キュー）

### 外部サービス
- DuoPlus API（バーチャルAndroidデバイス制御）
- OpenAI API（GPT-4, GPT-4 Vision）

### インフラ
- Docker + Docker Compose
- Python（画像処理ワーカー）

## ディレクトリ構成

```
project-root/
├── docker-compose.yml      # Docker構成
├── Dockerfile              # Node.jsアプリ用
├── Dockerfile.python       # Pythonワーカー用
├── .dockerignore
├── .env.example            # 環境変数サンプル
│
├── server/                 # バックエンド
│   ├── routers/           # tRPC APIルーター
│   │   ├── index.ts       # ルーター統合
│   │   ├── accounts.ts    # アカウント管理
│   │   ├── posts.ts       # 投稿管理
│   │   ├── strategies.ts  # 戦略管理
│   │   └── devices.ts     # デバイス操作
│   ├── services/          # ビジネスロジック
│   │   ├── duoplus.ts     # DuoPlus API連携
│   │   ├── openai.ts      # AI戦略生成
│   │   └── scheduler.ts   # スケジューラー
│   ├── lib/               # ユーティリティ
│   └── db/                # データベース関連
│       ├── index.ts       # DB接続
│       └── schema.ts      # Drizzleスキーマ
│
├── client/                 # フロントエンド
│   └── src/
│       ├── pages/         # ページコンポーネント
│       ├── components/    # 共通コンポーネント
│       ├── hooks/         # カスタムフック
│       └── utils/         # ユーティリティ
│
├── shared/                 # 共有型定義
│   └── types.ts
│
├── drizzle/               # DBマイグレーション
│   ├── schema.ts
│   └── migrations/
│
├── python/                # Python自動化スクリプト
│   ├── template_matching.py
│   ├── duoplus_client.py
│   └── automation/
│
├── scripts/               # 各種スクリプト
└── tests/                 # テストファイル
```

## Docker開発環境

### コンテナ構成
```
┌─────────────────────────────────────────────────────┐
│                    Docker Network                    │
├──────────┬──────────┬──────────┬───────────────────┤
│   app    │    db    │  redis   │  python-worker    │
│  :5000   │  :3306   │  :6379   │                   │
│  Node.js │  MySQL   │  Redis   │  OpenCV/Python    │
└──────────┴──────────┴──────────┴───────────────────┘
```

### 起動コマンド
```bash
# 初回起動
docker compose up -d --build

# 通常起動
docker compose up -d

# ログ確認
docker compose logs -f app

# 停止
docker compose down

# 完全削除（ボリューム含む）
docker compose down -v
```

### DBマイグレーション
```bash
docker compose exec app pnpm db:push
docker compose exec app pnpm db:generate
```

### テスト実行
```bash
docker compose exec app pnpm test
docker compose exec app pnpm test --coverage
```

## コーディング規約

### tRPC
- ルーターは機能単位で分割
- 入力は必ずZodでバリデーション
- エラーは`TRPCError`を使用

### Drizzle ORM
- スキーマは`drizzle/schema.ts`に集約
- リレーションは明示的に定義
- マイグレーションはDBプッシュ方式

### React
- コンポーネントは関数コンポーネント
- 状態管理はReact Query（tRPC統合）
- スタイルはTailwind CSS

### TypeScript
- `any`禁止、型は明示的に定義
- 共有型は`shared/types.ts`

## DuoPlus API操作の注意点

### 座標検出の鉄則
1. **UIAutomator必須**: 推測座標は絶対使わない
2. **閾値0.8以上**: テンプレートマッチング時
3. **待機時間**: 操作間は最低1秒、画面遷移後は3秒
4. **3回リトライ**: 失敗時は最大3回リトライ

### 座標計算の重要ポイント
```typescript
// bounds形式: [left, top][right, bottom]
// 中心座標の計算
const centerX = (bounds[0] + bounds[2]) / 2;
const centerY = (bounds[1] + bounds[3]) / 2;
```

## 環境変数

```env
# Database
DATABASE_URL=mysql://user:password@db:3306/sns_automation

# Redis
REDIS_URL=redis://redis:6379

# DuoPlus API
DUOPLUS_API_KEY=your_api_key

# OpenAI
OPENAI_API_KEY=your_api_key

# App
NODE_ENV=development
PORT=5000
```

## テスト要件

### 単体テスト
- Vitest使用
- カバレッジ目標: 80%以上
- モック: 外部APIはモック必須

### E2Eテスト
- Dockerコンテナ内で実行
- テストDBを使用
- 実デバイス操作はスキップ可能

## 既知の問題・制約事項

1. **DuoPlus API制限**: レート制限あり、連続操作に注意
2. **テンプレート画像**: 解像度依存、複数パターン用意推奨
3. **MySQL接続**: 初回起動時に接続待ちが必要な場合あり
