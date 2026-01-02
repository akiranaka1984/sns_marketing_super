CREATE TABLE `interactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`postUrlId` int NOT NULL,
	`fromAccountId` int NOT NULL,
	`fromDeviceId` varchar(50) NOT NULL,
	`interactionType` varchar(20) NOT NULL,
	`commentContent` text,
	`status` varchar(20) DEFAULT 'pending',
	`scheduledAt` timestamp,
	`executedAt` timestamp,
	`errorMessage` text,
	`retryCount` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `interactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `post_urls` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`scheduledPostId` int,
	`accountId` int NOT NULL,
	`deviceId` varchar(50) NOT NULL,
	`username` varchar(100) NOT NULL,
	`postUrl` varchar(500) NOT NULL,
	`postContent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `post_urls_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `x_api_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`apiKey` varchar(255),
	`apiSecret` varchar(500),
	`bearerToken` text,
	`isActive` boolean DEFAULT true,
	`lastTestedAt` timestamp,
	`testResult` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `x_api_settings_id` PRIMARY KEY(`id`)
);
