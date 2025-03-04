CREATE TABLE `actions` (
	`id` text PRIMARY KEY NOT NULL,
	`account` text NOT NULL,
	`objectType` text NOT NULL,
	`objectId` text NOT NULL,
	`action` text NOT NULL,
	`createdAt` integer NOT NULL,
	`actionStatus` text NOT NULL,
	`error` text
);
--> statement-breakpoint
CREATE INDEX `actionsAccount_idx` ON `actions` (`account`);--> statement-breakpoint
CREATE INDEX `actionsObjectId_idx` ON `actions` (`objectId`);--> statement-breakpoint
CREATE TABLE `drafts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account` text NOT NULL,
	`to` text,
	`cc` text,
	`bcc` text,
	`subject` text,
	`body` text,
	`createdAt` integer NOT NULL,
	`status` text NOT NULL,
	`error` text
);
--> statement-breakpoint
CREATE INDEX `draftsAccount_idx` ON `drafts` (`account`);--> statement-breakpoint
CREATE INDEX `draftsCreatedAt_idx` ON `drafts` (`createdAt`);--> statement-breakpoint
CREATE TABLE `emails` (
	`id` text PRIMARY KEY NOT NULL,
	`account` text NOT NULL,
	`threadId` text NOT NULL,
	`from` text,
	`to` text,
	`cc` text,
	`bcc` text,
	`subject` text,
	`body` text,
	`mimeType` text,
	`date` integer,
	`isRead` integer DEFAULT false,
	FOREIGN KEY (`threadId`) REFERENCES `threads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `emailsThreadId_idx` ON `emails` (`threadId`);--> statement-breakpoint
CREATE INDEX `emailsDate_idx` ON `emails` (`date`);--> statement-breakpoint
CREATE TABLE `threads` (
	`id` text PRIMARY KEY NOT NULL,
	`account` text NOT NULL,
	`subject` text,
	`date` integer,
	`labels` text,
	`historyId` text,
	`changeKey` text
);
--> statement-breakpoint
CREATE INDEX `threadAccount_idx` ON `threads` (`account`);--> statement-breakpoint
CREATE INDEX `threadDate_idx` ON `threads` (`date`);