CREATE TABLE `auto_responses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`freezeDetectionId` int NOT NULL,
	`accountId` int NOT NULL,
	`actionType` enum('change_ip','switch_device','pause_account','retry') NOT NULL,
	`oldValue` text,
	`newValue` text,
	`status` enum('pending','success','failed') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`executedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `auto_responses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `engagement_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`accountId` int NOT NULL,
	`taskType` enum('like','follow','comment','unfollow') NOT NULL,
	`targetUser` varchar(255),
	`targetPost` varchar(255),
	`status` enum('success','failed') NOT NULL,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `engagement_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `engagement_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`accountId` int NOT NULL,
	`taskType` enum('like','follow','comment','unfollow') NOT NULL,
	`targetUser` varchar(255),
	`targetPost` varchar(255),
	`commentText` text,
	`frequency` int NOT NULL DEFAULT 10,
	`isActive` boolean NOT NULL DEFAULT true,
	`lastExecutedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `engagement_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `freeze_detections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`deviceId` varchar(255),
	`freezeType` enum('ip_block','device_block','account_freeze','unknown') NOT NULL,
	`confidence` int NOT NULL DEFAULT 0,
	`errorMessage` text,
	`detectionDetails` text,
	`status` enum('detected','handling','resolved','failed') NOT NULL DEFAULT 'detected',
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `freeze_detections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scheduled_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`accountId` int NOT NULL,
	`content` text NOT NULL,
	`mediaUrls` text,
	`hashtags` text,
	`scheduledTime` timestamp NOT NULL,
	`repeatInterval` enum('none','daily','weekly','monthly') NOT NULL DEFAULT 'none',
	`status` enum('pending','posted','failed','cancelled') NOT NULL DEFAULT 'pending',
	`postedAt` timestamp,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scheduled_posts_id` PRIMARY KEY(`id`)
);
