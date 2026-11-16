# Economy tools integration – 2026-11-05

Mounted in the existing authenticated Dispatch Economy panel, after the existing payroll/receipt workspace. Existing reports and workspace flows are preserved. Same signed-in Supabase client is passed to the new tools; no service credentials are added to frontend code.

Included:
- Read-only 2026 gross/net salary previews, receipt VAT/BAS suggestions and monthly checklist through existing avenyn_ekonomi RPCs.
- JPG/PNG OCR with pinned Tesseract.js 7.0.0, processed in-browser (external language/engine assets downloaded). PDF manual entry. Manual review before private draft upload, duplicate check, signed original download. OCR drafts remain separate from the existing approved expense archive.
- Local SIE4 preview, CP437/UTF-8 decoding, basic structure/balance checks and organization mismatch warning. No import.

Not activated: ledger SQL, bookkeeping, period locks, tax-profile writes, invoice sending, bank payments or tax filing. The uploaded ledger migration requires separate staging and rollback testing before activation.

Validation:
- Production build completed; focused TypeScript check of six added modules passed.
- Receipt parser and SIE fixtures passed; component flow test covers OCR field fill, review invalidation, private upload and locking ambiguous saves to avoid automatic duplicates.
- Existing invoice-preview regression tests passed.
- Existing RPCs tested in rolled-back authenticated transactions: active admin preview calls succeeded; six nonadmin calls denied. Anonymous EXECUTE denied for all avenyn_ekonomi RPCs. Private bucket verified with admin-only read/insert, 10MB JPG/PNG/PDF limits.
- No real receipt upload, payroll write or invoice send used for validation.
- Managed browser preview failed to become healthy while optimizing the existing application. End-to-end browser/OCR network verification remains outstanding.
- Repository-wide typecheck contains errors outside these modules; do not treat the focused pass as a whole-project typecheck pass.

Commands:
node --experimental-strip-types tests/economy-sie-preview.test.mjs
node --experimental-strip-types tests/economy-receipt-parser.test.mjs
node tests/economy-tools-flow.test.cjs
node tests/business-invoice-preview.test.cjs

## Pending release: transfer calculated values into saved records

- The tools now live inside EconomyWorkspace. A selected driver's complete salary result fills a new payroll draft, with the payment month suggested as the editable payroll period. Gross, tax and employer fee retain their decimal precision; other salary additions remain zero for review.
- Reviewed receipt fields and the original File transfer to the existing receipt form. VAT deduction stays zero until explicitly entered; unknown/mixed VAT stays blank. Saving uses the existing authenticated receipt API and original file validation.
- Open/unsaved forms block transfers; a transferred result cannot be applied again. Existing payroll uniqueness and receipt request IDs remain unchanged.
- Existing separately saved OCR drafts remain readable; this change does not migrate them into expenses.
- Automated checks: transfer UI/state and request payloads, incomplete result rejection, receipt confirmation, repeat transfer lock, existing payroll/receipt API authorization and lifecycle, focused TypeScript and production build.
- Managed preview failed its health timeout after dependency installation; browser validation of this change is pending. Do not deploy until browser verification passes.
