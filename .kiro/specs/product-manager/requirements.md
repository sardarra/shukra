# Requirements Document

## Introduction

The Product Manager is a dedicated tab within Shukra that gives small business owners a clear view of all products and services they produce or offer. Users can define each product's selling price and variable costs, and the Product Manager automatically computes contribution margin, contribution margin ratio, and break-even analysis — giving owners actionable insight into which products are profitable and which are not.

Goals:
- Allow business owners to catalog every product or service they sell in one place.
- Automatically compute contribution margin and related profitability metrics per product.
- Surface clear viability signals so owners can make informed pricing and production decisions.
- Store product data in Supabase using the same per-user RLS patterns as the rest of Shukra.

Out of scope (v1): inventory quantity tracking, purchase order management, integration with the general ledger for COGS journal entries, multi-currency pricing, and product bundling.

## Glossary

- **Product_Manager**: The dedicated tab within Shukra for cataloging and analyzing products and services.
- **Product**: A physical good or service that the business produces or offers for sale, tracked in the Product_Manager.
- **Selling_Price**: The price at which one unit of a Product is sold to a customer. Must be a positive numeric value greater than zero.
- **Variable_Cost**: A cost that changes in direct proportion to the number of units produced or sold (e.g., raw materials, direct labor per unit, packaging).
- **Fixed_Cost**: A cost that does not change with production volume within a relevant range (e.g., rent, equipment depreciation allocated to a product line).
- **Contribution_Margin**: The amount each unit sold contributes toward covering Fixed_Costs and generating profit, calculated as Selling_Price minus the sum of all Variable Cost_Item amounts per unit. Displayed as a currency value rounded to two decimal places.
- **Contribution_Margin_Ratio**: Contribution_Margin expressed as a percentage of Selling_Price, calculated as (Contribution_Margin ÷ Selling_Price) × 100, rounded to two decimal places.
- **Break_Even_Units**: The number of units that must be sold for a product line to cover its allocated Fixed_Costs, calculated as the sum of all Fixed Cost_Item amounts divided by Contribution_Margin, rounded up to the nearest whole unit.
- **Viability_Status**: A computed label assigned to each Product indicating whether it is Profitable, Break-Even, or Unprofitable based on its Contribution_Margin.
- **Cost_Item**: A single line-item cost entry (either variable or fixed) associated with a Product. Has a non-empty label (max 150 characters), a cost type (Variable or Fixed), and a numeric amount per unit greater than or equal to zero.
- **Product_Type**: A classification of a Product as either "Physical Good" or "Service".

## Requirements

### Requirement 1: Add and Manage Products

**User Story:** As a business owner, I want to add products and services to the Product Manager, so that I can track all the things I sell in one place.

#### Acceptance Criteria

1. WHEN a user submits a new product form, THE Product_Manager SHALL create a product record containing: name (required, max 150 characters), product type (required: Physical Good or Service), description (optional), and selling price (required, must be greater than 0).
2. WHEN a user saves a new product, THE Product_Manager SHALL display the product in the product list within 2 seconds.
3. WHEN a user edits an existing product, THE Product_Manager SHALL update the product record and reflect the changes in the product list within 2 seconds.
4. WHEN a user deletes a product, THE Product_Manager SHALL remove the product record and all associated Cost_Items, and update the product list to no longer include it.
5. IF a user submits a product form with a missing or invalid required field (name, product type, or selling price ≤ 0), THEN THE Product_Manager SHALL display a field-level validation error identifying the specific invalid field and prevent the record from being saved.
6. THE Product_Manager SHALL support a minimum of 500 product records per user without degradation in load time beyond 2 seconds.
7. IF a Supabase write operation for creating, updating, or deleting a product fails, THEN THE Product_Manager SHALL display an error message identifying the failed operation and leave the product list unchanged so the user can retry.

---

### Requirement 2: Define Variable and Fixed Costs per Product

**User Story:** As a business owner, I want to itemize the costs associated with each product, so that I can see exactly what it costs me to produce or deliver it.

#### Acceptance Criteria

1. WHEN a user adds a Cost_Item to a product, THE Product_Manager SHALL accept a non-empty label (max 150 characters), a cost type (Variable or Fixed), and a numeric amount per unit greater than or equal to zero.
2. THE Product_Manager SHALL allow a product to have zero or more Variable Cost_Items and zero or more Fixed Cost_Items.
3. WHEN a user updates a Cost_Item amount, THE Product_Manager SHALL recalculate all derived metrics (Contribution_Margin, Contribution_Margin_Ratio, Break_Even_Units, Viability_Status) within 1 second and display the updated values.
4. WHEN a user removes a Cost_Item from a product, THE Product_Manager SHALL recalculate all derived metrics within 1 second and display the updated values.
5. IF a user enters a negative, non-numeric, or blank value for a Cost_Item amount or label, THEN THE Product_Manager SHALL display a field-level validation error identifying the specific invalid field and prevent the value from being saved.

---

### Requirement 3: Compute and Display Contribution Margin

**User Story:** As a business owner, I want to see the contribution margin for each product, so that I know how much each sale contributes to covering my costs and generating profit.

#### Acceptance Criteria

1. THE Product_Manager SHALL calculate Contribution_Margin for each product as Selling_Price minus the sum of all Variable Cost_Item amounts.
2. THE Product_Manager SHALL calculate Contribution_Margin_Ratio for each product as (Contribution_Margin ÷ Selling_Price) × 100, expressed as a percentage rounded to two decimal places.
3. THE Product_Manager SHALL display Contribution_Margin (as a currency value rounded to two decimal places) and Contribution_Margin_Ratio on each product card in the list view and in the product detail view.
4. WHEN a user changes the Selling_Price or any Variable Cost_Item, THE Product_Manager SHALL recalculate and display the updated Contribution_Margin and Contribution_Margin_Ratio within 1 second without requiring a page reload.
5. IF a user enters a Selling_Price that is zero or negative, THEN THE Product_Manager SHALL display a field-level validation error on the Selling_Price field and prevent the record from being saved.

---

### Requirement 4: Compute Break-Even Analysis

**User Story:** As a business owner, I want to see how many units I need to sell to break even on each product, so that I can set realistic sales targets.

#### Acceptance Criteria

1. IF a product has at least one Fixed Cost_Item and a positive Contribution_Margin, THEN THE Product_Manager SHALL calculate Break_Even_Units as the sum of all Fixed Cost_Item amounts divided by Contribution_Margin, rounded up to the nearest whole unit.
2. WHILE the product detail view is open, THE Product_Manager SHALL display Break_Even_Units as a whole number labeled "units".
3. IF a product has no Fixed Cost_Items, THEN THE Product_Manager SHALL display "N/A" for Break_Even_Units with an inline message indicating that no fixed costs have been entered.
4. IF a product's Contribution_Margin is zero or negative, THEN THE Product_Manager SHALL display "Cannot break even" for Break_Even_Units with an inline message indicating that the product does not cover its variable costs.
5. WHEN a user adds, updates, or removes a Fixed Cost_Item or changes the Contribution_Margin, THE Product_Manager SHALL recalculate and display the updated Break_Even_Units within 1 second without requiring a page reload.

---

### Requirement 5: Assess Product Viability

**User Story:** As a business owner, I want to see whether each product is viable, so that I can quickly identify which products to keep, reprice, or discontinue.

#### Acceptance Criteria

1. THE Product_Manager SHALL assign a Viability_Status to each product using the following rules: "Profitable" when Contribution_Margin is greater than zero; "Break-Even" when Contribution_Margin equals zero; "Unprofitable" when Contribution_Margin is less than zero.
2. THE Product_Manager SHALL display the Viability_Status as a color-coded badge on each product card: green for Profitable, yellow for Break-Even, and red for Unprofitable.
3. WHEN a user changes any cost or price that affects Contribution_Margin, THE Product_Manager SHALL update the Viability_Status badge within 500ms without requiring a page reload.
4. THE Product_Manager SHALL display a summary panel showing the count of Profitable, Break-Even, and Unprofitable products; the counts SHALL update within 500ms of any Viability_Status change, and SHALL display "0" for any category with no matching products.

---

### Requirement 6: View Product List and Detail

**User Story:** As a business owner, I want to browse all my products and drill into any one of them, so that I can review and compare product performance at a glance.

#### Acceptance Criteria

1. THE Product_Manager SHALL display all products in a list or card view showing: name, product type, selling price, Contribution_Margin, Contribution_Margin_Ratio, and Viability_Status badge.
2. WHEN a user selects a product, THE Product_Manager SHALL display a detail view showing: all Cost_Items (label, type, amount), Break_Even_Units, Contribution_Margin, Contribution_Margin_Ratio, Viability_Status, selling price, and product type.
3. WHEN a user filters the product list by Viability_Status, THE Product_Manager SHALL display only products matching the selected status.
4. WHEN a user filters the product list by Product_Type, THE Product_Manager SHALL display only products of the selected type.
5. WHEN a user enters a search term, THE Product_Manager SHALL display only products whose name or description contains the search term (case-insensitive); WHEN the search term is blank or empty, THE Product_Manager SHALL display all products.
6. THE Product_Manager SHALL display all product list content in a single-column layout on viewports 375px wide, with no horizontal scrolling required to access product name, Viability_Status badge, or primary action controls.
7. WHEN a filter or search produces no matching products, THE Product_Manager SHALL display an empty-state message indicating no products match the current criteria.

---

### Requirement 7: Persist Products in Supabase

**User Story:** As a business owner, I want my product data to be saved and available across sessions, so that I don't have to re-enter it every time I open the app.

#### Acceptance Criteria

1. THE Product_Manager SHALL store all product records and their associated Cost_Items in a Supabase `products` table and a `product_cost_items` table, both protected by Row Level Security policies that restrict access to the owning user.
2. WHEN the Product_Manager page loads, THE Product_Manager SHALL fetch all product records belonging to the authenticated user from Supabase and display them within 2 seconds.
3. WHEN a user creates, updates, or deletes a product or Cost_Item, THE Product_Manager SHALL persist the change to Supabase within 5 seconds before updating the UI; IF the operation involves both the `products` and `product_cost_items` tables, THE Product_Manager SHALL treat the write as atomic and roll back any partial changes on failure.
4. IF a Supabase write operation fails, THEN THE Product_Manager SHALL display an error message identifying the failed operation (e.g., "Failed to save product. Please try again.") and leave the local UI state unchanged so the user can retry.
5. IF a Supabase read operation fails on page load, THEN THE Product_Manager SHALL display an error state with a "Retry" button that re-triggers the fetch when clicked, rather than showing an empty product list.
6. WHILE a Supabase fetch is in progress on page load, THE Product_Manager SHALL display a loading indicator and prevent user interaction with the product list until the fetch completes or fails.
