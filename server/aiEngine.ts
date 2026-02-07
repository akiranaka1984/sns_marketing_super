import { invokeLLM } from "./_core/llm";

export interface StrategyData {
  contentType: string;
  hashtags: string;
  postingSchedule: string;
  engagementStrategy: string;
  generatedContent: string;
}

// Extended strategy data with actionable guidelines
export interface ExtendedStrategyData extends StrategyData {
  contentGuidelines?: {
    format: string;
    tone: string;
    keyElements: string[];
    avoidElements: string[];
  };
  timingGuidelines?: {
    bestHours: string[];
    frequency: string;
    dayPreference: string[];
  };
  hashtagGuidelines?: {
    primary: string[];
    secondary: string[];
    avoid: string[];
  };
  toneGuidelines?: {
    primary: string;
    examples: string[];
    avoid: string[];
  };
}

// Input types for context-aware strategy generation
export interface BuzzLearningInput {
  id: number;
  learningType: string;
  title: string;
  description: string;
  patternData?: any;
  confidence: number;
}

export interface ModelPatternInput {
  modelAccountId: number;
  avgPostsPerDay: number;
  peakPostingHours: string[];
  avgEngagementRate: number;
  bestEngagementHours: string[];
  avgContentLength: number;
  emojiUsageRate: number;
  hashtagAvgCount: number;
}

/**
 * Generate marketing strategy using AI
 */
export async function generateStrategy(objective: string): Promise<StrategyData> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are an expert SNS marketing strategist. Generate a comprehensive marketing strategy based on the user's objective. 
          
          Your response must be in JSON format with the following structure:
          {
            "contentType": "string describing the type of content (e.g., 'Educational posts, Behind-the-scenes, Product showcases')",
            "hashtags": "string of recommended hashtags separated by spaces (e.g., '#marketing #socialmedia #business')",
            "postingSchedule": "string describing when and how often to post (e.g., 'Post 3 times per day: 9 AM, 2 PM, 7 PM')",
            "engagementStrategy": "string describing how to engage with audience (e.g., 'Reply to comments within 1 hour, Like and comment on related posts')",
            "generatedContent": "string with 3-5 sample post ideas or templates"
          }`,
        },
        {
          role: "user",
          content: `Generate a marketing strategy for the following objective:\n\n${objective}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "marketing_strategy",
          strict: true,
          schema: {
            type: "object",
            properties: {
              contentType: {
                type: "string",
                description: "Type of content to create",
              },
              hashtags: {
                type: "string",
                description: "Recommended hashtags",
              },
              postingSchedule: {
                type: "string",
                description: "When and how often to post",
              },
              engagementStrategy: {
                type: "string",
                description: "How to engage with audience",
              },
              generatedContent: {
                type: "string",
                description: "Sample post ideas or templates",
              },
            },
            required: ["contentType", "hashtags", "postingSchedule", "engagementStrategy", "generatedContent"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content || typeof content !== 'string') {
      throw new Error("No content generated from AI");
    }

    const strategy: StrategyData = JSON.parse(content);
    return strategy;
  } catch (error) {
    console.error("[AI Engine] Failed to generate strategy:", error);
    
    // Return a fallback strategy
    return {
      contentType: "Mixed content: educational, promotional, and engaging posts",
      hashtags: "#marketing #socialmedia #business #growth",
      postingSchedule: "Post 2-3 times per day at peak engagement times (9 AM, 2 PM, 7 PM)",
      engagementStrategy: "Respond to all comments within 2 hours, engage with similar accounts daily",
      generatedContent: "1. Share industry insights\n2. Behind-the-scenes content\n3. Customer testimonials\n4. Product features\n5. Interactive polls and questions",
    };
  }
}

/**
 * Generate post content based on strategy
 */
export async function generatePostContent(
  strategy: StrategyData,
  topic?: string
): Promise<string> {
  try {
    // Get current date for context
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();
    const currentDateStr = `${currentYear}/${currentMonth}/${currentDay}`;

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a creative content writer for social media. Generate engaging post content based on the given strategy.

IMPORTANT: Today's date is ${currentDateStr} (Year ${currentYear}). Always reference the current year in your content. Do NOT mention past years like 2024.`,
        },
        {
          role: "user",
          content: `Generate a social media post based on this strategy:

Content Type: ${strategy.contentType}
Hashtags: ${strategy.hashtags}
${topic ? `Topic: ${topic}` : ''}

Create an engaging post that follows this strategy. Include relevant hashtags at the end.`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    return typeof content === 'string' ? content : "Failed to generate content";
  } catch (error) {
    console.error("[AI Engine] Failed to generate post content:", error);
    return "Failed to generate content. Please try again.";
  }
}

/**
 * KPI suggestion result interface
 */
export interface KPISuggestion {
  followers?: number;
  engagement?: number;
  clicks?: number;
  conversions?: number;
  impressions?: number;
  rationale: string;
}

/**
 * Suggest KPIs based on marketing objective
 */
export async function suggestKPIs(
  objective: string,
  currentMetrics?: {
    followers?: number;
    engagement?: number;
    clicks?: number;
  }
): Promise<KPISuggestion> {
  try {
    const currentContext = currentMetrics
      ? `Current metrics: Followers: ${currentMetrics.followers || 0}, Engagement rate: ${currentMetrics.engagement || 0}%, Clicks: ${currentMetrics.clicks || 0}`
      : "No current metrics available";

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are an SNS marketing expert. Based on the user's marketing objective, suggest realistic and measurable KPI targets.

Your response must be in JSON format with the following structure:
{
  "followers": number or null (target follower count increase),
  "engagement": number or null (target engagement rate percentage, e.g., 5.0 for 5%),
  "clicks": number or null (target click count),
  "conversions": number or null (target conversion count),
  "impressions": number or null (target impression count),
  "rationale": "string explaining why these KPIs are appropriate for the objective"
}

Only include KPIs that are relevant to the objective. Set irrelevant KPIs to null.
The rationale should be concise (2-3 sentences) explaining the connection between objective and KPIs.`,
        },
        {
          role: "user",
          content: `Suggest KPI targets for this marketing objective:\n\nObjective: ${objective}\n\n${currentContext}\n\nProvide realistic, achievable KPI targets that align with this objective.`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "kpi_suggestion",
          strict: true,
          schema: {
            type: "object",
            properties: {
              followers: { type: ["number", "null"], description: "Target follower increase" },
              engagement: { type: ["number", "null"], description: "Target engagement rate %" },
              clicks: { type: ["number", "null"], description: "Target click count" },
              conversions: { type: ["number", "null"], description: "Target conversion count" },
              impressions: { type: ["number", "null"], description: "Target impression count" },
              rationale: { type: "string", description: "Explanation of KPI selection" },
            },
            required: ["rationale"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content || typeof content !== 'string') {
      throw new Error("No content generated from AI");
    }

    const suggestion: KPISuggestion = JSON.parse(content);
    return suggestion;
  } catch (error) {
    console.error("[AI Engine] Failed to suggest KPIs:", error);

    // Return a fallback suggestion
    return {
      followers: 500,
      engagement: 3.0,
      rationale: "デフォルトのKPI提案です。目標に合わせて調整してください。",
    };
  }
}

/**
 * Analyze post performance and suggest improvements
 */
export async function analyzePostPerformance(
  postContent: string,
  metrics: {
    likes: number;
    comments: number;
    shares: number;
    views: number;
  }
): Promise<string> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a social media analytics expert. Analyze post performance and provide actionable insights.`,
        },
        {
          role: "user",
          content: `Analyze this post's performance:

Post: ${postContent}

Metrics:
- Likes: ${metrics.likes}
- Comments: ${metrics.comments}
- Shares: ${metrics.shares}
- Views: ${metrics.views}

Provide insights and suggestions for improvement.`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    return typeof content === 'string' ? content : "Failed to analyze performance";
  } catch (error) {
    console.error("[AI Engine] Failed to analyze performance:", error);
    return "Failed to analyze performance. Please try again.";
  }
}

/**
 * Generate strategy with context from buzz learnings and model account patterns
 * This is the goal-driven strategy generation function
 */
export async function generateStrategyWithContext(
  objective: string,
  options: {
    buzzLearnings?: BuzzLearningInput[];
    modelPatterns?: ModelPatternInput[];
    projectTargets?: Record<string, number>;
    currentPerformance?: { avgEngagement: number; avgLikes: number };
  }
): Promise<ExtendedStrategyData> {
  try {
    // Build context from buzz learnings
    let buzzContext = '';
    if (options.buzzLearnings && options.buzzLearnings.length > 0) {
      const learningsByType: Record<string, BuzzLearningInput[]> = {};
      for (const learning of options.buzzLearnings) {
        if (!learningsByType[learning.learningType]) {
          learningsByType[learning.learningType] = [];
        }
        learningsByType[learning.learningType].push(learning);
      }

      buzzContext = `
## バズ投稿から学んだ成功パターン

`;
      for (const [type, learnings] of Object.entries(learningsByType)) {
        buzzContext += `### ${type}\n`;
        for (const l of learnings.slice(0, 3)) { // Top 3 per type
          buzzContext += `- ${l.title}: ${l.description} (信頼度: ${l.confidence}%)\n`;
        }
      }
    }

    // Build context from model account patterns
    let modelContext = '';
    if (options.modelPatterns && options.modelPatterns.length > 0) {
      const avgPosts = options.modelPatterns.reduce((sum, p) => sum + p.avgPostsPerDay, 0) / options.modelPatterns.length;
      const avgEngagement = options.modelPatterns.reduce((sum, p) => sum + p.avgEngagementRate, 0) / options.modelPatterns.length;
      const allPeakHours = options.modelPatterns.flatMap(p => p.peakPostingHours);
      const peakHourCounts = allPeakHours.reduce((acc, h) => {
        acc[h] = (acc[h] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      const topPeakHours = Object.entries(peakHourCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([h]) => h);

      const avgContentLength = options.modelPatterns.reduce((sum, p) => sum + p.avgContentLength, 0) / options.modelPatterns.length;
      const avgHashtags = options.modelPatterns.reduce((sum, p) => sum + p.hashtagAvgCount, 0) / options.modelPatterns.length;

      modelContext = `
## 成功しているアカウントの行動パターン

分析対象: ${options.modelPatterns.length}アカウント

- 平均投稿頻度: ${avgPosts.toFixed(1)}回/日
- ピーク投稿時間: ${topPeakHours.map(h => h + '時').join(', ')}
- 平均エンゲージメント率: ${avgEngagement.toFixed(2)}%
- 平均投稿文字数: ${Math.round(avgContentLength)}文字
- 平均ハッシュタグ数: ${avgHashtags.toFixed(1)}個
`;
    }

    // Build context from project targets
    let targetContext = '';
    if (options.projectTargets && Object.keys(options.projectTargets).length > 0) {
      targetContext = `
## プロジェクト目標

`;
      for (const [key, value] of Object.entries(options.projectTargets)) {
        const label = {
          followers: 'フォロワー目標',
          engagement: 'エンゲージメント率目標',
          clicks: 'クリック数目標',
          conversions: 'コンバージョン目標',
          impressions: 'インプレッション目標',
        }[key] || key;
        targetContext += `- ${label}: ${value}\n`;
      }
    }

    // Build current performance context
    let performanceContext = '';
    if (options.currentPerformance) {
      performanceContext = `
## 現在のパフォーマンス

- 平均エンゲージメント: ${options.currentPerformance.avgEngagement.toFixed(2)}%
- 平均いいね数: ${options.currentPerformance.avgLikes}
`;
    }

    const systemPrompt = `あなたは、データに基づいたSNSマーケティング戦略を立案する専門家です。
以下のコンテキスト情報を参考に、目標達成に向けた具体的で実行可能な戦略を生成してください。

${buzzContext}
${modelContext}
${targetContext}
${performanceContext}

戦略は以下のJSON形式で出力してください:
{
  "contentType": "推奨するコンテンツタイプの説明",
  "hashtags": "推奨ハッシュタグ（スペース区切り）",
  "postingSchedule": "投稿スケジュールの推奨",
  "engagementStrategy": "エンゲージメント戦略",
  "generatedContent": "3-5個のサンプル投稿アイデア",
  "contentGuidelines": {
    "format": "推奨するコンテンツフォーマット",
    "tone": "推奨するトーン",
    "keyElements": ["必須要素1", "必須要素2"],
    "avoidElements": ["避けるべき要素1", "避けるべき要素2"]
  },
  "timingGuidelines": {
    "bestHours": ["09", "12", "19"],
    "frequency": "1日2-3回",
    "dayPreference": ["平日", "週末"]
  },
  "hashtagGuidelines": {
    "primary": ["メインハッシュタグ"],
    "secondary": ["サブハッシュタグ"],
    "avoid": ["避けるべきタグ"]
  },
  "toneGuidelines": {
    "primary": "主要なトーン",
    "examples": ["トーンの例文"],
    "avoid": ["避けるべきトーン"]
  }
}

重要: 成功パターンとモデルアカウントの行動様式を戦略に反映してください。`;

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: `以下の目標に対する戦略を生成してください:\n\n${objective}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "extended_strategy",
          strict: true,
          schema: {
            type: "object",
            properties: {
              contentType: { type: "string" },
              hashtags: { type: "string" },
              postingSchedule: { type: "string" },
              engagementStrategy: { type: "string" },
              generatedContent: { type: "string" },
              contentGuidelines: {
                type: "object",
                properties: {
                  format: { type: "string" },
                  tone: { type: "string" },
                  keyElements: { type: "array", items: { type: "string" } },
                  avoidElements: { type: "array", items: { type: "string" } },
                },
                required: ["format", "tone", "keyElements", "avoidElements"],
                additionalProperties: false,
              },
              timingGuidelines: {
                type: "object",
                properties: {
                  bestHours: { type: "array", items: { type: "string" } },
                  frequency: { type: "string" },
                  dayPreference: { type: "array", items: { type: "string" } },
                },
                required: ["bestHours", "frequency", "dayPreference"],
                additionalProperties: false,
              },
              hashtagGuidelines: {
                type: "object",
                properties: {
                  primary: { type: "array", items: { type: "string" } },
                  secondary: { type: "array", items: { type: "string" } },
                  avoid: { type: "array", items: { type: "string" } },
                },
                required: ["primary", "secondary", "avoid"],
                additionalProperties: false,
              },
              toneGuidelines: {
                type: "object",
                properties: {
                  primary: { type: "string" },
                  examples: { type: "array", items: { type: "string" } },
                  avoid: { type: "array", items: { type: "string" } },
                },
                required: ["primary", "examples", "avoid"],
                additionalProperties: false,
              },
            },
            required: [
              "contentType", "hashtags", "postingSchedule", "engagementStrategy",
              "generatedContent", "contentGuidelines", "timingGuidelines",
              "hashtagGuidelines", "toneGuidelines"
            ],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content || typeof content !== 'string') {
      throw new Error("No content generated from AI");
    }

    const strategy: ExtendedStrategyData = JSON.parse(content);
    return strategy;
  } catch (error) {
    console.error("[AI Engine] Failed to generate strategy with context:", error);

    // Return a fallback strategy
    return {
      contentType: "Mixed content: educational, promotional, and engaging posts",
      hashtags: "#marketing #socialmedia #business #growth",
      postingSchedule: "Post 2-3 times per day at peak engagement times",
      engagementStrategy: "Respond to all comments within 2 hours",
      generatedContent: "1. Share industry insights\n2. Behind-the-scenes\n3. Customer testimonials",
      contentGuidelines: {
        format: "Text with optional image",
        tone: "Friendly and professional",
        keyElements: ["Value proposition", "Call to action"],
        avoidElements: ["Overly promotional language"],
      },
      timingGuidelines: {
        bestHours: ["09", "12", "19"],
        frequency: "2-3 times per day",
        dayPreference: ["Weekdays"],
      },
      hashtagGuidelines: {
        primary: ["#marketing", "#growth"],
        secondary: ["#business", "#tips"],
        avoid: ["#spam", "#followforfollow"],
      },
      toneGuidelines: {
        primary: "Professional yet approachable",
        examples: ["Here's what we learned...", "Did you know..."],
        avoid: ["Overly casual", "Pushy sales language"],
      },
    };
  }
}

/**
 * Generate persona characteristics based on role and tone selection
 */
export async function generatePersonaCharacteristics(
  role: string,
  tone: string
): Promise<string> {
  const roleLabels: Record<string, string> = {
    specialist: "専門家・詳しい人",
    casual_user: "カジュアルユーザー",
    reviewer: "レビュアー・評論家",
    enthusiast: "熱狂的ファン",
    influencer: "インフルエンサー",
    newbie: "初心者・入門者",
    business: "ビジネスパーソン",
    custom: "カスタム",
  };

  const toneLabels: Record<string, string> = {
    formal: "フォーマル",
    casual: "カジュアル",
    friendly: "フレンドリー",
    professional: "プロフェッショナル",
    humorous: "ユーモラス",
  };

  const roleLabel = roleLabels[role] || role;
  const toneLabel = toneLabels[tone] || tone;

  const prompt = `あなたはSNSマーケティングの専門家です。
以下の役割とトーンを持つSNSアカウントのペルソナ設定として、特徴・コメントスタイルの叩き台を日本語で生成してください。

役割: ${roleLabel}
トーン: ${toneLabel}

以下の内容を含めてください：
- このペルソナの基本的な性格や姿勢
- よく使うフレーズや言い回しの例（3-4個）
- 絵文字の使い方の傾向
- コメント時のスタイル（長さ、特徴的な表現など）

150文字程度で簡潔にまとめてください。改行は入れず、1つの段落として記述してください。`;

  try {
    const result = await invokeLLM({
      messages: [{ role: "user", content: prompt }],
      max_tokens: 300,
    });
    const content = result.choices?.[0]?.message?.content;
    return (typeof content === 'string' ? content : '').trim();
  } catch (error) {
    console.error("Failed to generate persona characteristics:", error);
    // Fallback to a simple template
    return generateFallbackCharacteristics(role, tone);
  }
}

function generateFallbackCharacteristics(role: string, tone: string): string {
  const templates: Record<string, Record<string, string>> = {
    specialist: {
      formal: "専門的な知識に基づいた冷静な分析を行います。「この点は重要ですね」「～の観点から興味深いです」などの表現を使用。絵文字は控えめ。",
      casual: "詳しい知識をカジュアルに共有。「これ面白いよね！」「実は～なんだよ」など親しみやすい解説。時々絵文字を使用。",
      friendly: "専門知識を親しみやすく伝えます。「なるほど！」「勉強になります」「〜がポイントですね」など。絵文字は適度に使用。",
      professional: "専門家として的確なコメント。「この分野では～」「ビジネス的に見ると～」などの分析的な視点。",
      humorous: "専門知識にユーモアを交えて。「マニアックですが～」「オタク的に言うと最高です」など楽しい解説。",
    },
    casual_user: {
      formal: "一般ユーザーとして丁寧に反応。「素敵ですね」「参考になります」など控えめな表現。",
      casual: "気軽にSNSを楽しむスタイル。「いいね！」「面白い！」「これすごい！」などシンプルな反応。絵文字多め👍",
      friendly: "親しみやすい反応を心がけます。「わー！」「すごい！」「共感します〜」など温かいコメント。😊を使用。",
      professional: "一般ユーザーながら丁寧に。「興味深いですね」「参考にさせていただきます」など礼儀正しく。",
      humorous: "楽しくSNSを使う人。「笑った😂」「センスいい！」「ツボりました」などノリの良い反応。",
    },
    newbie: {
      formal: "学びの姿勢で丁寧にコメント。「勉強になります」「初めて知りました」など謙虚な表現。",
      casual: "素直に学ぶ姿勢。「へー！」「知らなかった！」「なるほど〜」など新鮮な反応。",
      friendly: "学びながらコンテンツを楽しむ姿勢。「勉強になります！」「なるほど〜」「初めて知りました！」などの素直な反応。",
      professional: "初心者として真摯に学ぶ姿勢。「大変参考になります」「知識が増えました」など。",
      humorous: "楽しみながら学ぶスタイル。「目から鱗！」「脳みそアップデートされた」など面白表現も。",
    },
  };

  const roleTemplates = templates[role] || templates.casual_user;
  return roleTemplates[tone] || roleTemplates.friendly ||
    "自然体でコンテンツに反応します。共感や興味を素直に表現し、適度に絵文字を使用します。";
}
