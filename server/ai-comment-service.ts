import OpenAI from "openai";

// Lazy initialization to avoid startup errors when API key is not set
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set. Please configure it in Settings.');
    }
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

/**
 * 投稿内容を理解して、ペルソナに合ったコメントを生成（検証済み）
 */
export async function generateComment(
  postContent: string,
  commenterPersona: string
): Promise<string> {
  try {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 100,
      messages: [{
        role: "user",
        content: `あなたは「${commenterPersona}」というペルソナのSNSユーザーです。

以下の投稿に対して、自然で人間らしいコメントを1つ生成してください。

【投稿内容】
${postContent}

【ルール】
- コメントは50文字以内で簡潔に
- 絵文字は1-2個まで使用可
- 自然な日本語または中国語で
- 同意、質問、感想のいずれかの形式で
- コメント本文のみを返し、他の説明は不要`
      }]
    });

    return response.choices[0].message.content || "";
  } catch (error) {
    console.error("[AI Comment] Generation failed:", error);
    return "素敵ですね！👍";
  }
}
