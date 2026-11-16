import assert from "node:assert/strict";
import test from "node:test";
import { allowsMeteredFallback } from "./prices.ts";

test("Landvetter routes can never use a metered fallback", () => {
  assert.equal(allowsMeteredFallback("Legendgatan 164, Backa, 422 55, Göteborg", "Landvetter Airport (Göteborg Landvetter Airport)", "nominatim:node:3421134862", "se-got-landvetter-airport"), false);
  assert.equal(allowsMeteredFallback("Göteborg Landvetter flygplats", "Alingsås", null, null), false);
});

test("ordinary non-airport journeys may use the configured route pricing", () => {
  assert.equal(allowsMeteredFallback("Alingsås", "Göteborg Centralstation", null, "se-got-central-station"), true);
});
