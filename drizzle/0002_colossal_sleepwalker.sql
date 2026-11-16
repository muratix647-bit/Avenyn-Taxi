CREATE TABLE `fare_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`start_price` real,
	`price_per_km` real,
	`price_per_minute` real,
	`waiting_per_hour` real,
	`minimum_fare` real,
	`large_vehicle_surcharge` real,
	`child_seat_surcharge` real,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_by` text
);
--> statement-breakpoint
CREATE TABLE `fixed_prices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`locality` text NOT NULL,
	`region` text DEFAULT '' NOT NULL,
	`destination` text NOT NULL,
	`price` real,
	`active` integer DEFAULT false NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_by` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_fixed_prices_locality_destination` ON `fixed_prices` (`locality`,`destination`);--> statement-breakpoint
CREATE INDEX `idx_fixed_prices_destination_active` ON `fixed_prices` (`destination`,`active`);
