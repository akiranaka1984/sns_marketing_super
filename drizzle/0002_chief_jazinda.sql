CREATE TABLE `analytics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`followersCount` int NOT NULL DEFAULT 0,
	`followingCount` int NOT NULL DEFAULT 0,
	`postsCount` int NOT NULL DEFAULT 0,
	`engagementRate` int NOT NULL DEFAULT 0,
	`likesCount` int NOT NULL DEFAULT 0,
	`commentsCount` int NOT NULL DEFAULT 0,
	`sharesCount` int NOT NULL DEFAULT 0,
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `analytics_id` PRIMARY KEY(`id`)
);
