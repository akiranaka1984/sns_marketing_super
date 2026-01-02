import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { db } from "./db";
import { postUrls, interactions, accounts } from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { executeLike, executeAiComment } from "./utils/python-runner";
import { getLatestTweets, buildTweetUrl } from "./x-api-service";

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
      username: z.string(),
      postUrl: z.string(),
      postContent: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const [result] = await db.insert(postUrls).values({
        projectId: input.projectId,
        accountId: input.accountId,
        deviceId: input.deviceId,
        username: input.username,
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
        console.log("[fetchLatestPosts] Starting fetch with input:", input);
        
        // アカウント情報を取得してxHandleを使用
        const account = await db.query.accounts.findFirst({
          where: eq(accounts.id, input.accountId),
        });

        console.log("[fetchLatestPosts] Account found:", account?.id, account?.xHandle);

        if (!account) {
          console.error("[fetchLatestPosts] Account not found for id", input.accountId);
          return { success: false, added: 0, total: 0, error: "アカウントが見つかりません" };
        }

        if (!account.xHandle) {
          console.error("[fetchLatestPosts] X Handle not found for account", input.accountId);
          return { success: false, added: 0, total: 0, error: "X Handleが設定されていません" };
        }

        console.log("[fetchLatestPosts] Fetching tweets for", account.xHandle);
        const tweets = await getLatestTweets(account.xHandle, input.count);
        console.log("[fetchLatestPosts] Tweets found:", tweets.length, "tweets");
        
        if (!tweets || tweets.length === 0) {
          console.log("[fetchLatestPosts] No tweets found for", account.xHandle);
          return { success: true, added: 0, total: 0 };
        }
        
        let added = 0;
        for (const tweet of tweets) {
          const postUrl = buildTweetUrl(account.xHandle, tweet.id);
          console.log("[fetchLatestPosts] Processing tweet:", tweet.id, postUrl);
          
          // 既に存在するかチェック
          const existing = await db.query.postUrls.findFirst({
            where: eq(postUrls.postUrl, postUrl),
          });

          if (!existing) {
            console.log("[fetchLatestPosts] Inserting new post URL:", postUrl);
            await db.insert(postUrls).values({
              projectId: input.projectId,
              accountId: input.accountId,
              deviceId: input.deviceId,
              username: input.username,
              postUrl,
              postContent: tweet.text,
            });
            added++;
          } else {
            console.log("[fetchLatestPosts] Post URL already exists:", postUrl);
          }
        }

        console.log("[fetchLatestPosts] Completed. Added:", added, "Total:", tweets.length);
        return { success: true, added, total: tweets.length };
      } catch (error) {
        console.error("[fetchLatestPosts] Error:", error);
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
      const apiKey = process.env.DUOPLUS_API_KEY;
      if (!apiKey) {
        return { success: false, error: "DUOPLUS_API_KEYが設定されていません" };
      }
      const result = await executeLike(apiKey, input.fromDeviceId, postUrl.postUrl);

      // 結果を更新
      await db.update(interactions)
        .set({
          status: result.success ? "completed" : "failed",
          executedAt: new Date(),
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
      const apiKey = process.env.DUOPLUS_API_KEY;
      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!apiKey || !openaiApiKey) {
        return { success: false, error: "API KEYが設定されていません" };
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
          executedAt: new Date(),
          commentContent: result.comment || null,
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
