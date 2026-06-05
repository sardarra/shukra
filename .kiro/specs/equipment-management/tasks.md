# Implementation Plan: Equipment Management

## Overview

Implement the Equipment Manager as a first-class feature within Shukra. The plan follows a bottom-up order: data layer → depreciation engine → API routes → React context → UI components → page assembly → ledger integration → reporting → reminders → integration and accessibility. Each task builds on the previous so the app is never left in a broken state.

## Tasks

- [x] 1. Data layer — types, schema, and Supabase helpers
  - [x] 1.1 Extend `lib/accounting-types.ts` with equipment types
    - Add `DepreciationMethod`, `AssetStatus`, `AssetCategory` union types
    - Add `EquipmentAsset`, `DepreciationRow`, `EquipmentReminder`, `EquipmentAuditLogEntry`, `CreateEquipmentAssetPayload`, `DisposalPayload`, `ParsedEquipmentAsset`, `PendingDepreciationBatch`, and `ReminderPayload` interfaces
    - Add `Gain on Disposal` and `Loss on Disposal` accounts to `ACCOUNTS` array with correct types and normal balances
    - _Requirements: 1.4, 3.1, 4.1, 6.1_

  - [x] 1.2 Create Supabase migration SQL file
    - Write `supabase/migrations/YYYYMMDD_equipment_management.sql` creating `equipment_assets`, `equipment_reminders`, `equipment_audit_log`, and `equipment_attachments` tables with all columns, foreign keys, and RLS policies as specified in the design
    - _Requirements: 1.4, 5.1, 6.5, 9.4_

  - [x] 1.3 Create `lib/supabase/equipment-assets.ts` client helpers
    - Implement `fetchEquipmentAssets(supabase)` — SELECT all rows for authenticated user, ordered by `purchase_date` DESC, mapping snake_case columns to camelCase `EquipmentAsset`
    - Implement `insertEquipmentAsset(supabase, payload)` — INSERT and return the new row
    - Implement `updateEquipmentAsset(supabase, id, patch)` — PATCH mutable fields and return updated row
    - Implement `softDeleteEquipmentAsset(supabase, id)` — set `status = 'Retired'` and `deleted_at`
    - Implement `insertAuditLogEntry(supabase, entry)` — INSERT into `equipment_audit_log`
    - Implement `insertReminder(supabase, reminder)` — INSERT into `equipment_reminders`
    - Implement `fetchReminders(supabase, assetId?)` — SELECT reminders for user, optionally filtered by asset
    - _Requirements: 1.4, 1.5, 5.1, 6.4, 6.5_

- [ ] 2. Depreciation engine — extend `lib/depreciation.ts`
  - [ ] 2.1 Implement `calculateDepreciationSchedule`
    - Add `calculateDepreciationSchedule(asset)` returning `DepreciationRow[]` for all four methods (SL, DDB, SYD, Section 179) using the formulas in the design
    - Return `[]` when `usefulLifeYears <= 0`; return zero-depreciation rows when `cost <= salvageValue`
    - Preserve existing `getAnnualDepreciation` for backward compatibility with `PlantAsset`
    - _Requirements: 3.4, 3.5, 4.1, 4.2, 4.4_

  - [ ] 2.2 Implement `getCurrentBookValue`, `getYTDDepreciation`, `getAccumulatedDepreciation`
    - `getCurrentBookValue(asset, asOf?)` — counts completed depreciation years from `purchaseDate` to `asOf` (default today), returns `cost - accumulatedDepreciation`
    - `getYTDDepreciation(asset, calendarYear)` — returns depreciation for the given calendar year; 0 if before purchase or after end of useful life
    - `getAccumulatedDepreciation(asset, asOf?)` — sum of annual depreciation for all completed years up to `asOf`
    - _Requirements: 3.1, 3.2, 3.3_

  - [ ] 2.3 Implement disposal journal entry builder
    - Add `buildDisposalJournalPayloads(asset, disposal)` returning an array of `JournalEntryInsertPayload` for the sale or retirement case, following the debit/credit structure in the design
    - Add `calculateGainLoss(asset, salePrice, asOf?)` returning `salePrice - bookValueAtDisposal`
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ]* 2.4 Write property tests for the depreciation engine — `lib/__tests__/depreciation.property.test.ts`
    - **Property 1: Book Value Invariant** — for any asset and method, every schedule row satisfies `bookValue = cost - accumulatedDepreciation`
    - **Property 2: Straight-Line Annual Depreciation is Constant** — every SL row has `annualDepreciation = (cost - salvageValue) / usefulLifeYears`
    - **Property 3: DDB Book Value Never Falls Below Salvage Value** — every DDB row has `bookValue >= salvageValue`
    - **Property 4: SYD Total Depreciation Equals Depreciable Base** — sum of SYD annual depreciation equals `cost - salvageValue`
    - **Property 5: Section 179 Full Expensing in Year 1** — year-1 row has `annualDepreciation = cost` and `bookValue = salvageValue`; all subsequent rows have `annualDepreciation = 0`
    - **Property 6: Depreciation Schedule Length Equals Useful Life** — `calculateDepreciationSchedule` returns exactly `usefulLifeYears` rows
    - **Validates: Requirements 3.3, 3.4, 3.5, 4.1, 4.2, 4.4**

  - [ ]* 2.5 Write property tests for disposal logic — `lib/__tests__/disposal.property.test.ts`
    - **Property 7: Disposal Gain/Loss Formula** — `gainLoss = salePrice - bookValueAtDisposal` for any asset and sale price
    - **Property 8: Disposal Journal Entries Are Balanced** — sum of debit amounts equals sum of credit amounts for any disposal
    - **Validates: Requirements 6.1, 6.2, 6.3**

- [ ] 3. Checkpoint — ensure all depreciation engine tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. API routes — equipment CRUD and parsing
  - [ ] 4.1 Create `app/api/parse-equipment/route.ts`
    - POST handler: authenticate via Supabase session cookie, call `checkAndIncrementUsage`, call Claude with an equipment-specific system prompt, return `ParsedEquipmentAsset` response shape including `remaining` and `resetAt`
    - Return 429 when quota is exhausted; 503 when AI service is unavailable
    - _Requirements: 1.1, 1.2_

  - [ ] 4.2 Create `app/api/equipment/route.ts` (GET + POST)
    - GET: authenticate, call `fetchEquipmentAssets`, return `{ ok: true, assets }` or error shape
    - POST: authenticate, validate body with Zod against `CreateEquipmentAssetPayload`, call `insertEquipmentAsset`, call `POST /api/journal-entries` for the purchase entry (debit Equipment, credit Cash or Accounts Payable), insert initial audit log entry, return created asset
    - _Requirements: 1.4, 1.5, 9.1_

  - [ ] 4.3 Create `app/api/equipment/[id]/route.ts` (PATCH + DELETE)
    - PATCH: authenticate, validate ownership, validate body, call `updateEquipmentAsset`; if `depreciationMethod` changed, insert `method_changed` audit log entry; if `status` changed to `'Sold'` or `'Retired'`, call `buildDisposalJournalPayloads` and post each entry via `/api/journal-entries`, insert `status_changed` audit log entry
    - DELETE: authenticate, validate ownership, call `softDeleteEquipmentAsset`, post write-off journal entries, insert `status_changed` audit log entry
    - Return 404 when asset not found; 403 when asset belongs to different user
    - _Requirements: 4.3, 6.2, 6.3, 6.4, 6.5_

  - [ ] 4.4 Create `app/api/equipment/[id]/depreciation-schedule/route.ts`
    - GET: authenticate, fetch asset, call `calculateDepreciationSchedule`, return `{ ok: true, schedule }`
    - _Requirements: 3.4_

  - [ ] 4.5 Create `app/api/equipment/[id]/reminders/route.ts`
    - POST: authenticate, validate body (`type`, `targetDate`, optional `notes`), call `insertReminder`, return created reminder
    - GET: authenticate, call `fetchReminders(supabase, id)`, return reminders array
    - _Requirements: 5.1_

  - [ ] 4.6 Create `app/api/equipment/reports/route.ts`
    - GET: authenticate, parse query params (`type`, `year`, `format`), fetch all assets, compute accumulated depreciation and book value for each, assemble Fixed Asset Schedule or Depreciation Summary JSON; if `format === 'csv'` serialize to CSV and return with `Content-Type: text/csv`
    - Include business name (from user metadata or fallback), generation date, and date range in the report payload
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ] 5. `EquipmentProvider` React context
  - [ ] 5.1 Create `components/equipment/equipment-provider.tsx`
    - Implement `EquipmentProvider` with the full `EquipmentContextType` interface from the design: `assets`, `isLoading`, `error`, `pendingDepreciationEntries`, `reminderBadgeCount`, and all action methods
    - On mount (when user is authenticated), fetch assets via `GET /api/equipment` and reminders via `GET /api/equipment/:id/reminders`; compute `reminderBadgeCount` as count of reminders with `targetDate` within 30 days and `isDismissed = false`
    - Implement `createAsset`, `updateAsset`, `disposeAsset`, `deleteAsset`, `createReminder`, `approvePendingDepreciation`, `rejectPendingDepreciation`, `getDepreciationSchedule` calling the corresponding API routes and updating local state optimistically
    - Surface toast notifications (via `sonner`) for network errors
    - _Requirements: 1.4, 1.5, 5.2, 8.1, 8.2, 9.3, 9.4, 9.5_

  - [ ]* 5.2 Write unit tests for `EquipmentProvider` state transitions
    - Mock `fetch`; verify state updates on `createAsset`, `updateAsset`, `disposeAsset`
    - Verify `reminderBadgeCount` increments when a reminder within 30 days is added
    - Verify `error` is set on network failure
    - _Requirements: 1.5, 5.2, 8.2_

- [ ] 6. UI components — bottom-up
  - [ ] 6.1 Create `components/equipment/equipment-summary-panel.tsx`
    - Render 4 KPI cards: active asset count, total original cost, total accumulated depreciation, total current book value
    - Consume `assets` from `EquipmentProvider`; compute totals using `getCurrentBookValue` and `getAccumulatedDepreciation`
    - _Requirements: 8.1, 8.2_

  - [ ]* 6.2 Write property test for summary panel totals — `lib/__tests__/summary.property.test.ts`
    - **Property 10: Summary Panel Totals Equal Sum of Individual Asset Values** — `totalCost`, `totalAccumulatedDepreciation`, and `totalBookValue` equal the sum of individual asset values for any list of active assets
    - **Validates: Requirements 8.1, 8.2**

  - [ ] 6.3 Create `components/equipment/equipment-table.tsx`
    - Render a `<table>` with `<th scope="col">` headers: Name, Category, Purchase Date, Cost, Book Value, YTD Depreciation, Status
    - Implement column-header click sorting (ascending/descending toggle)
    - Implement filter controls: category multi-select, status multi-select, date range picker
    - Implement search bar filtering by name/description
    - Highlight rows where a reminder is due within 30 days
    - Each row is clickable to open `AssetDetailSheet`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6, 5.2_

  - [ ]* 6.4 Write property test for filter logic — `lib/__tests__/filter.property.test.ts`
    - **Property 11: Filter Returns Only Matching Records** — every asset in the filtered result satisfies all filter criteria; no matching asset is absent
    - **Validates: Requirements 2.3, 2.4**

  - [ ] 6.5 Create `components/equipment/depreciation-schedule-table.tsx`
    - Render a year-by-year table: Year, Calendar Year, Annual Depreciation, Accumulated Depreciation, Book Value
    - Render a Recharts `AreaChart` of book value over time below the table
    - Accept `schedule: DepreciationRow[]` as a prop
    - _Requirements: 3.4_

  - [ ] 6.6 Create `components/equipment/reminder-form.tsx`
    - Form with reminder type selector (warranty expiration, scheduled maintenance, insurance renewal, loan/lease payment due) and a date picker
    - On submit, call `createReminder` from `EquipmentProvider`
    - _Requirements: 5.1_

  - [ ] 6.7 Create `components/equipment/disposal-dialog.tsx`
    - shadcn `Dialog` with `role="dialog"` and `aria-labelledby`
    - Radio group: Sold vs. Retired
    - When Sold: show sale date and sale price inputs; compute and display gain/loss preview using `calculateGainLoss`
    - On confirm, call `disposeAsset` from `EquipmentProvider`
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ] 6.8 Create `components/equipment/asset-detail-sheet.tsx`
    - shadcn `Sheet` (slide-over) with focus trap when open
    - Sections: asset details (all fields, editable inline), `DepreciationScheduleTable`, `ReminderForm` + reminder list, audit log timeline
    - Disposal button opens `DisposalDialog`
    - _Requirements: 3.4, 4.3, 5.1, 6.4_

  - [ ] 6.9 Create `components/equipment/add-equipment-dialog.tsx`
    - shadcn `Dialog` with `role="dialog"` and `aria-labelledby`
    - Step 1: natural-language textarea + "Parse" button → calls `POST /api/parse-equipment`; shows loading state
    - Step 2: review/edit form pre-populated with parsed values; all fields editable; shows confidence indicator
    - On confirm, calls `createAsset` from `EquipmentProvider`
    - Inline `react-hook-form` validation errors on all required fields
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ] 6.10 Create `components/equipment/equipment-report-export.tsx`
    - Dropdown button: Fixed Asset Schedule (PDF), Fixed Asset Schedule (CSV), Depreciation Summary (PDF), Depreciation Summary (CSV)
    - CSV: fetch from `GET /api/equipment/reports?format=csv` and trigger browser download
    - PDF: fetch JSON from `GET /api/equipment/reports?format=json`, render into a printable `<div>` with report header (business name, generation date, date range), and call `window.print()`
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ]* 6.11 Write property test for report completeness — `lib/__tests__/reports.property.test.ts`
    - **Property 9: Report Contains All Required Fields for Every Asset** — for any list of assets, the Fixed Asset Schedule contains name, category, purchase date, original cost, accumulated depreciation, and book value for each asset, plus business name, generation date, and date range in the header
    - **Validates: Requirements 7.1, 7.2, 7.3**

- [ ] 7. Checkpoint — ensure all component unit tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Page assembly — wire everything together
  - [ ] 8.1 Rewrite `app/(app)/equipment/page.tsx`
    - Wrap page content in `<EquipmentProvider>`
    - Render `EquipmentSummaryPanel`, `EquipmentTable`, floating "Add Equipment" button that opens `AddEquipmentDialog`, and `EquipmentReportExport`
    - Render an alert banner when `EquipmentProvider.error` is non-null (consistent with `AccountingProvider` pattern)
    - Render a pending depreciation review banner when `pendingDepreciationEntries` is non-null, with Approve and Reject buttons
    - _Requirements: 1.5, 2.1, 8.1, 9.3, 9.4, 9.5_

  - [ ]* 8.2 Write property test for asset save persistence — `lib/__tests__/equipment-asset.property.test.ts`
    - **Property 12: Asset Save Persists All Required Fields** — for any valid `CreateEquipmentAssetPayload`, the saved `EquipmentAsset` contains all required fields with matching values and `status = 'Active'`
    - **Validates: Requirements 1.4**

- [ ] 9. Ledger integration — auto-depreciation and balance sheet
  - [ ] 9.1 Extend `app/api/journal-entries/route.ts` to include equipment assets in the GET response
    - After fetching journal entries, also call `fetchEquipmentAssets` and return them as `equipmentAssets` in the response
    - _Requirements: 9.1, 9.2_

  - [ ] 9.2 Update `components/accounting-provider.tsx` to load and expose `equipmentAssets`
    - Read `equipmentAssets` from the `GET /api/journal-entries` response and store in state
    - Pass `equipmentAssets` to `calculateBalanceSheet` so managed assets appear correctly on the balance sheet (prefer `EquipmentAsset` records over inferred `PlantAsset` records for the same journal entry)
    - _Requirements: 9.1_

  - [ ] 9.3 Implement auto-depreciation generation in `EquipmentProvider`
    - On load, compute pending monthly depreciation entries for all active `EquipmentAsset` records where the current month has not yet been depreciated (check `lastDepreciatedDate`)
    - Store as `pendingDepreciationEntries` in context state
    - When user approves, call `POST /api/journal-entries` for each entry atomically and update `lastDepreciatedDate` via `PATCH /api/equipment/:id`
    - When user rejects, call `insertAuditLogEntry` with `action: 'depreciation_rejected'`
    - _Requirements: 9.2, 9.3, 9.4, 9.5_

  - [ ] 9.4 Update sidebar reminder badge
    - In `components/app-sidebar.tsx`, read `reminderBadgeCount` from `EquipmentProvider` (or a shared context) and render a numeric badge on the Equipment nav entry when count > 0
    - _Requirements: 5.2_

- [ ] 10. Checkpoint — ensure ledger integration tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Reminders and notifications
  - [ ] 11.1 Implement in-app reminder notification surface
    - In `EquipmentProvider`, on load compute reminders due within 30 days and set `reminderBadgeCount`
    - In `EquipmentTable`, highlight rows with due reminders using a distinct background color and a text label (not color alone)
    - In `AssetDetailSheet`, show a reminder list with due-date proximity indicator
    - _Requirements: 5.2, 5.3_

  - [ ] 11.2 Implement email notification opt-in and sending
    - Add an `emailAlertsEnabled` boolean to user preferences (stored in Supabase user metadata or a `user_preferences` table)
    - Create `app/api/equipment/reminders/notify/route.ts` — POST handler that checks all reminders due today for users with `emailAlertsEnabled = true` and sends email via the existing email infrastructure (or Supabase Edge Function); intended to be called by a scheduled job or cron
    - _Requirements: 5.4_

- [ ] 12. Accessibility audit and WCAG 2.1 AA fixes
  - [ ] 12.1 Audit and fix `EquipmentTable` accessibility
    - Verify `<table>` uses `<th scope="col">` for all column headers
    - Verify all interactive elements (sort buttons, filter controls, row click targets) have visible focus indicators and accessible labels
    - Verify status badges include text labels (not color alone)
    - _Requirements: 2.6_

  - [ ] 12.2 Audit and fix dialog and sheet accessibility
    - Verify `AddEquipmentDialog` and `DisposalDialog` have `role="dialog"` and `aria-labelledby` pointing to the dialog title
    - Verify `AssetDetailSheet` traps focus when open and restores focus on close
    - Verify all form inputs have associated `<label>` elements
    - _Requirements: 1.2, 1.3, 6.1_

- [ ] 13. Final checkpoint — full integration pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness invariants; unit tests validate specific examples and edge cases
- The depreciation engine (`lib/depreciation.ts`) is extended in-place; existing `getAnnualDepreciation` and `PlantAsset` logic is preserved for backward compatibility
- `EquipmentAsset` records take precedence over inferred `PlantAsset` records on the balance sheet when both reference the same journal entry
- Disposal journal entries follow the multi-line debit/credit structure in the design; each line is posted as a separate call to `POST /api/journal-entries` or as a batch if the API is extended to support it
- PDF export uses the browser print API (same pattern as the existing balance sheet export); no server-side PDF library is required

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3"] },
    { "id": 2, "tasks": ["2.1", "2.2", "2.3"] },
    { "id": 3, "tasks": ["2.4", "2.5", "4.1", "4.2"] },
    { "id": 4, "tasks": ["4.3", "4.4", "4.5", "4.6"] },
    { "id": 5, "tasks": ["5.1"] },
    { "id": 6, "tasks": ["5.2", "6.1", "6.3", "6.5", "6.6", "6.7"] },
    { "id": 7, "tasks": ["6.2", "6.4", "6.8", "6.9", "6.10"] },
    { "id": 8, "tasks": ["6.11", "8.1"] },
    { "id": 9, "tasks": ["8.2", "9.1", "9.2"] },
    { "id": 10, "tasks": ["9.3", "9.4"] },
    { "id": 11, "tasks": ["11.1", "11.2"] },
    { "id": 12, "tasks": ["12.1", "12.2"] }
  ]
}
```
