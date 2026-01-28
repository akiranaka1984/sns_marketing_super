#!/usr/bin/python3.11
"""
テンプレートマッチングによるボタン座標検出

重要: このロジックは検証済みです。変更しないでください。
"""

import cv2
import numpy as np
import os
import json
from typing import Optional, Tuple, Dict, List

# 設定
TEMPLATE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATES_PATH = os.path.join(TEMPLATE_DIR, 'templates')
THRESHOLD = 0.65  # 一致度の閾値（リツイートボタン検出のため0.7から下げた）


def find_button(
    screenshot_path: str,
    template_path: str,
    select_topmost: bool = True
) -> Dict:
    """
    テンプレートマッチングでボタンの座標を検出
    
    Args:
        screenshot_path: スクリーンショットのパス
        template_path: テンプレート画像のパス
        select_topmost: True=最上部のボタンを選択（リプライのボタンを避ける）
    
    Returns:
        {
            "success": bool,
            "x": int or None,
            "y": int or None,
            "confidence": float,
            "count": int  # 検出されたボタンの数
        }
    """
    # 画像読み込み
    screenshot = cv2.imread(screenshot_path)
    template = cv2.imread(template_path)
    
    if screenshot is None:
        return {"success": False, "error": "SCREENSHOT_ERROR", "x": None, "y": None, "confidence": 0, "count": 0}
    
    if template is None:
        return {"success": False, "error": "TEMPLATE_ERROR", "x": None, "y": None, "confidence": 0, "count": 0}
    
    # テンプレートマッチング実行
    result = cv2.matchTemplate(screenshot, template, cv2.TM_CCOEFF_NORMED)
    
    # 閾値以上の全箇所を検出
    locations = np.where(result >= THRESHOLD)
    
    if len(locations[0]) == 0:
        # 見つからない場合は最大一致度を返す
        min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(result)
        return {
            "success": False,
            "error": "NOT_FOUND",
            "x": None,
            "y": None,
            "confidence": float(max_val),
            "count": 0
        }
    
    # 検出箇所をリスト化
    matches: List[Tuple[int, int, float]] = []
    for pt in zip(*locations[::-1]):  # (x, y)
        x = pt[0] + template.shape[1] // 2
        y = pt[1] + template.shape[0] // 2
        conf = result[pt[1], pt[0]]
        matches.append((x, y, float(conf)))
    
    # Y座標が近い重複を除去（50px以内は同一ボタンとみなす）
    filtered: List[Tuple[int, int, float]] = []
    for m in sorted(matches, key=lambda x: x[1]):  # Y座標でソート
        is_duplicate = False
        for f in filtered:
            if abs(m[1] - f[1]) < 50:
                is_duplicate = True
                break
        if not is_duplicate:
            filtered.append(m)
    
    # 最上部（Y座標が最小）のボタンを選択
    if select_topmost:
        selected = filtered[0]
    else:
        # 最も一致度が高いものを選択
        selected = max(filtered, key=lambda x: x[2])
    
    x, y, conf = selected
    
    return {
        "success": True,
        "x": int(x),
        "y": int(y),
        "confidence": float(conf),
        "count": len(filtered)
    }


def find_like_button(screenshot_path: str) -> Dict:
    """いいねボタンの座標を検出"""
    template_path = os.path.join(TEMPLATES_PATH, 'template_like_button.png')
    return find_button(screenshot_path, template_path, select_topmost=True)


def find_comment_button(screenshot_path: str) -> Dict:
    """コメントボタンの座標を検出"""
    template_path = os.path.join(TEMPLATES_PATH, 'template_comment_button.png')
    return find_button(screenshot_path, template_path, select_topmost=True)


def find_retweet_button(screenshot_path: str) -> Dict:
    """リツイート（リポスト）ボタンの座標を検出"""
    template_path = os.path.join(TEMPLATES_PATH, 'template_retweet_button.png')
    return find_button(screenshot_path, template_path, select_topmost=True)


def find_repost_option(screenshot_path: str) -> Dict:
    """リポストメニューの「リポスト」オプションの座標を検出"""
    template_path = os.path.join(TEMPLATES_PATH, 'template_repost_option.png')
    return find_button(screenshot_path, template_path, select_topmost=False)


def find_follow_button(screenshot_path: str) -> Dict:
    """フォローボタンの座標を検出"""
    template_path = os.path.join(TEMPLATES_PATH, 'template_follow_button.png')
    return find_button(screenshot_path, template_path, select_topmost=True)


# CLIとして実行する場合
if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python3.11 template_matching.py <screenshot.png> [like|comment|both]")
        sys.exit(1)
    
    screenshot = sys.argv[1]
    target = sys.argv[2] if len(sys.argv) > 2 else "both"
    
    results = {}
    
    if target in ["like", "both"]:
        results["like"] = find_like_button(screenshot)
    
    if target in ["comment", "both"]:
        results["comment"] = find_comment_button(screenshot)
    
    print(json.dumps(results, indent=2, ensure_ascii=False))
