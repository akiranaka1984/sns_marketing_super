# SNSマーケティング自動化プラットフォーム - プロジェクト設定

## プロジェクト概要
SNSマーケティング自動化プラットフォーム
Playwrightブラウザ自動化でX/Twitterへの投稿を自動化

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
- OpenAI API（GPT-4, GPT-4 Vision）
- Playwright（ブラウザ自動化）

### インフラ
- Docker + Docker Compose

## ディレクトリ構成

```
project-root/
├── docker-compose.yml      # Docker構成
├── Dockerfile              # Node.jsアプリ用
├── .dockerignore
├── .env.example            # 環境変数サンプル
│
├── server/                 # バックエンド
│   ├── routers/           # tRPC APIルーター
│   │   ├── index.ts       # ルーター統合
│   │   ├── accounts.ts    # アカウント管理
│   │   ├── posts.ts       # 投稿管理
│   │   └── strategies.ts  # 戦略管理
│   ├── services/          # ビジネスロジック
│   │   ├── openai.ts      # AI戦略生成
│   │   └── scheduler.ts   # スケジューラー
│   ├── playwright/        # Playwright自動化
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
├── scripts/               # 各種スクリプト
└── tests/                 # テストファイル
```

## Docker開発環境

### コンテナ構成
```
┌─────────────────────────────────────────┐
│              Docker Network              │
├──────────┬──────────┬──────────────────┤
│   app    │    db    │      redis       │
│  :5000   │  :3306   │      :6379       │
│  Node.js │  MySQL   │      Redis       │
└──────────┴──────────┴──────────────────┘
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

## 環境変数

```env
# Database
DATABASE_URL=mysql://user:password@db:3306/sns_automation

# Redis
REDIS_URL=redis://redis:6379

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

## 計画ドキュメント管理

- plan modeで作成した実装計画は必ず `docs/` ディレクトリに保存する
- ファイル名形式: `PLAN_<機能名>.md`（例: `PLAN_AUTH_REFACTOR.md`）
- 過去の計画を蓄積し、意思決定の経緯を残す

## 既知の問題・制約事項

1. **X/Twitterのみ対応**: 現在はPlaywright経由でX/Twitterのみ自動投稿に対応
2. **MySQL接続**: 初回起動時に接続待ちが必要な場合あり
