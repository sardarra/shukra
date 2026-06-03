# Implementation Plan: Product Manager

## Overview

Implement the Product Manager as a self-contained feature within Shukra. The plan follows a bottom-up order: data layer → pure calculation functions → API routes → React context → UI components → page assembly → accessibility. Each task builds on the previous so the app is never left in a broken state. The feature does not write to the general ledger in v1.

## Tasks

- [x] 1. Data layer — types, schema, and Supabase helpers
  - [x] 1.1 Extend `lib/accounting-types.ts` with product types
    - Add `ProductType`, `CostType`, and `ViabilityStatus` union types
    - Add `Product`, `CostItem`, `ProductWithCostItems`, `ProductMetrics`, `ProductSummary`, `CreateProductPayload`, and `CreateCostItemPayload` interfaces
    - _Requirements: 1.1, 2.1, 3.1, 5.1, 7.1_

  - [x] 1.2 Create Supabase migration SQL file
    - Write `supabase/migrations/YYYYMMDD_product_manager.sql` creating `products` and `product_cost_items` tables with all columns, constraints (`char_length`, `selling_price > 0`, `amount >= 0`, `product_type` and `cost_type` CHECK constraints), foreign key with `ON DELETE CASCADE`, and RLS policies as specified in the design
    - _Requirements: 1.4, 7.1, 7.3_

  - [x] 1.3 Create `lib/supabase/products.ts` client helpers
    - Implement `fetchProductsWithCostItems(supabase)` — SELECT all `products` rows for authenticated user joined with their `product_cost_items`, ordered by `created_at` DESC, mapping snake_case columns to camelCase `ProductWithCostItems`
    - Implement `insertProduct(supabase, payload)` — INSERT into `products` and return the new row
    - Implement `updateProduct(supabase, id, patch)` — PATCH mutable fields (`name`, `description`, `product_type`, `selling_price`) and return updated row; always refresh `updated_at`
    - Implement `deleteProduct(supabase, id)` — hard DELETE the product row (cascade removes cost items)
    - Implement `insertCostItem(supabase, productId, payload)` — INSERT into `product_cost_items` and return the new row
    - Implement `updateCostItem(supabase, itemId, patch)` — PATCH mutable fields (`label`, `cost_type`, `amount`) and return updated row
    - Implement `deleteCostItem(supabase, itemId)` — DELETE the cost item row
    - _Requirements: 1.4, 2.1, 7.1, 7.2, 7.3_

- [x] 2. Pure calculation functions — `lib/products.ts`
  - [x] 2.1 Implement `computeContributionMargin` and `computeContributionMarginRatio`
    - `computeContributionMargin(sellingPrice, costItems)` — returns `sellingPrice` minus the sum of all `costItems` where `costType === 'Variable'`; fixed cost items must not affect the result
    - `computeContributionMarginRatio(cm, sellingPrice)` — returns `round((cm / sellingPrice) * 100, 2)`; returns `0` defensively when `sellingPrice` is `0`
    - _Requirements: 3.1, 3.2_

  - [x] 2.2 Write property tests for CM and CM ratio — `lib/__tests__/products.property.test.ts`
    - **Property 1: Contribution Margin Formula** — `computeContributionMargin` equals `sellingPrice` minus sum of variable cost items; fixed items do not affect the result
    - **Property 2: Contribution Margin Ratio Formula** — `computeContributionMarginRatio` equals `round((cm / sellingPrice) * 100, 2)` for any positive selling price
    - **Validates: Requirements 3.1, 3.2**

  - [x] 2.3 Implement `computeBreakEvenUnits` and `computeViabilityStatus`
    - `computeBreakEvenUnits(costItems, cm)` — returns `Math.ceil(sum(fixedCosts) / cm)` when fixed costs exist and `cm > 0`; returns `'N/A'` when no fixed cost items; returns `'Cannot break even'` when `cm <= 0`
    - `computeViabilityStatus(cm)` — returns `'Profitable'` when `cm > 0`, `'Break-Even'` when `cm === 0`, `'Unprofitable'` when `cm < 0`
    - _Requirements: 4.1, 4.3, 4.4, 5.1_

  - [x] 2.4 Write property tests for break-even and viability — `lib/__tests__/products.property.test.ts`
    - **Property 4: Viability Status Classification** — `computeViabilityStatus` returns the correct status for any CM value
    - **Property 9: Break-Even Units Formula** — `computeBreakEvenUnits` equals `Math.ceil(sum(fixedCosts) / cm)` for any product with fixed costs and positive CM
    - **Validates: Requirements 4.1, 5.1**

  - [x] 2.5 Implement `computeProductMetrics`, `computeProductSummary`, `validateProduct`, `validateCostItem`, and `filterProducts`
    - `computeProductMetrics(product)` — calls the four calculation functions and returns a `ProductMetrics` object; all derived values must be internally consistent
    - `computeProductSummary(products)` — returns counts of Profitable, Break-Even, and Unprofitable products; `profitable + breakEven + unprofitable` must equal `products.length`
    - `validateProduct(payload)` — returns a `Record<string, string>` of field-level errors; rejects empty/oversized name, missing product type, and selling price ≤ 0
    - `validateCostItem(payload)` — returns a `Record<string, string>` of field-level errors; rejects empty/oversized label and negative or non-numeric amount
    - `filterProducts(products, searchTerm, viabilityFilter, typeFilter)` — case-insensitive name/description search; viability and type filters; returns all products when all filters are `'All'` and search term is blank
    - _Requirements: 1.5, 2.5, 3.5, 5.4, 6.3, 6.4, 6.5_

  - [x] 2.6 Write property tests for metrics consistency, validation, summary, and filter — `lib/__tests__/products.property.test.ts` and `lib/__tests__/products-filter.property.test.ts`
    - **Property 3: Derived Metrics Consistency** — `computeProductMetrics` returns values consistent with each other for any product
    - **Property 5: Product Validation Rejects Invalid Inputs** — `validateProduct` returns a non-empty errors object for any payload with an invalid field
    - **Property 6: Cost Item Validation Rejects Invalid Inputs** — `validateCostItem` returns a non-empty errors object for any payload with an invalid field
    - **Property 7: Filter Returns Exactly Matching Products** — every product in the result satisfies all active filter criteria; no matching product is absent
    - **Property 8: Summary Counts Match Product List** — `profitable + breakEven + unprofitable === products.length` for any list
    - **Validates: Requirements 1.5, 2.3, 2.4, 2.5, 3.4, 3.5, 5.4, 6.3, 6.4, 6.5**

- [x] 3. Checkpoint — ensure all calculation function tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. API routes — product and cost item CRUD
  - [x] 4.1 Create `app/api/products/route.ts` (GET + POST)
    - GET: authenticate via `createSupabaseServerClient`, call `fetchProductsWithCostItems`, return `{ ok: true, products }` or error shape
    - POST: authenticate, validate body with Zod against `CreateProductPayload` (name max 150 chars, productType enum, sellingPrice > 0), call `insertProduct`, return `{ ok: true, product }` or 400/401/500 error shape
    - _Requirements: 1.1, 7.1, 7.2_

  - [x] 4.2 Create `app/api/products/[id]/route.ts` (PATCH + DELETE)
    - PATCH: authenticate, validate ownership (return 403 if product belongs to different user), validate body, call `updateProduct`, return updated product
    - DELETE: authenticate, validate ownership, call `deleteProduct` (cascade removes cost items at DB level), return `{ ok: true }`
    - Return 404 when product not found; 403 when product belongs to different user
    - _Requirements: 1.3, 1.4, 7.3_

  - [x] 4.3 Create `app/api/products/[id]/cost-items/route.ts` (POST)
    - POST: authenticate, validate ownership of parent product, validate body with Zod against `CreateCostItemPayload` (label non-empty max 150 chars, costType enum, amount >= 0), call `insertCostItem`, return `{ ok: true, costItem }`
    - If product insert succeeded but cost item insert fails, delete the product row (compensating transaction) and return 500
    - _Requirements: 2.1, 7.3_

  - [x] 4.4 Create `app/api/products/[id]/cost-items/[itemId]/route.ts` (PATCH + DELETE)
    - PATCH: authenticate, validate ownership, validate body, call `updateCostItem`, return updated cost item
    - DELETE: authenticate, validate ownership, call `deleteCostItem`, return `{ ok: true }`
    - Return 404 when cost item not found; 403 when cost item belongs to different user
    - _Requirements: 2.1, 2.3, 2.4, 7.3_

- [x] 5. `ProductProvider` React context
  - [x] 5.1 Create `components/products/product-provider.tsx`
    - Implement `ProductProvider` with the full `ProductContextType` interface from the design: `products`, `isLoading`, `error`, `searchTerm`, `setSearchTerm`, `viabilityFilter`, `setViabilityFilter`, `typeFilter`, `setTypeFilter`, `filteredProducts`, `summary`, and all action methods
    - On mount (when user is authenticated), fetch products via `GET /api/products`; set `isLoading` during fetch; set `error` on failure; expose `retryLoad` to re-trigger the fetch
    - `filteredProducts` is a memoized derived value applying `searchTerm`, `viabilityFilter`, and `typeFilter` using `filterProducts` from `lib/products.ts`
    - `summary` is a memoized result of `computeProductSummary` over the full product list
    - Implement `createProduct`, `updateProduct`, `deleteProduct`, `addCostItem`, `updateCostItem`, `removeCostItem` calling the corresponding API routes and updating local state; surface toast notifications via `sonner` for network errors
    - _Requirements: 1.2, 1.3, 1.4, 1.7, 2.3, 2.4, 5.4, 6.3, 6.4, 6.5, 7.2, 7.4, 7.5, 7.6_

  - [x] 5.2 Write unit tests for `ProductProvider` state transitions
    - Mock `fetch`; verify state updates on `createProduct`, `updateProduct`, `deleteProduct`
    - Verify `filteredProducts` updates when `searchTerm` or `viabilityFilter` changes
    - Verify `error` is set on network failure and `retryLoad` clears it and re-fetches
    - _Requirements: 1.7, 7.4, 7.5_

- [-] 6. UI components — bottom-up
  - [-] 6.1 Create `components/products/viability-badge.tsx`
    - Render a color-coded badge: green background for `'Profitable'`, yellow for `'Break-Even'`, red for `'Unprofitable'`
    - Include a visible text label alongside color — color must not be the sole indicator of status (WCAG 2.1 AA)
    - Accept `status: ViabilityStatus` as a prop
    - _Requirements: 5.2, 5.3_

  - [ ] 6.2 Create `components/products/product-summary-panel.tsx`
    - Render 3 KPI cards: count of Profitable, Break-Even, and Unprofitable products
    - Consume `summary` from `ProductProvider`; display `"0"` for any category with no matching products
    - Updates within 500ms of any viability status change (driven by reactive context state)
    - _Requirements: 5.4_

  - [ ]* 6.3 Write property test for summary panel totals — `lib/__tests__/products.property.test.ts`
    - **Property 8: Summary Counts Match Product List** — `profitable + breakEven + unprofitable === products.length` for any list of products
    - **Validates: Requirements 5.4**

  - [-] 6.4 Create `components/products/cost-item-form.tsx`
    - Inline form for adding or editing a cost item: label input (max 150 chars), cost type selector (Variable / Fixed), amount input (>= 0)
    - Use `react-hook-form` with inline field-level validation errors using `validateCostItem`
    - On submit, call `addCostItem` or `updateCostItem` from `ProductProvider`
    - _Requirements: 2.1, 2.5_

  - [ ] 6.5 Create `components/products/cost-item-list.tsx`
    - Render cost items grouped by type (Variable / Fixed) with label, amount, edit button, and delete button per row
    - On delete, call `removeCostItem` from `ProductProvider`
    - Show computed totals: total variable costs, total fixed costs
    - _Requirements: 2.2, 2.4, 6.2_

  - [ ] 6.6 Create `components/products/product-detail-sheet.tsx`
    - shadcn `Sheet` (slide-over) with `role="dialog"` and `aria-labelledby`; trap focus when open and restore focus on close
    - Sections: product details (name, type, selling price, description — all editable inline), `CostItemList` + `CostItemForm`, break-even analysis panel (Break_Even_Units with inline `'N/A'` or `'Cannot break even'` messages), contribution margin and CM ratio, `ViabilityBadge`
    - All derived metrics update within 1 second of any cost or price change without page reload
    - _Requirements: 2.3, 2.4, 3.3, 3.4, 4.2, 4.3, 4.4, 4.5, 6.2_

  - [ ] 6.7 Create `components/products/add-product-dialog.tsx`
    - shadcn `Dialog` with `role="dialog"` and `aria-labelledby`
    - Form fields: name (required, max 150 chars), product type selector (Physical Good / Service), description (optional), selling price (required, > 0)
    - Use `react-hook-form` with inline field-level validation errors using `validateProduct`; prevent submission when any required field is invalid
    - On confirm, call `createProduct` from `ProductProvider`
    - _Requirements: 1.1, 1.5_

  - [ ] 6.8 Create `components/products/product-card.tsx`
    - Render a single product card showing: name, product type, selling price, Contribution_Margin (currency, 2dp), Contribution_Margin_Ratio (percentage, 2dp), and `ViabilityBadge`
    - Inline edit and delete action buttons; delete calls `deleteProduct` from `ProductProvider`
    - Card is clickable to open `ProductDetailSheet`
    - _Requirements: 6.1_

  - [ ] 6.9 Create `components/products/product-list.tsx`
    - Render a responsive card grid of `ProductCard` components using `filteredProducts` from `ProductProvider`
    - Render filter controls: viability status multi-select, product type multi-select, and a search bar (case-insensitive, filters by name or description)
    - Display empty-state message when `filteredProducts` is empty (distinguishing "no products yet" from "no products match filters")
    - Single-column layout on viewports 375px wide with no horizontal scrolling required
    - _Requirements: 6.1, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [ ]* 6.10 Write property test for filter logic — `lib/__tests__/products-filter.property.test.ts`
    - **Property 7: Filter Returns Exactly Matching Products** — every product in the result satisfies all active filter criteria; no matching product is absent from the result
    - **Validates: Requirements 6.3, 6.4, 6.5**

- [ ] 7. Checkpoint — ensure all component unit tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Page assembly — wire everything together
  - [ ] 8.1 Create `app/(app)/products/page.tsx`
    - Wrap page content in `<ProductProvider>`
    - Render `ProductSummaryPanel`, `ProductList`, and a floating "Add Product" button that opens `AddProductDialog`
    - Render an alert banner when `ProductProvider.error` is non-null, with a "Retry" button that calls `retryLoad` (consistent with `AccountingProvider` pattern)
    - Render a loading skeleton and block user interaction while `isLoading` is true
    - _Requirements: 1.2, 7.5, 7.6_

  - [ ]* 8.2 Write property test for product creation round trip — `lib/__tests__/products-persistence.property.test.ts`
    - **Property 10: Product Creation Round Trip** — for any valid `CreateProductPayload`, the product returned by `createProduct` contains all input fields with matching values
    - **Validates: Requirements 1.1, 1.2**

  - [ ] 8.3 Add Products entry to `components/app-sidebar.tsx`
    - Import a suitable icon (e.g., `ShoppingBag` from lucide-react)
    - Add `{ name: 'Products', href: '/products', icon: ShoppingBag }` to the `navigation` array
    - _Requirements: 6.1_

- [ ] 9. Accessibility audit and WCAG 2.1 AA fixes
  - [ ] 9.1 Audit and fix `ProductList` and `ProductCard` accessibility
    - Verify the product list uses semantic markup (`<ul>` / `<li>`) or a `<table>` if tabular layout is used
    - Verify all interactive elements (filter controls, search bar, card click targets, edit/delete buttons) have visible focus indicators and accessible labels
    - Verify `ViabilityBadge` includes a text label alongside color — color is not the sole indicator of status
    - Verify single-column layout on 375px viewport with no horizontal scrolling
    - _Requirements: 5.2, 6.6_

  - [ ] 9.2 Audit and fix dialog and sheet accessibility
    - Verify `AddProductDialog` has `role="dialog"` and `aria-labelledby` pointing to the dialog title
    - Verify `ProductDetailSheet` traps focus when open and restores focus on close
    - Verify all form inputs in `AddProductDialog`, `CostItemForm`, and `ProductDetailSheet` have associated `<label>` elements
    - _Requirements: 1.1, 2.1_

- [ ] 10. Final checkpoint — full integration pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness invariants; unit tests validate specific examples and edge cases
- All profitability calculations are pure TypeScript functions in `lib/products.ts` — no server round-trips needed for derived metrics
- The feature does not write to the general ledger in v1; it is fully self-contained
- Atomic writes for product + cost items: if a cost item insert fails after a product insert, the product row is deleted as a compensating transaction
- `ON DELETE CASCADE` on `product_cost_items.product_id` handles cost item cleanup at the DB level when a product is deleted (Requirement 1.4)
- The `ProductProvider` pattern mirrors `AccountingProvider`; the `lib/supabase/products.ts` pattern mirrors `lib/supabase/equipment-assets.ts`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3"] },
    { "id": 2, "tasks": ["2.1", "2.3"] },
    { "id": 3, "tasks": ["2.2", "2.4", "2.5"] },
    { "id": 4, "tasks": ["2.6", "4.1"] },
    { "id": 5, "tasks": ["4.2", "4.3"] },
    { "id": 6, "tasks": ["4.4", "5.1"] },
    { "id": 7, "tasks": ["5.2", "6.1", "6.4"] },
    { "id": 8, "tasks": ["6.2", "6.5"] },
    { "id": 9, "tasks": ["6.3", "6.6", "6.7"] },
    { "id": 10, "tasks": ["6.8"] },
    { "id": 11, "tasks": ["6.9", "6.10"] },
    { "id": 12, "tasks": ["8.1", "8.3"] },
    { "id": 13, "tasks": ["8.2", "9.1", "9.2"] }
  ]
}
```
