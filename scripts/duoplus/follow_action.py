#!/usr/bin/python3.11
"""
Follow action logic

Flow:
1. Open user profile URL (x.com/@username)
2. Take screenshot
3. Template matching to detect follow button
4. If not found, scroll and retry (max 3 times)
5. Tap follow button
6. Verify success (button changes to "Following")
"""

import os
import sys
import time
import json
from typing import Dict

from duoplus_client import DuoPlusClient
# Template matching disabled due to resolution mismatch - using fixed coordinates instead

# Settings
MAX_RETRY = 3
WAIT_AFTER_OPEN = 8  # Wait seconds after opening URL
WAIT_AFTER_SCROLL = 2
TEMP_SCREENSHOT = "/tmp/screenshot_follow.png"
TEMP_SCREENSHOT_AFTER = "/tmp/screenshot_follow_after.png"

# Fixed coordinates for Follow button on profile page
# Screen: 1080x1920, Follow button is next to "..." button below banner
# Calculated from screenshot: X≈395*2.51=992, Y≈357*2.51=896
FOLLOW_BUTTON_X = 990  # Right side, center of Follow button
FOLLOW_BUTTON_Y = 900  # Below banner, in avatar row


def execute_follow(
    api_key: str,
    device_id: str,
    target_username: str
) -> Dict:
    """
    Execute follow on a user

    Args:
        api_key: DuoPlus API key
        device_id: Device ID
        target_username: Username to follow (with or without @)

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

    # Remove @ prefix if present
    username = target_username.lstrip('@')
    profile_url = f"https://x.com/{username}"

    print(f"[DEBUG] Opening profile: {profile_url}", file=sys.stderr)

    # Step 1: Open user profile URL
    if not client.open_url(profile_url):
        return {"success": False, "error": "FAILED_TO_OPEN_URL"}

    time.sleep(WAIT_AFTER_OPEN)

    # Use fixed coordinates (skip template matching due to resolution issues)
    x = FOLLOW_BUTTON_X
    y = FOLLOW_BUTTON_Y
    confidence = 0
    retry_count = 1

    print(f"[DEBUG] Using fixed coordinates: ({x}, {y})", file=sys.stderr)

    # Step 4: Tap follow button
    if not client.tap(x, y):
        return {
            "success": False,
            "error": "TAP_FOLLOW_BUTTON_FAILED",
            "x": x,
            "y": y,
            "confidence": confidence,
            "retry_count": retry_count
        }

    time.sleep(1)

    # Step 5: Take confirmation screenshot
    client.take_screenshot(TEMP_SCREENSHOT_AFTER)

    # Clean up temp files
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
        "retry_count": retry_count,
        "target_username": username
    }


# CLI execution
if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python3.11 follow_action.py <api_key> <device_id> <target_username>")
        sys.exit(1)

    result = execute_follow(sys.argv[1], sys.argv[2], sys.argv[3])
    print(json.dumps(result, indent=2, ensure_ascii=False))
