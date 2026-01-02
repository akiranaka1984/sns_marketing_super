import { relations } from "drizzle-orm/relations";
import { accounts, scheduledPosts, projects } from "./schema";

export const scheduledPostsRelations = relations(scheduledPosts, ({one}) => ({
	account: one(accounts, {
		fields: [scheduledPosts.accountId],
		references: [accounts.id]
	}),
	project: one(projects, {
		fields: [scheduledPosts.projectId],
		references: [projects.id]
	}),
}));

export const accountsRelations = relations(accounts, ({many}) => ({
	scheduledPosts: many(scheduledPosts),
}));

export const projectsRelations = relations(projects, ({many}) => ({
	scheduledPosts: many(scheduledPosts),
}));