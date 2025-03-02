CREATE TABLE `clients` (
	`id` int NOT NULL,
	`client_id` text NOT NULL,
	`client_secret` text NOT NULL,
	`grant_requirements` text,
	`grant_types` text,
	`redirect_uris` text,
	`post_logout_redirect_uris` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `clients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `confirmation_codes` (
	`id` int NOT NULL,
	`user_id` int,
	`confirmation_code` text NOT NULL,
	`used` int NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `confirmation_codes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int NOT NULL,
	`account_id` text NOT NULL,
	`email` text NOT NULL,
	`password` text NOT NULL,
	`verified` int NOT NULL DEFAULT false,
	`suspended` int NOT NULL DEFAULT false,
	`hmac_key` text,
	`display_name` text NOT NULL,
	`confirmation_attempts` int DEFAULT 0,
	`login_attempts` int DEFAULT 0,
	`confirmed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `confirmation_codes` ADD CONSTRAINT `confirmation_codes_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;