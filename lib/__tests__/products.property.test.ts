/**
 * Property-based tests for lib/products.ts
 * Feature: product-manager
 *
 * Validates: Requirements 3.1, 3.2, 4.1, 5.1
 */

import { describe, expect } from 'vitest'
import { test } from '@fast-check/vitest'
import * as fc from 'fast-check'
import {
  computeContributionMargin,
  computeContributionMarginRatio,
  computeBreakEvenUnits,
  computeViabilityStatus,
  computeProductMetrics,
  computeProductSummary,
  validateProduct,
  validateCostItem,
} from '../products'
import type { CostItem, ProductWithCostItems, CreateProductPayload, CreateCostItemPayload } from '../accounting-types'

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/**
 * A positive finite double in the range (0, 1_000_000].
 * Using fc.double so there are no 32-bit rounding restrictions.
 */
const positiveDouble = fc.double({ min: 1e-10, max: 1_000_000, noNaN: true })

/**
 * A negative finite double in the range [-1_000_000, -1e-10).
 */
const negativeDouble = fc.double({ min: -1_000_000, max: -1e-10, noNaN: true })

/**
 * Any finite double in the range [-1_000_000, 1_000_000].
 */
const anyDouble = fc.double({ min: -1_000_000, max: 1_000_000, noNaN: true })

/**
 * A non-negative finite double for cost amounts.
 */
const nonNegativeDouble = fc.double({ min: 0, max: 1_000_000, noNaN: true })

/** Generates a single CostItem with all required fields. */
const costItemArbitrary = fc.record<CostItem>({
  id: fc.uuid(),
  productId: fc.uuid(),
  userId: fc.uuid(),
  label: fc.string({ minLength: 1, maxLength: 150 }),
  costType: fc.constantFrom<'Variable' | 'Fixed'>('Variable', 'Fixed'),
  amount: nonNegativeDouble,
  createdAt: fc.constant(new Date().toISOString()),
  updatedAt: fc.constant(new Date().toISOString()),
})

/** Generates an array of 0–20 cost items of any mix of Variable/Fixed. */
const costItemsArbitrary = fc.array(costItemArbitrary, { minLength: 0, maxLength: 20 })

/** Generates a Fixed CostItem with all required fields. */
const fixedCostItemArbitrary = fc.record<CostItem>({
  id: fc.uuid(),
  productId: fc.uuid(),
  userId: fc.uuid(),
  label: fc.string({ minLength: 1, maxLength: 150 }),
  costType: fc.constant<'Fixed'>('Fixed'),
  amount: nonNegativeDouble,
  createdAt: fc.constant(new Date().toISOString()),
  updatedAt: fc.constant(new Date().toISOString()),
})

/** Generates an array of cost items with AT LEAST ONE Fixed item. */
const costItemsWithAtLeastOneFixedArbitrary = fc
  .tuple(fixedCostItemArbitrary, costItemsArbitrary)
  .map(([fixedItem, rest]) => [fixedItem, ...rest])

// ─── Property 1: Contribution Margin Formula ─────────────────────────────────
// Feature: product-manager, Property 1: Contribution Margin Formula
// Validates: Requirements 3.1

describe('Property 1: Contribution Margin Formula', () => {
  test.prop(
    [positiveDouble, costItemsArbitrary],
    { numRuns: 100 },
  )(
    'computeContributionMargin equals sellingPrice minus sum of variable cost items',
    (sellingPrice, costItems) => {
      const cm = computeContributionMargin(sellingPrice, costItems)
      const expectedCm =
        sellingPrice -
        costItems
          .filter((i) => i.costType === 'Variable')
          .reduce((sum, i) => sum + i.amount, 0)
      expect(cm).toBeCloseTo(expectedCm, 5)
    },
  )

  test.prop(
    [positiveDouble, costItemsArbitrary],
    { numRuns: 100 },
  )(
    'fixed cost items do not affect the contribution margin',
    (sellingPrice, costItems) => {
      const cmWithAll = computeContributionMargin(sellingPrice, costItems)
      const variableOnly = costItems.filter((i) => i.costType === 'Variable')
      const cmVariableOnly = computeContributionMargin(sellingPrice, variableOnly)
      expect(cmWithAll).toBeCloseTo(cmVariableOnly, 5)
    },
  )
})

// ─── Property 2: Contribution Margin Ratio Formula ───────────────────────────
// Feature: product-manager, Property 2: Contribution Margin Ratio Formula
// Validates: Requirements 3.2

describe('Property 2: Contribution Margin Ratio Formula', () => {
  test.prop(
    [anyDouble, positiveDouble],
    { numRuns: 100 },
  )(
    'computeContributionMarginRatio equals round((cm / sellingPrice) * 100, 2) for any positive selling price',
    (cm, sellingPrice) => {
      const ratio = computeContributionMarginRatio(cm, sellingPrice)
      const expected = Math.round((cm / sellingPrice) * 100 * 100) / 100
      expect(ratio).toBeCloseTo(expected, 5)
    },
  )
})

// ─── Property 3: Derived Metrics Consistency ─────────────────────────────────
// Feature: product-manager, Property 3: Derived Metrics Consistency
// Validates: Requirements 2.3

describe('Property 3: Derived Metrics Consistency', () => {
  test.prop(
    [
      fc.record<ProductWithCostItems>({
        id: fc.uuid(),
        userId: fc.uuid(),
        name: fc.string({ minLength: 1, maxLength: 50 }),
        productType: fc.constantFrom<'Physical Good' | 'Service'>('Physical Good', 'Service'),
        description: fc.option(fc.string({ maxLength: 100 }), { nil: null }),
        sellingPrice: nonNegativeDouble,
        createdAt: fc.constant(new Date().toISOString()),
        updatedAt: fc.constant(new Date().toISOString()),
        costItems: costItemsArbitrary,
      }),
    ],
    { numRuns: 200 },
  )('computeProductMetrics fields match individual calculations', (product) => {
    const p = product as unknown as ProductWithCostItems
    const metrics = computeProductMetrics(p)

    // contribution margin
    const expectedCm = computeContributionMargin(p.sellingPrice, p.costItems)
    expect(metrics.contributionMargin).toBeCloseTo(expectedCm, 5)

    // cm ratio
    const expectedRatio = computeContributionMarginRatio(expectedCm, p.sellingPrice)
    expect(metrics.contributionMarginRatio).toBeCloseTo(expectedRatio, 5)

    // break-even units
    const expectedBe = computeBreakEvenUnits(p.costItems, expectedCm)
    expect(metrics.breakEvenUnits).toEqual(expectedBe)

    // viability status
    const expectedStatus = computeViabilityStatus(expectedCm)
    expect(metrics.viabilityStatus).toEqual(expectedStatus)
  })
})

// ─── Property 5: Product Validation Rejects Invalid Inputs ──────────────────
// Feature: product-manager, Property 5: Product Validation Rejects Invalid Inputs
// Validates: Requirements 1.5, 3.5

describe('Property 5: Product Validation Rejects Invalid Inputs', () => {
  const validProduct: CreateProductPayload = {
    name: 'Valid Product',
    productType: 'Physical Good',
    sellingPrice: 1,
  }

  const invalidName = fc.oneof(
    fc.constant(''),
    fc.constant('   '),
    fc.string({ minLength: 151 })
  )

  const invalidProductType = fc.oneof(fc.constant(undefined), fc.constant(null) as any)

  const invalidSellingPrice = fc.oneof(
    fc.constant(undefined) as any,
    fc.double({ max: 0, noNaN: true })
  )

  const invalidPayloadArb = fc.oneof(
    invalidName.map((name) => ({ ...validProduct, name } as Partial<CreateProductPayload>)),
    invalidProductType.map(() => ({ ...validProduct, productType: undefined } as Partial<CreateProductPayload>)),
    invalidSellingPrice.map((sellingPrice) => ({ ...validProduct, sellingPrice } as any))
  )

  test.prop([invalidPayloadArb], { numRuns: 200 })(
    'validateProduct returns a non-empty errors object for payloads with at least one invalid field',
    (payload) => {
      const errors = validateProduct(payload)
      expect(Object.keys(errors).length).toBeGreaterThan(0)
    },
  )
})

// ─── Property 6: Cost Item Validation Rejects Invalid Inputs ───────────────
// Feature: product-manager, Property 6: Cost Item Validation Rejects Invalid Inputs
// Validates: Requirements 2.5

describe('Property 6: Cost Item Validation Rejects Invalid Inputs', () => {
  const validCostItem: CreateCostItemPayload = {
    label: 'Valid Cost',
    costType: 'Variable',
    amount: 0,
  }

  const invalidLabel = fc.oneof(fc.constant(''), fc.constant('   '), fc.string({ minLength: 151 }))
  const invalidAmount = fc.oneof(
    fc.constant(undefined) as any,
    fc.constant(null) as any,
    fc.string(),
    fc.double({ max: -1e-10, min: -1_000_000, noNaN: true })
  )

  const invalidCostItemArb = fc.oneof(
    invalidLabel.map((label) => ({ ...validCostItem, label } as Partial<CreateCostItemPayload>)),
    invalidAmount.map((amount) => ({ ...validCostItem, amount } as any))
  )

  test.prop([invalidCostItemArb], { numRuns: 200 })(
    'validateCostItem returns a non-empty errors object for payloads with at least one invalid field',
    (payload) => {
      const errors = validateCostItem(payload)
      expect(Object.keys(errors).length).toBeGreaterThan(0)
    },
  )
})

// ─── Property 8: Summary Counts Match Product List ─────────────────────────
// Feature: product-manager, Property 8: Summary Counts Match Product List
// Validates: Requirements 5.4

describe('Property 8: Summary Counts Match Product List', () => {
  test.prop([fc.array(fc.record<ProductWithCostItems>({
    id: fc.uuid(),
    userId: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    productType: fc.constantFrom<'Physical Good' | 'Service'>('Physical Good', 'Service'),
    description: fc.option(fc.string({ maxLength: 100 }), { nil: null }),
    sellingPrice: nonNegativeDouble,
    createdAt: fc.constant(new Date().toISOString()),
    updatedAt: fc.constant(new Date().toISOString()),
    costItems: costItemsArbitrary,
  }), { maxLength: 50 })], { numRuns: 100 })(
    'profitable + breakEven + unprofitable equals products.length',
    (products) => {
      const ps = products as unknown as ProductWithCostItems[]
      const summary = computeProductSummary(ps)
      expect(summary.profitable + summary.breakEven + summary.unprofitable).toBe(products.length)
    },
  )
})
