# Avenyn Taxi source export
Sites version 492, commit 0a75f817269578fc73b4bae29efde578ebb78570.
Production fix: app/api/customer-bookings/route.ts explicitly selects drivers!bookings_driver_id_fkey(full_name).
Tests: node --test tests/customer-bookings-read.test.cjs tests/customer-flight.test.cjs
Assets are listed with SHA-256 and production URLs in sites-assets-manifest.json; binary Gradle wrappers are embedded there as base64. Run python scripts/restore-sites-assets.py to restore them. Runtime secrets are not included and must be configured separately.
Version 491 remains the rollback artifact in Sites. No business records or database policies were modified.
