CREATE TABLE `coordinate_learning_data` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deviceId` varchar(100) NOT NULL,
	`resolution` varchar(50) NOT NULL,
	`element` varchar(50) NOT NULL,
	`success` int NOT NULL,
	`screenshotUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `coordinate_learning_data_id` PRIMARY KEY(`id`)
);
