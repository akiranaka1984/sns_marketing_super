# SNS Marketing Automation System

DuoPlus API を活用した、SNSアカウントの自動登録・運用を実現するマーケティング自動化システムです。

## 🚀 主要機能

### 1. アカウント自動登録
- **対応プラットフォーム**: Twitter, TikTok, Instagram, Facebook
- **自動化プロセス**: ID/PWを入力するだけで、自動的にログイン・登録を実行
- **リアルタイム監視**: 登録状況をリアルタイムで確認
- **エラーハンドリング**: 自動リトライ機能により、失敗時も自動で再試行

### 2. AI戦略生成エンジン
- **OpenAI API統合**: 目的文章から最適なマーケティング戦略を自動生成
- **生成内容**:
  - コンテンツタイプの推奨
  - ハッシュタグ戦略
  - 投稿スケジュール
  - エンゲージメント戦略
  - サンプルコンテンツ

### 3. DuoPlus API統合
- **クラウドデバイス操作**: 画面タップ、テキスト入力、スクリーンショット取得
- **プロキシ管理**: IP ローテーション、地域設定
- **検出回避**: 自然な行動パターンのシミュレート

### 4. 管理画面
- **ダッシュボード**: アカウント数、デバイス数、最近のアクティビティを一目で確認
- **アカウント管理**: 登録済みアカウントの一覧表示、ステータス確認
- **戦略管理**: AI生成された戦略の一覧表示、詳細確認
- **ログ表示**: 詳細なアクティビティログの表示

### 5. セキュリティ機能
- **認証**: Manus OAuth による安全なログイン
- **環境変数管理**: 認証情報の安全な管理
- **HTTPS通信**: すべての通信を暗号化

## 📋 技術スタック

### フロントエンド
- **React 19**: 最新のReactフレームワーク
- **Tailwind CSS 4**: モダンなスタイリング
- **shadcn/ui**: 高品質なUIコンポーネント
- **tRPC**: タイプセーフなAPI通信
- **Wouter**: 軽量なルーティング

### バックエンド
- **Node.js + Express**: サーバーサイドフレームワーク
- **tRPC 11**: エンドツーエンドのタイプセーフティ
- **Drizzle ORM**: タイプセーフなデータベースクエリ
- **MySQL/TiDB**: リレーショナルデータベース

### AI・自動化
- **OpenAI API**: AI戦略生成
- **DuoPlus API**: クラウドデバイス操作

## 🛠️ セットアップ

### 前提条件
- Node.js 22.x
- pnpm 10.x
- MySQL/TiDB データベース

### 環境変数
以下の環境変数が自動的に設定されます:
- `DATABASE_URL`: データベース接続文字列
- `JWT_SECRET`: セッション署名用シークレット
- `VITE_APP_ID`: Manus OAuth アプリケーションID
- `OAUTH_SERVER_URL`: Manus OAuth バックエンドURL
- `BUILT_IN_FORGE_API_URL`: Manus API URL
- `BUILT_IN_FORGE_API_KEY`: Manus API キー

### インストール

```bash
# 依存関係のインストール
pnpm install

# データベースマイグレーション
pnpm db:push

# 開発サーバーの起動
pnpm dev
```

### テスト実行

```bash
# すべてのテストを実行
pnpm test

# TypeScriptの型チェック
pnpm check
```

## 📖 使い方

### 1. アカウントの登録

1. ダッシュボードから「Add New Account」をクリック
2. プラットフォームを選択（Twitter, TikTok, Instagram, Facebook）
3. ユーザー名とパスワードを入力
4. 「Start Registration」をクリック
5. 登録状況がリアルタイムで表示されます

### 2. AI戦略の生成

1. ナビゲーションから「Strategies」をクリック
2. 「Generate Strategy」をクリック
3. マーケティング目的を入力（例: "Increase brand awareness for eco-friendly products"）
4. 「Generate Strategy」をクリック
5. AI が自動的に戦略を生成します

### 3. ログの確認

1. ナビゲーションから「Logs」をクリック
2. 最近のアクティビティログが表示されます
3. 各ログには以下の情報が含まれます:
   - アクション名
   - ステータス（成功/失敗/進行中）
   - 詳細情報
   - タイムスタンプ
   - デバイスID
   - アカウントID

## 🗄️ データベーススキーマ

### accounts テーブル
- アカウント情報の管理
- プラットフォーム、ユーザー名、ステータスなどを保存

### devices テーブル
- DuoPlusデバイス情報の管理
- デバイスID、ステータス、プロキシ情報などを保存

### strategies テーブル
- AI生成された戦略の管理
- 目的、コンテンツタイプ、ハッシュタグ、スケジュールなどを保存

### logs テーブル
- アクティビティログの管理
- アクション、ステータス、詳細情報、エラーメッセージなどを保存

## 🔧 開発ガイド

### ディレクトリ構造

```
sns_marketing_automation/
├── client/                 # フロントエンドコード
│   ├── src/
│   │   ├── pages/         # ページコンポーネント
│   │   ├── components/    # 再利用可能なUIコンポーネント
│   │   ├── lib/           # ユーティリティ関数
│   │   └── App.tsx        # ルーティング設定
│   └── public/            # 静的ファイル
├── server/                # バックエンドコード
│   ├── routers.ts         # tRPC ルーター定義
│   ├── db.ts              # データベースクエリヘルパー
│   ├── duoplus.ts         # DuoPlus API ラッパー
│   ├── accountRegistration.ts  # アカウント登録フロー
│   ├── aiEngine.ts        # AI戦略生成エンジン
│   └── _core/             # フレームワークコア
├── drizzle/               # データベーススキーマ
│   └── schema.ts          # テーブル定義
└── shared/                # 共有型定義
```

### 新機能の追加

1. **データベーススキーマの更新**
   ```bash
   # drizzle/schema.ts を編集
   pnpm db:push
   ```

2. **クエリヘルパーの追加**
   ```typescript
   // server/db.ts に関数を追加
   export async function getAccountsByPlatform(platform: string) {
     const db = await getDb();
     return db.select().from(accounts).where(eq(accounts.platform, platform));
   }
   ```

3. **tRPC プロシージャの追加**
   ```typescript
   // server/routers.ts に追加
   accounts: router({
     byPlatform: protectedProcedure
       .input(z.object({ platform: z.string() }))
       .query(({ input }) => getAccountsByPlatform(input.platform)),
   }),
   ```

4. **フロントエンドでの使用**
   ```typescript
   const { data } = trpc.accounts.byPlatform.useQuery({ platform: 'twitter' });
   ```

## 🔐 セキュリティ

- すべての認証情報は環境変数で管理
- HTTPS通信の強制
- セッションベースの認証
- tRPC の `protectedProcedure` による認証済みユーザーのみのアクセス制御

## 📝 ライセンス

MIT License

## 🤝 サポート

問題が発生した場合は、以下を確認してください:

1. **データベース接続**: `DATABASE_URL` が正しく設定されているか
2. **環境変数**: すべての必要な環境変数が設定されているか
3. **ログ**: `Logs` ページでエラーメッセージを確認

## 🚀 デプロイ

```bash
# ビルド
pnpm build

# 本番環境で起動
pnpm start
```

## 📊 パフォーマンス

- **並列処理**: 複数アカウントの同時登録に対応
- **キャッシング**: デバイス情報のキャッシュによる高速化
- **最適化されたクエリ**: Drizzle ORM による効率的なデータベースアクセス

## 🎯 今後の機能拡張

- [ ] 投稿スケジューリング機能
- [ ] 自動コメント・いいね機能
- [ ] アナリティクスダッシュボード
- [ ] 複数ユーザー対応
- [ ] Webhook 統合
- [ ] API エクスポート機能

---

**Built with ❤️ using Manus Platform**
