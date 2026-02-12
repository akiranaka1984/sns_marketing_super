import { mysqlTable, mysqlSchema, AnyMySqlColumn, int, mysqlEnum, varchar, text, timestamp, index, foreignKey, tinyint, decimal } from "drizzle-orm/mysql-core"
import { sql } from "drizzle-orm"

export const abTestLearnings = mysqlTable("ab_test_learnings", {
	id: int().autoincrement().notNull().primaryKey(),
	testId: int().notNull(),
	agentId: int().notNull(),
	learningType: mysqlEnum(['tone_preference','length_preference','emoji_preference','hashtag_preference','media_preference','timing_preference','general']).notNull(),
	title: varchar({ length: 255 }).notNull(),
	insight: text().notNull(),
	winningValue: varchar({ length: 255 }),
	losingValue: varchar({ length: 255 }),
	performanceDiff: int(),
	confidence: int().default(50).notNull(),
	isApplied: tinyint().default(0).notNull(),
	appliedAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const abTestVariations = mysqlTable("ab_test_variations", {
	id: int().autoincrement().notNull().primaryKey(),
	testId: int().notNull(),
	variationName: varchar({ length: 50 }).notNull(),
	content: text().notNull(),
	hashtags: text(),
	mediaUrls: text(),
	tone: varchar({ length: 100 }),
	contentLength: mysqlEnum(['short','medium','long']).default('medium').notNull(),
	emojiUsage: mysqlEnum(['none','minimal','moderate','heavy']).default('minimal').notNull(),
	hashtagCount: int().default(0).notNull(),
	hasMedia: tinyint().default(0).notNull(),
	postId: int(),
	likesCount: int().default(0).notNull(),
	commentsCount: int().default(0).notNull(),
	sharesCount: int().default(0).notNull(),
	viewsCount: int().default(0).notNull(),
	engagementRate: int().default(0).notNull(),
	performanceScore: int().default(0).notNull(),
	isWinner: tinyint().default(0).notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const abTests = mysqlTable("ab_tests", {
	id: int().autoincrement().notNull().primaryKey(),
	agentId: int().notNull(),
	name: varchar({ length: 255 }).notNull(),
	description: text(),
	theme: text().notNull(),
	status: mysqlEnum(['draft','running','completed','cancelled']).default('draft').notNull(),
	variationCount: int().default(2).notNull(),
	testDurationHours: int().default(48).notNull(),
	minEngagementThreshold: int().default(10).notNull(),
	winnerId: int(),
	winnerDeterminedAt: timestamp({ mode: 'string' }),
	confidenceLevel: int(),
	startedAt: timestamp({ mode: 'string' }),
	completedAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const accounts = mysqlTable("accounts", {
	id: int().autoincrement().notNull().primaryKey(),
	userId: int().notNull(),
	platform: mysqlEnum(['twitter','tiktok','instagram','facebook']).notNull(),
	username: varchar({ length: 255 }).notNull(),
	password: text().notNull(),
	status: mysqlEnum(['pending','active','suspended','failed']).default('active').notNull(),
	deviceId: varchar({ length: 255 }),
	lastLoginAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	proxyId: int(),
	xHandle: varchar({ length: 255 }),
	persona: varchar({ length: 200 }),
	// Persona settings (account-level)
	personaRole: varchar({ length: 255 }), // e.g., "specialist", "casual_user", "reviewer"
	personaTone: mysqlEnum(['formal', 'casual', 'friendly', 'professional', 'humorous']),
	personaCharacteristics: text(), // Free text describing account personality
	// X (Twitter) plan type - determines character limit
	// free: 280 chars, premium: 280 chars (articles separate), premium_plus: 25000 chars
	planType: mysqlEnum(['free', 'premium', 'premium_plus']).default('free').notNull(),
	// Posting method: playwright (browser automation)
	postingMethod: mysqlEnum(['duoplus', 'playwright']).default('playwright').notNull(),
	// Playwright session status
	sessionStatus: mysqlEnum(['active', 'expired', 'needs_login']).default('needs_login').notNull(),
	// Growth system fields - account leveling and experience points
	experiencePoints: int().default(0).notNull(),
	level: int().default(1).notNull(),
	totalLearningsCount: int().default(0).notNull(),
},
(table) => [
	index("username_platform_idx").on(table.username, table.platform),
]);

// Account relationships (intimacy/closeness between accounts)
export const accountRelationships = mysqlTable("account_relationships", {
	id: int().autoincrement().notNull().primaryKey(),
	projectId: int().notNull(), // Relationships are project-specific
	fromAccountId: int().notNull(), // The account that has the relationship
	toAccountId: int().notNull(), // The target account
	intimacyLevel: int().default(50).notNull(), // 0-100, higher = closer relationship
	relationshipType: mysqlEnum(['friend', 'acquaintance', 'follower', 'colleague', 'rival', 'stranger']).default('acquaintance').notNull(),
	interactionProbability: int().default(70).notNull(), // 0-100, probability of interacting
	preferredReactionTypes: text(), // JSON array: ['like', 'comment', 'retweet']
	commentStyle: mysqlEnum(['supportive', 'curious', 'playful', 'professional', 'neutral']).default('neutral'),
	notes: text(), // Optional notes about the relationship
	isActive: tinyint().default(1).notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const agentAccounts = mysqlTable("agent_accounts", {
	id: int().autoincrement().notNull().primaryKey(),
	agentId: int().notNull(),
	accountId: int().notNull(),
	isActive: tinyint().default(1).notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const agentExecutionLogs = mysqlTable("agent_execution_logs", {
	id: int().autoincrement().notNull().primaryKey(),
	agentId: int().notNull(),
	accountId: int(),
	executionType: mysqlEnum(['content_generation','post_execution','learning','analysis','optimization','scheduled_post_generation']).notNull(),
	status: mysqlEnum(['started','success','failed','skipped']).notNull(),
	inputData: text(),
	outputData: text(),
	postId: int(),
	knowledgeGained: text(),
	errorMessage: text(),
	executionTimeMs: int(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const agentKnowledge = mysqlTable("agent_knowledge", {
	id: int().autoincrement().notNull().primaryKey(),
	agentId: int().notNull(),
	knowledgeType: mysqlEnum(['success_pattern','failure_pattern','content_template','hashtag_strategy','timing_insight','audience_insight','engagement_tactic','general']).notNull(),
	title: varchar({ length: 255 }).notNull(),
	content: text().notNull(),
	sourcePostId: int(),
	confidence: int().default(50).notNull(),
	usageCount: int().default(0).notNull(),
	successRate: int().default(0).notNull(),
	isActive: tinyint().default(1).notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const agentRules = mysqlTable("agent_rules", {
	id: int().autoincrement().notNull().primaryKey(),
	agentId: int().notNull(),
	ruleType: mysqlEnum(['forbidden_word','required_element','content_limit','posting_limit','time_restriction','platform_specific','tone_guideline','custom']).notNull(),
	ruleName: varchar({ length: 255 }).notNull(),
	ruleValue: text().notNull(),
	priority: int().default(50).notNull(),
	isActive: tinyint().default(1).notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const agentSchedules = mysqlTable("agent_schedules", {
	id: int().autoincrement().notNull().primaryKey(),
	agentId: int().notNull(),
	accountId: int().notNull(),
	scheduleType: mysqlEnum(['daily','weekly','custom']).default('daily').notNull(),
	timeSlot: varchar({ length: 10 }).notNull(),
	dayOfWeek: int(),
	timezone: varchar({ length: 50 }).default('Asia/Tokyo').notNull(),
	isActive: tinyint().default(1).notNull(),
	lastExecutedAt: timestamp({ mode: 'string' }),
	nextExecutionAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const agents = mysqlTable("agents", {
	id: int().autoincrement().notNull().primaryKey(),
	userId: int().notNull(),
	projectId: int(),
	name: varchar({ length: 255 }).notNull(),
	description: text(),
	theme: text().notNull(),
	tone: mysqlEnum(['formal','casual','friendly','professional','humorous']).default('casual').notNull(),
	style: mysqlEnum(['ranking','trivia','story','tutorial','news','review']).default('story').notNull(),
	targetAudience: text(),
	contentFormat: text(),
	isActive: tinyint().default(1).notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	postingFrequency: mysqlEnum(['daily','twice_daily','three_times_daily','weekly','custom']).default('daily'),
	postingTimeSlots: text(),
	skipReview: tinyint().default(0).notNull(),
	autoOptimizationSettings: text(), // JSON: { enabled, minEngagementRateThreshold, checkIntervalHours, etc. }
	contentDiversityConfig: text(), // JSON: { types: [{type, weight}], maxConsecutiveSameType: 2, rotation: [...] }
});

export const aiOptimizations = mysqlTable("ai_optimizations", {
	id: int().autoincrement().notNull().primaryKey(),
	userId: int().notNull(),
	projectId: int(),
	agentId: int(),
	type: mysqlEnum(['tone_adjustment','style_adjustment','content_strategy','timing_optimization']).notNull(),
	beforeParams: text(),
	afterParams: text(),
	performanceImprovement: int(),
	insights: text(),
	status: mysqlEnum(['pending','applied','reverted']).default('pending').notNull(),
	appliedAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const alertHistory = mysqlTable("alert_history", {
	id: int().autoincrement().notNull().primaryKey(),
	userId: int().notNull(),
	alertType: mysqlEnum(['device_stopped','device_error','device_offline','consecutive_failures','posting_failed','engagement_drop','account_issue']).notNull(),
	deviceId: varchar({ length: 100 }),
	accountId: int(),
	postId: int(),
	title: varchar({ length: 255 }).notNull(),
	message: text().notNull(),
	severity: mysqlEnum(['low','medium','high','critical']).default('medium').notNull(),
	status: mysqlEnum(['triggered','acknowledged','resolved']).default('triggered').notNull(),
	acknowledgedAt: timestamp({ mode: 'string' }),
	resolvedAt: timestamp({ mode: 'string' }),
	notificationSent: tinyint().default(0).notNull(),
	notificationSentAt: timestamp({ mode: 'string' }),
	triggeredAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const alertSettings = mysqlTable("alert_settings", {
	id: int().autoincrement().notNull().primaryKey(),
	userId: int().notNull(),
	alertType: mysqlEnum(['device_stopped','device_error','device_offline','consecutive_failures','posting_failed','engagement_drop','account_issue']).notNull(),
	isEnabled: tinyint().default(1).notNull(),
	threshold: int().default(1).notNull(),
	cooldownMinutes: int().default(60).notNull(),
	notifyOwner: tinyint().default(1).notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const analytics = mysqlTable("analytics", {
	id: int().autoincrement().notNull().primaryKey(),
	accountId: int().notNull(),
	followersCount: int().default(0).notNull(),
	followingCount: int().default(0).notNull(),
	postsCount: int().default(0).notNull(),
	engagementRate: int().default(0).notNull(),
	likesCount: int().default(0).notNull(),
	commentsCount: int().default(0).notNull(),
	sharesCount: int().default(0).notNull(),
	recordedAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const autoResponses = mysqlTable("auto_responses", {
	id: int().autoincrement().notNull().primaryKey(),
	freezeDetectionId: int().notNull(),
	accountId: int().notNull(),
	actionType: mysqlEnum(['change_ip','switch_device','pause_account','retry']).notNull(),
	oldValue: text(),
	newValue: text(),
	status: mysqlEnum(['pending','success','failed']).default('pending').notNull(),
	errorMessage: text(),
	executedAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const collectedContents = mysqlTable("collected_contents", {
	id: int().autoincrement().notNull().primaryKey(),
	userId: int().notNull(),
	projectId: int(),
	platform: mysqlEnum(['twitter','tiktok','instagram','facebook','youtube','other']).notNull(),
	sourceUrl: text().notNull(),
	author: varchar({ length: 255 }),
	content: text().notNull(),
	mediaUrls: text(),
	hashtags: text(),
	likes: int().default(0),
	comments: int().default(0),
	shares: int().default(0),
	views: int().default(0),
	collectedAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const collectionSchedules = mysqlTable("collection_schedules", {
	id: int().autoincrement().notNull().primaryKey(),
	userId: int().notNull(),
	projectId: int(),
	platform: mysqlEnum(['twitter','tiktok','instagram','facebook','youtube','other']).notNull(),
	searchKeywords: text(),
	searchHashtags: text(),
	searchAccounts: text(),
	frequency: mysqlEnum(['hourly','daily','weekly']).default('daily').notNull(),
	maxItemsPerRun: int().default(50),
	isActive: tinyint().default(1).notNull(),
	lastRunAt: timestamp({ mode: 'string' }),
	nextRunAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const contentReviews = mysqlTable("content_reviews", {
	id: int().autoincrement().notNull().primaryKey(),
	userId: int().notNull(),
	projectId: int(),
	contentRewriteId: int(),
	reviewerId: int().notNull(),
	status: mysqlEnum(['pending','approved','rejected','revision_requested']).default('pending').notNull(),
	feedback: text(),
	reviewedAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const contentRewrites = mysqlTable("content_rewrites", {
	id: int().autoincrement().notNull().primaryKey(),
	userId: int().notNull(),
	projectId: int(),
	collectedContentId: int(),
	agentId: int().notNull(),
	originalContent: text().notNull(),
	rewrittenContent: text().notNull(),
	rewritePrompt: text(),
	status: mysqlEnum(['pending','completed','failed']).default('pending').notNull(),
	errorMessage: text(),
	rewrittenAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const coordinateLearningData = mysqlTable("coordinate_learning_data", {
	id: int().autoincrement().notNull().primaryKey(),
	deviceId: varchar({ length: 100 }).notNull(),
	resolution: varchar({ length: 50 }).notNull(),
	element: varchar({ length: 50 }).notNull(),
	x: int().notNull(),
	y: int().notNull(),
	source: varchar({ length: 20 }).notNull(), // 'learned', 'dynamic', 'default'
	success: int().notNull(),
	screenshotUrl: text(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const deviceMonitoringStatus = mysqlTable("device_monitoring_status", {
	id: int().autoincrement().notNull().primaryKey(),
	deviceId: varchar({ length: 100 }).notNull(),
	deviceName: varchar({ length: 255 }),
	currentStatus: mysqlEnum(['running','stopped','error','unknown']).default('unknown').notNull(),
	lastKnownStatus: mysqlEnum(['running','stopped','error','unknown']),
	consecutiveErrors: int().default(0).notNull(),
	lastSuccessfulCheck: timestamp({ mode: 'string' }),
	lastErrorAt: timestamp({ mode: 'string' }),
	lastErrorMessage: text(),
	isMonitored: tinyint().default(1).notNull(),
	isPaused: tinyint().default(0).notNull(),
	lastCheckedAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("device_monitoring_status_deviceId_unique").on(table.deviceId),
]);

export const deviceStatusHistory = mysqlTable("device_status_history", {
	id: int().autoincrement().notNull().primaryKey(),
	deviceId: varchar({ length: 100 }).notNull(),
	deviceName: varchar({ length: 255 }),
	status: mysqlEnum(['running','stopped','error','unknown']).notNull(),
	previousStatus: mysqlEnum(['running','stopped','error','unknown']),
	ipAddress: varchar({ length: 50 }),
	osVersion: varchar({ length: 100 }),
	errorMessage: text(),
	errorCode: varchar({ length: 50 }),
	detectedAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const devices = mysqlTable("devices", {
	id: int().autoincrement().notNull().primaryKey(),
	deviceId: varchar({ length: 255 }).notNull(),
	deviceName: varchar({ length: 255 }),
	status: mysqlEnum(['available','busy','offline']).default('available').notNull(),
	proxyIp: varchar({ length: 255 }),
	lastUsedAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("devices_deviceId_unique").on(table.deviceId),
]);

export const engagementLogs = mysqlTable("engagement_logs", {
	id: int().autoincrement().notNull().primaryKey(),
	taskId: int().notNull(),
	accountId: int().notNull(),
	taskType: mysqlEnum(['like','follow','comment','unfollow']).notNull(),
	targetUser: varchar({ length: 255 }),
	targetPost: varchar({ length: 255 }),
	status: mysqlEnum(['success','failed']).notNull(),
	errorMessage: text(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const engagementTasks = mysqlTable("engagement_tasks", {
	id: int().autoincrement().notNull().primaryKey(),
	projectId: int().notNull(),
	accountId: int().notNull(),
	taskType: mysqlEnum(['like','follow','comment','unfollow']).notNull(),
	targetUser: varchar({ length: 255 }),
	targetPost: varchar({ length: 255 }),
	commentText: text(),
	frequency: int().default(10).notNull(),
	isActive: tinyint().default(1).notNull(),
	lastExecutedAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const freezeDetections = mysqlTable("freeze_detections", {
	id: int().autoincrement().notNull().primaryKey(),
	accountId: int().notNull(),
	deviceId: varchar({ length: 255 }),
	freezeType: mysqlEnum(['ip_block','device_block','account_freeze','unknown']).notNull(),
	confidence: int().default(0).notNull(),
	errorMessage: text(),
	detectionDetails: text(),
	status: mysqlEnum(['detected','handling','resolved','failed']).default('detected').notNull(),
	resolvedAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const interactionSettings = mysqlTable("interaction_settings", {
	id: int().autoincrement().notNull().primaryKey(),
	projectId: int().notNull(),
	isEnabled: tinyint().default(0),
	likeEnabled: tinyint().default(1),
	likeDelayMinMin: int().default(5),
	likeDelayMinMax: int().default(30),
	commentEnabled: tinyint().default(1),
	commentDelayMinMin: int().default(10),
	commentDelayMinMax: int().default(60),
	defaultPersona: varchar({ length: 200 }).default('フレンドリーなユーザー'),
	retweetEnabled: tinyint().default(0),
	retweetDelayMinMin: int().default(15),
	retweetDelayMinMax: int().default(90),
	followEnabled: tinyint().default(0),
	followDelayMinMin: int().default(30),
	followDelayMinMax: int().default(180),
	followTargetUsers: text(), // JSON array: ["@user1", "@user2"] for external targets
	reactionProbability: int().default(100), // 反応確率（0-100%）
	maxReactingAccounts: int().default(0), // 最大反応アカウント数（0=無制限）
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("interaction_settings_projectId_unique").on(table.projectId),
]);

export const interactions = mysqlTable("interactions", {
	id: int().autoincrement().notNull().primaryKey(),
	postUrlId: int(), // Nullable for follow tasks
	fromAccountId: int().notNull(),
	fromDeviceId: varchar({ length: 50 }).notNull(),
	interactionType: varchar({ length: 20 }).notNull(),
	targetUsername: varchar({ length: 100 }), // For follow tasks
	commentContent: text(),
	status: varchar({ length: 20 }).default('pending'),
	scheduledAt: timestamp({ mode: 'string' }),
	executedAt: timestamp({ mode: 'string' }),
	errorMessage: text(),
	retryCount: int().default(0),
	beforeScreenshotUrl: text(),
	beforeScreenshotKey: text(),
	afterScreenshotUrl: text(),
	afterScreenshotKey: text(),
	metadata: text(), // JSON: relationship data, comment style, etc.
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const logs = mysqlTable("logs", {
	id: int().autoincrement().notNull().primaryKey(),
	accountId: int(),
	deviceId: varchar({ length: 255 }),
	action: varchar({ length: 255 }).notNull(),
	status: mysqlEnum(['success','failed','pending']).notNull(),
	details: text(),
	errorMessage: text(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const postAnalytics = mysqlTable("post_analytics", {
	id: int().autoincrement().notNull().primaryKey(),
	postId: int().notNull(),
	accountId: int().notNull(),
	platform: mysqlEnum(['twitter','tiktok','instagram','facebook']).notNull(),
	viewsCount: int().default(0).notNull(),
	likesCount: int().default(0).notNull(),
	commentsCount: int().default(0).notNull(),
	sharesCount: int().default(0).notNull(),
	savesCount: int().default(0).notNull(),
	clicksCount: int().default(0).notNull(),
	engagementRate: int().default(0).notNull(),
	reachCount: int().default(0).notNull(),
	impressionsCount: int().default(0).notNull(),
	recordedAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const postPerformanceFeedback = mysqlTable("post_performance_feedback", {
	id: int().autoincrement().notNull().primaryKey(),
	postId: int().notNull(),
	agentId: int().notNull(),
	accountId: int().notNull(),
	metrics1h: text(),
	metrics24h: text(),
	metrics7d: text(),
	performanceScore: int().default(0).notNull(),
	engagementScore: int().default(0).notNull(),
	viralityScore: int().default(0).notNull(),
	successFactors: text(),
	improvementAreas: text(),
	isProcessed: tinyint().default(0).notNull(),
	processedAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const postUrls = mysqlTable("post_urls", {
	id: int().autoincrement().notNull().primaryKey(),
	projectId: int().notNull(),
	scheduledPostId: int(),
	accountId: int().notNull(),
	deviceId: varchar({ length: 50 }).notNull(),
	username: varchar({ length: 100 }).notNull(),
	postUrl: varchar({ length: 500 }).notNull(),
	postContent: text(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const posts = mysqlTable("posts", {
	id: int().autoincrement().notNull().primaryKey(),
	projectId: int(),
	accountId: int(),
	strategyId: int(),
	content: text().notNull(),
	mediaUrls: text(),
	hashtags: text(),
	scheduledAt: timestamp({ mode: 'string' }),
	publishedAt: timestamp({ mode: 'string' }),
	status: mysqlEnum(['draft','scheduled','published','failed','pending_review','approved']).default('draft').notNull(),
	likesCount: int().default(0),
	commentsCount: int().default(0),
	sharesCount: int().default(0),
	reachCount: int().default(0),
	engagementRate: int().default(0),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	agentId: int(),
	platform: varchar({ length: 50 }),
});

export const projectAccounts = mysqlTable("project_accounts", {
	id: int().autoincrement().notNull().primaryKey(),
	projectId: int().notNull(),
	accountId: int().notNull(),
	personaRole: varchar({ length: 255 }),
	personaTone: varchar({ length: 255 }),
	personaCharacteristics: text(),
	isActive: tinyint().default(1).notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

// Project-Model Account linkage - links projects to model accounts for learning
// @deprecated Use accountModelAccounts instead for account-centric management
export const projectModelAccounts = mysqlTable("project_model_accounts", {
	id: int().autoincrement().notNull().primaryKey(),
	projectId: int().notNull(), // FK to projects.id
	modelAccountId: int().notNull(), // FK to model_accounts.id
	autoApplyLearnings: tinyint().default(0).notNull(), // Auto-apply new learnings to accounts
	targetAccountIds: text(), // JSON array: specific accounts to apply learnings to (null = all)
	lastSyncedAt: timestamp({ mode: 'string' }), // Last time learnings were synced
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("project_model_accounts_project_idx").on(table.projectId),
	index("project_model_accounts_model_idx").on(table.modelAccountId),
]);

// Account-Model Account linkage - links individual accounts to model accounts for learning
export const accountModelAccounts = mysqlTable("account_model_accounts", {
	id: int().autoincrement().notNull().primaryKey(),
	accountId: int().notNull(), // FK to accounts.id
	modelAccountId: int().notNull(), // FK to model_accounts.id
	autoApplyLearnings: tinyint().default(0).notNull(), // Auto-apply new learnings
	lastSyncedAt: timestamp({ mode: 'string' }), // Last time learnings were synced
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("account_model_accounts_account_idx").on(table.accountId),
	index("account_model_accounts_model_idx").on(table.modelAccountId),
]);

export const projects = mysqlTable("projects", {
	id: int().autoincrement().notNull().primaryKey(),
	userId: int().notNull(),
	name: varchar({ length: 255 }).notNull(),
	objective: text().notNull(),
	description: text(),
	status: mysqlEnum(['draft','active','paused','completed']).default('draft').notNull(),
	executionMode: mysqlEnum(['fullAuto','confirm','manual']).default('confirm').notNull(),
	startDate: timestamp({ mode: 'string' }),
	endDate: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	targets: text(),
});

export const proxies = mysqlTable("proxies", {
	id: int().autoincrement().notNull().primaryKey(),
	host: varchar({ length: 255 }).notNull(),
	port: int().notNull(),
	username: varchar({ length: 255 }).notNull(),
	password: varchar({ length: 255 }).notNull(),
	status: mysqlEnum(['available','assigned','error']).default('available').notNull(),
	assignedAccountId: int(),
	lastUsedAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	duoplusProxyId: varchar({ length: 255 }),
});

export const scheduledPosts = mysqlTable("scheduled_posts", {
	id: int().autoincrement().notNull().primaryKey(),
	projectId: int().notNull().references(() => projects.id, { onDelete: "cascade" } ),
	accountId: int().notNull().references(() => accounts.id, { onDelete: "cascade" } ),
	content: text().notNull(),
	mediaUrls: text(),
	hashtags: text(),
	scheduledTime: timestamp({ mode: 'string' }).notNull(),
	repeatInterval: mysqlEnum(['none','daily','weekly','monthly']).default('none').notNull(),
	status: mysqlEnum(['pending','posted','failed','cancelled']).default('pending').notNull(),
	postedAt: timestamp({ mode: 'string' }),
	errorMessage: text(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	agentId: int(),
	generatedByAgent: tinyint().default(0).notNull(),
	reviewStatus: mysqlEnum(['draft','pending_review','approved','rejected']).default('draft').notNull(),
	reviewedAt: timestamp({ mode: 'string' }),
	reviewNotes: text(),
	originalContent: text(),
	contentConfidence: int(),
	postUrl: text(),
	screenshotUrl: text(),
	usedLearningIds: text(), // JSON array of learning IDs used for content generation
});

export const settings = mysqlTable("settings", {
	id: int().autoincrement().notNull().primaryKey(),
	key: varchar({ length: 255 }).notNull(),
	value: text(),
	description: text(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("settings_key_unique").on(table.key),
]);

export const strategies = mysqlTable("strategies", {
	id: int().autoincrement().notNull().primaryKey(),
	userId: int().notNull(),
	accountId: int(),
	objective: text().notNull(),
	contentType: text(),
	hashtags: text(),
	postingSchedule: text(),
	engagementStrategy: text(),
	generatedContent: text(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	projectId: int(),

	// Basic strategy info
	name: varchar({ length: 255 }),
	description: text(),

	// === New fields for goal-driven strategy ===

	// Target linkage - snapshot of project targets at strategy creation
	projectTargetsSnapshot: text(), // JSON: {"followers": 1000, "engagement": 5, ...}

	// Source tracking - what data was used to generate this strategy
	incorporatedBuzzLearnings: text(), // JSON array of buzzLearnings.id
	incorporatedModelPatterns: text(), // JSON array of modelAccountBehaviorPatterns.id
	basedOnModelAccounts: text(), // JSON array of modelAccounts.id
	basedOnBuzzPosts: text(), // JSON array of buzzPosts.id

	// Validity period
	validFrom: timestamp({ mode: 'string' }),
	validUntil: timestamp({ mode: 'string' }),
	isActive: tinyint().default(1),

	// Effectiveness tracking
	effectivenessScore: int().default(0), // 0-100 based on generated posts' performance
	postsGenerated: int().default(0), // Count of posts generated using this strategy
	avgPostPerformance: int().default(0), // Average performance score of generated posts

	// Detailed guidelines (JSON) - actionable guidance for content generation
	contentGuidelines: text(), // JSON: specific content rules and patterns
	timingGuidelines: text(), // JSON: {"bestHours": ["09", "19"], "frequency": "2x daily"}
	hashtagGuidelines: text(), // JSON: {"primary": [...], "secondary": [...], "avoid": [...]}
	toneGuidelines: text(), // JSON: {"primary": "casual", "avoid": ["formal"], "examples": [...]}
},
(table) => [
	index("strategies_project_idx").on(table.projectId),
	index("strategies_active_idx").on(table.projectId, table.isActive),
]);

export const tenantUsers = mysqlTable("tenant_users", {
	id: int().autoincrement().notNull().primaryKey(),
	tenantId: int().notNull(),
	userId: int().notNull(),
	role: mysqlEnum(['owner','admin','member','viewer']).default('member').notNull(),
	permissions: text(),
	invitedBy: int(),
	invitedAt: timestamp({ mode: 'string' }),
	joinedAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const tenants = mysqlTable("tenants", {
	id: int().autoincrement().notNull().primaryKey(),
	name: varchar({ length: 255 }).notNull(),
	slug: varchar({ length: 255 }).notNull(),
	ownerId: int().notNull(),
	plan: mysqlEnum(['free','basic','pro','enterprise']).default('free').notNull(),
	maxAccounts: int().default(5),
	maxProjects: int().default(3),
	maxAgents: int().default(10),
	settings: text(),
	status: mysqlEnum(['active','suspended','cancelled']).default('active').notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("tenants_slug_unique").on(table.slug),
]);

export const users = mysqlTable("users", {
	id: int().autoincrement().notNull().primaryKey(),
	openId: varchar({ length: 64 }).notNull(),
	name: text(),
	email: varchar({ length: 320 }),
	loginMethod: varchar({ length: 64 }),
	role: mysqlEnum(['user','admin']).default('user').notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	lastSignedIn: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
},
(table) => [
	index("users_openId_unique").on(table.openId),
]);

export const videoGenerations = mysqlTable("video_generations", {
	id: int().autoincrement().notNull().primaryKey(),
	userId: int().notNull(),
	projectId: int(),
	agentId: int(),
	prompt: text().notNull(),
	script: text(),
	videoUrl: text(),
	thumbnailUrl: text(),
	duration: int(),
	format: mysqlEnum(['vertical','horizontal','square']).default('vertical').notNull(),
	platform: mysqlEnum(['tiktok','youtube','instagram','all']).default('all').notNull(),
	status: mysqlEnum(['pending','generating','completed','failed']).default('pending').notNull(),
	errorMessage: text(),
	generatedAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const weeklyReviews = mysqlTable("weekly_reviews", {
	id: int().autoincrement().notNull().primaryKey(),
	userId: int().notNull(),
	projectId: int(),
	weekStartDate: timestamp({ mode: 'string' }).notNull(),
	weekEndDate: timestamp({ mode: 'string' }).notNull(),
	totalPosts: int().default(0),
	totalViews: int().default(0),
	totalLikes: int().default(0),
	totalComments: int().default(0),
	totalShares: int().default(0),
	avgEngagementRate: int().default(0),
	insights: text(),
	recommendations: text(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const xApiSettings = mysqlTable("x_api_settings", {
	id: int().autoincrement().notNull().primaryKey(),
	userId: int().notNull(),
	apiKey: varchar({ length: 255 }),
	apiSecret: varchar({ length: 500 }),
	bearerToken: text(),
	isActive: tinyint().default(1),
	lastTestedAt: timestamp({ mode: 'string' }),
	testResult: varchar({ length: 50 }),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

// Account-specific learning data for consistent persona across posts and comments
export const accountLearnings = mysqlTable("account_learnings", {
	id: int().autoincrement().notNull().primaryKey(),
	accountId: int().notNull(), // FK to accounts.id
	projectId: int(), // Optional: project-specific learning
	learningType: mysqlEnum([
		'posting_style',     // Posting style (tone, emoji usage, etc.)
		'comment_style',     // Comment style
		'success_pattern',   // Success pattern (from high engagement posts)
		'failure_pattern',   // Failure pattern (from low engagement posts)
		'hashtag_strategy',  // Hashtag strategy
		'timing_pattern',    // Posting timing
		'topic_preference',  // Preferred topics
		'audience_insight'   // Audience understanding
	]).notNull(),
	title: varchar({ length: 255 }).notNull(),
	content: text().notNull(), // JSON format for detailed data
	sourceType: mysqlEnum(['post_performance', 'buzz_analysis', 'manual', 'ai_suggestion']).notNull(),
	sourcePostId: int(), // Reference to source post if applicable
	sourceLearningId: int(), // Reference to buzzLearnings if derived from there
	confidence: int().default(50).notNull(), // 0-100
	usageCount: int().default(0).notNull(),
	successRate: int().default(0).notNull(), // 0-100
	isActive: tinyint().default(1).notNull(),
	expiresAt: timestamp({ mode: 'string' }), // Optional expiry for old learnings
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("account_learnings_account_idx").on(table.accountId),
	index("account_learnings_type_idx").on(table.accountId, table.learningType),
]);

export const automationTasks = mysqlTable("automation_tasks", {
	id: int().autoincrement().notNull().primaryKey(),
	postUrl: text().notNull(),
	action: text().notNull(),
	status: text().default('pending').notNull(),
	deviceId: text().notNull(),
	persona: text(),
	generatedComment: text(),
	result: text(),
	executedAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ==========================================
// AI Learning & Buzz Analysis Tables
// ==========================================

// Model accounts - accounts to learn from (successful influencers, competitors, etc.)
export const modelAccounts = mysqlTable("model_accounts", {
	id: int().autoincrement().notNull().primaryKey(),
	userId: int().notNull(),
	projectId: int(),
	platform: mysqlEnum(['twitter', 'tiktok', 'instagram', 'facebook']).notNull(),
	username: varchar({ length: 255 }).notNull(),
	displayName: varchar({ length: 255 }),
	profileUrl: text(),
	avatarUrl: text(),
	headerImageUrl: text(),
	bio: text(),
	followersCount: int().default(0),
	followingCount: int().default(0),

	// Category classification
	industryCategory: mysqlEnum([
		'it_tech', 'beauty_fashion', 'food_restaurant', 'finance_investment',
		'health_fitness', 'education', 'entertainment', 'travel', 'business', 'other'
	]),
	postingStyle: mysqlEnum(['informative', 'entertaining', 'educational', 'inspirational', 'promotional']),
	toneStyle: mysqlEnum(['casual', 'formal', 'humorous', 'professional']),

	// Collection settings
	isActive: tinyint().default(1).notNull(),
	collectionFrequency: mysqlEnum(['hourly', 'daily', 'weekly']).default('daily'),
	lastCollectedAt: timestamp({ mode: 'string' }),
	nextCollectionAt: timestamp({ mode: 'string' }),
	totalCollectedPosts: int().default(0),

	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("model_accounts_user_platform_idx").on(table.userId, table.platform),
	index("model_accounts_industry_idx").on(table.industryCategory),
]);

// Buzz posts - viral/successful posts from own accounts and model accounts
export const buzzPosts = mysqlTable("buzz_posts", {
	id: int().autoincrement().notNull().primaryKey(),
	userId: int().notNull(),
	projectId: int(),

	// Source identification
	sourceType: mysqlEnum(['own_account', 'model_account']).notNull(),
	sourceAccountId: int(), // accounts.id if own_account
	modelAccountId: int(), // model_accounts.id if model_account

	// Post data
	platform: mysqlEnum(['twitter', 'tiktok', 'instagram', 'facebook']).notNull(),
	externalPostId: varchar({ length: 255 }),
	postUrl: text(),
	content: text().notNull(),
	mediaUrls: text(), // JSON array
	hashtags: text(), // JSON array
	postedAt: timestamp({ mode: 'string' }),

	// Engagement metrics
	likesCount: int().default(0),
	commentsCount: int().default(0),
	sharesCount: int().default(0),
	viewsCount: int().default(0),
	engagementRate: int().default(0), // * 100 for precision
	viralityScore: int().default(0), // 0-100

	// Category classification (AI-determined)
	industryCategory: mysqlEnum([
		'it_tech', 'beauty_fashion', 'food_restaurant', 'finance_investment',
		'health_fitness', 'education', 'entertainment', 'travel', 'business', 'other'
	]),
	postType: mysqlEnum(['announcement', 'empathy', 'educational', 'humor', 'promotional', 'question', 'other']),
	toneStyle: mysqlEnum(['casual', 'formal', 'humorous', 'inspirational', 'professional']),
	contentFormat: mysqlEnum(['text_only', 'with_image', 'with_video', 'with_poll', 'thread']),

	// AI analysis results
	successFactors: text(), // JSON: extracted success factors
	contentStructure: text(), // JSON: content structure analysis
	hookAnalysis: text(), // JSON: opening hook analysis
	ctaAnalysis: text(), // JSON: call-to-action analysis

	// Processing status
	isAnalyzed: tinyint().default(0).notNull(),
	analyzedAt: timestamp({ mode: 'string' }),
	isUsedForLearning: tinyint().default(0).notNull(),

	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("buzz_posts_source_idx").on(table.sourceType, table.sourceAccountId),
	index("buzz_posts_model_idx").on(table.modelAccountId),
	index("buzz_posts_category_idx").on(table.industryCategory, table.postType),
	index("buzz_posts_virality_idx").on(table.viralityScore),
]);

// Buzz learnings - extracted patterns from successful posts
export const buzzLearnings = mysqlTable("buzz_learnings", {
	id: int().autoincrement().notNull().primaryKey(),
	userId: int().notNull(),
	projectId: int(),
	agentId: int(),

	// Category scope
	industryCategory: mysqlEnum([
		'it_tech', 'beauty_fashion', 'food_restaurant', 'finance_investment',
		'health_fitness', 'education', 'entertainment', 'travel', 'business', 'other'
	]),
	postType: mysqlEnum(['announcement', 'empathy', 'educational', 'humor', 'promotional', 'question', 'other']),

	// Learning content
	learningType: mysqlEnum([
		'hook_pattern', 'structure_pattern', 'hashtag_strategy', 'timing_pattern',
		'cta_pattern', 'media_usage', 'tone_pattern', 'engagement_tactic'
	]).notNull(),
	title: varchar({ length: 255 }).notNull(),
	description: text().notNull(),

	// Pattern data
	patternData: text(), // JSON: specific pattern details
	examplePostIds: text(), // JSON array of buzz_posts.id

	// Confidence and usage tracking
	confidence: int().default(50).notNull(), // 0-100
	usageCount: int().default(0),
	successRate: int().default(0), // 0-100
	sampleSize: int().default(0), // number of posts analyzed

	isActive: tinyint().default(1).notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("buzz_learnings_agent_idx").on(table.agentId),
	index("buzz_learnings_category_idx").on(table.industryCategory, table.learningType),
]);

// Profile analyses - analysis of account profiles for optimization
export const profileAnalyses = mysqlTable("profile_analyses", {
	id: int().autoincrement().notNull().primaryKey(),
	userId: int().notNull(),

	// Analysis target
	targetType: mysqlEnum(['own_account', 'model_account']).notNull(),
	accountId: int(), // accounts.id if own_account
	modelAccountId: int(), // model_accounts.id if model_account

	// Profile elements
	bio: text(),
	avatarUrl: text(),
	headerImageUrl: text(),

	// AI analysis results
	bioAnalysis: text(), // JSON: structure, keywords, tone, cta
	avatarAnalysis: text(), // JSON: style, colors, impression
	headerAnalysis: text(), // JSON: theme, branding, message
	overallScore: int().default(0), // 0-100

	// Improvement suggestions
	bioSuggestions: text(), // JSON array of suggestions
	avatarSuggestions: text(),
	headerSuggestions: text(),

	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
},
(table) => [
	index("profile_analyses_target_idx").on(table.targetType, table.accountId),
]);

// ==========================================
// Model Account Behavior Patterns - Analyzes posting patterns from model accounts
// ==========================================
export const modelAccountBehaviorPatterns = mysqlTable("model_account_behavior_patterns", {
	id: int().autoincrement().notNull().primaryKey(),
	modelAccountId: int().notNull(), // FK to model_accounts.id

	// Posting frequency patterns
	avgPostsPerDay: decimal({ precision: 5, scale: 2 }),
	avgPostsPerWeek: decimal({ precision: 5, scale: 2 }),
	postingFrequencyStdDev: decimal({ precision: 5, scale: 2 }),

	// Time-of-day patterns (JSON)
	postingHoursDistribution: text(), // {"00": 5, "01": 2, ...} count per hour
	peakPostingHours: text(), // ["09", "12", "19"] array of peak hours

	// Day-of-week patterns (JSON)
	postingDaysDistribution: text(), // {"monday": 10, "tuesday": 8, ...}

	// Engagement patterns
	avgEngagementRate: decimal({ precision: 6, scale: 2 }),
	engagementRateTrend: text(), // [{date, rate}, ...] historical trend
	bestEngagementHours: text(), // Hours with highest engagement

	// Growth patterns
	followerGrowthRate: decimal({ precision: 8, scale: 2 }), // % growth per week
	followerHistory: text(), // [{date, count}, ...] historical data

	// Content patterns
	avgContentLength: int(),
	emojiUsageRate: decimal({ precision: 4, scale: 2 }), // 0-1 percentage
	hashtagAvgCount: decimal({ precision: 4, scale: 2 }),
	mediaUsageRate: decimal({ precision: 4, scale: 2 }), // 0-1 percentage

	// Analysis metadata
	analysisPeriodStart: timestamp({ mode: 'string' }),
	analysisPeriodEnd: timestamp({ mode: 'string' }),
	sampleSize: int(), // Number of posts analyzed
	lastAnalyzedAt: timestamp({ mode: 'string' }),

	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("model_account_behavior_patterns_model_idx").on(table.modelAccountId),
]);

// ==========================================
// Project KPI Tracking - Tracks progress toward project goals
// ==========================================
export const projectKpiTracking = mysqlTable("project_kpi_tracking", {
	id: int().autoincrement().notNull().primaryKey(),
	projectId: int().notNull(), // FK to projects.id

	// Metric type
	metricType: mysqlEnum([
		'followers', 'engagement_rate', 'impressions',
		'clicks', 'conversions', 'posts_count', 'avg_likes'
	]).notNull(),

	// Target values
	targetValue: decimal({ precision: 15, scale: 2 }),
	targetDeadline: timestamp({ mode: 'string' }),

	// Current progress
	currentValue: decimal({ precision: 15, scale: 2 }).default('0'),
	progressPercentage: decimal({ precision: 5, scale: 2 }).default('0'),

	// Projections
	projectedValue: decimal({ precision: 15, scale: 2 }), // Projected value by deadline
	onTrack: tinyint().default(1), // Whether on track to meet target

	// History (JSON array)
	valueHistory: text(), // [{date, value}, ...] historical data

	recordedAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("project_kpi_tracking_project_idx").on(table.projectId),
	index("project_kpi_tracking_metric_idx").on(table.projectId, table.metricType),
]);

// ==========================================
// Engagement Tracking Jobs - Auto-track post performance
// ==========================================
export const engagementTrackingJobs = mysqlTable("engagement_tracking_jobs", {
	id: int().autoincrement().notNull().primaryKey(),
	postUrlId: int().notNull(), // FK to post_urls.id
	tweetId: varchar({ length: 50 }).notNull(), // Extracted tweet ID from URL
	accountId: int().notNull(), // FK to accounts.id
	projectId: int(), // FK to projects.id

	// Tracking type and timing
	trackingType: mysqlEnum(['1h', '24h', '48h', '72h']).notNull(),
	scheduledAt: timestamp({ mode: 'string' }).notNull(), // When to run this job

	// Job status
	status: mysqlEnum(['pending', 'processing', 'completed', 'failed', 'skipped']).default('pending').notNull(),
	executedAt: timestamp({ mode: 'string' }), // When the job was actually executed

	// Metrics result (stored as JSON)
	metrics: text(), // JSON: {retweetCount, replyCount, likeCount, quoteCount, impressionCount}

	// Error handling
	errorMessage: text(),
	retryCount: int().default(0).notNull(),

	// Learning trigger flag
	learningTriggered: tinyint().default(0).notNull(), // Whether auto-learning was triggered from this job

	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("engagement_tracking_jobs_status_idx").on(table.status, table.scheduledAt),
	index("engagement_tracking_jobs_post_idx").on(table.postUrlId),
	index("engagement_tracking_jobs_account_idx").on(table.accountId),
]);

// ==========================================
// Learning Sync Log - Tracks buzz→account learning synchronization
// ==========================================
export const learningSyncLog = mysqlTable("learning_sync_log", {
	id: int().autoincrement().notNull().primaryKey(),
	sourceLearningType: mysqlEnum(['buzz_learning', 'agent_knowledge']).notNull(),
	sourceLearningId: int().notNull(),
	targetAccountId: int().notNull(),
	accountLearningId: int(), // The created account learning ID
	relevanceScore: int().default(50).notNull(), // 0-100
	autoApplied: tinyint().default(1).notNull(),
	syncedAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
},
(table) => [
	index("learning_sync_log_source_idx").on(table.sourceLearningType, table.sourceLearningId),
	index("learning_sync_log_target_idx").on(table.targetAccountId),
]);

// ==========================================
// Hashtag Performance - Tracks hashtag-level analytics
// ==========================================
export const hashtagPerformance = mysqlTable("hashtag_performance", {
	id: int().autoincrement().notNull().primaryKey(),
	hashtag: varchar({ length: 255 }).notNull(),
	accountId: int(),
	projectId: int(),
	usageCount: int().default(0).notNull(),
	avgLikes: int().default(0).notNull(),
	avgComments: int().default(0).notNull(),
	avgShares: int().default(0).notNull(),
	avgEngagementRate: int().default(0).notNull(), // * 100 for precision
	bestPerformingPostId: int(),
	trendScore: int().default(0).notNull(), // 0-100
	lastUsedAt: timestamp({ mode: 'string' }),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
},
(table) => [
	index("hashtag_performance_hashtag_idx").on(table.hashtag),
	index("hashtag_performance_account_idx").on(table.accountId),
	index("hashtag_performance_project_idx").on(table.projectId),
	index("hashtag_performance_trend_idx").on(table.trendScore),
]);

// ==========================================
// Funnel Events - Tracks conversion funnel stages
// ==========================================
export const funnelEvents = mysqlTable("funnel_events", {
	id: int().autoincrement().notNull().primaryKey(),
	accountId: int().notNull(),
	projectId: int(),
	eventType: mysqlEnum(['impression', 'engagement', 'profile_visit', 'follow', 'conversion']).notNull(),
	postId: int(),
	sourceType: varchar({ length: 100 }),
	value: int().default(0),
	metadata: text(), // JSON
	recordedAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
},
(table) => [
	index("funnel_events_account_idx").on(table.accountId),
	index("funnel_events_project_idx").on(table.projectId),
	index("funnel_events_type_idx").on(table.eventType, table.recordedAt),
]);

// ==========================================
// Insert / Select Type Exports
// ==========================================

// abTestLearnings
export type InsertAbTestLearning = typeof abTestLearnings.$inferInsert;
export type SelectAbTestLearning = typeof abTestLearnings.$inferSelect;

// abTestVariations
export type InsertAbTestVariation = typeof abTestVariations.$inferInsert;
export type SelectAbTestVariation = typeof abTestVariations.$inferSelect;

// abTests
export type InsertAbTest = typeof abTests.$inferInsert;
export type SelectAbTest = typeof abTests.$inferSelect;

// accounts
export type InsertAccount = typeof accounts.$inferInsert;
export type SelectAccount = typeof accounts.$inferSelect;

// accountRelationships
export type InsertAccountRelationship = typeof accountRelationships.$inferInsert;
export type SelectAccountRelationship = typeof accountRelationships.$inferSelect;

// agentAccounts
export type InsertAgentAccount = typeof agentAccounts.$inferInsert;
export type SelectAgentAccount = typeof agentAccounts.$inferSelect;

// agentExecutionLogs
export type InsertAgentExecutionLog = typeof agentExecutionLogs.$inferInsert;
export type SelectAgentExecutionLog = typeof agentExecutionLogs.$inferSelect;

// agentKnowledge
export type InsertAgentKnowledge = typeof agentKnowledge.$inferInsert;
export type SelectAgentKnowledge = typeof agentKnowledge.$inferSelect;

// agentRules
export type InsertAgentRule = typeof agentRules.$inferInsert;
export type SelectAgentRule = typeof agentRules.$inferSelect;

// agentSchedules
export type InsertAgentSchedule = typeof agentSchedules.$inferInsert;
export type SelectAgentSchedule = typeof agentSchedules.$inferSelect;

// agents
export type InsertAgent = typeof agents.$inferInsert;
export type SelectAgent = typeof agents.$inferSelect;

// aiOptimizations
export type InsertAiOptimization = typeof aiOptimizations.$inferInsert;
export type SelectAiOptimization = typeof aiOptimizations.$inferSelect;

// alertHistory
export type InsertAlertHistory = typeof alertHistory.$inferInsert;
export type SelectAlertHistory = typeof alertHistory.$inferSelect;

// alertSettings
export type InsertAlertSetting = typeof alertSettings.$inferInsert;
export type SelectAlertSetting = typeof alertSettings.$inferSelect;

// analytics
export type InsertAnalytics = typeof analytics.$inferInsert;
export type SelectAnalytics = typeof analytics.$inferSelect;

// autoResponses
export type InsertAutoResponse = typeof autoResponses.$inferInsert;
export type SelectAutoResponse = typeof autoResponses.$inferSelect;

// collectedContents
export type InsertCollectedContent = typeof collectedContents.$inferInsert;
export type SelectCollectedContent = typeof collectedContents.$inferSelect;

// collectionSchedules
export type InsertCollectionSchedule = typeof collectionSchedules.$inferInsert;
export type SelectCollectionSchedule = typeof collectionSchedules.$inferSelect;

// contentReviews
export type InsertContentReview = typeof contentReviews.$inferInsert;
export type SelectContentReview = typeof contentReviews.$inferSelect;

// contentRewrites
export type InsertContentRewrite = typeof contentRewrites.$inferInsert;
export type SelectContentRewrite = typeof contentRewrites.$inferSelect;

// coordinateLearningData
export type InsertCoordinateLearningData = typeof coordinateLearningData.$inferInsert;
export type SelectCoordinateLearningData = typeof coordinateLearningData.$inferSelect;

// deviceMonitoringStatus
export type InsertDeviceMonitoringStatus = typeof deviceMonitoringStatus.$inferInsert;
export type SelectDeviceMonitoringStatus = typeof deviceMonitoringStatus.$inferSelect;

// deviceStatusHistory
export type InsertDeviceStatusHistory = typeof deviceStatusHistory.$inferInsert;
export type SelectDeviceStatusHistory = typeof deviceStatusHistory.$inferSelect;

// devices
export type InsertDevice = typeof devices.$inferInsert;
export type SelectDevice = typeof devices.$inferSelect;

// engagementLogs
export type InsertEngagementLog = typeof engagementLogs.$inferInsert;
export type SelectEngagementLog = typeof engagementLogs.$inferSelect;

// engagementTasks
export type InsertEngagementTask = typeof engagementTasks.$inferInsert;
export type SelectEngagementTask = typeof engagementTasks.$inferSelect;

// freezeDetections
export type InsertFreezeDetection = typeof freezeDetections.$inferInsert;
export type SelectFreezeDetection = typeof freezeDetections.$inferSelect;

// interactionSettings
export type InsertInteractionSetting = typeof interactionSettings.$inferInsert;
export type SelectInteractionSetting = typeof interactionSettings.$inferSelect;

// interactions
export type InsertInteraction = typeof interactions.$inferInsert;
export type SelectInteraction = typeof interactions.$inferSelect;

// logs
export type InsertLog = typeof logs.$inferInsert;
export type SelectLog = typeof logs.$inferSelect;

// postAnalytics
export type InsertPostAnalytics = typeof postAnalytics.$inferInsert;
export type SelectPostAnalytics = typeof postAnalytics.$inferSelect;

// postPerformanceFeedback
export type InsertPostPerformanceFeedback = typeof postPerformanceFeedback.$inferInsert;
export type SelectPostPerformanceFeedback = typeof postPerformanceFeedback.$inferSelect;

// postUrls
export type InsertPostUrl = typeof postUrls.$inferInsert;
export type SelectPostUrl = typeof postUrls.$inferSelect;

// posts
export type InsertPost = typeof posts.$inferInsert;
export type SelectPost = typeof posts.$inferSelect;

// projectAccounts
export type InsertProjectAccount = typeof projectAccounts.$inferInsert;
export type SelectProjectAccount = typeof projectAccounts.$inferSelect;

// projectModelAccounts
export type InsertProjectModelAccount = typeof projectModelAccounts.$inferInsert;
export type SelectProjectModelAccount = typeof projectModelAccounts.$inferSelect;

// accountModelAccounts
export type InsertAccountModelAccount = typeof accountModelAccounts.$inferInsert;
export type SelectAccountModelAccount = typeof accountModelAccounts.$inferSelect;

// projects
export type InsertProject = typeof projects.$inferInsert;
export type SelectProject = typeof projects.$inferSelect;

// proxies
export type InsertProxy = typeof proxies.$inferInsert;
export type SelectProxy = typeof proxies.$inferSelect;

// scheduledPosts
export type InsertScheduledPost = typeof scheduledPosts.$inferInsert;
export type SelectScheduledPost = typeof scheduledPosts.$inferSelect;

// settings
export type InsertSetting = typeof settings.$inferInsert;
export type SelectSetting = typeof settings.$inferSelect;

// strategies
export type InsertStrategy = typeof strategies.$inferInsert;
export type SelectStrategy = typeof strategies.$inferSelect;

// tenantUsers
export type InsertTenantUser = typeof tenantUsers.$inferInsert;
export type SelectTenantUser = typeof tenantUsers.$inferSelect;

// tenants
export type InsertTenant = typeof tenants.$inferInsert;
export type SelectTenant = typeof tenants.$inferSelect;

// users
export type InsertUser = typeof users.$inferInsert;
export type SelectUser = typeof users.$inferSelect;

// videoGenerations
export type InsertVideoGeneration = typeof videoGenerations.$inferInsert;
export type SelectVideoGeneration = typeof videoGenerations.$inferSelect;

// weeklyReviews
export type InsertWeeklyReview = typeof weeklyReviews.$inferInsert;
export type SelectWeeklyReview = typeof weeklyReviews.$inferSelect;

// xApiSettings
export type InsertXApiSetting = typeof xApiSettings.$inferInsert;
export type SelectXApiSetting = typeof xApiSettings.$inferSelect;

// accountLearnings
export type InsertAccountLearning = typeof accountLearnings.$inferInsert;
export type SelectAccountLearning = typeof accountLearnings.$inferSelect;

// automationTasks
export type InsertAutomationTask = typeof automationTasks.$inferInsert;
export type SelectAutomationTask = typeof automationTasks.$inferSelect;

// modelAccounts
export type InsertModelAccount = typeof modelAccounts.$inferInsert;
export type SelectModelAccount = typeof modelAccounts.$inferSelect;

// buzzPosts
export type InsertBuzzPost = typeof buzzPosts.$inferInsert;
export type SelectBuzzPost = typeof buzzPosts.$inferSelect;

// buzzLearnings
export type InsertBuzzLearning = typeof buzzLearnings.$inferInsert;
export type SelectBuzzLearning = typeof buzzLearnings.$inferSelect;

// profileAnalyses
export type InsertProfileAnalysis = typeof profileAnalyses.$inferInsert;
export type SelectProfileAnalysis = typeof profileAnalyses.$inferSelect;

// modelAccountBehaviorPatterns
export type InsertModelAccountBehaviorPattern = typeof modelAccountBehaviorPatterns.$inferInsert;
export type SelectModelAccountBehaviorPattern = typeof modelAccountBehaviorPatterns.$inferSelect;

// projectKpiTracking
export type InsertProjectKpiTracking = typeof projectKpiTracking.$inferInsert;
export type SelectProjectKpiTracking = typeof projectKpiTracking.$inferSelect;

// engagementTrackingJobs
export type InsertEngagementTrackingJob = typeof engagementTrackingJobs.$inferInsert;
export type SelectEngagementTrackingJob = typeof engagementTrackingJobs.$inferSelect;

// learningSyncLog
export type InsertLearningSyncLog = typeof learningSyncLog.$inferInsert;
export type SelectLearningSyncLog = typeof learningSyncLog.$inferSelect;

// hashtagPerformance
export type InsertHashtagPerformance = typeof hashtagPerformance.$inferInsert;
export type SelectHashtagPerformance = typeof hashtagPerformance.$inferSelect;

// funnelEvents
export type InsertFunnelEvent = typeof funnelEvents.$inferInsert;
export type SelectFunnelEvent = typeof funnelEvents.$inferSelect;

// ==========================================
// Growth Loop System Tables
// ==========================================

// Growth loop state - tracks the autonomous loop execution per project
export const growthLoopState = mysqlTable("growth_loop_state", {
	id: int().autoincrement().notNull().primaryKey(),
	projectId: int().notNull(),

	// Loop status
	isRunning: tinyint().default(0).notNull(),
	lastKpiCheckAt: timestamp({ mode: 'string' }),
	lastPerformanceUpdateAt: timestamp({ mode: 'string' }),
	lastStrategyEvaluationAt: timestamp({ mode: 'string' }),
	lastStrategyRegenerationAt: timestamp({ mode: 'string' }),
	lastFullReviewAt: timestamp({ mode: 'string' }),

	// Current state data
	currentKpiSummary: text(), // JSON: latest KPI snapshot
	currentStrategyScore: int().default(0), // 0-100 strategy effectiveness
	consecutiveDeclines: int().default(0), // How many checks showed declining metrics
	escalationNeeded: tinyint().default(0).notNull(),
	escalationReason: text(),

	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("growth_loop_state_project_idx").on(table.projectId),
]);

// Growth loop actions - complete log of autonomous actions
export const growthLoopActions = mysqlTable("growth_loop_actions", {
	id: int().autoincrement().notNull().primaryKey(),
	projectId: int().notNull(),

	// Action details
	actionType: mysqlEnum([
		'kpi_check', 'performance_update', 'strategy_evaluation',
		'strategy_regeneration', 'timing_optimization', 'content_diversity_adjustment',
		'frequency_adjustment', 'escalation', 'full_review'
	]).notNull(),
	description: text().notNull(),
	actionData: text(), // JSON: detailed action parameters

	// Decision info
	triggerReason: text(), // Why this action was triggered
	executionMode: mysqlEnum(['fullAuto', 'confirm', 'manual']).notNull(),
	status: mysqlEnum(['pending', 'approved', 'executed', 'rejected', 'failed']).default('pending').notNull(),
	approvedAt: timestamp({ mode: 'string' }),
	executedAt: timestamp({ mode: 'string' }),

	// Results
	resultData: text(), // JSON: action outcome
	resultSuccess: tinyint(),
	errorMessage: text(),

	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
},
(table) => [
	index("growth_loop_actions_project_idx").on(table.projectId),
	index("growth_loop_actions_type_idx").on(table.actionType, table.status),
]);

// ==========================================
// Network Orchestration Tables (Phase 2)
// ==========================================

// Account roles - defines account roles within a project
export const accountRoles = mysqlTable("account_roles", {
	id: int().autoincrement().notNull().primaryKey(),
	projectId: int().notNull(),
	accountId: int().notNull(),

	role: mysqlEnum(['main', 'amplifier', 'engagement', 'support']).notNull(),
	priority: int().default(50).notNull(), // Higher = more important
	isActive: tinyint().default(1).notNull(),

	// Role-specific config
	config: text(), // JSON: role-specific settings (e.g., amplification delay range)

	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("account_roles_project_idx").on(table.projectId),
	index("account_roles_account_idx").on(table.accountId),
]);

// Orchestration plans - pre-planned cross-account actions
export const orchestrationPlans = mysqlTable("orchestration_plans", {
	id: int().autoincrement().notNull().primaryKey(),
	projectId: int().notNull(),
	triggerPostId: int(), // The post that triggered this plan
	triggerPostUrl: text(),

	// Plan details
	planType: mysqlEnum(['amplification', 'conversation', 'engagement_boost']).notNull(),
	status: mysqlEnum(['planned', 'in_progress', 'completed', 'cancelled', 'failed']).default('planned').notNull(),
	actions: text().notNull(), // JSON array of planned actions with timing

	// Execution tracking
	totalActions: int().default(0).notNull(),
	completedActions: int().default(0).notNull(),
	failedActions: int().default(0).notNull(),

	startedAt: timestamp({ mode: 'string' }),
	completedAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("orchestration_plans_project_idx").on(table.projectId),
	index("orchestration_plans_status_idx").on(table.status),
]);

// ==========================================
// Trend Monitoring Tables (Phase 3)
// ==========================================

// Tracked trends - detected trends and their state
export const trackedTrends = mysqlTable("tracked_trends", {
	id: int().autoincrement().notNull().primaryKey(),
	userId: int().notNull(),
	projectId: int(),

	// Trend identification
	trendName: varchar({ length: 255 }).notNull(),
	trendType: mysqlEnum(['hashtag', 'topic', 'keyword', 'event']).notNull(),
	platform: mysqlEnum(['twitter', 'tiktok', 'instagram', 'facebook']).default('twitter').notNull(),
	source: mysqlEnum(['x_api', 'buzz_analysis', 'model_account', 'manual']).notNull(),

	// Scoring
	relevanceScore: int().default(0).notNull(), // 0-100 brand relevance
	trendingScore: int().default(0).notNull(), // 0-100 how trending
	volumeEstimate: int().default(0), // Estimated post volume

	// Status
	status: mysqlEnum(['detected', 'evaluating', 'responding', 'responded', 'expired', 'ignored']).default('detected').notNull(),
	respondedAt: timestamp({ mode: 'string' }),
	expiresAt: timestamp({ mode: 'string' }),

	detectedAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("tracked_trends_project_idx").on(table.projectId),
	index("tracked_trends_status_idx").on(table.status),
]);

// Trend response posts - posts created in response to trends
export const trendResponsePosts = mysqlTable("trend_response_posts", {
	id: int().autoincrement().notNull().primaryKey(),
	trendId: int().notNull(),
	postId: int(), // FK to posts or scheduledPosts
	scheduledPostId: int(),
	accountId: int().notNull(),

	// Performance comparison
	normalAvgEngagement: int().default(0), // Average engagement of non-trend posts
	trendPostEngagement: int().default(0), // This trend post's engagement
	performanceLift: int().default(0), // % improvement over normal

	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
},
(table) => [
	index("trend_response_posts_trend_idx").on(table.trendId),
]);

// ==========================================
// Conversion Tracking Tables (Phase 4)
// ==========================================

// Campaigns - business goal groupings
export const campaigns = mysqlTable("campaigns", {
	id: int().autoincrement().notNull().primaryKey(),
	userId: int().notNull(),
	projectId: int().notNull(),

	name: varchar({ length: 255 }).notNull(),
	description: text(),
	goal: mysqlEnum(['awareness', 'traffic', 'leads', 'sales', 'engagement']).notNull(),
	targetUrl: text(), // Landing page URL
	utmSource: varchar({ length: 100 }).default('sns_automation'),
	utmMedium: varchar({ length: 100 }).default('social'),
	utmCampaign: varchar({ length: 255 }),

	// Budget & ROI
	budget: decimal({ precision: 10, scale: 2 }),
	revenue: decimal({ precision: 10, scale: 2 }).default('0'),
	roi: decimal({ precision: 8, scale: 2 }),

	status: mysqlEnum(['draft', 'active', 'paused', 'completed']).default('draft').notNull(),
	startDate: timestamp({ mode: 'string' }),
	endDate: timestamp({ mode: 'string' }),

	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("campaigns_project_idx").on(table.projectId),
]);

// Conversion events - funnel events
export const conversionEvents = mysqlTable("conversion_events", {
	id: int().autoincrement().notNull().primaryKey(),
	campaignId: int(),
	accountId: int(),
	postId: int(),
	trackedLinkId: int(),

	eventType: mysqlEnum([
		'impression', 'engagement', 'profile_visit', 'follow',
		'link_click', 'page_view', 'signup', 'purchase'
	]).notNull(),
	eventValue: decimal({ precision: 10, scale: 2 }),
	metadata: text(), // JSON: additional event data

	occurredAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
},
(table) => [
	index("conversion_events_campaign_idx").on(table.campaignId),
	index("conversion_events_type_idx").on(table.eventType),
]);

// Tracked links - UTM-tagged links
export const trackedLinks = mysqlTable("tracked_links", {
	id: int().autoincrement().notNull().primaryKey(),
	campaignId: int(),
	accountId: int(),
	postId: int(),

	originalUrl: text().notNull(),
	trackedUrl: text().notNull(), // URL with UTM params
	shortUrl: varchar({ length: 255 }), // Shortened version

	clickCount: int().default(0).notNull(),
	uniqueClickCount: int().default(0).notNull(),
	lastClickedAt: timestamp({ mode: 'string' }),

	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
},
(table) => [
	index("tracked_links_campaign_idx").on(table.campaignId),
]);

// ==========================================
// Account Health Tables (Phase 5)
// ==========================================

// Account health - per-account health tracking
export const accountHealth = mysqlTable("account_health", {
	id: int().autoincrement().notNull().primaryKey(),
	accountId: int().notNull(),

	// Health score (0-100)
	healthScore: int().default(100).notNull(),

	// Component scores
	loginSuccessRate: int().default(100), // 0-100
	postSuccessRate: int().default(100), // 0-100
	engagementNaturalnessScore: int().default(100), // 0-100 how natural engagement looks
	freezeRiskScore: int().default(0), // 0-100, higher = riskier

	// Warming protocol
	accountPhase: mysqlEnum(['warming', 'growing', 'mature', 'cooling', 'suspended']).default('warming').notNull(),
	warmingStartedAt: timestamp({ mode: 'string' }),
	warmingCompletedAt: timestamp({ mode: 'string' }),
	maxDailyPosts: int().default(1).notNull(), // Dynamic limit based on phase
	maxDailyActions: int().default(10).notNull(), // Total actions (likes + comments + follows)

	// Rate tracking
	postsToday: int().default(0).notNull(),
	actionsToday: int().default(0).notNull(),
	postsThisHour: int().default(0).notNull(),
	actionsThisHour: int().default(0).notNull(),
	lastActionAt: timestamp({ mode: 'string' }),
	lastPostAt: timestamp({ mode: 'string' }),

	// Throttling
	isThrottled: tinyint().default(0).notNull(),
	throttleReason: text(),
	throttleUntil: timestamp({ mode: 'string' }),
	isSuspended: tinyint().default(0).notNull(),
	suspendedReason: text(),

	// History
	totalFreezeCount: int().default(0).notNull(),
	lastFreezeAt: timestamp({ mode: 'string' }),
	consecutiveSuccesses: int().default(0).notNull(),
	consecutiveFailures: int().default(0).notNull(),

	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("account_health_account_idx").on(table.accountId),
	index("account_health_score_idx").on(table.healthScore),
]);

// ==========================================
// Content Calendar Tables (Phase 6)
// ==========================================

// Content calendar - planned content slots
export const contentCalendar = mysqlTable("content_calendar", {
	id: int().autoincrement().notNull().primaryKey(),
	projectId: int().notNull(),
	accountId: int(),
	agentId: int(),

	// Scheduling
	scheduledDate: timestamp({ mode: 'string' }).notNull(),
	timeSlot: varchar({ length: 10 }), // HH:mm format

	// Content type planning
	contentType: mysqlEnum([
		'educational', 'engagement', 'promotional', 'story',
		'trend_response', 'reserved', 'filler'
	]).notNull(),
	topic: varchar({ length: 255 }),
	notes: text(),

	// Execution status
	status: mysqlEnum(['planned', 'content_generated', 'scheduled', 'published', 'skipped']).default('planned').notNull(),
	scheduledPostId: int(), // FK to scheduledPosts when content is generated
	postId: int(), // FK to posts when published

	// Campaign linkage
	campaignId: int(),

	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("content_calendar_project_idx").on(table.projectId),
	index("content_calendar_date_idx").on(table.scheduledDate),
]);
