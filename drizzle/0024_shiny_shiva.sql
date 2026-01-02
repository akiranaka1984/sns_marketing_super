CREATE TABLE `interaction_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`isEnabled` boolean DEFAULT false,
	`likeEnabled` boolean DEFAULT true,
	`likeDelayMinMin` int DEFAULT 5,
	`likeDelayMinMax` int DEFAULT 30,
	`commentEnabled` boolean DEFAULT true,
	`commentDelayMinMin` int DEFAULT 10,
	`commentDelayMinMax` int DEFAULT 60,
	`defaultPersona` varchar(200) DEFAULT 'フレンドリーなユーザー',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `interaction_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `interaction_settings_projectId_unique` UNIQUE(`projectId`)
);
--> statement-breakpoint
ALTER TABLE `accounts` ADD `persona` varchar(200);