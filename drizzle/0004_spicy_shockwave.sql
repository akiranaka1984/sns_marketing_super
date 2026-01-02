ALTER TABLE `projects` ADD `targets` text;--> statement-breakpoint
ALTER TABLE `projects` DROP COLUMN `targetFollowers`;--> statement-breakpoint
ALTER TABLE `projects` DROP COLUMN `targetEngagementRate`;