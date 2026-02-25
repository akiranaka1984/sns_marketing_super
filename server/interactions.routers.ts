import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { db } from "./db";
import { postUrls, interactions, accounts } from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { executeLike, executeAiComment, executeRetweet, executeFollow } from "./utils/python-runner";
import { getLatestTweets, buildTweetUrl } from "./x-api-service";
import { createLogger } from "./utils/logger";

const logger = createLogger("interactions-router");

export const interactionsRouter = router({
  // プロジェクトの投稿URL一覧を取得
  getPostUrls: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      const urls = await db
        .select()
        .from(postUrls)
        .where(eq(postUrls.projectId, input.projectId))
        .orderBy(desc(postUrls.createdAt));
      return urls;
    }),

  // 投稿URLを手動追加
  addPostUrl: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      accountId: z.number(),
      deviceId: z.string(),
      username: z.string().optional(),  // Optional - will extract from URL if not provided
      postUrl: z.string(),
      postContent: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      // Extract X handle from URL (https://x.com/username/status/...)
      let xHandle = input.username;
      const urlMatch = input.postUrl.match(/x\.com\/([^\/]+)\/status/);
      if (urlMatch) {
        xHandle = urlMatch[1];
      }

      const [result] = await db.insert(postUrls).values({
        projectId: input.projectId,
        accountId: input.accountId,
        deviceId: input.deviceId,
        username: xHandle || "unknown",
        postUrl: input.postUrl,
        postContent: input.postContent || "",
      });
      return { success: true, id: result.insertId };
    }),

  // X APIから最新投稿を取得して追加
  fetchLatestPosts: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      accountId: z.number(),
      deviceId: z.string(),
      username: z.string(),
      count: z.number().default(5),
    }))
    .mutation(async ({ input }) => {
      try {
        logger.info({ input }, "Starting fetch latest posts");

        // アカウント情報を取得してxHandleを使用
        const account = await db.query.accounts.findFirst({
          where: eq(accounts.id, input.accountId),
        });

        logger.info({ accountId: account?.id, xHandle: account?.xHandle }, "Account found");

        if (!account) {
          logger.error({ accountId: input.accountId }, "Account not found");
          return { success: false, added: 0, total: 0, error: "アカウントが見つかりません" };
        }

        if (!account.xHandle) {
          logger.error({ accountId: input.accountId }, "X Handle not found for account");
          return { success: false, added: 0, total: 0, error: "X Handleが設定されていません" };
        }

        logger.info({ xHandle: account.xHandle }, "Fetching tweets");
        const tweets = await getLatestTweets(account.xHandle, input.count);
        logger.info({ count: tweets.length }, "Tweets found");
        
        if (!tweets || tweets.length === 0) {
          logger.info({ xHandle: account.xHandle }, "No tweets found");
          return { success: true, added: 0, total: 0 };
        }
        
        let added = 0;
        for (const tweet of tweets) {
          const postUrl = buildTweetUrl(account.xHandle, tweet.id);
          logger.info({ tweetId: tweet.id, postUrl }, "Processing tweet");

          // 既に存在するかチェック
          const existing = await db.query.postUrls.findFirst({
            where: eq(postUrls.postUrl, postUrl),
          });

          if (!existing) {
            logger.info({ postUrl }, "Inserting new post URL");
            await db.insert(postUrls).values({
              projectId: input.projectId,
              accountId: input.accountId,
              deviceId: input.deviceId,
              username: account.xHandle,  // Use X handle instead of login username
              postUrl,
              postContent: tweet.text,
            });
            added++;
          } else {
            logger.info({ postUrl }, "Post URL already exists");
          }
        }

        logger.info({ added, total: tweets.length }, "Fetch latest posts completed");
        return { success: true, added, total: tweets.length };
      } catch (error) {
        logger.error({ err: error }, "Error fetching latest posts");
        return { success: false, added: 0, total: 0, error: error instanceof Error ? error.message : "不明なエラーが発生しました" };
      }
    }),

  // いいねを実行
  executeLike: protectedProcedure
    .input(z.object({
      postUrlId: z.number(),
      fromAccountId: z.number(),
      fromDeviceId: z.string(),
    }))
    .mutation(async ({ input }) => {
      // 投稿URLを取得
      const postUrl = await db.query.postUrls.findFirst({
        where: eq(postUrls.id, input.postUrlId),
      });

      if (!postUrl) {
        return { success: false, error: "投稿URLが見つかりません" };
      }

      // タスクを作成
      const [task] = await db.insert(interactions).values({
        postUrlId: input.postUrlId,
        fromAccountId: input.fromAccountId,
        fromDeviceId: input.fromDeviceId,
        interactionType: "like",
        status: "processing",
      });

      // いいねを実行
      const apiKey = process.env.AUTOMATION_API_KEY || '';
      if (!apiKey) {
        return { success: false, error: "AUTOMATION_API_KEYが設定されていません。" };
      }
      const result = await executeLike(apiKey, input.fromDeviceId, postUrl.postUrl);

      // 結果を更新
      await db.update(interactions)
        .set({
          status: result.success ? "completed" : "failed",
          executedAt: new Date().toISOString(),
          errorMessage: result.error || null,
        })
        .where(eq(interactions.id, task.insertId));

      return result;
    }),

  // コメントを実行
  executeComment: protectedProcedure
    .input(z.object({
      postUrlId: z.number(),
      fromAccountId: z.number(),
      fromDeviceId: z.string(),
      persona: z.string().default("フレンドリーなユーザー"),
    }))
    .mutation(async ({ input }) => {
      // 投稿URLを取得
      const postUrl = await db.query.postUrls.findFirst({
        where: eq(postUrls.id, input.postUrlId),
      });

      if (!postUrl) {
        return { success: false, error: "投稿URLが見つかりません" };
      }

      // タスクを作成
      const [task] = await db.insert(interactions).values({
        postUrlId: input.postUrlId,
        fromAccountId: input.fromAccountId,
        fromDeviceId: input.fromDeviceId,
        interactionType: "comment",
        status: "processing",
      });

      // コメントを実行
      const apiKey = process.env.AUTOMATION_API_KEY || '';
      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!apiKey || !openaiApiKey) {
        return { success: false, error: "API KEYが設定されていません。設定画面で設定後、サーバーを再起動してください。" };
      }
      const result = await executeAiComment(
        apiKey,
        input.fromDeviceId,
        postUrl.postUrl,
        openaiApiKey,
        input.persona
      );

      // 結果を更新
      await db.update(interactions)
        .set({
          status: result.success ? "completed" : "failed",
          executedAt: new Date().toISOString(),
          commentContent: result.comment || null,
          errorMessage: result.error || null,
        })
        .where(eq(interactions.id, task.insertId));

      return result;
    }),

  // リツイートを実行
  executeRetweet: protectedProcedure
    .input(z.object({
      postUrlId: z.number(),
      fromAccountId: z.number(),
      fromDeviceId: z.string(),
    }))
    .mutation(async ({ input }) => {
      // 投稿URLを取得
      const postUrl = await db.query.postUrls.findFirst({
        where: eq(postUrls.id, input.postUrlId),
      });

      if (!postUrl) {
        return { success: false, error: "投稿URLが見つかりません" };
      }

      // タスクを作成
      const [task] = await db.insert(interactions).values({
        postUrlId: input.postUrlId,
        fromAccountId: input.fromAccountId,
        fromDeviceId: input.fromDeviceId,
        interactionType: "retweet",
        status: "processing",
      });

      // リツイートを実行
      const apiKey = process.env.AUTOMATION_API_KEY || '';
      if (!apiKey) {
        return { success: false, error: "AUTOMATION_API_KEYが設定されていません" };
      }
      logger.info({ postUrlId: input.postUrlId, url: postUrl.postUrl, username: postUrl.username }, "Executing retweet");
      const result = await executeRetweet(apiKey, input.fromDeviceId, postUrl.postUrl);

      // 結果を更新
      await db.update(interactions)
        .set({
          status: result.success ? "completed" : "failed",
          executedAt: new Date().toISOString(),
          errorMessage: result.error || null,
        })
        .where(eq(interactions.id, task.insertId));

      // URLをレスポンスに追加（デバッグ用）
      return { ...result, usedUrl: postUrl.postUrl };
    }),

  // フォローを実行
  executeFollow: protectedProcedure
    .input(z.object({
      targetUsername: z.string(),
      fromAccountId: z.number(),
      fromDeviceId: z.string(),
    }))
    .mutation(async ({ input }) => {
      // タスクを作成
      const [task] = await db.insert(interactions).values({
        postUrlId: null,
        fromAccountId: input.fromAccountId,
        fromDeviceId: input.fromDeviceId,
        interactionType: "follow",
        targetUsername: input.targetUsername,
        status: "processing",
      });

      // フォローを実行
      const apiKey = process.env.AUTOMATION_API_KEY || '';
      if (!apiKey) {
        return { success: false, error: "AUTOMATION_API_KEYが設定されていません" };
      }
      const result = await executeFollow(apiKey, input.fromDeviceId, input.targetUsername);

      // 結果を更新
      await db.update(interactions)
        .set({
          status: result.success ? "completed" : "failed",
          executedAt: new Date().toISOString(),
          errorMessage: result.error || null,
        })
        .where(eq(interactions.id, task.insertId));

      return result;
    }),

  // 相互連携履歴を取得
  getHistory: protectedProcedure
    .input(z.object({
      postUrlId: z.number().optional(),
      projectId: z.number().optional(),
    }))
    .query(async ({ input }) => {
      if (input.postUrlId) {
        return db
          .select()
          .from(interactions)
          .where(eq(interactions.postUrlId, input.postUrlId))
          .orderBy(desc(interactions.createdAt));
      }

      if (input.projectId) {
        // プロジェクト内の全投稿の履歴を取得
        const projectPostUrls = await db
          .select({ id: postUrls.id })
          .from(postUrls)
          .where(eq(postUrls.projectId, input.projectId));

        const postUrlIds = projectPostUrls.map(p => p.id);
        if (postUrlIds.length === 0) return [];

        return db
          .select()
          .from(interactions)
          .orderBy(desc(interactions.createdAt))
          .limit(50);
      }

      return [];
    }),

  // プロジェクトのアカウント一覧（デバイス付き）を取得
  getProjectAccounts: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      // プロジェクトに紐付けられたアカウントを取得（userIdでフィルタリング）
      const allAccounts = await db
        .select()
        .from(accounts)
        .where(
          and(
            eq(accounts.userId, ctx.user.id),
            eq(accounts.platform, "twitter")
          )
        );
      return allAccounts.filter(a => a.deviceId);
    }),
});
