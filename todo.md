# SNS Marketing Automation System - TODO

## 検証済みロジックの実装（IMPLEMENTATION_GUIDE.md準拠）

- [x] テンプレート画像を配置（scripts/duoplus/templates/）
- [x] template_matching.py を実装
- [x] duoplus_client.py を実装
- [x] like_action.py を実装
- [x] ai_comment_action.py を実装
- [x] python-runner.ts を実装
- [x] automation.ts ルーターを実装
- [x] automation_tasks.ts スキーマを実装
- [x] データベースマイグレーション実行

## バグ修正

- [x] Python環境の互換性問題を修正（PYTHONHOME/PYTHONPATHがPython 3.13を指していた問題）

### アカウント追加ページの重複エラー問題
- [x] 重複アカウントエラーの問題を調査
- [x] エラーメッセージの改善（既存アカウントへのリンク追加）
- [x] 重複チェックのUX改善（ユーザー単位でのチェックに変更）
- [x] 修正のテストと動作確認

## 無料ユーザー投稿制限対応

- [x] AI投稿生成時の文字数制限実装(最大280文字または140全角文字)
- [x] フロントエンドに文字数カウンター追加
- [x] 文字数超過時の警告表示実装
- [x] 文字数制限のバリデーションテスト作成

## 高優先度機能開発（戦略設計書完全実装）

### Phase 1: 要件分析とデータベース設計
- [x] モード切替機能の詳細要件定義
- [x] AI自動学習の戦略反映機能の詳細要件定義
- [x] データベーススキーマ設計（projects, strategies, agentsテーブル拡張）
- [x] データベースマイグレーション実行

### Phase 2: モード切替機能の実装（バックエンド）
- [x] projectsテーブルにexecutionModeカラム追加（fullAuto/confirm/manual）
- [x] フルオートモードのロジック実装（自動承認機能）
- [x] 確認モードのロジック実装（既存機能の整理）
- [x] 手動モードのロジック実装
- [x] tRPCエンドポイント追加（projects.updateMode）

### Phase 3: モード切替機能の実装（フロントエンド）
- [x] プロジェクト詳細ページにモード選択UIを追加
- [x] モード説明とアイコン表示
- [x] モード切替時の確認ダイアログ
- [x] 投稿レビューページのUI調整（フルオート時は自動承認表示）

### Phase 4: AI自動学習の戦略反映機能の実装
- [x] エンゲージメント分析サービス実装（engagement-analyzer.ts）
- [x] 戦略最適化サービス実装（strategy-optimizer.ts）
- [x] 週次レビュー自動実行機能（weekly-review-scheduler.ts）
- [x] 戦略自動更新API実装（strategies.autoOptimize）
- [x] 学習結果の可視化UI（週次レビューページ拡張）

### Phase 5: 統合テストと動作確認
- [x] モード切替機能のVitestテスト作成
- [x] AI自動学習機能のVitestテスト作成
- [x] エンドツーエンドテスト実行
- [x] 実際のデバイスでテスト実行

### Phase 6: 結果報告とドキュメント作成
- [x] 実装完了レポート作成
- [ ] ユーザーガイド更新
- [ ] 戦略設計書との最終比較レポート作成

### アカウントステータスが「保留中」の問題
- [x] arnoldmuran82@gmail.comアカウントのステータスが保留中になっている原因を調査
- [x] アカウント作成時のデフォルトステータスを確認
- [x] 保留中ステータスの意味と使用目的を確認
- [x] 適切な修正方法を決定（自動アクティブ化 or 手動承認フロー）
- [x] 修正を実装してテスト

### arnoldmuran82@gmail.comアカウントが保留中のまま
- [x] データベースで該当アカウントのステータスを確認
- [x] arnoldmuran82@gmail.comアカウントのステータスをactiveに更新
- [x] ブラウザで更新して表示を確認

### プロジェクト編集ページ404エラー
- [x] App.tsxでルーティング設定を確認
- [x] /projects/:id/editルートが存在するか確認
- [x] ProjectEditページコンポーネントを作成または修正
- [x] プロジェクト編集機能を実装
- [x] ProjectDetail.tsxの編集ボタンにonClickハンドラーを追加
- [x] ブラウザで動作確認

### プロジェクト管理機能の強化
- [x] データベーススキーマを確認（startDate, endDate, statusフィールド）
- [x] 必要に応じてフィールドを追加
- [x] データベースマイグレーションを実行
- [x] ProjectEdit.tsxに開始日・終了日の入力フィールドを追加
- [x] ProjectEdit.tsxにステータス選択ドロップダウンを追加
- [x] バックエンドAPIを更新（projects.update）
- [x] プロジェクト削除APIを実装（projects.delete）
- [x] ProjectEdit.tsxに削除ボタンと確認ダイアログを追加
- [x] ブラウザで動作確認

### 投稿作成時のアカウント選択機能
- [x] ProjectDetail.tsxの投稿作成ダイアログにアカウント選択ドロップダウンを追加
- [x] プロジェクトに紐付いているアカウント一覧を取得して表示
- [x] 選択されたアカウントで投稿を作成
- [x] ブラウザで動作確認
