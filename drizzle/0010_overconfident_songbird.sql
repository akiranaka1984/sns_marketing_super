CREATE TABLE `ai_optimizations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectId` int,
	`agentId` int,
	`type` enum('tone_adjustment','style_adjustment','content_strategy','timing_optimization') NOT NULL,
	`beforeParams` text,
	`afterParams` text,
	`performanceImprovement` int,
	`insights` text,
	`status` enum('pending','applied','reverted') NOT NULL DEFAULT 'pending',
	`appliedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_optimizations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `collected_contents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectId` int,
	`platform` enum('twitter','tiktok','instagram','facebook','youtube','other') NOT NULL,
	`sourceUrl` text NOT NULL,
	`author` varchar(255),
	`content` text NOT NULL,
	`mediaUrls` text,
	`hashtags` text,
	`likes` int DEFAULT 0,
	`comments` int DEFAULT 0,
	`shares` int DEFAULT 0,
	`views` int DEFAULT 0,
	`collectedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `collected_contents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `collection_schedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectId` int,
	`platform` enum('twitter','tiktok','instagram','facebook','youtube','other') NOT NULL,
	`searchKeywords` text,
	`searchHashtags` text,
	`searchAccounts` text,
	`frequency` enum('hourly','daily','weekly') NOT NULL DEFAULT 'daily',
	`maxItemsPerRun` int DEFAULT 50,
	`isActive` boolean NOT NULL DEFAULT true,
	`lastRunAt` timestamp,
	`nextRunAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `collection_schedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `content_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectId` int,
	`contentRewriteId` int,
	`reviewerId` int NOT NULL,
	`status` enum('pending','approved','rejected','revision_requested') NOT NULL DEFAULT 'pending',
	`feedback` text,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `content_reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `content_rewrites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectId` int,
	`collectedContentId` int,
	`agentId` int NOT NULL,
	`originalContent` text NOT NULL,
	`rewrittenContent` text NOT NULL,
	`rewritePrompt` text,
	`status` enum('pending','completed','failed') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`rewrittenAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `content_rewrites_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tenant_users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('owner','admin','member','viewer') NOT NULL DEFAULT 'member',
	`permissions` text,
	`invitedBy` int,
	`invitedAt` timestamp,
	`joinedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tenant_users_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`ownerId` int NOT NULL,
	`plan` enum('free','basic','pro','enterprise') NOT NULL DEFAULT 'free',
	`maxAccounts` int DEFAULT 5,
	`maxProjects` int DEFAULT 3,
	`maxAgents` int DEFAULT 10,
	`settings` text,
	`status` enum('active','suspended','cancelled') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tenants_id` PRIMARY KEY(`id`),
	CONSTRAINT `tenants_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `weekly_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectId` int,
	`weekStartDate` timestamp NOT NULL,
	`weekEndDate` timestamp NOT NULL,
	`totalPosts` int DEFAULT 0,
	`totalViews` int DEFAULT 0,
	`totalLikes` int DEFAULT 0,
	`totalComments` int DEFAULT 0,
	`totalShares` int DEFAULT 0,
	`avgEngagementRate` int DEFAULT 0,
	`insights` text,
	`recommendations` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `weekly_reviews_id` PRIMARY KEY(`id`)
);
