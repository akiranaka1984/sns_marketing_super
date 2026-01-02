import { mysqlTable, mysqlSchema, AnyMySqlColumn, int, mysqlEnum, varchar, text, timestamp, index, foreignKey, tinyint } from "drizzle-orm/mysql-core"
import { sql } from "drizzle-orm"

export const abTestLearnings = mysqlTable("ab_test_learnings", {
	id: int().autoincrement().notNull(),
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
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const abTestVariations = mysqlTable("ab_test_variations", {
	id: int().autoincrement().notNull(),
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
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const abTests = mysqlTable("ab_tests", {
	id: int().autoincrement().notNull(),
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
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const accounts = mysqlTable("accounts", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	platform: mysqlEnum(['twitter','tiktok','instagram','facebook']).notNull(),
	username: varchar({ length: 255 }).notNull(),
	password: text().notNull(),
	status: mysqlEnum(['pending','active','suspended','failed']).default('active').notNull(),
	deviceId: varchar({ length: 255 }),
	lastLoginAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	proxyId: int(),
	xHandle: varchar({ length: 255 }),
	persona: varchar({ length: 200 }),
},
(table) => [
	index("username_platform_idx").on(table.username, table.platform),
]);

export const agentAccounts = mysqlTable("agent_accounts", {
	id: int().autoincrement().notNull(),
	agentId: int().notNull(),
	accountId: int().notNull(),
	isActive: tinyint().default(1).notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const agentExecutionLogs = mysqlTable("agent_execution_logs", {
	id: int().autoincrement().notNull(),
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
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const agentKnowledge = mysqlTable("agent_knowledge", {
	id: int().autoincrement().notNull(),
	agentId: int().notNull(),
	knowledgeType: mysqlEnum(['success_pattern','failure_pattern','content_template','hashtag_strategy','timing_insight','audience_insight','engagement_tactic','general']).notNull(),
	title: varchar({ length: 255 }).notNull(),
	content: text().notNull(),
	sourcePostId: int(),
	confidence: int().default(50).notNull(),
	usageCount: int().default(0).notNull(),
	successRate: int().default(0).notNull(),
	isActive: tinyint().default(1).notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const agentRules = mysqlTable("agent_rules", {
	id: int().autoincrement().notNull(),
	agentId: int().notNull(),
	ruleType: mysqlEnum(['forbidden_word','required_element','content_limit','posting_limit','time_restriction','platform_specific','tone_guideline','custom']).notNull(),
	ruleName: varchar({ length: 255 }).notNull(),
	ruleValue: text().notNull(),
	priority: int().default(50).notNull(),
	isActive: tinyint().default(1).notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const agentSchedules = mysqlTable("agent_schedules", {
	id: int().autoincrement().notNull(),
	agentId: int().notNull(),
	accountId: int().notNull(),
	scheduleType: mysqlEnum(['daily','weekly','custom']).default('daily').notNull(),
	timeSlot: varchar({ length: 10 }).notNull(),
	dayOfWeek: int(),
	timezone: varchar({ length: 50 }).default('Asia/Tokyo').notNull(),
	isActive: tinyint().default(1).notNull(),
	lastExecutedAt: timestamp({ mode: 'string' }),
	nextExecutionAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const agents = mysqlTable("agents", {
	id: int().autoincrement().notNull(),
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
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	postingFrequency: mysqlEnum(['daily','twice_daily','three_times_daily','weekly','custom']).default('daily'),
	postingTimeSlots: text(),
	skipReview: tinyint().default(0).notNull(),
});

export const aiOptimizations = mysqlTable("ai_optimizations", {
	id: int().autoincrement().notNull(),
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
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const alertHistory = mysqlTable("alert_history", {
	id: int().autoincrement().notNull(),
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
	triggeredAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const alertSettings = mysqlTable("alert_settings", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	alertType: mysqlEnum(['device_stopped','device_error','device_offline','consecutive_failures','posting_failed','engagement_drop','account_issue']).notNull(),
	isEnabled: tinyint().default(1).notNull(),
	threshold: int().default(1).notNull(),
	cooldownMinutes: int().default(60).notNull(),
	notifyOwner: tinyint().default(1).notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const analytics = mysqlTable("analytics", {
	id: int().autoincrement().notNull(),
	accountId: int().notNull(),
	followersCount: int().default(0).notNull(),
	followingCount: int().default(0).notNull(),
	postsCount: int().default(0).notNull(),
	engagementRate: int().default(0).notNull(),
	likesCount: int().default(0).notNull(),
	commentsCount: int().default(0).notNull(),
	sharesCount: int().default(0).notNull(),
	recordedAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const autoResponses = mysqlTable("auto_responses", {
	id: int().autoincrement().notNull(),
	freezeDetectionId: int().notNull(),
	accountId: int().notNull(),
	actionType: mysqlEnum(['change_ip','switch_device','pause_account','retry']).notNull(),
	oldValue: text(),
	newValue: text(),
	status: mysqlEnum(['pending','success','failed']).default('pending').notNull(),
	errorMessage: text(),
	executedAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const collectedContents = mysqlTable("collected_contents", {
	id: int().autoincrement().notNull(),
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
	collectedAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const collectionSchedules = mysqlTable("collection_schedules", {
	id: int().autoincrement().notNull(),
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
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const contentReviews = mysqlTable("content_reviews", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	projectId: int(),
	contentRewriteId: int(),
	reviewerId: int().notNull(),
	status: mysqlEnum(['pending','approved','rejected','revision_requested']).default('pending').notNull(),
	feedback: text(),
	reviewedAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const contentRewrites = mysqlTable("content_rewrites", {
	id: int().autoincrement().notNull(),
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
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const coordinateLearningData = mysqlTable("coordinate_learning_data", {
	id: int().autoincrement().notNull(),
	deviceId: varchar({ length: 100 }).notNull(),
	resolution: varchar({ length: 50 }).notNull(),
	element: varchar({ length: 50 }).notNull(),
	success: int().notNull(),
	screenshotUrl: text(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const deviceMonitoringStatus = mysqlTable("device_monitoring_status", {
	id: int().autoincrement().notNull(),
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
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("device_monitoring_status_deviceId_unique").on(table.deviceId),
]);

export const deviceStatusHistory = mysqlTable("device_status_history", {
	id: int().autoincrement().notNull(),
	deviceId: varchar({ length: 100 }).notNull(),
	deviceName: varchar({ length: 255 }),
	status: mysqlEnum(['running','stopped','error','unknown']).notNull(),
	previousStatus: mysqlEnum(['running','stopped','error','unknown']),
	ipAddress: varchar({ length: 50 }),
	osVersion: varchar({ length: 100 }),
	errorMessage: text(),
	errorCode: varchar({ length: 50 }),
	detectedAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const devices = mysqlTable("devices", {
	id: int().autoincrement().notNull(),
	deviceId: varchar({ length: 255 }).notNull(),
	deviceName: varchar({ length: 255 }),
	status: mysqlEnum(['available','busy','offline']).default('available').notNull(),
	proxyIp: varchar({ length: 255 }),
	lastUsedAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("devices_deviceId_unique").on(table.deviceId),
]);

export const engagementLogs = mysqlTable("engagement_logs", {
	id: int().autoincrement().notNull(),
	taskId: int().notNull(),
	accountId: int().notNull(),
	taskType: mysqlEnum(['like','follow','comment','unfollow']).notNull(),
	targetUser: varchar({ length: 255 }),
	targetPost: varchar({ length: 255 }),
	status: mysqlEnum(['success','failed']).notNull(),
	errorMessage: text(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const engagementTasks = mysqlTable("engagement_tasks", {
	id: int().autoincrement().notNull(),
	projectId: int().notNull(),
	accountId: int().notNull(),
	taskType: mysqlEnum(['like','follow','comment','unfollow']).notNull(),
	targetUser: varchar({ length: 255 }),
	targetPost: varchar({ length: 255 }),
	commentText: text(),
	frequency: int().default(10).notNull(),
	isActive: tinyint().default(1).notNull(),
	lastExecutedAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const freezeDetections = mysqlTable("freeze_detections", {
	id: int().autoincrement().notNull(),
	accountId: int().notNull(),
	deviceId: varchar({ length: 255 }),
	freezeType: mysqlEnum(['ip_block','device_block','account_freeze','unknown']).notNull(),
	confidence: int().default(0).notNull(),
	errorMessage: text(),
	detectionDetails: text(),
	status: mysqlEnum(['detected','handling','resolved','failed']).default('detected').notNull(),
	resolvedAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const interactionSettings = mysqlTable("interaction_settings", {
	id: int().autoincrement().notNull(),
	projectId: int().notNull(),
	isEnabled: tinyint().default(0),
	likeEnabled: tinyint().default(1),
	likeDelayMinMin: int().default(5),
	likeDelayMinMax: int().default(30),
	commentEnabled: tinyint().default(1),
	commentDelayMinMin: int().default(10),
	commentDelayMinMax: int().default(60),
	defaultPersona: varchar({ length: 200 }).default('フレンドリーなユーザー'),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("interaction_settings_projectId_unique").on(table.projectId),
]);

export const interactions = mysqlTable("interactions", {
	id: int().autoincrement().notNull(),
	postUrlId: int().notNull(),
	fromAccountId: int().notNull(),
	fromDeviceId: varchar({ length: 50 }).notNull(),
	interactionType: varchar({ length: 20 }).notNull(),
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
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const logs = mysqlTable("logs", {
	id: int().autoincrement().notNull(),
	accountId: int(),
	deviceId: varchar({ length: 255 }),
	action: varchar({ length: 255 }).notNull(),
	status: mysqlEnum(['success','failed','pending']).notNull(),
	details: text(),
	errorMessage: text(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const postAnalytics = mysqlTable("post_analytics", {
	id: int().autoincrement().notNull(),
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
	recordedAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const postPerformanceFeedback = mysqlTable("post_performance_feedback", {
	id: int().autoincrement().notNull(),
	postId: int().notNull(),
	agentId: int().notNull(),
	accountId: int().notNull(),
	metrics1H: text(),
	metrics24H: text(),
	metrics7D: text(),
	performanceScore: int().default(0).notNull(),
	engagementScore: int().default(0).notNull(),
	viralityScore: int().default(0).notNull(),
	successFactors: text(),
	improvementAreas: text(),
	isProcessed: tinyint().default(0).notNull(),
	processedAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const postUrls = mysqlTable("post_urls", {
	id: int().autoincrement().notNull(),
	projectId: int().notNull(),
	scheduledPostId: int(),
	accountId: int().notNull(),
	deviceId: varchar({ length: 50 }).notNull(),
	username: varchar({ length: 100 }).notNull(),
	postUrl: varchar({ length: 500 }).notNull(),
	postContent: text(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const posts = mysqlTable("posts", {
	id: int().autoincrement().notNull(),
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
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	agentId: int(),
	platform: varchar({ length: 50 }),
});

export const projectAccounts = mysqlTable("project_accounts", {
	id: int().autoincrement().notNull(),
	projectId: int().notNull(),
	accountId: int().notNull(),
	personaRole: varchar({ length: 255 }),
	personaTone: varchar({ length: 255 }),
	personaCharacteristics: text(),
	isActive: tinyint().default(1).notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const projects = mysqlTable("projects", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	name: varchar({ length: 255 }).notNull(),
	objective: text().notNull(),
	description: text(),
	status: mysqlEnum(['draft','active','paused','completed']).default('draft').notNull(),
	executionMode: mysqlEnum(['fullAuto','confirm','manual']).default('confirm').notNull(),
	startDate: timestamp({ mode: 'string' }),
	endDate: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	targets: text(),
});

export const proxies = mysqlTable("proxies", {
	id: int().autoincrement().notNull(),
	host: varchar({ length: 255 }).notNull(),
	port: int().notNull(),
	username: varchar({ length: 255 }).notNull(),
	password: varchar({ length: 255 }).notNull(),
	status: mysqlEnum(['available','assigned','error']).default('available').notNull(),
	assignedAccountId: int(),
	lastUsedAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	duoplusProxyId: varchar({ length: 255 }),
});

export const scheduledPosts = mysqlTable("scheduled_posts", {
	id: int().autoincrement().notNull(),
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
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
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
});

export const settings = mysqlTable("settings", {
	id: int().autoincrement().notNull(),
	key: varchar({ length: 255 }).notNull(),
	value: text(),
	description: text(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("settings_key_unique").on(table.key),
]);

export const strategies = mysqlTable("strategies", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	accountId: int(),
	objective: text().notNull(),
	contentType: text(),
	hashtags: text(),
	postingSchedule: text(),
	engagementStrategy: text(),
	generatedContent: text(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	projectId: int(),
});

export const tenantUsers = mysqlTable("tenant_users", {
	id: int().autoincrement().notNull(),
	tenantId: int().notNull(),
	userId: int().notNull(),
	role: mysqlEnum(['owner','admin','member','viewer']).default('member').notNull(),
	permissions: text(),
	invitedBy: int(),
	invitedAt: timestamp({ mode: 'string' }),
	joinedAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const tenants = mysqlTable("tenants", {
	id: int().autoincrement().notNull(),
	name: varchar({ length: 255 }).notNull(),
	slug: varchar({ length: 255 }).notNull(),
	ownerId: int().notNull(),
	plan: mysqlEnum(['free','basic','pro','enterprise']).default('free').notNull(),
	maxAccounts: int().default(5),
	maxProjects: int().default(3),
	maxAgents: int().default(10),
	settings: text(),
	status: mysqlEnum(['active','suspended','cancelled']).default('active').notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("tenants_slug_unique").on(table.slug),
]);

export const users = mysqlTable("users", {
	id: int().autoincrement().notNull(),
	openId: varchar({ length: 64 }).notNull(),
	name: text(),
	email: varchar({ length: 320 }),
	loginMethod: varchar({ length: 64 }),
	role: mysqlEnum(['user','admin']).default('user').notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	lastSignedIn: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
},
(table) => [
	index("users_openId_unique").on(table.openId),
]);

export const videoGenerations = mysqlTable("video_generations", {
	id: int().autoincrement().notNull(),
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
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const weeklyReviews = mysqlTable("weekly_reviews", {
	id: int().autoincrement().notNull(),
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
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const xApiSettings = mysqlTable("x_api_settings", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	apiKey: varchar({ length: 255 }),
	apiSecret: varchar({ length: 500 }),
	bearerToken: text(),
	isActive: tinyint().default(1),
	lastTestedAt: timestamp({ mode: 'string' }),
	testResult: varchar({ length: 50 }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const automationTasks = mysqlTable("automation_tasks", {
	id: int().autoincrement().notNull(),
	postUrl: text().notNull(),
	action: text().notNull(),
	status: text().default('pending').notNull(),
	deviceId: text().notNull(),
	persona: text(),
	generatedComment: text(),
	result: text(),
	executedAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});
