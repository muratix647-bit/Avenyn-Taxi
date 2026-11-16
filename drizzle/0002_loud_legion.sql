ALTER TABLE `bookings` ADD `archived_at` text;--> statement-breakpoint
ALTER TABLE `bookings` ADD `archived_by` text;--> statement-breakpoint
CREATE INDEX `idx_bookings_archived_at` ON `bookings` (`archived_at`);--> statement-breakpoint
ALTER TABLE `profiles` ADD `deleted_at` text;