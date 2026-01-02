import { invokeLLM } from "./_core/llm";

interface Coordinates {
  x: number;
  y: number;
}

interface CoordinateResult {
  success: boolean;
  coordinates?: Coordinates;
  error?: string;
}

/**
 * GPT-4 Visionで画面要素の座標を取得
 * 
 * 重要: base64Imageはデバイスから直接取得したもの（1080x1920）を使用すること
 */
export async function getElementCoordinates(
  base64Image: string,
  elementDescription: string
): Promise<CoordinateResult> {
  try {
    const response = await invokeLLM({
      messages: [{
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: `data:image/png;base64,${base64Image}`,
              detail: "high"
            }
          },
          {
            type: "text",
            text: `You are a UI automation assistant analyzing a mobile screenshot (1080x1920 pixels).

Task: Find the ${elementDescription} and return its center coordinates.

IMPORTANT:
- Coordinates origin (0,0) is at top-left corner
- X increases to the right (max 1080)
- Y increases downward (max 1920)
- If element not found, return {"x": 0, "y": 0, "error": "Element not found"}
- Be precise - the coordinates will be used for automated tapping

Response format (JSON only, no explanation):
{"x": number, "y": number}`
          }
        ]
      }]
    });

    const content = response.choices[0].message.content;
    const text = typeof content === 'string' ? content : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { success: false, error: "No JSON found in response" };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    // 座標が(0,0)の場合はエラーとして扱う
    if (parsed.x === 0 && parsed.y === 0) {
      return { 
        success: false, 
        error: parsed.error || "Element not found - coordinates are (0,0)" 
      };
    }
    
    // 座標が範囲外の場合もエラー
    if (parsed.x < 0 || parsed.x > 1080 || parsed.y < 0 || parsed.y > 1920) {
      return { 
        success: false, 
        error: `Invalid coordinates: (${parsed.x}, ${parsed.y}) - out of range` 
      };
    }
    
    return {
      success: true,
      coordinates: { x: parsed.x, y: parsed.y }
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * いいねボタン（ハートアイコン）の座標を取得
 */
export async function getLikeButtonCoordinates(base64Image: string): Promise<CoordinateResult> {
  return getElementCoordinates(
    base64Image, 
    "heart icon (like button). This is typically located below the post content, on the left side of the interaction bar. It may be outlined (not filled) if not yet liked, or filled/red if already liked. Look for a heart shape icon."
  );
}

/**
 * コメントボタン（吹き出しアイコン）の座標を取得
 */
export async function getCommentButtonCoordinates(base64Image: string): Promise<CoordinateResult> {
  return getElementCoordinates(
    base64Image, 
    "comment/reply icon (speech bubble icon). This is typically located below the post content, next to the heart icon. It's a speech bubble or chat bubble icon. Look for a rounded rectangle with a small tail at the bottom."
  );
}

/**
 * Replyボタン（青いボタン）の座標を取得
 */
export async function getReplyButtonCoordinates(base64Image: string): Promise<CoordinateResult> {
  return getElementCoordinates(
    base64Image, 
    "blue Reply button (or 返信 in Japanese). IMPORTANT: This is the POST/SEND button that appears AFTER you tap the comment icon and the compose area opens. Look for: (1) A prominent blue button with bright blue color, (2) Located at the BOTTOM-RIGHT corner of the screen, (3) Contains white text Reply or 返信 or 投稿, (4) Appears above the keyboard area, (5) Usually rounded rectangle shape, (6) This is NOT the comment icon - it is the button to submit the comment after typing"
  );
}

/**
 * 投稿が正しく表示されているか確認
 */
export async function checkPostDisplayed(base64Image: string): Promise<{ isDisplayed: boolean; error?: string }> {
  try {
    const response = await invokeLLM({
      messages: [{
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: `data:image/png;base64,${base64Image}`,
              detail: "high"
            }
          },
          {
            type: "text",
            text: `You are a UI automation assistant analyzing a mobile screenshot of X (Twitter).

Task: Check if a post/tweet is currently displayed on the screen.

IMPORTANT:
- Look for typical post elements: username, post content text, timestamp, interaction buttons (reply, retweet, like)
- If you see "Post" header at the top and post content below, it means a post is displayed → return {"isDisplayed": true}
- If you see timeline, login screen, error page, or loading screen → return {"isDisplayed": false}
- Check if the main content area shows a complete post with all elements

Response format (JSON only, no explanation):
{"isDisplayed": boolean}`
          }
        ]
      }]
    });

    const content = response.choices[0].message.content;
    const text = typeof content === 'string' ? content : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { isDisplayed: false, error: "No JSON found in response" };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return { isDisplayed: parsed.isDisplayed === true };
  } catch (error) {
    return { isDisplayed: false, error: String(error) };
  }
}

/**
 * いいねボタンの状態を確認（いいね済みかどうか）
 */
export async function checkLikeButtonState(base64Image: string): Promise<{ isLiked: boolean; error?: string }> {
  try {
    const response = await invokeLLM({
      messages: [{
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: `data:image/png;base64,${base64Image}`,
              detail: "high"
            }
          },
          {
            type: "text",
            text: `You are a UI automation assistant analyzing a mobile screenshot of X (Twitter).

Task: Check if the heart icon (like button) is in a "liked" state.

IMPORTANT:
- If the heart icon is FILLED/RED/PINK, it means the post is liked → return {"isLiked": true}
- If the heart icon is OUTLINED/GRAY/EMPTY, it means the post is not liked → return {"isLiked": false}
- Look carefully at the color and fill state of the heart icon below the post content

Response format (JSON only, no explanation):
{"isLiked": boolean}`
          }
        ]
      }]
    });

    const content = response.choices[0].message.content;
    const text = typeof content === 'string' ? content : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { isLiked: false, error: "No JSON found in response" };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return { isLiked: parsed.isLiked === true };
  } catch (error) {
    return { isLiked: false, error: String(error) };
  }
}
