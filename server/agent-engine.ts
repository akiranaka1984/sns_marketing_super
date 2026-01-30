/**
 * SNS Agent Engine
 * 
 * エージェントが自律的にコンテンツを生成・投稿し、
 * ノウハウを蓄積しながら成長していく仕組み
 */

import { db } from "./db";
import {
  agents,
  agentKnowledge,
  agentRules,
  agentAccounts,
  agentExecutionLogs,
  agentSchedules,
  postPerformanceFeedback,
  posts,
  accounts,
  postAnalytics,
  strategies,
  projects,
  projectAccounts,
  accountModelAccounts,
  buzzLearnings,
  scheduledPosts,
} from "../drizzle/schema";
import { eq, and, desc, gte, lte, sql, inArray } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import { postToSNS } from "./sns-posting";
import {
  getAccountLearnings,
  getLearningsForPrompt,
  learnFromPostPerformance,
  AccountLearning,
  getBuzzLearningsForPrompt,
  getFailurePatternsForPrompt,
  BuzzPatternsForPrompt,
  formatWeightedLearningsForPrompt,
} from "./services/account-learning-service";
import { ensureDeviceReady } from './ensure-device-ready';

// ============================================
// Types
// ============================================

// Strategy guidelines type (from aiEngine)
interface StrategyGuidelines {
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

// Account persona for personalized content generation
interface AccountPersona {
  accountId: number;
  persona: {
    role?: string | null;
    tone?: string | null;
    characteristics?: string | null;
  };
  modelAccountIds?: number[];
}

interface AgentContext {
  agent: typeof agents.$inferSelect;
  accounts: (typeof accounts.$inferSelect)[];
  knowledge: (typeof agentKnowledge.$inferSelect)[];
  rules: (typeof agentRules.$inferSelect)[];
  recentPosts: (typeof posts.$inferSelect)[];
  accountLearnings: Map<number, AccountLearning[]>; // accountId -> learnings
  buzzPatterns: BuzzPatternsForPrompt; // Buzz analysis patterns for improved content
  // New: Project strategy and targets for goal-driven content
  projectStrategy?: typeof strategies.$inferSelect | null;
  projectTargets?: Record<string, number>;
  // New: Account personas for personalized content generation
  accountPersonas: AccountPersona[];
  pendingScheduledContents: string[];
}

interface GeneratedContent {
  content: string;
  hashtags: string[];
  mediaPrompt?: string;
  confidence: number;
  reasoning: string;
}

interface PostResult {
  success: boolean;
  postId?: number;
  error?: string;
}

// ============================================
// Agent Context Builder
// ============================================

/**
 * エージェントの実行に必要なコンテキストを構築
 */
export async function buildAgentContext(agentId: number): Promise<AgentContext | null> {
  // エージェント情報を取得
  const agent = await db.query.agents.findFirst({
    where: eq(agents.id, agentId),
  });

  if (!agent) {
    return null;
  }

  // 紐づくアカウントを取得
  const agentAccountLinks = await db.query.agentAccounts.findMany({
    where: and(
      eq(agentAccounts.agentId, agentId),
      eq(agentAccounts.isActive, 1)
    ),
  });

  const accountIds = agentAccountLinks.map(link => link.accountId);
  const linkedAccounts = accountIds.length > 0
    ? await db.query.accounts.findMany({
        where: inArray(accounts.id, accountIds),
      })
    : [];

  // 知見を取得（信頼度順）
  const knowledge = await db.query.agentKnowledge.findMany({
    where: and(
      eq(agentKnowledge.agentId, agentId),
      eq(agentKnowledge.isActive, 1)
    ),
    orderBy: [desc(agentKnowledge.confidence), desc(agentKnowledge.successRate)],
    limit: 50,
  });

  // ルールを取得（優先度順）
  const rules = await db.query.agentRules.findMany({
    where: and(
      eq(agentRules.agentId, agentId),
      eq(agentRules.isActive, 1)
    ),
    orderBy: desc(agentRules.priority),
  });

  // 最近の投稿を取得（重複防止用）
  const recentPosts = await db.query.posts.findMany({
    where: eq(posts.agentId, agentId),
    orderBy: desc(posts.createdAt),
    limit: 20,
  });

  // pending scheduledPostsのコンテンツを取得（重複防止用）
  const pendingScheduledPosts = accountIds.length > 0
    ? await db.query.scheduledPosts.findMany({
        where: and(
          inArray(scheduledPosts.accountId, accountIds),
          eq(scheduledPosts.status, "pending")
        ),
        orderBy: desc(scheduledPosts.createdAt),
        limit: 30,
      })
    : [];
  const pendingScheduledContents = pendingScheduledPosts.map(sp => sp.content);

  // アカウント学習を取得
  const accountLearnings = new Map<number, AccountLearning[]>();
  for (const account of linkedAccounts) {
    try {
      const learnings = await getAccountLearnings(account.id, {
        minConfidence: 30,
        limit: 20,
      });
      accountLearnings.set(account.id, learnings);
    } catch (error) {
      console.error(`[AgentEngine] Failed to get learnings for account ${account.id}:`, error);
      accountLearnings.set(account.id, []);
    }
  }

  // バズ分析パターンを取得（投稿品質向上用）
  let buzzPatterns: BuzzPatternsForPrompt;
  try {
    buzzPatterns = await getBuzzLearningsForPrompt(agent.userId);
    if (buzzPatterns.hasData) {
      console.log(`[AgentEngine] Loaded buzz patterns for user ${agent.userId}`);
    }
  } catch (error) {
    console.error(`[AgentEngine] Failed to get buzz patterns:`, error);
    buzzPatterns = {
      hooks: '- まだ蓄積されていません',
      structures: '- まだ蓄積されていません',
      ctas: '- まだ蓄積されていません',
      avoidPatterns: '- 特にありません',
      hasData: false,
    };
  }

  // Get account personas (for personalized content generation)
  const accountPersonas: AccountPersona[] = [];
  for (const account of linkedAccounts) {
    // Get project-specific persona (priority) or account-level persona
    let persona: AccountPersona['persona'] = {
      role: account.personaRole,
      tone: account.personaTone,
      characteristics: account.personaCharacteristics,
    };

    // Check for project-specific persona (overrides account-level)
    if (agent.projectId) {
      const projectAccount = await db.query.projectAccounts.findFirst({
        where: and(
          eq(projectAccounts.accountId, account.id),
          eq(projectAccounts.projectId, agent.projectId)
        ),
      });

      if (projectAccount) {
        // Use project-specific persona if available, otherwise fall back to account-level
        persona = {
          role: projectAccount.personaRole || account.personaRole,
          tone: projectAccount.personaTone || account.personaTone,
          characteristics: projectAccount.personaCharacteristics || account.personaCharacteristics,
        };
      }
    }

    // Get linked model accounts (for applying their learnings)
    const modelLinks = await db.query.accountModelAccounts.findMany({
      where: and(
        eq(accountModelAccounts.accountId, account.id),
        eq(accountModelAccounts.autoApplyLearnings, 1)
      ),
    });
    const modelAccountIds = modelLinks.map(link => link.modelAccountId);

    accountPersonas.push({
      accountId: account.id,
      persona,
      modelAccountIds,
    });

    if (persona.role || persona.tone || persona.characteristics) {
      console.log(`[AgentEngine] Loaded persona for account ${account.id}: role=${persona.role}, tone=${persona.tone}`);
    }
    if (modelAccountIds.length > 0) {
      console.log(`[AgentEngine] Account ${account.id} linked to ${modelAccountIds.length} model accounts`);
    }
  }

  // Get project strategy and targets (for goal-driven content generation)
  let projectStrategy: typeof strategies.$inferSelect | null = null;
  let projectTargets: Record<string, number> = {};

  if (agent.projectId) {
    try {
      // Get the active strategy for this project
      const foundStrategy = await db.query.strategies.findFirst({
        where: and(
          eq(strategies.projectId, agent.projectId),
          eq(strategies.isActive, 1)
        ),
        orderBy: desc(strategies.createdAt),
      });
      projectStrategy = foundStrategy ?? null;

      if (projectStrategy) {
        console.log(`[AgentEngine] Loaded project strategy for project ${agent.projectId}`);
      }

      // Get project targets
      const project = await db.query.projects.findFirst({
        where: eq(projects.id, agent.projectId),
      });

      if (project?.targets) {
        try {
          projectTargets = JSON.parse(project.targets);
          console.log(`[AgentEngine] Loaded project targets:`, projectTargets);
        } catch (e) {
          console.error(`[AgentEngine] Failed to parse project targets:`, e);
        }
      }
    } catch (error) {
      console.error(`[AgentEngine] Failed to get project strategy/targets:`, error);
    }
  }

  return {
    agent,
    accounts: linkedAccounts,
    knowledge,
    rules,
    recentPosts,
    accountLearnings,
    buzzPatterns,
    projectStrategy,
    projectTargets,
    accountPersonas,
    pendingScheduledContents,
  };
}

// ============================================
// Content Generation
// ============================================

/**
 * エージェントのコンテキストに基づいてコンテンツを生成
 */
export async function generateContent(
  context: AgentContext,
  maxLength?: number,
  targetAccountId?: number,
  additionalAvoidContents?: string[]
): Promise<GeneratedContent> {
  const { agent, knowledge, rules, recentPosts, accountLearnings, projectStrategy, projectTargets, accountPersonas, pendingScheduledContents } = context;

  // Get the target account's persona
  const targetAccountPersona = targetAccountId
    ? accountPersonas.find(ap => ap.accountId === targetAccountId)
    : accountPersonas[0];  // Default to first account if not specified

  // アカウント固有の学習を取得
  let accountLearningPrompt = '';
  if (targetAccountId && accountLearnings.has(targetAccountId)) {
    const learnings = accountLearnings.get(targetAccountId) || [];
    if (learnings.length > 0) {
      const sections: string[] = [];

      // 成功パターン
      const successPatterns = learnings.filter(l => l.learningType === 'success_pattern');
      if (successPatterns.length > 0) {
        sections.push('## このアカウントの成功パターン');
        successPatterns.slice(0, 3).forEach(p => {
          try {
            const content = JSON.parse(p.content);
            sections.push(`- ${p.title}: ${content.insight || content.description || ''}`);
          } catch {
            sections.push(`- ${p.title}`);
          }
        });
      }

      // 投稿スタイル
      const postingStyles = learnings.filter(l => l.learningType === 'posting_style');
      if (postingStyles.length > 0) {
        sections.push('## このアカウントの投稿スタイル');
        postingStyles.slice(0, 3).forEach(p => {
          try {
            const content = JSON.parse(p.content);
            sections.push(`- ${content.description || p.title}`);
          } catch {
            sections.push(`- ${p.title}`);
          }
        });
      }

      // ハッシュタグ戦略
      const hashtagLearnings = learnings.filter(l => l.learningType === 'hashtag_strategy');
      if (hashtagLearnings.length > 0) {
        sections.push('## このアカウントのハッシュタグ傾向');
        hashtagLearnings.slice(0, 2).forEach(p => {
          try {
            const content = JSON.parse(p.content);
            sections.push(`- ${content.description || p.title}`);
          } catch {
            sections.push(`- ${p.title}`);
          }
        });
      }

      if (sections.length > 0) {
        accountLearningPrompt = '\n\n' + sections.join('\n');
      }
    }
  }

  // Get weighted learnings (time-decay prioritized, most recent and successful first)
  let weightedLearningPrompt = '';
  if (targetAccountId) {
    try {
      const projectId = context.agent.projectId || undefined;
      weightedLearningPrompt = await formatWeightedLearningsForPrompt(targetAccountId, {
        projectId,
        forPostGeneration: true,
        limit: 8,
      });
      if (weightedLearningPrompt) {
        console.log(`[AgentEngine] Loaded weighted learnings for account ${targetAccountId}`);
      }
    } catch (error) {
      console.error(`[AgentEngine] Failed to get weighted learnings:`, error);
    }
  }

  // Build account persona prompt (personalized content generation)
  let personaPrompt = '';
  if (targetAccountPersona?.persona) {
    const { role, tone, characteristics } = targetAccountPersona.persona;
    if (role || tone || characteristics) {
      const personaSections: string[] = [];
      personaSections.push('## 👤 アカウントペルソナ');
      personaSections.push('このアカウントの個性を反映した投稿を作成してください:');

      if (role) {
        // Map role to Japanese description
        const roleDescriptions: Record<string, string> = {
          'specialist': '専門家・エキスパートとして発信',
          'casual_user': '一般ユーザー目線でカジュアルに発信',
          'reviewer': 'レビュアー・評論家として客観的に発信',
          'influencer': 'インフルエンサーとしてトレンドを発信',
          'educator': '教育者として分かりやすく解説',
          'entertainer': 'エンターテイナーとして楽しく発信',
        };
        const roleDesc = roleDescriptions[role] || role;
        personaSections.push(`- 役割: ${roleDesc}`);
      }

      if (tone) {
        // Map tone to Japanese description
        const toneDescriptions: Record<string, string> = {
          'formal': 'フォーマル（丁寧語、敬語を使用）',
          'casual': 'カジュアル（友達に話すような口調）',
          'friendly': 'フレンドリー（親しみやすく温かい）',
          'professional': 'プロフェッショナル（専門的で信頼感のある）',
          'humorous': 'ユーモラス（軽快で面白い）',
        };
        const toneDesc = toneDescriptions[tone] || tone;
        personaSections.push(`- トーン: ${toneDesc}`);
      }

      if (characteristics) {
        personaSections.push(`- 特徴: ${characteristics}`);
      }

      personaPrompt = '\n\n---\n' + personaSections.join('\n');
      console.log(`[AgentEngine] Using persona for content generation: role=${role}, tone=${tone}`);
    }
  }

  // Build strategy guidance prompt (goal-driven content generation)
  let strategyPrompt = '';
  if (projectStrategy) {
    const strategySections: string[] = [];
    strategySections.push('## 🎯 プロジェクト戦略');
    strategySections.push(`現在のアクティブ戦略: ${projectStrategy.name || '戦略'}`);

    if (projectStrategy.description) {
      strategySections.push(`\n### 戦略の方向性\n${projectStrategy.description}`);
    }

    // Content guidelines
    if (projectStrategy.contentGuidelines) {
      try {
        const guidelines = JSON.parse(projectStrategy.contentGuidelines) as StrategyGuidelines['contentGuidelines'];
        if (guidelines) {
          strategySections.push('\n### コンテンツガイドライン');
          if (guidelines.format) {
            strategySections.push(`- フォーマット: ${guidelines.format}`);
          }
          if (guidelines.tone) {
            strategySections.push(`- トーン: ${guidelines.tone}`);
          }
          if (guidelines.keyElements && guidelines.keyElements.length > 0) {
            strategySections.push(`- 含めるべき要素: ${guidelines.keyElements.join(', ')}`);
          }
          if (guidelines.avoidElements && guidelines.avoidElements.length > 0) {
            strategySections.push(`- 避ける要素: ${guidelines.avoidElements.join(', ')}`);
          }
        }
      } catch (e) {
        console.error('[AgentEngine] Failed to parse contentGuidelines:', e);
      }
    }

    // Hashtag guidelines
    if (projectStrategy.hashtagGuidelines) {
      try {
        const hashtagGuide = JSON.parse(projectStrategy.hashtagGuidelines) as StrategyGuidelines['hashtagGuidelines'];
        if (hashtagGuide) {
          strategySections.push('\n### ハッシュタグ戦略');
          if (hashtagGuide.primary && hashtagGuide.primary.length > 0) {
            strategySections.push(`- メインタグ: ${hashtagGuide.primary.map(t => `#${t}`).join(', ')}`);
          }
          if (hashtagGuide.secondary && hashtagGuide.secondary.length > 0) {
            strategySections.push(`- サブタグ: ${hashtagGuide.secondary.map(t => `#${t}`).join(', ')}`);
          }
          if (hashtagGuide.avoid && hashtagGuide.avoid.length > 0) {
            strategySections.push(`- 避けるタグ: ${hashtagGuide.avoid.map(t => `#${t}`).join(', ')}`);
          }
        }
      } catch (e) {
        console.error('[AgentEngine] Failed to parse hashtagGuidelines:', e);
      }
    }

    // Tone guidelines
    if (projectStrategy.toneGuidelines) {
      try {
        const toneGuide = JSON.parse(projectStrategy.toneGuidelines) as StrategyGuidelines['toneGuidelines'];
        if (toneGuide) {
          strategySections.push('\n### トーン＆ボイス');
          if (toneGuide.primary) {
            strategySections.push(`- 基本トーン: ${toneGuide.primary}`);
          }
          if (toneGuide.examples && toneGuide.examples.length > 0) {
            strategySections.push(`- 表現例: ${toneGuide.examples.slice(0, 3).join(' / ')}`);
          }
          if (toneGuide.avoid && toneGuide.avoid.length > 0) {
            strategySections.push(`- 避けるトーン: ${toneGuide.avoid.join(', ')}`);
          }
        }
      } catch (e) {
        console.error('[AgentEngine] Failed to parse toneGuidelines:', e);
      }
    }

    strategyPrompt = '\n\n---\n' + strategySections.join('\n');
  }

  // Build project targets prompt
  let projectTargetsPrompt = '';
  if (projectTargets && Object.keys(projectTargets).length > 0) {
    const targetSections: string[] = [];
    targetSections.push('## 📈 プロジェクト目標');
    targetSections.push('以下の目標達成に貢献するコンテンツを作成してください:');

    const targetLabels: Record<string, string> = {
      followers: 'フォロワー数',
      engagement_rate: 'エンゲージメント率',
      impressions: 'インプレッション数',
      clicks: 'クリック数',
      conversions: 'コンバージョン数',
      avg_likes: '平均いいね数',
      posts_count: '投稿数',
    };

    for (const [key, value] of Object.entries(projectTargets)) {
      if (value && value > 0) {
        const label = targetLabels[key] || key;
        targetSections.push(`- ${label}: ${value.toLocaleString()}`);
      }
    }

    targetSections.push('\n目標達成のために、エンゲージメントを高める工夫を取り入れてください。');
    projectTargetsPrompt = '\n\n' + targetSections.join('\n');
  }

  // 成功パターンを抽出
  const successPatterns = knowledge
    .filter(k => k.knowledgeType === 'success_pattern')
    .slice(0, 5)
    .map(k => k.content);

  // コンテンツテンプレートを抽出
  const templates = knowledge
    .filter(k => k.knowledgeType === 'content_template')
    .slice(0, 3)
    .map(k => k.content);

  // ハッシュタグ戦略を抽出
  const hashtagStrategies = knowledge
    .filter(k => k.knowledgeType === 'hashtag_strategy')
    .slice(0, 3)
    .map(k => k.content);

  // 禁止ワードを抽出
  const forbiddenWords = rules
    .filter(r => r.ruleType === 'forbidden_word')
    .map(r => r.ruleValue);

  // トーンガイドラインを抽出
  const toneGuidelines = rules
    .filter(r => r.ruleType === 'tone_guideline')
    .map(r => r.ruleValue);

  // 最近の投稿内容（重複防止用）- pending scheduledPosts + バッチ内生成済みコンテンツも含む
  const recentContents = [
    ...recentPosts.slice(0, 10).map(p => p.content.substring(0, 100)),
    ...pendingScheduledContents.slice(0, 15).map(c => c.substring(0, 100)),
    ...(additionalAvoidContents || []).map(c => c.substring(0, 100)),
  ];

  // 現在日付を取得
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();
  const currentDateStr = `${currentYear}年${currentMonth}月${currentDay}日`;

  // バズパターンを取得
  const { buzzPatterns } = context;

  // プロンプトを構築（バズ分析パターンを活用した改善版）
  const systemPrompt = `あなたは「${agent.name}」というSNSエージェントです。

【重要】現在の日付: ${currentDateStr}（${currentYear}年です）
※投稿内容は必ず現在の日付を基準に作成してください。過去の年（2024年など）について言及しないでください。

## エージェント設定
- テーマ: ${agent.theme}
- トーン: ${agent.tone}
- スタイル: ${agent.style}
- ターゲット: ${agent.targetAudience || '一般'}

あなたの役割は、テーマに沿った**具体的で価値のある**SNS投稿を作成することです。
抽象的な表現ではなく、読者が「なるほど」と思える具体的な情報やインサイトを含めてください。

---
## 効果的なフック（冒頭）パターン
以下のパターンで始めると効果的です：
${buzzPatterns.hooks}

## 推奨される投稿構造
${buzzPatterns.structures}

## 効果的なCTA（行動喚起）
${buzzPatterns.ctas}

## 避けるべきパターン
以下は避けてください：
${buzzPatterns.avoidPatterns}

---
## 禁止事項
${forbiddenWords.length > 0 ? forbiddenWords.map(w => `- ${w}`).join('\n') : '- 特になし'}

## トーンガイドライン
${toneGuidelines.length > 0 ? toneGuidelines.map(g => `- ${g}`).join('\n') : '- 自然で親しみやすいトーンを維持'}

## このアカウントの成功パターン
${successPatterns.length > 0 ? successPatterns.map((p, i) => `${i + 1}. ${p}`).join('\n') : '- まだ蓄積されていません'}

## コンテンツテンプレート（参考）
${templates.length > 0 ? templates.map((t, i) => `${i + 1}. ${t}`).join('\n') : '- まだ蓄積されていません'}

## ハッシュタグ戦略
${hashtagStrategies.length > 0 ? hashtagStrategies.map((h, i) => `${i + 1}. ${h}`).join('\n') : '- まだ蓄積されていません'}

## 最近の投稿（重複を避けてください）
${recentContents.length > 0 ? recentContents.map((c, i) => `${i + 1}. ${c}...`).join('\n') : '- まだ投稿がありません'}
${accountLearningPrompt}${weightedLearningPrompt ? '\n\n---\n' + weightedLearningPrompt : ''}${personaPrompt}${strategyPrompt}${projectTargetsPrompt}

---
## 重要な指示
1. **フックで注意を引く**: 最初の1-2行で読者の興味を引きつける
2. **具体性を重視**: 数字、具体例、実体験を含める（例：「3つのポイント」「先週試して効果があった」）
3. **価値を提供**: 読者が「役に立った」と思える情報を含める
4. **CTAで行動を促す**: 質問を投げかける、共感を求める、次のアクションを示す
5. **過去投稿との差別化**: 同じような内容にならないよう工夫する`;

  // X (Twitter)の文字数カウント: 全ての文字が1としてカウントされる
  const calculateCharCount = (text: string): number => {
    return text.length;
  };

  // プランに応じた文字数制限
  // Free: 280, Premium: 4000, Premium+: 25000
  const effectiveMaxLength = maxLength || 280;

  // プランタイプを判定
  type PlanType = 'free' | 'premium' | 'premium_plus';
  let planType: PlanType;
  if (effectiveMaxLength >= 25000) {
    planType = 'premium_plus';
  } else if (effectiveMaxLength >= 4000) {
    planType = 'premium';
  } else {
    planType = 'free';
  }

  // プランに応じた設定
  let contentMaxLength: number;
  let maxHashtags: number;
  let lengthConstraint: string;

  if (planType === 'premium_plus') {
    // Premium+: 最大25,000文字
    contentMaxLength = 2000; // 長文でも読みやすい範囲
    maxHashtags = 5;
    lengthConstraint = `

【X Premium+プラン】
- 最大25,000文字まで投稿可能です
- 詳細で価値のあるコンテンツを作成してください
- ハッシュタグは3-5個が効果的です`;
  } else if (planType === 'premium') {
    // Premium: 最大4,000文字
    contentMaxLength = 800; // 中程度の長文
    maxHashtags = 4;
    lengthConstraint = `

【X Premiumプラン】
- 最大4,000文字まで投稿可能です
- ある程度詳しい内容を含めることができます
- 投稿本文は${contentMaxLength}文字程度を目安にしてください
- ハッシュタグは3-4個が効果的です`;
  } else {
    // 無料: 280文字制限
    contentMaxLength = 200; // ハッシュタグ用に余裕を確保
    maxHashtags = 3;
    lengthConstraint = `

【重要】X (Twitter)の文字数制限:
- 無料プランは280文字制限です
- 投稿本文は${contentMaxLength}文字以内に収めてください
- ハッシュタグと合わせて${effectiveMaxLength}文字以内にする必要があります
- 日本語も英語も1文字=1カウントです`;
  }

  // プランに応じたコンテンツ指示
  const contentInstruction = planType === 'premium_plus'
    ? '詳細で価値のある内容'
    : planType === 'premium'
    ? `${contentMaxLength}文字程度の充実した内容`
    : `${contentMaxLength}文字以内`;

  const closingInstruction = planType === 'free'
    ? `- 投稿本文は簡潔に、${contentMaxLength}文字以内で`
    : '- 読者に価値を提供する充実したコンテンツを心がけてください';

  const userPrompt = `テーマ「${agent.theme}」に関する新しいSNS投稿を1つ作成してください。${lengthConstraint}

以下のJSON形式で回答してください:
{
  "content": "投稿本文（${contentInstruction}、ハッシュタグは含めない）",
  "hashtags": ["タグ1", "タグ2"${maxHashtags > 2 ? ', "タグ3"' : ''}],
  "mediaPrompt": "この投稿に合う画像の説明（オプション）",
  "confidence": 0-100の数値（この投稿の成功予測度）,
  "reasoning": "この投稿を選んだ理由"
}

注意:
- hashtagsには「#」記号を含めないでください
- ハッシュタグは${maxHashtags}個までにしてください
${closingInstruction}`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "generated_content",
          strict: true,
          schema: {
            type: "object",
            properties: {
              content: { type: "string", description: "投稿本文" },
              hashtags: { 
                type: "array", 
                items: { type: "string" },
                description: "ハッシュタグリスト" 
              },
              mediaPrompt: { type: "string", description: "画像生成用プロンプト" },
              confidence: { type: "integer", description: "成功予測度 0-100" },
              reasoning: { type: "string", description: "この投稿を選んだ理由" },
            },
            required: ["content", "hashtags", "mediaPrompt", "confidence", "reasoning"],
            additionalProperties: false,
          },
        },
      },
    });

    const messageContent = response.choices[0].message.content;
    const result = JSON.parse(typeof messageContent === 'string' ? messageContent : '{}');

    // コンテンツとハッシュタグを取得
    let content = result.content || '';
    let hashtags = result.hashtags || [];

    // プランに応じたハッシュタグ数制限
    if (hashtags.length > maxHashtags) {
      console.warn(`[AgentEngine] Too many hashtags (${hashtags.length}), limiting to ${maxHashtags}`);
      hashtags = hashtags.slice(0, maxHashtags);
    }

    // ハッシュタグを含めた総文字数を計算
    const hashtagsText = hashtags.map((tag: string) => `#${tag}`).join(' ');
    const totalLength = content.length + (hashtagsText.length > 0 ? 2 + hashtagsText.length : 0); // 2 = 改行2つ分

    // 総文字数が制限を超えている場合は本文を切り詰める
    if (totalLength > effectiveMaxLength) {
      const maxContentLen = effectiveMaxLength - (hashtagsText.length > 0 ? 2 + hashtagsText.length : 0) - 3; // 3 = "..."分
      console.warn(`[AgentEngine] Total length ${totalLength} exceeds ${effectiveMaxLength}, truncating content to ${maxContentLen} chars`);
      content = content.substring(0, Math.max(maxContentLen, 50)) + '...';
    }

    // Log content generation with strategy info
    const strategyInfo = projectStrategy ? `, strategy: "${projectStrategy.name}"` : '';
    const targetsInfo = projectTargets && Object.keys(projectTargets).length > 0 ? `, targets: ${Object.keys(projectTargets).length}` : '';
    console.log(`[AgentEngine] Plan: ${planType}, Generated content: ${content.length} chars, hashtags: ${hashtagsText.length} chars, total: ${content.length + (hashtagsText.length > 0 ? 2 + hashtagsText.length : 0)}/${effectiveMaxLength} chars${strategyInfo}${targetsInfo}`);

    return {
      content,
      hashtags,
      mediaPrompt: result.mediaPrompt,
      confidence: result.confidence || 50,
      reasoning: result.reasoning || '',
    };
  } catch (error) {
    console.error('[AgentEngine] Content generation failed:', error);
    throw error;
  }
}

// ============================================
// Post Execution
// ============================================

/**
 * 生成したコンテンツを投稿
 */
export async function executePost(
  context: AgentContext,
  content: GeneratedContent,
  accountId: number
): Promise<PostResult> {
  const { agent } = context;

  // アカウント情報を取得
  const account = await db.query.accounts.findFirst({
    where: eq(accounts.id, accountId),
  });

  if (!account) {
    return { success: false, error: 'Account not found' };
  }

  if (!account.deviceId) {
    return { success: false, error: 'No device assigned to account' };
  }

  // デバイスが起動しているか確認し、停止中なら自動起動
  const deviceReady = await ensureDeviceReady(account.deviceId);
  if (!deviceReady.ready) {
    return { success: false, error: `デバイス起動失敗: ${deviceReady.message}` };
  }

  // プロジェクトのexecutionModeを取得
  let isFullAuto = false;
  if (agent.projectId) {
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, agent.projectId),
    });
    isFullAuto = project?.executionMode === 'fullAuto';
  }

  // フルオートモードまたはskipReviewの場合は即座に投稿
  const shouldAutoPost = isFullAuto || agent.skipReview;

  // 投稿レコードを作成
  const [post] = await db.insert(posts).values({
    accountId,
    agentId: agent.id,
    projectId: agent.projectId,
    platform: account.platform,
    content: content.content,
    hashtags: JSON.stringify(content.hashtags),
    status: shouldAutoPost ? 'scheduled' : 'pending_review',
  });

  const postId = post.insertId;

  // フルオートモードまたはレビュースキップの場合は即座に投稿
  if (shouldAutoPost) {
    try {
      // ハッシュタグを含めた投稿内容を構築
      const fullContent = content.content + '\n\n' + content.hashtags.map(h => `#${h}`).join(' ');
      
      const result = await postToSNS(
        account.platform,
        account.deviceId,
        fullContent
      );

      if (result.success) {
        await db.update(posts)
          .set({
            status: 'published',
            publishedAt: new Date(),
          })
          .where(eq(posts.id, postId));

        // パフォーマンスフィードバック用のレコードを作成
        await db.insert(postPerformanceFeedback).values({
          postId,
          agentId: agent.id,
          accountId,
        });

        return { success: true, postId };
      } else {
        await db.update(posts)
          .set({ status: 'failed' })
          .where(eq(posts.id, postId));

        return { success: false, postId, error: result.error };
      }
    } catch (error) {
      await db.update(posts)
        .set({ status: 'failed' })
        .where(eq(posts.id, postId));

      return { 
        success: false, 
        postId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // レビュー待ちの場合
  return { success: true, postId };
}

// ============================================
// Agent Execution
// ============================================

/**
 * エージェントの実行（コンテンツ生成→投稿）
 */
export async function runAgent(agentId: number, accountId?: number): Promise<{
  success: boolean;
  postId?: number;
  content?: GeneratedContent;
  error?: string;
}> {
  const startTime = Date.now();

  // 実行ログを開始
  const [logEntry] = await db.insert(agentExecutionLogs).values({
    agentId,
    accountId,
    executionType: 'content_generation',
    status: 'started',
  });
  const logId = logEntry.insertId;

  try {
    // コンテキストを構築
    const context = await buildAgentContext(agentId);
    if (!context) {
      await db.update(agentExecutionLogs)
        .set({ 
          status: 'failed',
          errorMessage: 'Agent not found',
          executionTimeMs: Date.now() - startTime,
        })
        .where(eq(agentExecutionLogs.id, logId));
      return { success: false, error: 'Agent not found' };
    }

    // 投稿先アカウントを決定
    let targetAccountId = accountId;
    if (!targetAccountId && context.accounts.length > 0) {
      // ランダムに選択（将来的には最適なアカウントを選択）
      targetAccountId = context.accounts[Math.floor(Math.random() * context.accounts.length)].id;
    }

    if (!targetAccountId) {
      await db.update(agentExecutionLogs)
        .set({ 
          status: 'failed',
          errorMessage: 'No account available',
          executionTimeMs: Date.now() - startTime,
        })
        .where(eq(agentExecutionLogs.id, logId));
      return { success: false, error: 'No account available' };
    }

    // コンテンツを生成（アカウント学習を考慮）
    const content = await generateContent(context, undefined, targetAccountId);

    // 投稿を実行
    const result = await executePost(context, content, targetAccountId);

    // ログを更新
    await db.update(agentExecutionLogs)
      .set({ 
        status: result.success ? 'success' : 'failed',
        accountId: targetAccountId,
        postId: result.postId,
        outputData: JSON.stringify(content),
        errorMessage: result.error,
        executionTimeMs: Date.now() - startTime,
      })
      .where(eq(agentExecutionLogs.id, logId));

    return {
      success: result.success,
      postId: result.postId,
      content,
      error: result.error,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await db.update(agentExecutionLogs)
      .set({ 
        status: 'failed',
        errorMessage,
        executionTimeMs: Date.now() - startTime,
      })
      .where(eq(agentExecutionLogs.id, logId));

    return { success: false, error: errorMessage };
  }
}

// ============================================
// Learning & Knowledge Extraction
// ============================================

/**
 * 投稿パフォーマンスを分析して知見を抽出
 */
export async function analyzePostPerformance(postId: number): Promise<void> {
  const post = await db.query.posts.findFirst({
    where: eq(posts.id, postId),
  });

  if (!post) {
    return;
  }

  // accountIdがない場合はscheduledPostsから取得を試みる
  let accountId = post.accountId;
  if (!accountId) {
    const scheduledPost = await db.query.scheduledPosts.findFirst({
      where: eq(posts.id, postId),
    });
    accountId = scheduledPost?.accountId || null;
  }

  // パフォーマンスデータを取得
  const analytics = await db.query.postAnalytics.findFirst({
    where: eq(postAnalytics.postId, postId),
    orderBy: desc(postAnalytics.recordedAt),
  });

  if (!analytics) {
    return;
  }

  // パフォーマンススコアを計算
  const engagementScore = Math.min(100, 
    (analytics.likesCount * 2 + analytics.commentsCount * 5 + analytics.sharesCount * 10) / 10
  );

  // フィードバックを更新
  await db.update(postPerformanceFeedback)
    .set({
      performanceScore: engagementScore,
      engagementScore: analytics.engagementRate,
      isProcessed: 1,
      processedAt: new Date().toISOString(),
    })
    .where(eq(postPerformanceFeedback.postId, postId));

  // 高パフォーマンスの場合、成功パターンとして保存
  if (engagementScore >= 70) {
    // エージェント知識に保存（agentIdがある場合のみ）
    if (post.agentId) {
      await db.insert(agentKnowledge).values({
        agentId: post.agentId,
        knowledgeType: 'success_pattern',
        title: `高エンゲージメント投稿パターン`,
        content: JSON.stringify({
          content: post.content,
          hashtags: post.hashtags,
          engagementScore,
          metrics: {
            likes: analytics.likesCount,
            comments: analytics.commentsCount,
            shares: analytics.sharesCount,
          },
        }),
        sourcePostId: postId,
        confidence: Math.min(100, engagementScore + 10),
        successRate: 100,
      });
    }

    // アカウント学習に保存
    if (accountId) {
      try {
        await learnFromPostPerformance(postId, accountId, {
          likes: analytics.likesCount,
          comments: analytics.commentsCount,
          shares: analytics.sharesCount,
          views: analytics.viewsCount || undefined,
        }, { successLikes: 50, failureLikes: 5 });
        console.log(`[AgentEngine] Account learning saved for account ${accountId}, post ${postId}`);
      } catch (error) {
        console.error(`[AgentEngine] Failed to save account learning:`, error);
      }
    }
  }

  // 低パフォーマンスの場合、失敗パターンとして保存
  if (engagementScore < 30) {
    // エージェント知識に保存（agentIdがある場合のみ）
    if (post.agentId) {
      await db.insert(agentKnowledge).values({
        agentId: post.agentId,
        knowledgeType: 'failure_pattern',
        title: `低エンゲージメント投稿パターン`,
        content: JSON.stringify({
          content: post.content,
          hashtags: post.hashtags,
          engagementScore,
          metrics: {
            likes: analytics.likesCount,
            comments: analytics.commentsCount,
            shares: analytics.sharesCount,
          },
        }),
        sourcePostId: postId,
        confidence: 70,
        successRate: 0,
      });
    }

    // アカウント学習に保存（失敗パターン）
    if (accountId) {
      try {
        await learnFromPostPerformance(postId, accountId, {
          likes: analytics.likesCount,
          comments: analytics.commentsCount,
          shares: analytics.sharesCount,
          views: analytics.viewsCount || undefined,
        }, { successLikes: 50, failureLikes: 5 });
        console.log(`[AgentEngine] Account failure learning saved for account ${accountId}, post ${postId}`);
      } catch (error) {
        console.error(`[AgentEngine] Failed to save account failure learning:`, error);
      }
    }
  }
}

/**
 * エージェントの知見を要約・統合
 */
export async function consolidateKnowledge(agentId: number): Promise<void> {
  // 成功パターンを取得
  const successPatterns = await db.query.agentKnowledge.findMany({
    where: and(
      eq(agentKnowledge.agentId, agentId),
      eq(agentKnowledge.knowledgeType, 'success_pattern'),
      eq(agentKnowledge.isActive, 1)
    ),
    orderBy: desc(agentKnowledge.confidence),
    limit: 20,
  });

  if (successPatterns.length < 5) {
    return; // 十分なデータがない
  }

  // AIで共通パターンを抽出
  const patternsData = successPatterns.map(p => {
    try {
      return JSON.parse(p.content);
    } catch {
      return { content: p.content };
    }
  });

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "あなたはSNSマーケティングの専門家です。成功した投稿パターンを分析し、共通する成功要因を抽出してください。"
        },
        {
          role: "user",
          content: `以下の成功した投稿パターンを分析し、共通する成功要因を3つ抽出してください。

${JSON.stringify(patternsData, null, 2)}

以下のJSON形式で回答してください:
{
  "factors": [
    {"title": "成功要因1", "description": "詳細説明", "confidence": 0-100},
    {"title": "成功要因2", "description": "詳細説明", "confidence": 0-100},
    {"title": "成功要因3", "description": "詳細説明", "confidence": 0-100}
  ]
}`
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "success_factors",
          strict: true,
          schema: {
            type: "object",
            properties: {
              factors: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    description: { type: "string" },
                    confidence: { type: "integer" },
                  },
                  required: ["title", "description", "confidence"],
                  additionalProperties: false,
                },
              },
            },
            required: ["factors"],
            additionalProperties: false,
          },
        },
      },
    });

    const messageContent = response.choices[0].message.content;
    const result = JSON.parse(typeof messageContent === 'string' ? messageContent : '{}');

    // 抽出した知見を保存
    for (const factor of result.factors || []) {
      await db.insert(agentKnowledge).values({
        agentId,
        knowledgeType: 'general',
        title: factor.title,
        content: factor.description,
        confidence: factor.confidence,
        successRate: 80,
      });
    }
  } catch (error) {
    console.error('[AgentEngine] Knowledge consolidation failed:', error);
  }
}

// ============================================
// Exports
// ============================================

export {
  AgentContext,
  GeneratedContent,
  PostResult,
};
