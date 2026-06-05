# Design Document: Equipment Management

## Overview

The Equipment Manager is a dedicated module within Shukra that gives small business owners a complete view of their physical assets. It extends the existing plant asset tracking (which currently infers assets from journal entries) into a first-class feature with its own data model, API routes, depreciation engine, and UI.

The design follows Shukra's established patterns: Next.js App Router, Supabase for persistence, React Context for client state, and Claude (via the AI SDK) for natural-language parsing. The Equipment Manager integrates tightly with the existing general ledger — every asset acquisition and disposal posts journal entries through the existing `/api/journal-entries` infrastructure.

### Key Design Decisions

- **Separate `equipment_assets` table** rather than extending `plantAssets`. The new feature needs fields (status, category, depreciation method, audit log, reminders, attachments, disposal data) that would bloat the existing table and break the inference-based sync logic.
- **`EquipmentAsset` supersedes `PlantAsset` for managed assets.** Assets created through the Equipment Manager are stored in `equipment_assets`. The existing `plantAssets` table continues to serve assets inferred from raw journal entries. The balance sheet and ledger integration will prefer `equipment_assets` records when available.
- **Depreciation engine is pure TypeScript.** All four methods (SL, DDB, SYD, Section 179) are implemented as pure functions in `lib/depreciation.ts`, making them trivially testable and reusable across API routes and UI components.
- **Ledger integration via existing `/api/journal-entries`.** Asset saves and disposals call the existing journal entry API rather than writing directly to Supabase, preserving the single source of truth for the general ledger.
- **Pending-review pattern for auto-generated depreciation entries.** Consistent with the existing `AccountingProvider` confirm/cancel flow, auto-generated monthly depreciation entries are surfaced for user review before being committed.

## Architecture

```mermaid
graph TD
    subgraph "Client (Browser)"
        EP[EquipmentPage<br/>app/(app)/equipment/page.tsx]
        EP --> ESP[EquipmentSummaryPanel]
        EP --> ET[EquipmentTable]
        EP --> AED[AddEquipmentDialog]
        EP --> ADS[AssetDetailSheet]
        ADS --> DST[DepreciationScheduleTable]
        ADS --> RF[ReminderForm]
        ADS --> DD[DisposalDialog]
        EP --> ERE[EquipmentReportExport]
        EP --> ECtx[EquipmentProvider<br/>React Context]
    end

    subgraph "API Routes (Next.js)"
        R1[POST /api/equipment]
        R2[GET /api/equipment]
        R3[PATCH /api/equipment/:id]
        R4[DELETE /api/equipment/:id]
        R5[GET /api/equipment/:id/depreciation-schedule]
        R6[POST /api/equipment/:id/reminders]
        R7[GET /api/equipment/reports]
        R8[POST /api/parse-equipment]
    end

    subgraph "Business Logic (lib/)"
        DE[lib/depreciation.ts<br/>Extended engine]
        AT[lib/accounting-types.ts<br/>EquipmentAsset type]
        ES[lib/supabase/equipment-assets.ts]
    end

    subgraph "Existing Infrastructure"
        JE[POST /api/journal-entries]
        SB[(Supabase)]
    end

    ECtx --> R1 & R2 & R3 & R4 & R5 & R6 & R7
    AED --> R8
    R1 & R3 & R4 --> JE
    R1 & R2 & R3 & R4 & R6 --> ES
    ES --> SB
    DE --> R1 & R3 & R5 & R7
```

The Equipment Manager introduces a new `EquipmentProvider` React context (analogous to `AccountingProvider`) that owns equipment-specific state: the asset list, pending depreciation entries, loading/error state, and reminder badges. It is mounted inside the existing `AccountingProvider` so both contexts are available on the equipment page.

## Components and Interfaces

### New API Routes

#### `POST /api/parse-equipment`
Accepts a plain-English description and returns a structured `ParsedEquipmentAsset`. Uses Claude (same model as `parse-transaction`) with an equipment-specific system prompt. Subject to the same daily quota via `checkAndIncrementUsage`.

Request body:
```ts
{ input: string; todayDate: string }
```

Response:
```ts
{
  assetName: string
  category: string | null
  purchaseDate: string | null
  cost: number | null
  usefulLifeYears: number | null
  depreciationMethodHint: 'SL' | 'DDB' | 'SYD' | 'Section179' | null
  salvageValue: number | null
  confidence: number
  messageToUser: string | null
  remaining: number
  resetAt: string
}
```

#### `POST /api/equipment`
Creates a new `EquipmentAsset` record and posts the purchase journal entry.

Request body: `CreateEquipmentAssetPayload` (see Data Models).

Side effects:
1. Inserts row into `equipment_assets`.
2. Calls `POST /api/journal-entries` with `debitAccount: 'Equipment'`, `creditAccount: 'Cash'` (or `'Accounts Payable'` if `paymentMethod === 'credit'`), `debitAmount: cost`.
3. Inserts initial audit log entry.

#### `GET /api/equipment`
Returns all `EquipmentAsset` records for the authenticated user, ordered by `purchase_date` descending.

Response: `{ ok: boolean; assets: EquipmentAsset[]; error: string | null }`

#### `PATCH /api/equipment/[id]`
Partial update. Accepts any subset of mutable fields. If `depreciationMethod` changes, records the change in `equipment_audit_log`. If `status` changes to `'Sold'` or `'Retired'`, triggers disposal journal entry logic.

#### `DELETE /api/equipment/[id]`
Soft-delete: sets `status = 'Retired'` and `deletedAt` timestamp. Does not remove the row. Posts a write-off journal entry.

#### `GET /api/equipment/[id]/depreciation-schedule`
Returns the full year-by-year schedule computed by `calculateDepreciationSchedule`.

Response: `{ ok: boolean; schedule: DepreciationRow[]; error: string | null }`

#### `POST /api/equipment/[id]/reminders`
Creates a reminder record in `equipment_reminders`.

Request body: `{ type: ReminderType; targetDate: string; notes?: string }`

#### `GET /api/equipment/reports`
Generates a Fixed Asset Schedule or Depreciation Summary.

Query params: `type: 'fixed-asset-schedule' | 'depreciation-summary'`, `year?: number`, `format: 'json' | 'csv'`

For PDF export, the client renders the JSON response into a printable view and uses the browser's print API (same pattern as the existing balance sheet export).

### New UI Components (`components/equipment/`)

| Component | Responsibility |
|---|---|
| `EquipmentPage` | Page shell; mounts `EquipmentProvider`, renders summary + table + floating add button |
| `EquipmentProvider` | React context; owns asset list, pending depreciation entries, reminder badge state |
| `EquipmentSummaryPanel` | 4 KPI cards: active asset count, total cost, total accumulated depreciation, total book value |
| `EquipmentTable` | Sortable/filterable table; columns: Name, Category, Purchase Date, Cost, Book Value, YTD Depreciation, Status |
| `AddEquipmentDialog` | Natural-language input → AI parse → review/edit form → save |
| `AssetDetailSheet` | Slide-over (shadcn `Sheet`) showing full asset details, depreciation schedule, reminders, audit log |
| `DepreciationScheduleTable` | Year-by-year table + Recharts area chart of book value over time |
| `ReminderForm` | Add/edit reminder with type selector and date picker |
| `DisposalDialog` | Mark as Sold (with sale price) or Retired; shows calculated gain/loss before confirm |
| `EquipmentReportExport` | Dropdown: Fixed Asset Schedule (PDF/CSV) or Depreciation Summary (PDF/CSV) |

### `EquipmentProvider` Interface

```ts
interface EquipmentContextType {
  assets: EquipmentAsset[]
  isLoading: boolean
  error: string | null
  pendingDepreciationEntries: PendingDepreciationBatch | null
  reminderBadgeCount: number
  // Actions
  createAsset: (payload: CreateEquipmentAssetPayload) => Promise<void>
  updateAsset: (id: string, patch: Partial<EquipmentAsset>) => Promise<void>
  disposeAsset: (id: string, disposal: DisposalPayload) => Promise<void>
  deleteAsset: (id: string) => Promise<void>
  createReminder: (assetId: string, reminder: ReminderPayload) => Promise<void>
  approvePendingDepreciation: () => Promise<void>
  rejectPendingDepreciation: () => void
  getDepreciationSchedule: (assetId: string) => Promise<DepreciationRow[]>
}
```

`PendingDepreciationBatch` holds the auto-generated monthly depreciation journal entries (one per active asset) that are surfaced for user review, mirroring the `pendingEntry` pattern in `AccountingProvider`.

## Data Models

### `EquipmentAsset` (TypeScript)

```ts
export type DepreciationMethod = 'SL' | 'DDB' | 'SYD' | 'Section179'
export type AssetStatus = 'Active' | 'Sold' | 'Retired'
export type AssetCategory =
  | 'Machinery'
  | 'Vehicles'
  | 'Computers & Technology'
  | 'Furniture & Fixtures'
  | 'Buildings & Improvements'
  | 'Other'

export interface EquipmentAsset {
  id: string
  userId: string
  // Core identity
  name: string
  specificName: string
  category: AssetCategory
  description: string | null
  // Financial
  account: string                    // e.g. "Equipment"
  cost: number
  salvageValue: number
  usefulLifeYears: number
  depreciationMethod: DepreciationMethod
  // Dates
  purchaseDate: string               // ISO date
  lastDepreciatedDate: string | null
  // Status & disposal
  status: AssetStatus
  saleDate: string | null
  salePrice: number | null
  gainLoss: number | null
  // Ledger linkage
  associatedJournalEntryId: string | null
  // Metadata
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}
```

### `DepreciationRow` (TypeScript)

```ts
export interface DepreciationRow {
  year: number                       // 1-indexed year of useful life
  calendarYear: number               // actual calendar year
  annualDepreciation: number
  accumulatedDepreciation: number
  bookValue: number
}
```

### `EquipmentReminder` (TypeScript)

```ts
export type ReminderType =
  | 'warranty_expiration'
  | 'scheduled_maintenance'
  | 'insurance_renewal'
  | 'loan_payment_due'

export interface EquipmentReminder {
  id: string
  assetId: string
  userId: string
  type: ReminderType
  targetDate: string                 // ISO date
  notes: string | null
  isDismissed: boolean
  createdAt: string
}
```

### `EquipmentAuditLogEntry` (TypeScript)

```ts
export type AuditAction =
  | 'created'
  | 'method_changed'
  | 'status_changed'
  | 'depreciation_rejected'
  | 'field_updated'

export interface EquipmentAuditLogEntry {
  id: string
  assetId: string
  userId: string
  action: AuditAction
  previousValue: string | null       // JSON-serialized previous state
  newValue: string | null            // JSON-serialized new state
  createdAt: string
}
```

### `CreateEquipmentAssetPayload` (TypeScript)

```ts
export interface CreateEquipmentAssetPayload {
  name: string
  specificName: string
  category: AssetCategory
  description?: string
  purchaseDate: string
  cost: number
  salvageValue: number
  usefulLifeYears: number
  depreciationMethod: DepreciationMethod
  paymentMethod: 'cash' | 'credit'   // determines credit account in journal entry
}
```

### `DisposalPayload` (TypeScript)

```ts
export interface DisposalPayload {
  disposalType: 'Sold' | 'Retired'
  saleDate: string
  salePrice?: number                 // required when disposalType === 'Sold'
}
```

### Supabase Schema

#### `equipment_assets`

```sql
CREATE TABLE IF NOT EXISTS equipment_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  name text NOT NULL,
  specific_name text NOT NULL,
  category text NOT NULL,
  description text,
  account text NOT NULL DEFAULT 'Equipment',
  cost numeric NOT NULL,
  salvage_value numeric NOT NULL DEFAULT 0,
  useful_life_years integer NOT NULL,
  depreciation_method text NOT NULL DEFAULT 'SL',
  purchase_date date NOT NULL,
  last_depreciated_date timestamptz,
  status text NOT NULL DEFAULT 'Active',
  sale_date date,
  sale_price numeric,
  gain_loss numeric,
  associated_journal_entry_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE equipment_assets ENABLE ROW LEVEL SECURITY;
-- RLS policies: select/insert/update/delete own rows (auth.uid()::text = user_id)
```

#### `equipment_reminders`

```sql
CREATE TABLE IF NOT EXISTS equipment_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES equipment_assets(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  type text NOT NULL,
  target_date date NOT NULL,
  notes text,
  is_dismissed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE equipment_reminders ENABLE ROW LEVEL SECURITY;
```

#### `equipment_audit_log`

```sql
CREATE TABLE IF NOT EXISTS equipment_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES equipment_assets(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  action text NOT NULL,
  previous_value text,
  new_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE equipment_audit_log ENABLE ROW LEVEL SECURITY;
```

#### `equipment_attachments`

```sql
CREATE TABLE IF NOT EXISTS equipment_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES equipment_assets(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  file_name text NOT NULL,
  storage_path text NOT NULL,        -- Supabase Storage path
  mime_type text,
  file_size_bytes integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE equipment_attachments ENABLE ROW LEVEL SECURITY;
```

Attachments are stored in a Supabase Storage bucket (`equipment-attachments`) with per-user path prefixes (`{userId}/{assetId}/{filename}`). RLS on the bucket mirrors the table policies.

## Depreciation Engine

The depreciation engine lives in `lib/depreciation.ts` as pure, side-effect-free functions. All four methods are implemented and the existing `getAnnualDepreciation` (straight-line only) is preserved for backward compatibility with `PlantAsset`.

### Core Functions

```ts
/**
 * Calculate the full year-by-year depreciation schedule for an asset.
 * Returns one row per year of useful life.
 */
export function calculateDepreciationSchedule(
  asset: Pick<EquipmentAsset, 'cost' | 'salvageValue' | 'usefulLifeYears' | 'depreciationMethod' | 'purchaseDate'>
): DepreciationRow[]

/**
 * Book value as of a given date (defaults to today).
 * Counts completed depreciation years from purchaseDate.
 */
export function getCurrentBookValue(
  asset: Pick<EquipmentAsset, 'cost' | 'salvageValue' | 'usefulLifeYears' | 'depreciationMethod' | 'purchaseDate'>
): number

/**
 * Depreciation expense for a specific calendar year.
 * Returns 0 if the year is before purchase or after end of useful life.
 */
export function getYTDDepreciation(
  asset: Pick<EquipmentAsset, 'cost' | 'salvageValue' | 'usefulLifeYears' | 'depreciationMethod' | 'purchaseDate'>,
  calendarYear: number
): number

/**
 * Accumulated depreciation as of a given date.
 */
export function getAccumulatedDepreciation(
  asset: Pick<EquipmentAsset, 'cost' | 'salvageValue' | 'usefulLifeYears' | 'depreciationMethod' | 'purchaseDate'>,
  asOf?: Date
): number
```

### Method Implementations

**Straight-Line (SL)**
```
annualDepreciation = (cost - salvageValue) / usefulLifeYears
```
Constant each year. Book value decreases linearly to salvage value.

**Double Declining Balance (DDB)**
```
rate = 2 / usefulLifeYears
annualDepreciation[y] = min(bookValue[y-1] * rate, bookValue[y-1] - salvageValue)
```
Applied to remaining book value each year. Book value never drops below salvage value — the `min` guard enforces this.

**Sum-of-Years-Digits (SYD)**
```
SYD = usefulLifeYears * (usefulLifeYears + 1) / 2
annualDepreciation[y] = (cost - salvageValue) * (usefulLifeYears - y + 1) / SYD
```
Front-loaded. Sum of all annual depreciation equals `cost - salvageValue`.

**Section 179**
```
year1Depreciation = cost
bookValueAfterYear1 = salvageValue
annualDepreciation[y > 1] = 0
```
Full expensing in year 1. Book value drops to salvage value immediately.

### Ledger Integration

When an asset is saved via `POST /api/equipment`, the route handler calls `POST /api/journal-entries` with:
```
Debit:  Equipment                    $cost
Credit: Cash | Accounts Payable      $cost
```

When an asset is disposed (sold), the route handler posts:
```
Debit:  Accumulated Depreciation - {assetName}   $accumulatedDepreciation
Debit:  Cash                                      $salePrice
Debit:  Loss on Disposal (if loss)                $|gainLoss|
Credit: Equipment                                 $cost
Credit: Gain on Disposal (if gain)                $gainLoss
```

When an asset is retired (no sale proceeds):
```
Debit:  Accumulated Depreciation - {assetName}   $accumulatedDepreciation
Debit:  Loss on Disposal                          $bookValue
Credit: Equipment                                 $cost
```

Monthly depreciation entries (auto-generated, pending review):
```
Debit:  Depreciation Expense - {assetName}        $monthlyAmount
Credit: Accumulated Depreciation - {assetName}    $monthlyAmount
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

The depreciation engine is a set of pure functions with well-defined mathematical specifications, making it an ideal candidate for property-based testing. The properties below are derived from the acceptance criteria prework analysis and cover the core invariants of the depreciation calculations, disposal accounting, filtering/sorting logic, and summary aggregations.

**Property reflection:** After reviewing all testable criteria, several properties were consolidated:
- Requirements 3.3 and 3.4 both express the book value invariant — consolidated into Property 1.
- Requirements 3.5, 4.2, and 4.4 all test method-specific correctness — kept separate because each method has a distinct mathematical invariant.
- Requirements 6.1 and 6.2/6.3 both involve disposal accounting — consolidated into Property 7 (gain/loss formula) and Property 8 (journal entry balance), since the journal entry balance property subsumes the individual account checks.
- Requirements 7.1, 7.2, and 7.3 all test report content — consolidated into Property 9 (report completeness) since the header requirement is a special case of completeness.
- Requirements 8.1 and 8.2 both test summary aggregation — consolidated into Property 10.

---

### Property 1: Book Value Invariant

*For any* equipment asset with any supported depreciation method, at every year `y` in the depreciation schedule, `bookValue[y]` must equal `cost - accumulatedDepreciation[y]`.

**Validates: Requirements 3.3, 3.4**

---

### Property 2: Straight-Line Annual Depreciation is Constant

*For any* asset using the Straight-Line method with `cost > salvageValue` and `usefulLifeYears > 0`, every row in the depreciation schedule must have `annualDepreciation = (cost - salvageValue) / usefulLifeYears`.

**Validates: Requirements 3.5, 4.1, 4.2**

---

### Property 3: DDB Book Value Never Falls Below Salvage Value

*For any* asset using the Double Declining Balance method, every row in the depreciation schedule must have `bookValue >= salvageValue`.

**Validates: Requirements 3.5, 4.1, 4.2**

---

### Property 4: SYD Total Depreciation Equals Depreciable Base

*For any* asset using the Sum-of-Years-Digits method, the sum of all `annualDepreciation` values across the full schedule must equal `cost - salvageValue`.

**Validates: Requirements 3.5, 4.1, 4.2**

---

### Property 5: Section 179 Full Expensing in Year 1

*For any* asset using Section 179, the depreciation schedule must have `annualDepreciation[year=1] = cost` and `bookValue[year=1] = salvageValue`, and all subsequent years must have `annualDepreciation = 0`.

**Validates: Requirements 4.4**

---

### Property 6: Depreciation Schedule Length Equals Useful Life

*For any* asset with `usefulLifeYears = n`, `calculateDepreciationSchedule` must return exactly `n` rows.

**Validates: Requirements 3.4**

---

### Property 7: Disposal Gain/Loss Formula

*For any* asset with a known book value at disposal date and any sale price, `gainLoss = salePrice - bookValueAtDisposal`. A positive value is a gain; a negative value is a loss.

**Validates: Requirements 6.1**

---

### Property 8: Disposal Journal Entries Are Balanced

*For any* asset disposal (sale or retirement), the set of journal entries generated must be balanced: the sum of all debit amounts must equal the sum of all credit amounts.

**Validates: Requirements 6.2, 6.3**

---

### Property 9: Report Contains All Required Fields for Every Asset

*For any* list of equipment assets, the generated Fixed Asset Schedule report must contain, for each asset: name, category, purchase date, original cost, accumulated depreciation, and book value. The report header must include business name, generation date, and date range.

**Validates: Requirements 7.1, 7.2, 7.3**

---

### Property 10: Summary Panel Totals Equal Sum of Individual Asset Values

*For any* list of active equipment assets, the summary panel must display: `totalCost = sum(asset.cost)`, `totalAccumulatedDepreciation = sum(getAccumulatedDepreciation(asset))`, and `totalBookValue = sum(getCurrentBookValue(asset))`.

**Validates: Requirements 8.1, 8.2**

---

### Property 11: Filter Returns Only Matching Records

*For any* list of assets and any combination of filter criteria (category, status, date range), every asset in the filtered result must satisfy all filter criteria, and no asset satisfying all criteria must be absent from the result.

**Validates: Requirements 2.3, 2.4**

---

### Property 12: Asset Save Persists All Required Fields

*For any* valid `CreateEquipmentAssetPayload`, the saved `EquipmentAsset` record must contain all required fields with values matching the input: name, category, purchase date, cost, salvage value, useful life, depreciation method, status (`'Active'`), and a computed book value equal to `cost` (no depreciation yet in year of purchase).

**Validates: Requirements 1.4**

## Error Handling

### API Route Errors

All API routes follow the existing pattern: return `{ ok: false, error: string }` with an appropriate HTTP status code.

| Scenario | Status | Error message |
|---|---|---|
| Unauthenticated request | 401 | `'Unauthorized'` |
| Invalid request body (Zod failure) | 400 | `'Invalid request payload'` |
| Asset not found | 404 | `'Asset not found'` |
| Asset belongs to different user | 403 | `'Forbidden'` |
| Supabase write failure | 500 | `'Failed to persist asset'` |
| Journal entry post failure | 500 | `'Failed to post journal entry'` |
| AI quota exhausted | 429 | `'Daily prompt limit reached'` |
| AI service unavailable | 503 | `'Service temporarily unavailable'` |

### Atomicity

Asset mutations that require both a Supabase write and a journal entry post are executed in sequence. If the journal entry post fails after the asset row is written, the API returns a 500 and the client displays an error. The asset row is left in a `pending_journal` state (tracked via an `associatedJournalEntryId: null` check) so the user can retry. A future migration can add a Postgres transaction wrapper once the journal entries table is co-located.

### Depreciation Engine Errors

- `usefulLifeYears <= 0`: `calculateDepreciationSchedule` returns `[]`.
- `cost <= salvageValue`: All methods return zero depreciation (no depreciable base).
- `cost < 0` or `salvageValue < 0`: Treated as invalid input; the API route rejects via Zod validation before reaching the engine.

### UI Error States

- Network errors surface as toast notifications (using the existing `sonner` package already in `node_modules`).
- Validation errors on the `AddEquipmentDialog` form are shown inline using `react-hook-form` field-level errors.
- The `EquipmentProvider` exposes an `error: string | null` field that the page renders as an alert banner, consistent with `AccountingProvider`.

## Testing Strategy

### Dual Testing Approach

Unit tests cover specific examples, edge cases, and error conditions. Property-based tests verify universal invariants across the depreciation engine and business logic. Together they provide comprehensive coverage.

### Property-Based Testing

The depreciation engine functions are pure TypeScript with no I/O, making them ideal for property-based testing. The project uses **fast-check** (already available in the Node.js ecosystem and compatible with Jest/Vitest) as the PBT library.

Each property test runs a minimum of **100 iterations** with randomly generated inputs. Tests are tagged with a comment referencing the design property:

```ts
// Feature: equipment-management, Property 1: Book Value Invariant
it.prop([assetArbitrary, methodArbitrary])('book value invariant holds', (asset, method) => {
  const schedule = calculateDepreciationSchedule({ ...asset, depreciationMethod: method })
  for (const row of schedule) {
    expect(row.bookValue).toBeCloseTo(asset.cost - row.accumulatedDepreciation, 2)
  }
})
```

**Arbitraries (generators) needed:**
- `assetArbitrary`: generates `{ cost, salvageValue, usefulLifeYears, purchaseDate }` where `cost > salvageValue >= 0`, `1 <= usefulLifeYears <= 40`
- `methodArbitrary`: one of `['SL', 'DDB', 'SYD', 'Section179']`
- `assetListArbitrary`: array of 0–500 assets
- `filterCriteriaArbitrary`: random combination of category, status, date range filters
- `disposalArbitrary`: `{ salePrice, saleDate }` where `salePrice >= 0`

**Property tests to implement** (one test per property):

| Test file | Properties covered |
|---|---|
| `lib/__tests__/depreciation.property.test.ts` | Properties 1–6 |
| `lib/__tests__/disposal.property.test.ts` | Properties 7–8 |
| `lib/__tests__/reports.property.test.ts` | Property 9 |
| `lib/__tests__/summary.property.test.ts` | Property 10 |
| `lib/__tests__/filter.property.test.ts` | Property 11 |
| `lib/__tests__/equipment-asset.property.test.ts` | Property 12 |

### Unit Tests

Unit tests focus on:
- **Specific method examples**: Known inputs with hand-calculated expected outputs (e.g., a $10,000 asset, 5-year SL, $1,000 salvage → $1,800/year).
- **Edge cases**: `usefulLifeYears = 1`, `salvageValue = 0`, `cost = salvageValue`, Section 179 with zero salvage.
- **API route handlers**: Mock Supabase client; verify correct status codes and response shapes.
- **`EquipmentProvider`**: Mock fetch; verify state transitions on create/update/dispose.
- **`AddEquipmentDialog`**: Verify the review step is shown after parsing; verify each field is editable.
- **Audit log**: Verify method change and status change are recorded with correct action types.

### Integration Tests

- **Ledger integration**: Create an asset via `POST /api/equipment` against a test Supabase instance; verify the journal entry appears in `GET /api/journal-entries`.
- **Disposal atomicity**: Simulate a Supabase failure mid-disposal; verify no partial state is left.
- **Auto-depreciation**: Verify `syncDepreciationForCurrentUser` generates entries for `equipment_assets` records.

### Accessibility

All new UI components must meet WCAG 2.1 AA. Key requirements:
- `EquipmentTable` uses `<table>` with proper `<th scope>` headers.
- `AddEquipmentDialog` and `DisposalDialog` use `role="dialog"` with `aria-labelledby`.
- `AssetDetailSheet` traps focus when open.
- All interactive elements have visible focus indicators.
- Color is not the sole indicator of status (status badges include text labels).

Full validation requires manual testing with assistive technologies (VoiceOver, NVDA) and expert accessibility review.
