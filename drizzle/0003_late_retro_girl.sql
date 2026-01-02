CREATE TABLE `posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`accountId` int NOT NULL,
	`strategyId` int,
	`content` text NOT NULL,
	`mediaUrls` text,
	`hashtags` text,
	`scheduledAt` timestamp,
	`publishedAt` timestamp,
	`status` enum('draft','scheduled','published','failed') NOT NULL DEFAULT 'draft',
	`likesCount` int DEFAULT 0,
	`commentsCount` int DEFAULT 0,
	`sharesCount` int DEFAULT 0,
	`reachCount` int DEFAULT 0,
	`engagementRate` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `posts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`accountId` int NOT NULL,
	`personaRole` varchar(255),
	`personaTone` varchar(255),
	`personaCharacteristics` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `project_accounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`objective` text NOT NULL,
	`description` text,
	`status` enum('draft','active','paused','completed') NOT NULL DEFAULT 'draft',
	`startDate` timestamp,
	`endDate` timestamp,
	`targetFollowers` int,
	`targetEngagementRate` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `strategies` ADD `projectId` int;