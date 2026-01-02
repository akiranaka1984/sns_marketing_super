ALTER TABLE `scheduled_posts` ADD `agentId` int;--> statement-breakpoint
ALTER TABLE `scheduled_posts` ADD `generatedByAgent` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `scheduled_posts` ADD `reviewStatus` enum('draft','pending_review','approved','rejected') DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE `scheduled_posts` ADD `reviewedAt` timestamp;--> statement-breakpoint
ALTER TABLE `scheduled_posts` ADD `reviewNotes` text;--> statement-breakpoint
ALTER TABLE `scheduled_posts` ADD `originalContent` text;--> statement-breakpoint
ALTER TABLE `scheduled_posts` ADD `contentConfidence` int;