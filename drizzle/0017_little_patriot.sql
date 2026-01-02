CREATE TABLE `alert_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`alertType` enum('device_stopped','device_error','device_offline','consecutive_failures','posting_failed','engagement_drop','account_issue') NOT NULL,
	`deviceId` varchar(100),
	`accountId` int,
	`postId` int,
	`title` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`severity` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`status` enum('triggered','acknowledged','resolved') NOT NULL DEFAULT 'triggered',
	`acknowledgedAt` timestamp,
	`resolvedAt` timestamp,
	`notificationSent` boolean NOT NULL DEFAULT false,
	`notificationSentAt` timestamp,
	`triggeredAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `alert_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `alert_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`alertType` enum('device_stopped','device_error','device_offline','consecutive_failures','posting_failed','engagement_drop','account_issue') NOT NULL,
	`isEnabled` boolean NOT NULL DEFAULT true,
	`threshold` int NOT NULL DEFAULT 1,
	`cooldownMinutes` int NOT NULL DEFAULT 60,
	`notifyOwner` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `alert_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `device_monitoring_status` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deviceId` varchar(100) NOT NULL,
	`deviceName` varchar(255),
	`currentStatus` enum('running','stopped','error','unknown') NOT NULL DEFAULT 'unknown',
	`lastKnownStatus` enum('running','stopped','error','unknown'),
	`consecutiveErrors` int NOT NULL DEFAULT 0,
	`lastSuccessfulCheck` timestamp,
	`lastErrorAt` timestamp,
	`lastErrorMessage` text,
	`isMonitored` boolean NOT NULL DEFAULT true,
	`isPaused` boolean NOT NULL DEFAULT false,
	`lastCheckedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `device_monitoring_status_id` PRIMARY KEY(`id`),
	CONSTRAINT `device_monitoring_status_deviceId_unique` UNIQUE(`deviceId`)
);
--> statement-breakpoint
CREATE TABLE `device_status_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deviceId` varchar(100) NOT NULL,
	`deviceName` varchar(255),
	`status` enum('running','stopped','error','unknown') NOT NULL,
	`previousStatus` enum('running','stopped','error','unknown'),
	`ipAddress` varchar(50),
	`osVersion` varchar(100),
	`errorMessage` text,
	`errorCode` varchar(50),
	`detectedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `device_status_history_id` PRIMARY KEY(`id`)
);
