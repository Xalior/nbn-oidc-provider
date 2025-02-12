CREATE TABLE `confirmation_codes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text,
	`invite_code` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `confirmation_codes_invite_code_unique` ON `confirmation_codes` (`invite_code`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`password` text NOT NULL,
	`verified` integer DEFAULT false NOT NULL,
	`suspended` integer DEFAULT false NOT NULL,
	`hmac_key` text,
	`display_name` text NOT NULL,
	`confirmation_attempts` integer,
	`login_attempts` integer,
	`created_at` integer DEFAULT (unixepoch()),
	`confirmed_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);