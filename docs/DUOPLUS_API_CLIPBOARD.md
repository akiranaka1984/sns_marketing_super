# DuoPlus API - クリップボード操作

## 概要

DuoPlus APIには直接的なクリップボード操作APIは存在しません。しかし、**ADBコマンド実行API**を使用してクリップボード操作を実現できます。

## ADBコマンド実行API

### エンドポイント
```
POST /api/v1/cloudPhone/command
```

### 認証
```
Header: DuoPlus-API-Key: YOUR_API_KEY
```

### リクエストパラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| image_id | string | Yes | クラウドフォンID |
| command | string | Yes | 実行するADBコマンド（`adb shell`プレフィックスは不要） |

### 制限事項
- **10秒以内に完了するコマンドのみサポート**
- 長時間実行コマンドは `> /dev/null 2>&1 &` を末尾に追加してバックグラウンド実行

## クリップボード操作方法

### 方法1: input keyevent（ペースト操作）

```bash
# 1. テキスト入力フィールドをタップ（座標は事前に確認）
input tap 300 400

# 2. 長押しでペーストメニューを表示（2秒間）
input swipe 300 400 300 400 2000

# 3. ペーストボタンをタップ
input tap 350 450
```

**問題点:**
- 座標が固定されているため、画面レイアウトが変わると動作しない
- ペーストメニューの表示位置が予測できない

### 方法2: am broadcast（クリップボードに直接書き込み）

```bash
# クリップボードにテキストをコピー
am broadcast -a clipper.set -e text "こんにちは、世界！"
```

**問題点:**
- 標準のAndroid APIではサポートされていない
- カスタムアプリ（Clipper）が必要

### 方法3: service call（システムレベルのクリップボード操作）

```bash
# クリップボードにテキストを設定（Base64エンコード）
service call clipboard 2 s16 "こんにちは"
```

**問題点:**
- Android 10以降では動作しない可能性がある
- セキュリティ制限により失敗する可能性が高い

## 推奨アプローチ

### ✅ 現実的な解決策: UI自動化ツール（UIAutomator2）

DuoPlus APIのADBコマンド実行機能を使って、**UIAutomator2**を活用します。

#### ステップ1: UIAutomator2でテキスト入力フィールドを特定

```bash
# UI要素のダンプを取得
uiautomator dump /sdcard/ui.xml && cat /sdcard/ui.xml
```

#### ステップ2: テキスト入力フィールドに直接テキストを設定

```bash
# UIAutomator2コマンドでテキストを入力
uiautomator runtest uitest.jar -c com.example.SetText -e text "こんにちは、世界！"
```

**問題点:**
- カスタムJARファイルが必要
- 複雑な実装

## 最終的な推奨方法

### 🎯 方法4: input text + Base64エンコード（最も確実）

```bash
# Base64エンコードされたテキストを入力
input text $(echo -n "こんにちは、世界！" | base64)
```

**しかし、これも日本語では動作しません。**

## 結論

**DuoPlus APIのADBコマンド実行機能では、日本語テキストの直接入力は不可能です。**

### 代替案

1. **DuoPlus Web UIの手動操作**
   - ユーザーがDuoPlus Web UIで手動でテキストを入力

2. **事前にテキストファイルをアップロード**
   - Cloud Drive Management APIでテキストファイルをアップロード
   - アプリ内でファイルを読み込んで投稿

3. **英語のみで投稿**
   - 日本語を諦めて英語で投稿

4. **ローカルADB接続を使用**
   - DuoPlusのADB接続情報（`98.98.125.9:23385`）を使用
   - ローカルからADBコマンドを実行
   - ADBKeyboardを使用して日本語入力

## 次のステップ

**ローカルADB接続方式を実装することを推奨します。**
