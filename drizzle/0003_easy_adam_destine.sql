CREATE TABLE `projectIdeas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`inputText` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projectIdeas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `projectIdeas` ADD CONSTRAINT `projectIdeas_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `project_ideas_project_idx` ON `projectIdeas` (`projectId`);