#!/usr/bin/python3.11
"""
DuoPlus API クライアント

重要: このロジックは検証済みです。変更しないでください。
"""

import requests
import base64
import time
import os
from typing import Optional, Dict

# 設定（環境変数から取得）
DUOPLUS_API_KEY = os.environ.get("DUOPLUS_API_KEY", "")
DUOPLUS_API_URL = "https://openapi.duoplus.net/api/v1/cloudPhone/command"


class DuoPlusClient:
    def __init__(self, api_key: str, device_id: str):
        self.api_key = api_key
        self.device_id = device_id
        self.api_url = DUOPLUS_API_URL
    
    def _execute_command(self, command: str) -> Dict:
        """ADBコマンドを実行"""
        headers = {
            "Content-Type": "application/json",
            "DuoPlus-API-Key": self.api_key
        }
        payload = {
            "image_id": self.device_id,
            "command": command
        }
        
        response = requests.post(self.api_url, json=payload, headers=headers)
        return response.json()
    
    def open_url(self, url: str) -> bool:
        """ChromeでURLを開く"""
        command = f'am start -a android.intent.action.VIEW -d "{url}" -p com.android.chrome'
        result = self._execute_command(command)
        return result.get("code") == 200
    
    def take_screenshot(self, save_path: str) -> bool:
        """スクリーンショットを取得してBase64デコード後に保存"""
        command = "screencap -p /sdcard/screen.png && base64 /sdcard/screen.png"
        result = self._execute_command(command)
        
        if result.get("code") == 200 and result.get("data", {}).get("success"):
            content = result["data"]["content"]
            b64_data = content.replace('\n', '').strip()
            img_data = base64.b64decode(b64_data)
            
            with open(save_path, 'wb') as f:
                f.write(img_data)
            return True
        
        return False
    
    def tap(self, x: int, y: int) -> bool:
        """指定座標をタップ"""
        command = f"input tap {x} {y}"
        result = self._execute_command(command)
        return result.get("code") == 200
    
    def scroll_down(self) -> bool:
        """下にスクロール"""
        # 540, 1500 → 540, 500 を500msでスワイプ
        command = "input swipe 540 1500 540 500 500"
        result = self._execute_command(command)
        return result.get("code") == 200
    
    def input_text(self, text: str) -> bool:
        """ADBKeyboardでテキスト入力"""
        # シングルクォートをエスケープ
        escaped_text = text.replace("'", "'\\''")
        command = f"am broadcast -a ADB_INPUT_TEXT --es msg '{escaped_text}'"
        result = self._execute_command(command)
        return result.get("code") == 200


# CLIとして実行する場合
if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 4:
        print("Usage: python3.11 duoplus_client.py <api_key> <device_id> <command> [args...]")
        sys.exit(1)
    
    api_key = sys.argv[1]
    device_id = sys.argv[2]
    command = sys.argv[3]
    
    client = DuoPlusClient(api_key, device_id)
    
    if command == "open_url":
        print(client.open_url(sys.argv[4]))
    elif command == "screenshot":
        print(client.take_screenshot(sys.argv[4]))
    elif command == "tap":
        print(client.tap(int(sys.argv[4]), int(sys.argv[5])))
    elif command == "scroll":
        print(client.scroll_down())
    elif command == "input":
        print(client.input_text(sys.argv[4]))
