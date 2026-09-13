CREATE TABLE `auth_attempts` (
	`key` text PRIMARY KEY NOT NULL,
	`fails` integer NOT NULL,
	`window` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `project` (
	`id` integer PRIMARY KEY NOT NULL,
	`records` text NOT NULL
);
