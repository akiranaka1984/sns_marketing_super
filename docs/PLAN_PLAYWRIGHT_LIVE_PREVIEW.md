# Playwright ライブプレビュー機能

## 概要
Playwright自動化（ログイン・投稿・ヘルスチェック）の実行中、ブラウザ画面をリアルタイムでフロントエンドのモーダルに表示する。

## 技術方式: CDP Screencast + WebSocket

ChromeのCDP（Chrome DevTools Protocol）`Page.startScreencast` を使い、ブラウザのフレームをJPEGで取得し、WebSocketでフロントエンドにバイナリ送信する。

**選定理由:**
- CDP screencastはChrome内蔵で画面変化時のみフレーム送信（低負荷）
- WebSocketバイナリ転送でbase64より33%効率的
- 既存のHTTPサーバーにWebSocketServerを追加するだけ（追加ポート不要）

## アーキテクチャ

```
Chromium (Playwright)
    │ CDP Page.startScreencast (JPEG frames)
    ▼
ScreencastService (server/playwright/screencast-service.ts)
    │ バイナリフレーム + JSONステータス
    ▼
WebSocketServer (ws://host/ws/playwright-preview?accountId=X)
    │
    ▼
React BrowserPreviewDialog (モーダル内 <img> タグ)
```

## 実装ファイル一覧

### 新規作成 (4ファイル)

| ファイル | 内容 |
|---------|------|
| `server/playwright/screencast-service.ts` | CDP screencast管理・フレーム配信・操作ステータス管理 |
| `server/playwright/ws-preview.ts` | WebSocketサーバー（`/ws/playwright-preview`パス） |
| `client/src/hooks/useBrowserPreview.ts` | WebSocket接続・フレーム管理カスタムフック |
| `client/src/components/BrowserPreviewDialog.tsx` | ライブプレビューモーダルコンポーネント |

### 既存変更 (6ファイル)

| ファイル | 変更内容 |
|---------|---------|
| `server/playwright/x-login-handler.ts` | `loginToX`にscreencast開始/停止を追加 |
| `server/playwright/x-playwright-poster.ts` | `postToXViaPlaywright`にscreencast開始/停止を追加 |
| `server/playwright/browser-session-manager.ts` | `checkSessionHealth`にscreencast開始/停止を追加 |
| `server/playwright/index.ts` | screencast関連のre-export追加 |
| `server/_core/index.ts` | `attachWebSocketServer(server)`呼び出し追加 |
| `client/src/pages/AccountDetail.tsx` | セッションタブにライブプレビューボタン追加、操作時にモーダル自動表示 |

## 作成日
2026-02-04
