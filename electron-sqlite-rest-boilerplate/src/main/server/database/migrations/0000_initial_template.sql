CREATE TABLE IF NOT EXISTS `about_info` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`app_name` text NOT NULL,
	`version` text NOT NULL,
	`description` text,
	`author` text,
	`license` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `process_info` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pid` integer NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`cpu_usage` real DEFAULT 0 NOT NULL,
	`memory_usage` real DEFAULT 0 NOT NULL,
	`memory_bytes` integer DEFAULT 0 NOT NULL,
	`started_at` text,
	`command` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`value` text,
	`description` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `system_stats` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cpu_usage` real DEFAULT 0 NOT NULL,
	`memory_usage` real DEFAULT 0 NOT NULL,
	`memory_total` integer DEFAULT 0 NOT NULL,
	`memory_used` integer DEFAULT 0 NOT NULL,
	`disk_usage` real DEFAULT 0 NOT NULL,
	`disk_total` integer DEFAULT 0 NOT NULL,
	`disk_used` integer DEFAULT 0 NOT NULL,
	`network_rx` integer DEFAULT 0 NOT NULL,
	`network_tx` integer DEFAULT 0 NOT NULL,
	`recorded_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `template_permissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`description` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `template_permissions_code_unique` ON `template_permissions` (`code`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `template_role_permissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`role_id` integer NOT NULL,
	`permission_id` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `template_role_permissions_unique` ON `template_role_permissions` (`role_id`,`permission_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `template_roles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`description` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `template_roles_code_unique` ON `template_roles` (`code`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `template_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`access_token` text NOT NULL,
	`refresh_token` text NOT NULL,
	`access_expires_at` integer NOT NULL,
	`refresh_expires_at` integer NOT NULL,
	`revoked_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `template_sessions_access_token_unique` ON `template_sessions` (`access_token`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `template_sessions_refresh_token_unique` ON `template_sessions` (`refresh_token`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `template_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`real_name` text,
	`email` text,
	`role_id` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `template_users_username_unique` ON `template_users` (`username`);
