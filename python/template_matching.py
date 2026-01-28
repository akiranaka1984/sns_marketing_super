"""
Template Matching Module
Uses OpenCV for UI element detection
"""
import cv2
import numpy as np
from typing import Optional, Tuple


def find_template(
    screenshot_path: str,
    template_path: str,
    threshold: float = 0.8
) -> Optional[Tuple[int, int, float]]:
    """
    Find template in screenshot using OpenCV template matching.

    Args:
        screenshot_path: Path to the screenshot image
        template_path: Path to the template image
        threshold: Minimum confidence threshold (0.0 - 1.0)

    Returns:
        Tuple of (center_x, center_y, confidence) if found, None otherwise
    """
    # Read images
    img = cv2.imread(screenshot_path)
    template = cv2.imread(template_path)

    if img is None or template is None:
        return None

    # Convert to grayscale for better matching
    img_gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    template_gray = cv2.cvtColor(template, cv2.COLOR_BGR2GRAY)

    # Perform template matching
    result = cv2.matchTemplate(img_gray, template_gray, cv2.TM_CCOEFF_NORMED)
    min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(result)

    if max_val >= threshold:
        h, w = template_gray.shape
        center_x = max_loc[0] + w // 2
        center_y = max_loc[1] + h // 2
        return (center_x, center_y, max_val)

    return None


def find_all_templates(
    screenshot_path: str,
    template_path: str,
    threshold: float = 0.8
) -> list[Tuple[int, int, float]]:
    """
    Find all occurrences of template in screenshot.

    Args:
        screenshot_path: Path to the screenshot image
        template_path: Path to the template image
        threshold: Minimum confidence threshold

    Returns:
        List of (center_x, center_y, confidence) tuples
    """
    img = cv2.imread(screenshot_path)
    template = cv2.imread(template_path)

    if img is None or template is None:
        return []

    img_gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    template_gray = cv2.cvtColor(template, cv2.COLOR_BGR2GRAY)

    result = cv2.matchTemplate(img_gray, template_gray, cv2.TM_CCOEFF_NORMED)
    locations = np.where(result >= threshold)

    h, w = template_gray.shape
    matches = []

    for pt in zip(*locations[::-1]):
        center_x = pt[0] + w // 2
        center_y = pt[1] + h // 2
        confidence = result[pt[1], pt[0]]
        matches.append((center_x, center_y, float(confidence)))

    return matches
