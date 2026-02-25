import { invokeLLM } from "./_core/llm";

import { createLogger } from "./utils/logger";

const logger = createLogger("ai-comment-service");

/**
 * 投稿内容を理解して、ペルソナに合ったコメントを生成（検証済み）
 */
export async function generateComment(
  postContent: string,
  commenterPersona: string
): Promise<string> {
  try {
    const result = await invokeLLM({
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
      }],
      maxTokens: 100,
    });

    return result.choices[0]?.message?.content as string || "";
  } catch (error) {
    logger.error({ err: error }, "[AI Comment] Generation failed");
    return "素敵ですね！👍";
  }
}
