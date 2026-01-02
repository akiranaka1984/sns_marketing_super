CREATE TABLE `agent_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agentId` int NOT NULL,
	`accountId` int NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agent_accounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agent_execution_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agentId` int NOT NULL,
	`accountId` int,
	`executionType` enum('content_generation','post_execution','learning','analysis','optimization') NOT NULL,
	`status` enum('started','success','failed','skipped') NOT NULL,
	`inputData` text,
	`outputData` text,
	`postId` int,
	`knowledgeGained` text,
	`errorMessage` text,
	`executionTimeMs` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_execution_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agent_knowledge` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agentId` int NOT NULL,
	`knowledgeType` enum('success_pattern','failure_pattern','content_template','hashtag_strategy','timing_insight','audience_insight','engagement_tactic','general') NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`sourcePostId` int,
	`confidence` int NOT NULL DEFAULT 50,
	`usageCount` int NOT NULL DEFAULT 0,
	`successRate` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agent_knowledge_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agent_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agentId` int NOT NULL,
	`ruleType` enum('forbidden_word','required_element','content_limit','posting_limit','time_restriction','platform_specific','tone_guideline','custom') NOT NULL,
	`ruleName` varchar(255) NOT NULL,
	`ruleValue` text NOT NULL,
	`priority` int NOT NULL DEFAULT 50,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agent_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agent_schedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agentId` int NOT NULL,
	`accountId` int NOT NULL,
	`scheduleType` enum('daily','weekly','custom') NOT NULL DEFAULT 'daily',
	`timeSlot` varchar(10) NOT NULL,
	`dayOfWeek` int,
	`timezone` varchar(50) NOT NULL DEFAULT 'Asia/Tokyo',
	`isActive` boolean NOT NULL DEFAULT true,
	`lastExecutedAt` timestamp,
	`nextExecutionAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agent_schedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `post_performance_feedback` (
	`id` int AUTO_INCREMENT NOT NULL,
	`postId` int NOT NULL,
	`agentId` int NOT NULL,
	`accountId` int NOT NULL,
	`metrics1h` text,
	`metrics24h` text,
	`metrics7d` text,
	`performanceScore` int NOT NULL DEFAULT 0,
	`engagementScore` int NOT NULL DEFAULT 0,
	`viralityScore` int NOT NULL DEFAULT 0,
	`successFactors` text,
	`improvementAreas` text,
	`isProcessed` boolean NOT NULL DEFAULT false,
	`processedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `post_performance_feedback_id` PRIMARY KEY(`id`)
);
