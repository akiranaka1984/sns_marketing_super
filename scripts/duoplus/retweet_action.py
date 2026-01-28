#!/usr/bin/python3.11
"""
Retweet (Repost) action logic

Flow:
1. Open post URL (10 second wait)
2. Take screenshot
3. Template matching to detect retweet button
4. If not found, scroll and retry (max 3 times)
5. Tap retweet button
6. Wait for repost menu to appear
7. Tap "Repost" option to confirm
8. Verify success
"""

import os
import sys
import time
import json
from typing import Dict

from duoplus_client import DuoPlusClient
from template_matching import find_retweet_button, find_repost_option

# Settings
MAX_RETRY = 3
WAIT_AFTER_OPEN = 10  # Wait seconds after opening URL
WAIT_AFTER_SCROLL = 2
WAIT_AFTER_RETWEET_BUTTON = 2  # Wait for menu to appear
TEMP_SCREENSHOT = "/tmp/screenshot_retweet.png"
TEMP_SCREENSHOT_MENU = "/tmp/screenshot_retweet_menu.png"
TEMP_SCREENSHOT_AFTER = "/tmp/screenshot_retweet_after.png"

# Fallback coordinates for repost menu option (if template not found)
# Screen: 1080x1920, menu at bottom
REPOST_OPTION_X = 230  # X position of "Repost" text
REPOST_OPTION_Y = 1440  # Y position of "Repost" option (first item in bottom sheet)


def execute_retweet(
    api_key: str,
    device_id: str,
    post_url: str
) -> Dict:
    """
    Execute retweet (repost) on a post

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

    # Step 1: Open post URL
    if not client.open_url(post_url):
        return {"success": False, "error": "FAILED_TO_OPEN_URL"}

    time.sleep(WAIT_AFTER_OPEN)

    # Step 2-3: Screenshot & template matching (with retry)
    found = False
    x, y, confidence = None, None, 0
    retry_count = 0

    for i in range(MAX_RETRY):
        retry_count = i + 1
        print(f"[DEBUG] Retry {retry_count}/{MAX_RETRY}", file=sys.stderr)

        # Take screenshot
        if not client.take_screenshot(TEMP_SCREENSHOT):
            print(f"[DEBUG] Screenshot failed", file=sys.stderr)
            continue

        print(f"[DEBUG] Screenshot saved to {TEMP_SCREENSHOT}", file=sys.stderr)

        # Template matching for retweet button
        result = find_retweet_button(TEMP_SCREENSHOT)
        print(f"[DEBUG] Template matching result: {result}", file=sys.stderr)

        if result["success"]:
            x = result["x"]
            y = result["y"]
            confidence = result["confidence"]
            found = True
            break
        else:
            # Scroll if not found
            if i < MAX_RETRY - 1:
                client.scroll_down()
                time.sleep(WAIT_AFTER_SCROLL)

    if not found:
        # Keep screenshot for debugging (don't delete on error)
        return {
            "success": False,
            "error": "RETWEET_BUTTON_NOT_FOUND",
            "retry_count": retry_count,
            "confidence": confidence,
            "debug_screenshot": TEMP_SCREENSHOT
        }

    # Step 4: Tap retweet button
    if not client.tap(x, y):
        return {
            "success": False,
            "error": "TAP_RETWEET_BUTTON_FAILED",
            "x": x,
            "y": y,
            "confidence": confidence,
            "retry_count": retry_count
        }

    # Step 5: Wait for repost menu to appear
    time.sleep(WAIT_AFTER_RETWEET_BUTTON)

    # Step 6: Take screenshot of menu and find "Repost" option
    if not client.take_screenshot(TEMP_SCREENSHOT_MENU):
        return {
            "success": False,
            "error": "SCREENSHOT_MENU_FAILED",
            "x": x,
            "y": y,
            "confidence": confidence,
            "retry_count": retry_count
        }

    # Try to find repost option using template matching
    repost_result = find_repost_option(TEMP_SCREENSHOT_MENU)

    if repost_result["success"]:
        repost_x = repost_result["x"]
        repost_y = repost_result["y"]
    else:
        # Use fallback coordinates if template not found
        repost_x = REPOST_OPTION_X
        repost_y = REPOST_OPTION_Y

    # Step 7: Tap "Repost" option
    if not client.tap(repost_x, repost_y):
        return {
            "success": False,
            "error": "TAP_REPOST_OPTION_FAILED",
            "x": x,
            "y": y,
            "confidence": confidence,
            "retry_count": retry_count
        }

    time.sleep(1)

    # Step 8: Take confirmation screenshot
    client.take_screenshot(TEMP_SCREENSHOT_AFTER)

    # Clean up temp files
    try:
        os.remove(TEMP_SCREENSHOT)
        os.remove(TEMP_SCREENSHOT_MENU)
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


# CLI execution
if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python3.11 retweet_action.py <api_key> <device_id> <post_url>")
        sys.exit(1)

    result = execute_retweet(sys.argv[1], sys.argv[2], sys.argv[3])
    print(json.dumps(result, indent=2, ensure_ascii=False))
