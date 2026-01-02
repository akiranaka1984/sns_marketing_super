import { invokeLLM } from "./_core/llm";

export interface StrategyData {
  contentType: string;
  hashtags: string;
  postingSchedule: string;
  engagementStrategy: string;
  generatedContent: string;
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
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a creative content writer for social media. Generate engaging post content based on the given strategy.`,
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
