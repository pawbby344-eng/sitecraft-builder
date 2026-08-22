CREATE TABLE `aiProposals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`baseDraftRevision` int NOT NULL,
	`scopeType` enum('block','section','page','theme') NOT NULL,
	`scopeId` int,
	`proposal` json NOT NULL,
	`status` enum('pending','applied','rejected','expired') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `aiProposals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pageBlocks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pageId` int NOT NULL,
	`parentBlockId` int,
	`type` enum('section','text','image','button') NOT NULL,
	`sortOrder` int NOT NULL,
	`props` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pageBlocks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`pageSlug` varchar(160) NOT NULL,
	`purpose` text,
	`isHome` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pages_id` PRIMARY KEY(`id`),
	CONSTRAINT `pages_project_slug_unique` UNIQUE(`projectId`,`pageSlug`)
);
--> statement-breakpoint
CREATE TABLE `projectBriefs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`inputText` text NOT NULL,
	`brief` json NOT NULL,
	`status` enum('draft','confirmed') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projectBriefs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`projectSlug` varchar(160) NOT NULL,
	`projectDraftRevision` int NOT NULL DEFAULT 1,
	`publishedRevisionId` int,
	`theme` json NOT NULL,
	`isPublished` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`),
	CONSTRAINT `projects_projectSlug_unique` UNIQUE(`projectSlug`)
);
--> statement-breakpoint
CREATE TABLE `publishedRevisions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`revisionNumber` int NOT NULL,
	`schemaVersion` varchar(32) NOT NULL DEFAULT '1',
	`snapshot` json NOT NULL,
	`publishedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `publishedRevisions_id` PRIMARY KEY(`id`),
	CONSTRAINT `published_revisions_project_revision_unique` UNIQUE(`projectId`,`revisionNumber`)
);
--> statement-breakpoint
CREATE TABLE `scopeLocks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`scopeType` enum('block','section','theme') NOT NULL,
	`scopeId` int,
	`locked` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scopeLocks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `siteSpecs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`briefId` int NOT NULL,
	`spec` json NOT NULL,
	`schemaVersion` varchar(32) NOT NULL DEFAULT '1',
	`status` enum('draft','confirmed') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `siteSpecs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `aiProposals` ADD CONSTRAINT `aiProposals_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pageBlocks` ADD CONSTRAINT `pageBlocks_pageId_pages_id_fk` FOREIGN KEY (`pageId`) REFERENCES `pages`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pages` ADD CONSTRAINT `pages_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projectBriefs` ADD CONSTRAINT `projectBriefs_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projects` ADD CONSTRAINT `projects_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `publishedRevisions` ADD CONSTRAINT `publishedRevisions_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `scopeLocks` ADD CONSTRAINT `scopeLocks_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `siteSpecs` ADD CONSTRAINT `siteSpecs_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `siteSpecs` ADD CONSTRAINT `siteSpecs_briefId_projectBriefs_id_fk` FOREIGN KEY (`briefId`) REFERENCES `projectBriefs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `ai_proposals_project_idx` ON `aiProposals` (`projectId`);--> statement-breakpoint
CREATE INDEX `page_blocks_page_order_idx` ON `pageBlocks` (`pageId`,`parentBlockId`,`sortOrder`);--> statement-breakpoint
CREATE INDEX `page_blocks_page_idx` ON `pageBlocks` (`pageId`);--> statement-breakpoint
CREATE INDEX `pages_project_idx` ON `pages` (`projectId`);--> statement-breakpoint
CREATE INDEX `project_briefs_project_idx` ON `projectBriefs` (`projectId`);--> statement-breakpoint
CREATE INDEX `projects_owner_idx` ON `projects` (`ownerId`);--> statement-breakpoint
CREATE INDEX `published_revisions_project_idx` ON `publishedRevisions` (`projectId`);--> statement-breakpoint
CREATE INDEX `scope_locks_project_scope_idx` ON `scopeLocks` (`projectId`,`scopeType`,`scopeId`);--> statement-breakpoint
CREATE INDEX `site_specs_project_idx` ON `siteSpecs` (`projectId`);