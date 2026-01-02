# DuoPlus Cloud Drive API

## ファイル転送の流れ

1. まずCloud Driveにファイルをアップロード（Web UIまたはAPI経由）
2. File List APIでファイルIDを取得
3. File Push APIでデバイスにファイルを転送

## File List API

- Method: POST
- Endpoint: `/api/v1/cloudDisk/pushFiles` (ドキュメントの誤り？実際は/api/v1/cloudDisk/listかも)
- パラメータ:
  - keyword: 検索キーワード（オプション）
  - page: ページ番号（デフォルト1）
  - pagesize: 1ページあたりの件数（デフォルト10、最大100）

## File Push API

- Method: POST
- Endpoint: `/api/v1/cloudDisk/pushFiles`
- パラメータ:
  - ids: ファイルIDの配列（必須）
  - image_ids: クラウドフォンIDの配列（必須）
  - dest_dir: 転送先ディレクトリ（必須）例: "/sdcard/Download"

## 実装方針

DuoPlus Cloud Driveへのファイルアップロード用のAPIが見つからないため、
以下の代替方法を検討:

1. ADBコマンドでURLからファイルを直接ダウンロード
   - `am start -a android.intent.action.VIEW -d "URL"`
   - または `curl` / `wget` コマンドを使用

2. S3のパブリックURLを使用してデバイスで直接ダウンロード
