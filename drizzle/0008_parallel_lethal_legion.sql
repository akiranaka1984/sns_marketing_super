CREATE TABLE `agents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectId` int,
	`name` varchar(255) NOT NULL,
	`description` text,
	`theme` text NOT NULL,
	`tone` enum('formal','casual','friendly','professional','humorous') NOT NULL DEFAULT 'casual',
	`style` enum('ranking','trivia','story','tutorial','news','review') NOT NULL DEFAULT 'story',
	`targetAudience` text,
	`contentFormat` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `post_analytics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`postId` int NOT NULL,
	`accountId` int NOT NULL,
	`platform` enum('twitter','tiktok','instagram','facebook') NOT NULL,
	`viewsCount` int NOT NULL DEFAULT 0,
	`likesCount` int NOT NULL DEFAULT 0,
	`commentsCount` int NOT NULL DEFAULT 0,
	`sharesCount` int NOT NULL DEFAULT 0,
	`savesCount` int NOT NULL DEFAULT 0,
	`clicksCount` int NOT NULL DEFAULT 0,
	`engagementRate` int NOT NULL DEFAULT 0,
	`reachCount` int NOT NULL DEFAULT 0,
	`impressionsCount` int NOT NULL DEFAULT 0,
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `post_analytics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `video_generations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectId` int,
	`agentId` int,
	`prompt` text NOT NULL,
	`script` text,
	`videoUrl` text,
	`thumbnailUrl` text,
	`duration` int,
	`format` enum('vertical','horizontal','square') NOT NULL DEFAULT 'vertical',
	`platform` enum('tiktok','youtube','instagram','all') NOT NULL DEFAULT 'all',
	`status` enum('pending','generating','completed','failed') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`generatedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `video_generations_id` PRIMARY KEY(`id`)
);
