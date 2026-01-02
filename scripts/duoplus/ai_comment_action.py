#!/usr/bin/python3.11
"""
AIコメント実行ロジック

重要: このロジックは検証済みです。変更しないでください。

フロー:
1. 投稿URLを開く（10秒待機）
2. スクリーンショット取得
3. GPT-4 Visionで投稿内容を読み取りコメント生成
4. テンプレートマッチングでコメントボタン検出
5. 見つからなければスクロールして再試行（最大3回）
6. コメントボタンをタップ
7. コメント入力
8. 投稿ボタンをタップ
"""

import os
import sys
import time
import json
import base64
import urllib.request
import ssl
from typing import Dict, Optional

from duoplus_client import DuoPlusClient
from template_matching import find_comment_button

# SSL証明書検証をスキップ
ssl._create_default_https_context = ssl._create_unverified_context

# 設定
MAX_RETRY = 3
WAIT_AFTER_OPEN = 10
WAIT_AFTER_SCROLL = 2
WAIT_AFTER_COMMENT_BUTTON = 3
POST_BUTTON_X = 980  # 投稿ボタンのX座標（固定）
POST_BUTTON_Y = 350  # 投稿ボタンのY座標（固定）
TEMP_SCREENSHOT = "/tmp/screenshot.png"


def generate_ai_comment(
    screenshot_path: str,
    openai_api_key: str,
    persona: str
) -> Optional[str]:
    """
    GPT-4 Visionで投稿を読み取りコメントを生成
    
    Args:
        screenshot_path: スクリーンショットのパス
        openai_api_key: OpenAI APIキー
        persona: コメントのペルソナ設定
    
    Returns:
        生成されたコメント文字列 or None
    """
    # 画像をBase64エンコード
    with open(screenshot_path, "rb") as f:
        image_base64 = base64.b64encode(f.read()).decode("utf-8")
    
    prompt = f"""この画像はX（Twitter）の投稿のスクリーンショットです。

【タスク】
1. 投稿の内容を読み取ってください
2. 以下のペルソナとして、この投稿に対する自然なコメント（リプライ）を生成してください

【ペルソナ】
{persona}

【コメントのルール】
- 50文字以内の短いコメント
- 投稿内容に具体的に言及する
- フレンドリーで前向きなトーン
- 絵文字は1つまで使用可
- 質問を入れると会話が広がりやすい
- 宣伝や営業っぽくならないこと
- 日本語で書くこと

【出力形式】
コメント文のみを出力してください。説明や前置きは不要です。
"""
    
    request_body = {
        "model": "gpt-4o",
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{image_base64}",
                            "detail": "high"
                        }
                    }
                ]
            }
        ],
        "max_tokens": 200
    }
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {openai_api_key}"
    }
    
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps(request_body).encode("utf-8"),
        headers=headers,
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            result = json.loads(response.read().decode("utf-8"))
            comment = result["choices"][0]["message"]["content"].strip()
            comment = comment.strip('"').strip("'").strip()
            return comment
    except Exception as e:
        print(f"Error generating comment: {e}", file=sys.stderr)
        return None


def execute_ai_comment(
    api_key: str,
    device_id: str,
    post_url: str,
    openai_api_key: str,
    persona: str
) -> Dict:
    """
    投稿にAIコメントを実行
    
    Returns:
        {
            "success": bool,
            "comment": str,
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
    
    # Step 2: スクリーンショット取得
    if not client.take_screenshot(TEMP_SCREENSHOT):
        return {"success": False, "error": "SCREENSHOT_FAILED"}
    
    # Step 3: AIコメント生成
    comment = generate_ai_comment(TEMP_SCREENSHOT, openai_api_key, persona)
    
    if not comment:
        return {"success": False, "error": "COMMENT_GENERATION_FAILED"}
    
    # Step 4: コメントボタン検出（リトライ付き）
    found = False
    x, y, confidence = None, None, 0
    retry_count = 0
    
    for i in range(MAX_RETRY):
        retry_count = i + 1
        
        # スクリーンショット取得
        if not client.take_screenshot(TEMP_SCREENSHOT):
            continue
        
        # テンプレートマッチング
        result = find_comment_button(TEMP_SCREENSHOT)
        
        if result["success"]:
            x = result["x"]
            y = result["y"]
            confidence = result["confidence"]
            found = True
            break
        else:
            if i < MAX_RETRY - 1:
                client.scroll_down()
                time.sleep(WAIT_AFTER_SCROLL)
    
    if not found:
        return {
            "success": False,
            "error": "COMMENT_BUTTON_NOT_FOUND",
            "comment": comment,
            "retry_count": retry_count,
            "confidence": confidence
        }
    
    # Step 5: コメントボタンをタップ
    if not client.tap(x, y):
        return {
            "success": False,
            "error": "TAP_FAILED",
            "comment": comment,
            "x": x,
            "y": y
        }
    
    time.sleep(WAIT_AFTER_COMMENT_BUTTON)
    
    # Step 6: コメント入力
    if not client.input_text(comment):
        return {
            "success": False,
            "error": "INPUT_FAILED",
            "comment": comment,
            "x": x,
            "y": y
        }
    
    time.sleep(1)
    
    # Step 7: 投稿ボタンをタップ
    if not client.tap(POST_BUTTON_X, POST_BUTTON_Y):
        return {
            "success": False,
            "error": "POST_TAP_FAILED",
            "comment": comment,
            "x": x,
            "y": y
        }
    
    # 一時ファイル削除
    try:
        os.remove(TEMP_SCREENSHOT)
    except:
        pass
    
    return {
        "success": True,
        "comment": comment,
        "x": x,
        "y": y,
        "confidence": confidence,
        "retry_count": retry_count
    }


# CLIとして実行する場合
if __name__ == "__main__":
    if len(sys.argv) < 6:
        print("Usage: python3.11 ai_comment_action.py <duoplus_api_key> <device_id> <post_url> <openai_api_key> <persona>")
        sys.exit(1)
    
    result = execute_ai_comment(
        sys.argv[1],  # duoplus_api_key
        sys.argv[2],  # device_id
        sys.argv[3],  # post_url
        sys.argv[4],  # openai_api_key
        sys.argv[5]   # persona
    )
    print(json.dumps(result, indent=2, ensure_ascii=False))
