/**
 * OCR Service
 *
 * Extracts text from images using GPT-4o Vision API.
 * Supports SNS post screenshots and general image text extraction.
 */

import { invokeLLM } from "../_core/llm";

// ============================================
// Types
// ============================================

export interface ExtractedPostData {
  content: string;
  hashtags: string[];
  mentionedUsers: string[];
  mediaDescriptions: string[];
  engagementMetrics?: {
    likes?: number;
    comments?: number;
    shares?: number;
    views?: number;
  };
  authorInfo?: {
    username?: string;
    displayName?: string;
    isVerified?: boolean;
  };
  timestamp?: string;
  platform?: string;
}

export interface TextExtractionResult {
  success: boolean;
  text: string;
  language?: string;
  confidence?: number;
  error?: string;
}

// ============================================
// Core Functions
// ============================================

/**
 * Extract text from an image URL using GPT-4o Vision
 */
export async function extractTextFromImage(imageUrl: string): Promise<TextExtractionResult> {
  try {
    const response = await invokeLLM({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an OCR specialist. Extract all visible text from the provided image.
Return the result in the following JSON format:
{
  "text": "All extracted text, maintaining original line breaks",
  "language": "detected language code (e.g., ja, en)",
  "confidence": 0-100 (your confidence in the extraction accuracy)
}

Be thorough and include all visible text, including small text, watermarks, and UI elements.`
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: imageUrl }
            },
            {
              type: "text",
              text: "Extract all text from this image."
            }
          ]
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "text_extraction",
          strict: true,
          schema: {
            type: "object",
            properties: {
              text: { type: "string" },
              language: { type: "string" },
              confidence: { type: "number" }
            },
            required: ["text", "language", "confidence"],
            additionalProperties: false
          }
        }
      }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return {
        success: false,
        text: "",
        error: "No response from vision model"
      };
    }

    const result = JSON.parse(content);
    return {
      success: true,
      text: result.text,
      language: result.language,
      confidence: result.confidence
    };
  } catch (error: any) {
    console.error("[OCR] Error extracting text from image:", error);
    return {
      success: false,
      text: "",
      error: error.message
    };
  }
}

/**
 * Extract text from a base64 encoded image
 */
export async function extractTextFromBase64(base64Image: string): Promise<TextExtractionResult> {
  // Ensure proper data URL format
  const imageUrl = base64Image.startsWith("data:")
    ? base64Image
    : `data:image/png;base64,${base64Image}`;

  return extractTextFromImage(imageUrl);
}

/**
 * Extract SNS post data from a screenshot
 */
export async function extractPostFromScreenshot(
  imageUrl: string,
  platform: string = "twitter"
): Promise<ExtractedPostData | null> {
  try {
    const platformGuide = {
      twitter: "Twitter/X post format with likes, retweets, comments, views",
      instagram: "Instagram post with likes, comments, and save count",
      facebook: "Facebook post with reactions, comments, and shares",
      tiktok: "TikTok video post with likes, comments, shares, and views"
    };

    const response = await invokeLLM({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a social media post analyzer. Extract all information from the provided ${platform} screenshot.
This is a ${platformGuide[platform as keyof typeof platformGuide] || "social media post"}.

Return the result in the following JSON format:
{
  "content": "The main post text content",
  "hashtags": ["hashtag1", "hashtag2"],
  "mentionedUsers": ["@user1", "@user2"],
  "mediaDescriptions": ["Description of any images/videos in the post"],
  "engagementMetrics": {
    "likes": 1234,
    "comments": 56,
    "shares": 78,
    "views": 9012
  },
  "authorInfo": {
    "username": "@username",
    "displayName": "Display Name",
    "isVerified": true
  },
  "timestamp": "extracted timestamp if visible",
  "platform": "${platform}"
}

Note: Use null for any metrics that are not visible in the screenshot.`
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: imageUrl }
            },
            {
              type: "text",
              text: `Extract all post information from this ${platform} screenshot.`
            }
          ]
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "post_extraction",
          strict: true,
          schema: {
            type: "object",
            properties: {
              content: { type: "string" },
              hashtags: { type: "array", items: { type: "string" } },
              mentionedUsers: { type: "array", items: { type: "string" } },
              mediaDescriptions: { type: "array", items: { type: "string" } },
              engagementMetrics: {
                type: "object",
                properties: {
                  likes: { type: ["number", "null"] },
                  comments: { type: ["number", "null"] },
                  shares: { type: ["number", "null"] },
                  views: { type: ["number", "null"] }
                },
                required: ["likes", "comments", "shares", "views"],
                additionalProperties: false
              },
              authorInfo: {
                type: "object",
                properties: {
                  username: { type: ["string", "null"] },
                  displayName: { type: ["string", "null"] },
                  isVerified: { type: ["boolean", "null"] }
                },
                required: ["username", "displayName", "isVerified"],
                additionalProperties: false
              },
              timestamp: { type: ["string", "null"] },
              platform: { type: "string" }
            },
            required: [
              "content",
              "hashtags",
              "mentionedUsers",
              "mediaDescriptions",
              "engagementMetrics",
              "authorInfo",
              "timestamp",
              "platform"
            ],
            additionalProperties: false
          }
        }
      }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.error("[OCR] No response from vision model for post extraction");
      return null;
    }

    const result = JSON.parse(content);
    return result as ExtractedPostData;
  } catch (error: any) {
    console.error("[OCR] Error extracting post from screenshot:", error);
    return null;
  }
}

/**
 * Analyze image for viral potential
 */
export async function analyzeImageViralPotential(imageUrl: string): Promise<{
  score: number;
  factors: string[];
  suggestions: string[];
}> {
  try {
    const response = await invokeLLM({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a social media content analyst specializing in viral content.
Analyze the provided image for its viral potential on social media.

Consider factors like:
- Visual appeal and quality
- Emotional impact
- Shareability
- Trending elements
- Hook potential
- Call-to-action clarity

Return the result in the following JSON format:
{
  "score": 0-100 (viral potential score),
  "factors": ["List of positive factors that could make this go viral"],
  "suggestions": ["Suggestions to improve viral potential"]
}`
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: imageUrl }
            },
            {
              type: "text",
              text: "Analyze this image for viral potential on social media."
            }
          ]
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "viral_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              score: { type: "number" },
              factors: { type: "array", items: { type: "string" } },
              suggestions: { type: "array", items: { type: "string" } }
            },
            required: ["score", "factors", "suggestions"],
            additionalProperties: false
          }
        }
      }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { score: 0, factors: [], suggestions: [] };
    }

    return JSON.parse(content);
  } catch (error: any) {
    console.error("[OCR] Error analyzing image viral potential:", error);
    return { score: 0, factors: [], suggestions: ["Unable to analyze image"] };
  }
}

/**
 * Extract engagement numbers from screenshot text
 * Useful for parsing numbers like "1.2K", "5M" etc.
 */
export function parseEngagementNumber(text: string): number | null {
  if (!text) return null;

  const cleaned = text.trim().toLowerCase().replace(/,/g, "");

  // Handle K, M, B suffixes
  const match = cleaned.match(/^([\d.]+)\s*([kmb])?$/);
  if (!match) return null;

  const num = parseFloat(match[1]);
  const suffix = match[2];

  if (isNaN(num)) return null;

  switch (suffix) {
    case "k":
      return Math.round(num * 1000);
    case "m":
      return Math.round(num * 1000000);
    case "b":
      return Math.round(num * 1000000000);
    default:
      return Math.round(num);
  }
}
