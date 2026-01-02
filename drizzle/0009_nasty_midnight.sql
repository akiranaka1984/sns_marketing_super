ALTER TABLE `agents` ADD `postingFrequency` enum('daily','twice_daily','three_times_daily','weekly','custom') DEFAULT 'daily';--> statement-breakpoint
ALTER TABLE `agents` ADD `postingTimeSlots` text;