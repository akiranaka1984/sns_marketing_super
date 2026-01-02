"""
Generate a lightweight test image for X posting test
"""

from PIL import Image, ImageDraw, ImageFont
import os
from datetime import datetime

# Create output directory
output_dir = "/home/ubuntu/sns_marketing_automation/test-assets"
os.makedirs(output_dir, exist_ok=True)

# Create a simple gradient image with text
width, height = 800, 600
image = Image.new('RGB', (width, height))
draw = ImageDraw.Draw(image)

# Create gradient background (blue to purple)
for y in range(height):
    r = int(50 + (y / height) * 100)
    g = int(100 - (y / height) * 50)
    b = int(200 - (y / height) * 50)
    for x in range(width):
        draw.point((x, y), fill=(r, g, b))

# Add text
try:
    # Try to use a system font
    font_large = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 48)
    font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 24)
except:
    # Fallback to default font
    font_large = ImageFont.load_default()
    font_small = ImageFont.load_default()

# Draw text
text_main = "DuoPlus API Test"
text_sub = f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
text_hashtag = "#duoplus_test #automation"

# Center the main text
bbox = draw.textbbox((0, 0), text_main, font=font_large)
text_width = bbox[2] - bbox[0]
x = (width - text_width) // 2
draw.text((x, 200), text_main, fill=(255, 255, 255), font=font_large)

# Center the subtitle
bbox = draw.textbbox((0, 0), text_sub, font=font_small)
text_width = bbox[2] - bbox[0]
x = (width - text_width) // 2
draw.text((x, 280), text_sub, fill=(200, 200, 200), font=font_small)

# Center the hashtag
bbox = draw.textbbox((0, 0), text_hashtag, font=font_small)
text_width = bbox[2] - bbox[0]
x = (width - text_width) // 2
draw.text((x, 350), text_hashtag, fill=(100, 200, 255), font=font_small)

# Add a decorative border
draw.rectangle([10, 10, width-10, height-10], outline=(255, 255, 255), width=3)

# Save the image
output_path = os.path.join(output_dir, "test_post_image.jpg")
image.save(output_path, "JPEG", quality=85)

print(f"Test image generated: {output_path}")
print(f"Image size: {os.path.getsize(output_path)} bytes")
