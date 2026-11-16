CREATE TABLE `bookings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pickup` text NOT NULL,
	`destination` text NOT NULL,
	`pickup_lat` real,
	`pickup_lng` real,
	`destination_lat` real,
	`destination_lng` real,
	`customer_name` text NOT NULL,
	`customer_phone` text NOT NULL,
	`customer_email` text DEFAULT '' NOT NULL,
	`pickup_time` text NOT NULL,
	`passengers` integer DEFAULT 1 NOT NULL,
	`vehicle` text DEFAULT 'standard' NOT NULL,
	`child_seats` integer DEFAULT 0 NOT NULL,
	`flight_number` text DEFAULT '' NOT NULL,
	`price` integer NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`assigned_driver_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `driver_locations` (
	`driver_id` text PRIMARY KEY NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`heading` real DEFAULT 0 NOT NULL,
	`online` integer DEFAULT true NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`role` text DEFAULT 'driver' NOT NULL,
	`approved` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_email_unique` ON `profiles` (`email`);