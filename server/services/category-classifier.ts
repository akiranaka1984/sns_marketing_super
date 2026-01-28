/**
 * Category Classifier Service
 * Uses GPT-4o to automatically classify posts and model accounts
 * by industry, post type, tone, and content format
 */

import { invokeLLM } from "../_core/llm";

// Industry categories
export const industryCategories = [
  'it_tech', 'beauty_fashion', 'food_restaurant', 'finance_investment',
  'health_fitness', 'education', 'entertainment', 'travel', 'business', 'other'
] as const;

// Post types
export const postTypes = [
  'announcement', 'empathy', 'educational', 'humor',
  'promotional', 'question', 'other'
] as const;

// Tone styles
export const toneStyles = [
  'casual', 'formal', 'humorous', 'inspirational', 'professional'
] as const;

// Content formats
export const contentFormats = [
  'text_only', 'with_image', 'with_video', 'thread'
] as const;

// Posting styles for accounts
export const postingStyles = [
  'informative', 'entertaining', 'educational', 'inspirational', 'promotional'
] as const;

export type IndustryCategory = typeof industryCategories[number];
export type PostType = typeof postTypes[number];
export type ToneStyle = typeof toneStyles[number];
export type ContentFormat = typeof contentFormats[number];
export type PostingStyle = typeof postingStyles[number];

export interface PostClassification {
  industryCategory: IndustryCategory;
  postType: PostType;
  toneStyle: ToneStyle;
  contentFormat: ContentFormat;
  confidence: number; // 0-100
}

export interface AccountClassification {
  industryCategory: IndustryCategory;
  postingStyle: PostingStyle;
  toneStyle: ToneStyle;
  confidence: number;
}

/**
 * Classify a single post's content
 */
export async function classifyPost(
  content: string,
  hasImage: boolean = false,
  hasVideo: boolean = false,
  isThread: boolean = false
): Promise<PostClassification> {
  const systemPrompt = `You are an expert content analyst specializing in social media marketing.
Analyze the given post content and classify it into the following categories.

Industry Categories:
- it_tech: Technology, software, AI, programming
- beauty_fashion: Beauty, cosmetics, fashion, style
- food_restaurant: Food, restaurants, cooking, recipes
- finance_investment: Finance, stocks, crypto, investment
- health_fitness: Health, fitness, wellness, medical
- education: Learning, courses, tutorials, knowledge
- entertainment: Music, movies, games, pop culture
- travel: Travel, tourism, destinations
- business: Business, entrepreneurship, marketing
- other: Content that doesn't fit above categories

Post Types:
- announcement: News, updates, launches
- empathy: Relatable content, shared experiences
- educational: Tips, how-to, knowledge sharing
- humor: Jokes, memes, funny content
- promotional: Sales, offers, product promotion
- question: Asking audience questions, polls
- other: Doesn't fit above types

Tone Styles:
- casual: Friendly, conversational, relaxed
- formal: Professional, business-like
- humorous: Funny, witty, playful
- inspirational: Motivational, uplifting
- professional: Expert, authoritative

Respond in JSON format only.`;

  const contentFormat: ContentFormat = isThread ? 'thread'
    : hasVideo ? 'with_video'
    : hasImage ? 'with_image'
    : 'text_only';

  const userPrompt = `Classify this social media post:

Content: "${content}"
Content Format: ${contentFormat}

Respond with JSON:
{
  "industryCategory": "one of the industry categories",
  "postType": "one of the post types",
  "toneStyle": "one of the tone styles",
  "confidence": number between 0-100
}`;

  try {
    const result = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      responseFormat: { type: "json_object" },
      maxTokens: 500,
    });

    const responseText = typeof result.choices[0]?.message?.content === 'string'
      ? result.choices[0].message.content
      : '';

    const classification = JSON.parse(responseText);

    // Validate and normalize response
    return {
      industryCategory: validateCategory(classification.industryCategory, industryCategories, 'other'),
      postType: validateCategory(classification.postType, postTypes, 'other'),
      toneStyle: validateCategory(classification.toneStyle, toneStyles, 'casual'),
      contentFormat,
      confidence: Math.min(100, Math.max(0, classification.confidence || 50)),
    };
  } catch (error) {
    console.error("[CategoryClassifier] Error classifying post:", error);
    // Return default classification on error
    return {
      industryCategory: 'other',
      postType: 'other',
      toneStyle: 'casual',
      contentFormat,
      confidence: 0,
    };
  }
}

/**
 * Classify a model account based on bio and recent posts
 */
export async function classifyAccount(
  username: string,
  bio: string,
  recentPostContents: string[]
): Promise<AccountClassification> {
  const systemPrompt = `You are an expert content analyst specializing in social media marketing.
Analyze the given account information and classify it.

Industry Categories:
- it_tech: Technology, software, AI, programming
- beauty_fashion: Beauty, cosmetics, fashion, style
- food_restaurant: Food, restaurants, cooking, recipes
- finance_investment: Finance, stocks, crypto, investment
- health_fitness: Health, fitness, wellness, medical
- education: Learning, courses, tutorials, knowledge
- entertainment: Music, movies, games, pop culture
- travel: Travel, tourism, destinations
- business: Business, entrepreneurship, marketing
- other: Doesn't fit above categories

Posting Styles:
- informative: Shares facts, news, updates
- entertaining: Creates fun, engaging content
- educational: Teaches, provides tutorials
- inspirational: Motivates, shares success stories
- promotional: Focuses on selling, marketing

Tone Styles:
- casual: Friendly, conversational
- formal: Professional, business-like
- humorous: Funny, witty
- professional: Expert, authoritative

Respond in JSON format only.`;

  const postsSnippet = recentPostContents
    .slice(0, 5)
    .map((p, i) => `${i + 1}. "${p.substring(0, 200)}..."`)
    .join('\n');

  const userPrompt = `Classify this social media account:

Username: @${username}
Bio: "${bio || 'No bio'}"

Recent Posts:
${postsSnippet || 'No posts available'}

Respond with JSON:
{
  "industryCategory": "one of the industry categories",
  "postingStyle": "one of the posting styles",
  "toneStyle": "one of the tone styles",
  "confidence": number between 0-100
}`;

  try {
    const result = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      responseFormat: { type: "json_object" },
      maxTokens: 500,
    });

    const responseText = typeof result.choices[0]?.message?.content === 'string'
      ? result.choices[0].message.content
      : '';

    const classification = JSON.parse(responseText);

    return {
      industryCategory: validateCategory(classification.industryCategory, industryCategories, 'other'),
      postingStyle: validateCategory(classification.postingStyle, postingStyles, 'informative'),
      toneStyle: validateCategory(classification.toneStyle, toneStyles, 'casual'),
      confidence: Math.min(100, Math.max(0, classification.confidence || 50)),
    };
  } catch (error) {
    console.error("[CategoryClassifier] Error classifying account:", error);
    return {
      industryCategory: 'other',
      postingStyle: 'informative',
      toneStyle: 'casual',
      confidence: 0,
    };
  }
}

/**
 * Batch classify multiple posts
 */
export async function classifyPosts(
  posts: Array<{ id: number; content: string; hasImage?: boolean; hasVideo?: boolean; isThread?: boolean }>
): Promise<Map<number, PostClassification>> {
  const results = new Map<number, PostClassification>();

  // Process in parallel with concurrency limit
  const BATCH_SIZE = 5;
  for (let i = 0; i < posts.length; i += BATCH_SIZE) {
    const batch = posts.slice(i, i + BATCH_SIZE);
    const classifications = await Promise.all(
      batch.map(post =>
        classifyPost(post.content, post.hasImage, post.hasVideo, post.isThread)
          .then(classification => ({ id: post.id, classification }))
      )
    );

    for (const { id, classification } of classifications) {
      results.set(id, classification);
    }
  }

  return results;
}

/**
 * Validate category against allowed values
 */
function validateCategory<T extends string>(
  value: string | undefined,
  allowedValues: readonly T[],
  defaultValue: T
): T {
  if (!value) return defaultValue;
  const normalized = value.toLowerCase().replace(/[^a-z_]/g, '_');
  return allowedValues.includes(normalized as T) ? (normalized as T) : defaultValue;
}
