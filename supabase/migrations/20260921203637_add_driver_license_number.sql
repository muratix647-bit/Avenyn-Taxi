alter table public.drivers
add column if not exists taxi_driver_license_number text;

create unique index if not exists drivers_taxi_driver_license_number_unique
on public.drivers (lower(taxi_driver_license_number))
where taxi_driver_license_number is not null;
