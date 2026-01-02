import { router, protectedProcedure } from '../_core/trpc';
import { z } from 'zod';
import { executeLike, executeAiComment } from '../utils/python-runner';
import { db } from '../db';
import { automationTasks } from '../../drizzle/schema/automation_tasks';
import { eq } from 'drizzle-orm';

export const automationRouter = router({
  // いいね実行
  like: protectedProcedure
    .input(z.object({
      postUrl: z.string().url(),
      deviceId: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const apiKey = process.env.DUOPLUS_API_KEY!;
      
      // タスク記録
      const task = await db.insert(automationTasks).values({
        postUrl: input.postUrl,
        action: 'like',
        status: 'pending',
        deviceId: input.deviceId,
      });
      
      const taskId = Number(task.insertId);
      
      // 実行
      const result = await executeLike(apiKey, input.deviceId, input.postUrl);
      
      // 結果更新
      await db.update(automationTasks)
        .set({
          status: result.success ? 'success' : 'failed',
          result: result as any,
          executedAt: new Date(),
        })
        .where(eq(automationTasks.id, taskId));
      
      return result;
    }),

  // AIコメント実行
  aiComment: protectedProcedure
    .input(z.object({
      postUrl: z.string().url(),
      deviceId: z.string(),
      persona: z.string().default('20代男性、AIとマーケティングに興味がある'),
    }))
    .mutation(async ({ input, ctx }) => {
      const apiKey = process.env.DUOPLUS_API_KEY!;
      const openaiApiKey = process.env.OPENAI_API_KEY!;
      
      // タスク記録
      const task = await db.insert(automationTasks).values({
        postUrl: input.postUrl,
        action: 'comment',
        status: 'pending',
        deviceId: input.deviceId,
        persona: input.persona,
      });
      
      const taskId = Number(task.insertId);
      
      // 実行
      const result = await executeAiComment(
        apiKey,
        input.deviceId,
        input.postUrl,
        openaiApiKey,
        input.persona
      );
      
      // 結果更新
      await db.update(automationTasks)
        .set({
          status: result.success ? 'success' : 'failed',
          generatedComment: result.comment,
          result: result as any,
          executedAt: new Date(),
        })
        .where(eq(automationTasks.id, taskId));
      
      return result;
    }),

  // 一括処理（クロスアカウント連携用）
  batchInteraction: protectedProcedure
    .input(z.object({
      postUrl: z.string().url(),
      interactions: z.array(z.object({
        deviceId: z.string(),
        action: z.enum(['like', 'comment']),
        persona: z.string().optional(),
        delayMinutes: z.number().min(0).max(60).default(0),
      })),
    }))
    .mutation(async ({ input }) => {
      const results = [];
      
      for (const interaction of input.interactions) {
        // ランダム遅延（5〜60分）
        if (interaction.delayMinutes > 0) {
          const delayMs = interaction.delayMinutes * 60 * 1000;
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        
        if (interaction.action === 'like') {
          const result = await executeLike(
            process.env.DUOPLUS_API_KEY!,
            interaction.deviceId,
            input.postUrl
          );
          results.push({ deviceId: interaction.deviceId, action: 'like', result });
        } else {
          const result = await executeAiComment(
            process.env.DUOPLUS_API_KEY!,
            interaction.deviceId,
            input.postUrl,
            process.env.OPENAI_API_KEY!,
            interaction.persona || '20代男性、AIとマーケティングに興味がある'
          );
          results.push({ deviceId: interaction.deviceId, action: 'comment', result });
        }
      }
      
      return results;
    }),
});
