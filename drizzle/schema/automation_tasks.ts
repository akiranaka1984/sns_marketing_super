import { mysqlTable, serial, text, timestamp, json } from 'drizzle-orm/mysql-core';

export const automationTasks = mysqlTable('automation_tasks', {
  id: serial('id').primaryKey(),
  postUrl: text('post_url').notNull(),
  action: text('action').notNull(), // 'like' | 'comment'
  status: text('status').notNull().default('pending'), // 'pending' | 'success' | 'failed'
  deviceId: text('device_id').notNull(),
  persona: text('persona'),
  generatedComment: text('generated_comment'),
  result: json('result'),
  executedAt: timestamp('executed_at'),
  createdAt: timestamp('created_at').defaultNow(),
});
