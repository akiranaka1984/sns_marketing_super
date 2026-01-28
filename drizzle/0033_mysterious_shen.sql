ALTER TABLE `interaction_settings` ADD `retweetEnabled` tinyint DEFAULT 0;--> statement-breakpoint
ALTER TABLE `interaction_settings` ADD `retweetDelayMinMin` int DEFAULT 15;--> statement-breakpoint
ALTER TABLE `interaction_settings` ADD `retweetDelayMinMax` int DEFAULT 90;