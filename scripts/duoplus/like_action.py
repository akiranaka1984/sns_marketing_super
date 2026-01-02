#!/usr/bin/python3.11
"""
いいね実行ロジック

重要: このロジックは検証済みです。変更しないでください。

フロー:
1. 投稿URLを開く（10秒待機）
2. スクリーンショット取得
3. テンプレートマッチングでいいねボタン検出
4. 見つからなければスクロールして再試行（最大3回）
5. タップ実行
6. 結果確認
"""

import os
import sys
import time
import json
from typing import Dict

from duoplus_client import DuoPlusClient
from template_matching import find_like_button

# 設定
MAX_RETRY = 3
WAIT_AFTER_OPEN = 10  # URL開いた後の待機秒数
WAIT_AFTER_SCROLL = 2
TEMP_SCREENSHOT = "/tmp/screenshot.png"
TEMP_SCREENSHOT_AFTER = "/tmp/screenshot_after.png"


def execute_like(
    api_key: str,
    device_id: str,
    post_url: str
) -> Dict:
    """
    投稿にいいねを実行
    
    Returns:
        {
            "success": bool,
            "x": int,
            "y": int,
            "confidence": float,
            "retry_count": int,
            "error": str or None
        }
    """
    client = DuoPlusClient(api_key, device_id)
    
    # Step 1: 投稿を開く
    if not client.open_url(post_url):
        return {"success": False, "error": "FAILED_TO_OPEN_URL"}
    
    time.sleep(WAIT_AFTER_OPEN)
    
    # Step 2-3: スクリーンショット & テンプレートマッチング（リトライ付き）
    found = False
    x, y, confidence = None, None, 0
    retry_count = 0
    
    for i in range(MAX_RETRY):
        retry_count = i + 1
        
        # スクリーンショット取得
        if not client.take_screenshot(TEMP_SCREENSHOT):
            continue
        
        # テンプレートマッチング
        result = find_like_button(TEMP_SCREENSHOT)
        
        if result["success"]:
            x = result["x"]
            y = result["y"]
            confidence = result["confidence"]
            found = True
            break
        else:
            # 見つからなければスクロール
            if i < MAX_RETRY - 1:
                client.scroll_down()
                time.sleep(WAIT_AFTER_SCROLL)
    
    if not found:
        return {
            "success": False,
            "error": "LIKE_BUTTON_NOT_FOUND",
            "retry_count": retry_count,
            "confidence": confidence
        }
    
    # Step 4: タップ実行
    if not client.tap(x, y):
        return {
            "success": False,
            "error": "TAP_FAILED",
            "x": x,
            "y": y,
            "confidence": confidence,
            "retry_count": retry_count
        }
    
    time.sleep(1)
    
    # Step 5: 結果確認用スクリーンショット
    client.take_screenshot(TEMP_SCREENSHOT_AFTER)
    
    # 一時ファイル削除
    try:
        os.remove(TEMP_SCREENSHOT)
        os.remove(TEMP_SCREENSHOT_AFTER)
    except:
        pass
    
    return {
        "success": True,
        "x": x,
        "y": y,
        "confidence": confidence,
        "retry_count": retry_count
    }


# CLIとして実行する場合
if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python3.11 like_action.py <api_key> <device_id> <post_url>")
        sys.exit(1)
    
    result = execute_like(sys.argv[1], sys.argv[2], sys.argv[3])
    print(json.dumps(result, indent=2, ensure_ascii=False))
