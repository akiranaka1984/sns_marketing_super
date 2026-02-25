/**
 * Profile Optimizer Service
 * Analyzes social media profiles and generates improvement suggestions
 * using GPT-4o for AI-powered optimization
 */

import { invokeLLM } from "../_core/llm";

import { createLogger } from "../utils/logger";

const logger = createLogger("profile-optimizer");

export type AnalysisLanguage = 'ja' | 'en';

export interface ProfileData {
  username: string;
  displayName?: string;
  bio?: string;
  followersCount?: number;
  followingCount?: number;
  postsCount?: number;
  industryCategory?: string;
  postingStyle?: string;
}

export interface ProfileAnalysisResult {
  overallScore: number; // 0-100
  bioAnalysis: BioAnalysis;
  suggestions: ProfileSuggestion[];
  competitorInsights?: string[];
  improvedBioOptions: ImprovedBio[];
}

export interface BioAnalysis {
  clarity: number; // 0-100 - How clear is the value proposition
  personality: number; // 0-100 - How much personality shines through
  callToAction: number; // 0-100 - Strength of CTA
  keywords: number; // 0-100 - Relevant keyword usage
  length: number; // 0-100 - Optimal length usage
  overallAnalysis: string;
  strengths: string[];
  weaknesses: string[];
}

export interface ProfileSuggestion {
  category: 'bio' | 'name' | 'avatar' | 'header' | 'pinned_post' | 'link' | 'overall';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  example?: string;
}

export interface ImprovedBio {
  bio: string;
  style: 'professional' | 'casual' | 'creative' | 'minimalist';
  focus: string;
  whyItWorks: string;
}

/**
 * Analyze a profile and generate optimization suggestions
 * For model accounts, focus on learning from their success rather than suggesting improvements
 */
export async function analyzeProfile(
  profile: ProfileData,
  modelAccountProfiles?: ProfileData[],
  language: AnalysisLanguage = 'ja',
  isModelAccount: boolean = false,
  accumulatedLearnings?: string[]
): Promise<ProfileAnalysisResult> {
  const languageInstructions = language === 'ja'
    ? 'すべての分析結果、説明、提案は日本語で記述してください。'
    : 'Write all analysis, descriptions, and suggestions in English.';

  // Accumulated learnings context for own account analysis
  const learningsContext = !isModelAccount && accumulatedLearnings && accumulatedLearnings.length > 0
    ? `\n\nIMPORTANT: Use these learnings from successful model accounts to inform your suggestions:\n${accumulatedLearnings.join('\n')}`
    : '';

  // Different prompts for model accounts vs own accounts
  const systemPrompt = isModelAccount
    ? `You are an expert social media analyst. Analyze this successful model account to identify what makes their profile effective and what can be learned from them.

${languageInstructions}

Focus on:
1. What makes their bio compelling and effective
2. How they convey their value proposition
3. Their unique personality and branding techniques
4. Effective keyword usage
5. Overall profile presentation strengths

This is a MODEL ACCOUNT - a successful example to learn from. Focus on identifying their strengths and what makes them successful, NOT on suggesting improvements.

Respond in JSON format only.`
    : `You are an expert social media profile optimizer. Analyze the given profile and provide actionable suggestions to improve engagement and conversions.

${languageInstructions}

Consider:
1. Bio clarity and value proposition
2. Personality and authenticity
3. Call-to-action effectiveness
4. Keyword optimization
5. Profile completeness

If model account profiles are provided, use them as benchmarks for best practices.
${learningsContext}

When making suggestions, incorporate insights from the accumulated learnings above if relevant.

Respond in JSON format only.`;

  const modelAccountsContext = !isModelAccount && modelAccountProfiles && modelAccountProfiles.length > 0
    ? `\n\nSuccessful model accounts in this industry:\n${modelAccountProfiles.map(p =>
        `- @${p.username}: "${p.bio}" (${p.followersCount?.toLocaleString()} followers)`
      ).join('\n')}`
    : '';

  const userPrompt = isModelAccount
    ? `Analyze this successful model account to learn from their profile:

Username: @${profile.username}
Display Name: ${profile.displayName || 'Not set'}
Bio: "${profile.bio || 'No bio'}"
Followers: ${profile.followersCount?.toLocaleString() || 'Unknown'}
Following: ${profile.followingCount?.toLocaleString() || 'Unknown'}
Posts: ${profile.postsCount?.toLocaleString() || 'Unknown'}
Industry: ${profile.industryCategory || 'General'}
Style: ${profile.postingStyle || 'Mixed'}

Respond with JSON:
{
  "overallScore": 0-100,
  "bioAnalysis": {
    "clarity": 0-100,
    "personality": 0-100,
    "callToAction": 0-100,
    "keywords": 0-100,
    "length": 0-100,
    "overallAnalysis": "detailed analysis of what makes this profile effective",
    "strengths": ["key strength 1", "key strength 2", "key strength 3"],
    "weaknesses": []
  },
  "suggestions": [],
  "competitorInsights": ["learning 1 - what to copy", "learning 2 - technique to adopt", "learning 3 - style to emulate"],
  "improvedBioOptions": []
}`
    : `Analyze this social media profile:

Username: @${profile.username}
Display Name: ${profile.displayName || 'Not set'}
Bio: "${profile.bio || 'No bio'}"
Followers: ${profile.followersCount?.toLocaleString() || 'Unknown'}
Following: ${profile.followingCount?.toLocaleString() || 'Unknown'}
Posts: ${profile.postsCount?.toLocaleString() || 'Unknown'}
Industry: ${profile.industryCategory || 'General'}
Style: ${profile.postingStyle || 'Mixed'}
${modelAccountsContext}

Respond with JSON:
{
  "overallScore": 0-100,
  "bioAnalysis": {
    "clarity": 0-100,
    "personality": 0-100,
    "callToAction": 0-100,
    "keywords": 0-100,
    "length": 0-100,
    "overallAnalysis": "detailed analysis",
    "strengths": ["strength1", "strength2"],
    "weaknesses": ["weakness1", "weakness2"]
  },
  "suggestions": [
    {
      "category": "bio|name|avatar|header|pinned_post|link|overall",
      "priority": "high|medium|low",
      "title": "short title",
      "description": "detailed description",
      "example": "optional example"
    }
  ],
  "competitorInsights": ["insight1", "insight2"],
  "improvedBioOptions": [
    {
      "bio": "improved bio text (max 160 chars for Twitter)",
      "style": "professional|casual|creative|minimalist",
      "focus": "what this version emphasizes",
      "whyItWorks": "explanation"
    }
  ]
}`;

  try {
    const result = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      responseFormat: { type: "json_object" },
      maxTokens: 2000,
    });

    const responseText = typeof result.choices[0]?.message?.content === 'string'
      ? result.choices[0].message.content
      : '';

    const analysis = JSON.parse(responseText);

    // Validate and normalize response
    return {
      overallScore: Math.min(100, Math.max(0, analysis.overallScore || 50)),
      bioAnalysis: {
        clarity: Math.min(100, Math.max(0, analysis.bioAnalysis?.clarity || 50)),
        personality: Math.min(100, Math.max(0, analysis.bioAnalysis?.personality || 50)),
        callToAction: Math.min(100, Math.max(0, analysis.bioAnalysis?.callToAction || 50)),
        keywords: Math.min(100, Math.max(0, analysis.bioAnalysis?.keywords || 50)),
        length: Math.min(100, Math.max(0, analysis.bioAnalysis?.length || 50)),
        overallAnalysis: analysis.bioAnalysis?.overallAnalysis || 'Analysis not available',
        strengths: analysis.bioAnalysis?.strengths || [],
        weaknesses: analysis.bioAnalysis?.weaknesses || [],
      },
      suggestions: (analysis.suggestions || []).map((s: any) => ({
        category: validateCategory(s.category),
        priority: validatePriority(s.priority),
        title: s.title || 'Suggestion',
        description: s.description || '',
        example: s.example,
      })),
      competitorInsights: analysis.competitorInsights || [],
      improvedBioOptions: (analysis.improvedBioOptions || []).map((b: any) => ({
        bio: (b.bio || '').substring(0, 160),
        style: validateBioStyle(b.style),
        focus: b.focus || '',
        whyItWorks: b.whyItWorks || '',
      })),
    };
  } catch (error) {
    logger.error("[ProfileOptimizer] Error analyzing profile:", error);
    return getDefaultAnalysis();
  }
}

/**
 * Generate bio variations based on industry and style preferences
 */
export async function generateBioVariations(
  profile: ProfileData,
  targetStyle: 'professional' | 'casual' | 'creative' | 'minimalist',
  keyPoints: string[],
  language: AnalysisLanguage = 'ja'
): Promise<ImprovedBio[]> {
  const languageInstructions = language === 'ja'
    ? 'Bio、説明、理由はすべて日本語で記述してください。'
    : 'Write all bios, descriptions, and explanations in English.';

  const systemPrompt = `You are an expert copywriter specializing in social media bios.
Create compelling bio variations that capture attention and drive engagement.

${languageInstructions}

Guidelines:
- Maximum 160 characters for Twitter/X
- Include a clear value proposition
- Add personality without being generic
- Consider including a CTA when appropriate

Respond in JSON format only.`;

  const userPrompt = `Generate 4 bio variations for this profile:

Username: @${profile.username}
Industry: ${profile.industryCategory || 'General'}
Current Bio: "${profile.bio || 'No current bio'}"
Target Style: ${targetStyle}
Key Points to Include: ${keyPoints.join(', ') || 'None specified'}

Respond with JSON:
{
  "bios": [
    {
      "bio": "bio text (max 160 chars)",
      "style": "professional|casual|creative|minimalist",
      "focus": "what this version emphasizes",
      "whyItWorks": "explanation"
    }
  ]
}`;

  try {
    const result = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      responseFormat: { type: "json_object" },
      maxTokens: 1000,
    });

    const responseText = typeof result.choices[0]?.message?.content === 'string'
      ? result.choices[0].message.content
      : '';

    const data = JSON.parse(responseText);

    return (data.bios || []).map((b: any) => ({
      bio: (b.bio || '').substring(0, 160),
      style: validateBioStyle(b.style),
      focus: b.focus || '',
      whyItWorks: b.whyItWorks || '',
    }));
  } catch (error) {
    logger.error("[ProfileOptimizer] Error generating bio variations:", error);
    return [];
  }
}

/**
 * Compare profile against successful model accounts
 */
export async function compareWithModelAccounts(
  targetProfile: ProfileData,
  modelProfiles: ProfileData[],
  language: AnalysisLanguage = 'ja'
): Promise<{
  similarities: string[];
  differences: string[];
  recommendations: string[];
  averageFollowers: number;
  targetVsAverage: 'above' | 'below' | 'similar';
}> {
  const noModelMessage = language === 'ja'
    ? '比較するモデルアカウントを追加してください'
    : 'Add model accounts to compare against';

  if (modelProfiles.length === 0) {
    return {
      similarities: [],
      differences: [],
      recommendations: [noModelMessage],
      averageFollowers: 0,
      targetVsAverage: 'similar',
    };
  }

  const avgFollowers = modelProfiles.reduce((sum, p) => sum + (p.followersCount || 0), 0) / modelProfiles.length;
  const targetFollowers = targetProfile.followersCount || 0;

  let targetVsAverage: 'above' | 'below' | 'similar';
  if (targetFollowers > avgFollowers * 1.2) {
    targetVsAverage = 'above';
  } else if (targetFollowers < avgFollowers * 0.8) {
    targetVsAverage = 'below';
  } else {
    targetVsAverage = 'similar';
  }

  const languageInstructions = language === 'ja'
    ? 'すべての分析結果、類似点、相違点、推奨事項は日本語で記述してください。'
    : 'Write all analysis, similarities, differences, and recommendations in English.';

  const systemPrompt = `You are an expert at analyzing social media profiles.
Compare the target profile with successful model accounts and identify patterns.

${languageInstructions}

Respond in JSON format only.`;

  const userPrompt = `Compare this profile with successful accounts:

Target Profile:
- Username: @${targetProfile.username}
- Bio: "${targetProfile.bio || 'No bio'}"
- Followers: ${targetProfile.followersCount?.toLocaleString() || 'Unknown'}

Model Accounts:
${modelProfiles.map(p => `- @${p.username}: "${p.bio}" (${p.followersCount?.toLocaleString()} followers)`).join('\n')}

Respond with JSON:
{
  "similarities": ["what target does well compared to models"],
  "differences": ["key differences from successful accounts"],
  "recommendations": ["specific actionable recommendations"]
}`;

  try {
    const result = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      responseFormat: { type: "json_object" },
      maxTokens: 1000,
    });

    const responseText = typeof result.choices[0]?.message?.content === 'string'
      ? result.choices[0].message.content
      : '';

    const data = JSON.parse(responseText);

    return {
      similarities: data.similarities || [],
      differences: data.differences || [],
      recommendations: data.recommendations || [],
      averageFollowers: Math.round(avgFollowers),
      targetVsAverage,
    };
  } catch (error) {
    logger.error("[ProfileOptimizer] Error comparing profiles:", error);
    const errorMessage = language === 'ja' ? '比較分析に失敗しました' : 'Comparison analysis failed';
    return {
      similarities: [],
      differences: [],
      recommendations: [errorMessage],
      averageFollowers: Math.round(avgFollowers),
      targetVsAverage,
    };
  }
}

// Helper functions

function validateCategory(category: string): ProfileSuggestion['category'] {
  const validCategories: ProfileSuggestion['category'][] = [
    'bio', 'name', 'avatar', 'header', 'pinned_post', 'link', 'overall'
  ];
  return validCategories.includes(category as any) ? (category as ProfileSuggestion['category']) : 'overall';
}

function validatePriority(priority: string): ProfileSuggestion['priority'] {
  const validPriorities: ProfileSuggestion['priority'][] = ['high', 'medium', 'low'];
  return validPriorities.includes(priority as any) ? (priority as ProfileSuggestion['priority']) : 'medium';
}

function validateBioStyle(style: string): ImprovedBio['style'] {
  const validStyles: ImprovedBio['style'][] = ['professional', 'casual', 'creative', 'minimalist'];
  return validStyles.includes(style as any) ? (style as ImprovedBio['style']) : 'professional';
}

function getDefaultAnalysis(): ProfileAnalysisResult {
  return {
    overallScore: 0,
    bioAnalysis: {
      clarity: 0,
      personality: 0,
      callToAction: 0,
      keywords: 0,
      length: 0,
      overallAnalysis: 'Analysis failed',
      strengths: [],
      weaknesses: [],
    },
    suggestions: [],
    competitorInsights: [],
    improvedBioOptions: [],
  };
}
