ALTER TABLE `bookings` ADD `tracking_token` text;--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_tracking_token_unique` ON `bookings` (`tracking_token`);--> statement-breakpoint
CREATE INDEX `idx_bookings_driver_status` ON `bookings` (`assigned_driver_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_bookings_status_time` ON `bookings` (`status`,`pickup_time`);