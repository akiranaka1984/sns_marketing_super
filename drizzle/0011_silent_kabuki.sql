ALTER TABLE `posts` MODIFY COLUMN `projectId` int;--> statement-breakpoint
ALTER TABLE `posts` MODIFY COLUMN `accountId` int;--> statement-breakpoint
ALTER TABLE `posts` MODIFY COLUMN `status` enum('draft','scheduled','published','failed','pending_review','approved') NOT NULL DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE `agents` ADD `skipReview` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `posts` ADD `agentId` int;--> statement-breakpoint
ALTER TABLE `posts` ADD `platform` varchar(50);