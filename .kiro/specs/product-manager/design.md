# Design Document: Product Manager

## Overview

The Product Manager is a dedicated tab within Shukra that lets small business owners catalog every product or service they sell, itemize variable and fixed costs per product, and instantly see contribution margin, contribution margin ratio, break-even units, and a viability status badge. The goal is to surface clear profitability signals without requiring accounting expertise.

The design follows Shukra's established patterns: Next.js App Router, Supabase for persistence with per-user RLS, React Context for client state, and shadcn/ui + Tailwind CSS for the UI. The feature is self-contained — it does not write to the general ledger in v1.

### Key Design Decisions

- **Separate `products` and `product_cost_items` tables** rather than embedding costs in a JSON column. This keeps the schema normalized, makes individual cost item updates cheap, and allows future querying (e.g., "all products with a specific cost label").
- **All profitability calculations are pure TypeScript functions** in `lib/products.ts`. No server round-trips are needed for derived metrics — they are computed client-side on every state change, keeping the UI reactive within the 500ms–1s requirements.
- **Dedicated `ProductProvider` React context** (analogous to `AccountingProvider`) owns product state, loading/error state, and CRUD actions. It is mounted inside the existing app layout so it is available only on the products page.
- **API routes follow the `plant-assets` pattern**: a thin Next.js route handler authenticates the request, delegates to a `lib/supabase/products.ts` data layer, and returns `{ ok, data, error }` shaped responses.
- **Atomic writes for product + cost items** are handled by inserting/deleting cost items in a single Supabase RPC call (or sequential inserts within the same request) and rolling back on failure by re-fetching the server state.

## Architecture

```mermaid
graph TD
    subgraph "Client (Browser)"
        PP[ProductsPage<br/>app/(app)/products/page.tsx]
        PP --> PSP[ProductSummaryPanel]
        PP --> PL[ProductList]
        PP --> APD[AddProductDialog]
        PP --> PDS[ProductDetailSheet]
        PDS --> CIL[CostItemList]
        PDS --> CIF[CostItemForm]
        PP --> PCtx[ProductProvider<br/>React Context]
    end

    subgraph "API Routes (Next.js)"
        R1[POST /api/products]
        R2[GET /api/products]
        R3[PATCH /api/products/:id]
        R4[DELETE /api/products/:id]
        R5[POST /api/products/:id/cost-items]
        R6[PATCH /api/products/:id/cost-items/:itemId]
        R7[DELETE /api/products/:id/cost-items/:itemId]
    end

    subgraph "Business Logic (lib/)"
        PL2[lib/products.ts<br/>Pure calculation functions]
        AT[lib/accounting-types.ts<br/>Product types]
        PS[lib/supabase/products.ts<br/>Data layer]
    end

    subgraph "Persistence"
        SB[(Supabase<br/>products + product_cost_items)]
    end

    PCtx --> R1 & R2 & R3 & R4 & R5 & R6 & R7
    R1 & R2 & R3 & R4 & R5 & R6 & R7 --> PS
    PS --> SB
    PL2 --> PCtx
```

The `ProductProvider` fetches all products and their cost items on mount, stores them in local state, and exposes CRUD actions. All derived metrics (contribution margin, CM ratio, break-even units, viability status) are computed synchronously from local state using pure functions from `lib/products.ts` — no additional API calls are needed for recalculation.

## Components and Interfaces

### New API Routes (`app/api/products/`)

All routes authenticate via `createSupabaseServerClient()` and return `{ ok: boolean; error: string | null }` shaped responses, consistent with the existing `plant-assets` route.

#### `GET /api/products`
Returns all products with their cost items for the authenticated user.

Response:
```ts
{
  ok: boolean
  products: ProductWithCostItems[]
  error: string | null
}
```

#### `POST /api/products`
Creates a new product record.

Request body: `CreateProductPayload`

Response:
```ts
{
  ok: boolean
  product: Product | null
  error: string | null
}
```

#### `PATCH /api/products/[id]`
Partial update of a product's mutable fields (name, description, productType, sellingPrice).

Request body: `Partial<Pick<Product, 'name' | 'description' | 'productType' | 'sellingPrice'>>`

#### `DELETE /api/products/[id]`
Hard-deletes the product and all associated cost items (cascade handled by DB foreign key).

#### `POST /api/products/[id]/cost-items`
Adds a cost item to a product.

Request body: `CreateCostItemPayload`

#### `PATCH /api/products/[id]/cost-items/[itemId]`
Updates a cost item's label, type, or amount.

#### `DELETE /api/products/[id]/cost-items/[itemId]`
Removes a cost item from a product.

### New UI Components (`components/products/`)

| Component | Responsibility |
|---|---|
| `ProductsPage` | Page shell; mounts `ProductProvider`, renders summary panel + product list + add button |
| `ProductProvider` | React context; owns product list, loading/error state, CRUD actions |
| `ProductSummaryPanel` | 3 KPI cards: count of Profitable / Break-Even / Unprofitable products |
| `ProductList` | Filterable/searchable card grid; each card shows name, type, price, CM, CM ratio, viability badge |
| `ProductCard` | Single product card with inline edit/delete actions |
| `AddProductDialog` | Form dialog for creating a new product (name, type, description, selling price) |
| `ProductDetailSheet` | Slide-over (`shadcn Sheet`) showing full product details, cost item list, break-even analysis |
| `CostItemList` | Editable list of cost items grouped by type (Variable / Fixed) |
| `CostItemForm` | Inline form for adding or editing a cost item (label, type, amount) |
| `ViabilityBadge` | Color-coded badge: green/Profitable, yellow/Break-Even, red/Unprofitable |

### `ProductProvider` Interface

```ts
interface ProductContextType {
  products: ProductWithCostItems[]
  isLoading: boolean
  error: string | null
  // Filters / search
  searchTerm: string
  setSearchTerm: (term: string) => void
  viabilityFilter: ViabilityStatus | 'All'
  setViabilityFilter: (status: ViabilityStatus | 'All') => void
  typeFilter: ProductType | 'All'
  setTypeFilter: (type: ProductType | 'All') => void
  // Derived
  filteredProducts: ProductWithCostItems[]
  summary: ProductSummary
  // Actions
  createProduct: (payload: CreateProductPayload) => Promise<void>
  updateProduct: (id: string, patch: Partial<Pick<Product, 'name' | 'description' | 'productType' | 'sellingPrice'>>) => Promise<void>
  deleteProduct: (id: string) => Promise<void>
  addCostItem: (productId: string, payload: CreateCostItemPayload) => Promise<void>
  updateCostItem: (productId: string, itemId: string, patch: Partial<Pick<CostItem, 'label' | 'costType' | 'amount'>>) => Promise<void>
  removeCostItem: (productId: string, itemId: string) => Promise<void>
  retryLoad: () => void
}
```

`filteredProducts` is a memoized derived value that applies `searchTerm`, `viabilityFilter`, and `typeFilter` to the full product list. `summary` is a memoized count of products by viability status.

## Data Models

### TypeScript Types (additions to `lib/accounting-types.ts`)

```ts
export type ProductType = 'Physical Good' | 'Service'
export type CostType = 'Variable' | 'Fixed'
export type ViabilityStatus = 'Profitable' | 'Break-Even' | 'Unprofitable'

export interface Product {
  id: string
  userId: string
  name: string                    // max 150 characters
  productType: ProductType
  description: string | null
  sellingPrice: number            // > 0
  createdAt: string
  updatedAt: string
}

export interface CostItem {
  id: string
  productId: string
  userId: string
  label: string                   // non-empty, max 150 characters
  costType: CostType
  amount: number                  // >= 0
  createdAt: string
  updatedAt: string
}

export interface ProductWithCostItems extends Product {
  costItems: CostItem[]
}

export interface ProductMetrics {
  contributionMargin: number      // sellingPrice - sum(variable costs)
  contributionMarginRatio: number // (CM / sellingPrice) * 100, rounded to 2dp
  breakEvenUnits: number | 'N/A' | 'Cannot break even'
  viabilityStatus: ViabilityStatus
}

export interface ProductSummary {
  profitable: number
  breakEven: number
  unprofitable: number
}

export interface CreateProductPayload {
  name: string
  productType: ProductType
  description?: string
  sellingPrice: number
}

export interface CreateCostItemPayload {
  label: string
  costType: CostType
  amount: number
}
```

### Supabase Schema

#### `products`

```sql
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  name text NOT NULL CHECK (char_length(name) <= 150),
  product_type text NOT NULL CHECK (product_type IN ('Physical Good', 'Service')),
  description text,
  selling_price numeric NOT NULL CHECK (selling_price > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own products"
  ON products FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own products"
  ON products FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own products"
  ON products FOR UPDATE
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own products"
  ON products FOR DELETE
  USING (auth.uid()::text = user_id);
```

#### `product_cost_items`

```sql
CREATE TABLE IF NOT EXISTS product_cost_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  label text NOT NULL CHECK (char_length(label) <= 150),
  cost_type text NOT NULL CHECK (cost_type IN ('Variable', 'Fixed')),
  amount numeric NOT NULL CHECK (amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE product_cost_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own cost items"
  ON product_cost_items FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own cost items"
  ON product_cost_items FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own cost items"
  ON product_cost_items FOR UPDATE
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own cost items"
  ON product_cost_items FOR DELETE
  USING (auth.uid()::text = user_id);
```

The `ON DELETE CASCADE` on `product_cost_items.product_id` ensures that deleting a product automatically removes all its cost items, satisfying Requirement 1.4 at the database level.

### Pure Calculation Functions (`lib/products.ts`)

```ts
/**
 * Contribution margin = selling price minus sum of all variable cost items.
 */
export function computeContributionMargin(
  sellingPrice: number,
  costItems: CostItem[]
): number

/**
 * CM ratio = (CM / sellingPrice) * 100, rounded to 2 decimal places.
 * Returns 0 if sellingPrice is 0 (guarded by validation, but defensive).
 */
export function computeContributionMarginRatio(
  contributionMargin: number,
  sellingPrice: number
): number

/**
 * Break-even units = ceil(sum(fixed costs) / CM).
 * Returns 'N/A' if there are no fixed cost items.
 * Returns 'Cannot break even' if CM <= 0.
 */
export function computeBreakEvenUnits(
  costItems: CostItem[],
  contributionMargin: number
): number | 'N/A' | 'Cannot break even'

/**
 * Viability status based on contribution margin sign.
 */
export function computeViabilityStatus(contributionMargin: number): ViabilityStatus

/**
 * Compute all metrics for a product in one call.
 */
export function computeProductMetrics(product: ProductWithCostItems): ProductMetrics

/**
 * Compute summary counts across a list of products.
 */
export function computeProductSummary(products: ProductWithCostItems[]): ProductSummary

/**
 * Validate a CreateProductPayload. Returns a map of field -> error message,
 * or an empty object if valid.
 */
export function validateProduct(payload: Partial<CreateProductPayload>): Record<string, string>

/**
 * Validate a CreateCostItemPayload. Returns a map of field -> error message,
 * or an empty object if valid.
 */
export function validateCostItem(payload: Partial<CreateCostItemPayload>): Record<string, string>

/**
 * Filter and search a product list.
 * - searchTerm: case-insensitive match against name or description
 * - viabilityFilter: 'All' or a specific ViabilityStatus
 * - typeFilter: 'All' or a specific ProductType
 */
export function filterProducts(
  products: ProductWithCostItems[],
  searchTerm: string,
  viabilityFilter: ViabilityStatus | 'All',
  typeFilter: ProductType | 'All'
): ProductWithCostItems[]
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

The product manager's calculation and filtering logic is implemented as pure TypeScript functions with no I/O, making it well-suited for property-based testing. The properties below are derived from the acceptance criteria prework analysis.

**Property reflection:** After reviewing all testable criteria, the following consolidations were made:
- Requirements 3.1 and 3.2 are independent formulas — kept separate since they test different computations.
- Requirements 2.3 and 2.4 both test that derived metrics are recalculated correctly after cost item changes — consolidated into a single "metrics consistency" property (Property 3) since the same invariant applies to both add and remove operations.
- Requirements 6.3 and 6.4 both test filter correctness — consolidated into a single "filter correctness" property (Property 7) since the same invariant (all returned items match the filter, no matching items are excluded) applies to both viability and type filters.
- Requirements 1.5 and 2.5 and 3.5 all test input validation — consolidated into two validation properties (Properties 5 and 6) covering product-level and cost-item-level validation respectively.
- Requirements 5.1 and 5.4 are related but test different things — viability classification (Property 4) and summary count aggregation (Property 8) are kept separate.

---

### Property 1: Contribution Margin Formula

*For any* product with a positive selling price and any list of cost items, `computeContributionMargin(sellingPrice, costItems)` must equal `sellingPrice` minus the sum of all cost items where `costType === 'Variable'`. Fixed cost items must not affect the result.

**Validates: Requirements 3.1**

---

### Property 2: Contribution Margin Ratio Formula

*For any* product with a positive selling price and any contribution margin, `computeContributionMarginRatio(cm, sellingPrice)` must equal `round((cm / sellingPrice) * 100, 2)`.

**Validates: Requirements 3.2**

---

### Property 3: Derived Metrics Consistency

*For any* product with any selling price and any list of cost items, `computeProductMetrics(product)` must return values that are consistent with each other: `contributionMargin = sellingPrice - sum(variableCosts)`, `contributionMarginRatio = round((cm / sellingPrice) * 100, 2)`, and `viabilityStatus` must match the sign of `contributionMargin`.

**Validates: Requirements 2.3, 2.4, 3.4**

---

### Property 4: Viability Status Classification

*For any* contribution margin value, `computeViabilityStatus(cm)` must return `'Profitable'` when `cm > 0`, `'Break-Even'` when `cm === 0`, and `'Unprofitable'` when `cm < 0`.

**Validates: Requirements 5.1**

---

### Property 5: Product Validation Rejects Invalid Inputs

*For any* product payload where the name is empty or exceeds 150 characters, the product type is missing, or the selling price is zero or negative, `validateProduct(payload)` must return a non-empty errors object containing an entry for the specific invalid field.

**Validates: Requirements 1.5, 3.5**

---

### Property 6: Cost Item Validation Rejects Invalid Inputs

*For any* cost item payload where the label is empty or exceeds 150 characters, or the amount is negative or non-numeric, `validateCostItem(payload)` must return a non-empty errors object containing an entry for the specific invalid field.

**Validates: Requirements 2.5**

---

### Property 7: Filter Returns Exactly Matching Products

*For any* list of products and any combination of viability filter, type filter, and search term, every product in the result of `filterProducts(...)` must satisfy all active filter criteria, and every product in the input list that satisfies all active filter criteria must appear in the result.

**Validates: Requirements 6.3, 6.4, 6.5**

---

### Property 8: Summary Counts Match Product List

*For any* list of products, `computeProductSummary(products)` must return counts where `profitable + breakEven + unprofitable === products.length`, and each count equals the number of products whose `computeViabilityStatus` returns the corresponding status.

**Validates: Requirements 5.4**

---

### Property 9: Break-Even Units Formula

*For any* product with at least one fixed cost item and a positive contribution margin, `computeBreakEvenUnits(costItems, cm)` must equal `Math.ceil(sum(fixedCosts) / cm)`.

**Validates: Requirements 4.1**

---

### Property 10: Product Creation Round Trip

*For any* valid `CreateProductPayload`, the product returned by `createProduct` must contain all input fields with matching values: name, productType, description, and sellingPrice.

**Validates: Requirements 1.1, 1.2**

## Error Handling

### API Route Errors

All API routes return `{ ok: false, error: string }` with an appropriate HTTP status code, consistent with the existing `plant-assets` route pattern.

| Scenario | Status | Error message |
|---|---|---|
| Unauthenticated request | 401 | `'Unauthorized'` |
| Invalid request body (Zod failure) | 400 | `'Invalid request payload'` |
| Product not found | 404 | `'Product not found'` |
| Product belongs to different user | 403 | `'Forbidden'` |
| Supabase write failure | 500 | `'Failed to save product. Please try again.'` |
| Supabase read failure | 500 | `'Failed to load products. Please try again.'` |

### Atomicity

When creating a product with initial cost items, the API inserts the product row first, then inserts cost items. If any cost item insert fails, the API deletes the product row (compensating transaction) and returns a 500. The client displays the error and leaves local state unchanged so the user can retry.

For updates that touch both tables (e.g., updating a product and one of its cost items in the same request), the operations are sequential. On failure, the client re-fetches the server state to ensure consistency.

### Calculation Edge Cases

- `sellingPrice = 0`: Guarded by validation before reaching calculation functions. `computeContributionMarginRatio` returns `0` defensively.
- `costItems = []`: `computeContributionMargin` returns `sellingPrice`. `computeBreakEvenUnits` returns `'N/A'`.
- `contributionMargin <= 0`: `computeBreakEvenUnits` returns `'Cannot break even'`.
- `amount = 0` on a cost item: Valid — zero-cost items are allowed (Requirement 2.1).

### UI Error States

- Network/Supabase errors surface as toast notifications using the existing `sonner` package.
- Validation errors on `AddProductDialog` and `CostItemForm` are shown inline using `react-hook-form` field-level errors.
- The `ProductProvider` exposes `error: string | null` that the page renders as an alert banner with a "Retry" button (Requirement 7.5), consistent with the `AccountingProvider` pattern.
- While loading, the product list is replaced with a loading skeleton and user interaction is blocked (Requirement 7.6).

## Testing Strategy

### Dual Testing Approach

Unit tests cover specific examples, edge cases, and error conditions. Property-based tests verify universal invariants across the pure calculation and filtering functions. Together they provide comprehensive coverage.

### Property-Based Testing

The calculation and filtering functions in `lib/products.ts` are pure TypeScript with no I/O, making them ideal for property-based testing. The project uses **fast-check** as the PBT library (consistent with the equipment-management feature).

Each property test runs a minimum of **100 iterations** with randomly generated inputs. Tests are tagged with a comment referencing the design property:

```ts
// Feature: product-manager, Property 1: Contribution Margin Formula
it.prop([fc.float({ min: 0.01, max: 1_000_000 }), costItemsArbitrary])(
  'contribution margin equals selling price minus sum of variable costs',
  (sellingPrice, costItems) => {
    const cm = computeContributionMargin(sellingPrice, costItems)
    const expectedCm = sellingPrice - costItems
      .filter(i => i.costType === 'Variable')
      .reduce((sum, i) => sum + i.amount, 0)
    expect(cm).toBeCloseTo(expectedCm, 10)
  }
)
```

**Arbitraries (generators) needed:**
- `costItemArbitrary`: generates `{ label, costType, amount }` where label is 1–150 chars, costType is `'Variable'` or `'Fixed'`, amount is `>= 0`
- `costItemsArbitrary`: array of 0–20 cost items
- `productArbitrary`: generates `ProductWithCostItems` with valid fields
- `productListArbitrary`: array of 0–50 products
- `invalidProductPayloadArbitrary`: generates payloads with at least one invalid field
- `invalidCostItemPayloadArbitrary`: generates payloads with at least one invalid field
- `filterCriteriaArbitrary`: random combination of search term, viability filter, type filter

**Property tests to implement** (one test per property):

| Test file | Properties covered |
|---|---|
| `lib/__tests__/products.property.test.ts` | Properties 1, 2, 3, 4, 5, 6, 8, 9 |
| `lib/__tests__/products-filter.property.test.ts` | Property 7 |
| `lib/__tests__/products-persistence.property.test.ts` | Property 10 |

### Unit Tests

Unit tests focus on:
- **Specific formula examples**: Known inputs with hand-calculated expected outputs (e.g., selling price $100, variable costs $60 → CM $40, CM ratio 40.00%).
- **Break-even edge cases**: No fixed costs → `'N/A'`; CM = 0 → `'Cannot break even'`; CM > 0 with fixed costs → correct ceiling.
- **Viability badge rendering**: Verify correct color class for each status.
- **`ProductProvider`**: Mock fetch; verify state transitions on create/update/delete.
- **`AddProductDialog`**: Verify form validation prevents submission with invalid fields.
- **`CostItemForm`**: Verify inline validation for negative amounts and blank labels.
- **API route handlers**: Mock Supabase client; verify correct status codes and response shapes.
- **Error states**: Mock Supabase failure; verify error message is shown and state is unchanged.

### Integration Tests

- **RLS enforcement**: Verify a user cannot read another user's products via the API.
- **Cascade delete**: Create a product with cost items, delete the product, verify cost items are gone.
- **Atomic create**: Simulate a cost item insert failure after product insert; verify the product row is cleaned up.

### Accessibility

All new UI components must meet WCAG 2.1 AA. Key requirements:
- `ProductList` uses semantic list markup (`<ul>` / `<li>`) or a `<table>` if tabular layout is used.
- `AddProductDialog` and `ProductDetailSheet` use `role="dialog"` with `aria-labelledby`.
- `ViabilityBadge` includes a text label alongside color — color is not the sole indicator of status.
- All form fields have associated `<label>` elements.
- All interactive elements have visible focus indicators.

Full validation requires manual testing with assistive technologies (VoiceOver, NVDA) and expert accessibility review.
