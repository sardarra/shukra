/**
 * Property-based tests for filterProducts
 * Feature: product-manager
 *
 * Property 7: Filter Returns Exactly Matching Products
 * Validates: Requirements 6.3, 6.4, 6.5
 */

import { test } from '@fast-check/vitest'
import * as fc from 'fast-check'
import { describe, expect } from 'vitest'
import { filterProducts, computeContributionMargin, computeViabilityStatus } from '../products'
import type { ProductWithCostItems, CostItem, ProductType, ViabilityStatus } from '../accounting-types'

// Arbitraries (duplicated from other tests for isolation)
const nonNegativeDouble = fc.double({ min: 0, max: 1_000_000, noNaN: true })
const uuid = fc.uuid()
const costItemArbitrary = fc.record<CostItem>({
  id: uuid,
  productId: uuid,
  userId: uuid,
  label: fc.string({ minLength: 1, maxLength: 150 }),
  costType: fc.constantFrom<'Variable' | 'Fixed'>('Variable', 'Fixed'),
  amount: nonNegativeDouble,
  createdAt: fc.constant(new Date().toISOString()),
  updatedAt: fc.constant(new Date().toISOString()),
})
const costItemsArbitrary = fc.array(costItemArbitrary, { minLength: 0, maxLength: 10 })

const productArbitrary = fc.record<ProductWithCostItems>({
  id: uuid,
  userId: uuid,
  name: fc.string({ minLength: 1, maxLength: 100 }),
  productType: fc.constantFrom<ProductType>('Physical Good', 'Service'),
  description: fc.option(fc.string({ maxLength: 200 }), { nil: null }),
  sellingPrice: nonNegativeDouble,
  createdAt: fc.constant(new Date().toISOString()),
  updatedAt: fc.constant(new Date().toISOString()),
  costItems: costItemsArbitrary,
})

const searchTermArb = fc.string({ maxLength: 50 })
const viabilityFilterArb = fc.constantFrom<ViabilityStatus | 'All'>('All', 'Profitable', 'Break-Even', 'Unprofitable')
const typeFilterArb = fc.constantFrom<ProductType | 'All'>('All', 'Physical Good', 'Service')

function localMatches(prod: ProductWithCostItems, term: string, viabilityFilter: ViabilityStatus | 'All', typeFilter: ProductType | 'All') {
  const t = term.trim().toLowerCase()
  if (t.length > 0) {
    const nameMatch = prod.name.toLowerCase().includes(t)
    const descMatch = (prod.description?.toLowerCase().includes(t)) ?? false
    if (!nameMatch && !descMatch) return false
  }

  if (viabilityFilter !== 'All') {
    const cm = computeContributionMargin(prod.sellingPrice, prod.costItems)
    const status = computeViabilityStatus(cm)
    if (status !== viabilityFilter) return false
  }

  if (typeFilter !== 'All') {
    if (prod.productType !== typeFilter) return false
  }

  return true
}

describe('Property 7: Filter Returns Exactly Matching Products', () => {
  test.prop([
    fc.array(productArbitrary, { maxLength: 50 }),
    searchTermArb,
    viabilityFilterArb,
    typeFilterArb,
  ], { numRuns: 200 })(
    'every product in result satisfies all active filter criteria and no matching product is absent',
    (products, term, viabilityFilter, typeFilter) => {
      const ps = products as unknown as ProductWithCostItems[]
      const result = filterProducts(ps, term, viabilityFilter, typeFilter)

      // every product in result must match
      for (const r of result) {
        expect(localMatches(r, term, viabilityFilter, typeFilter)).toBe(true)
      }

      // every product that matches should be present in result
      for (const p of ps) {
        if (localMatches(p, term, viabilityFilter, typeFilter)) {
          // identity by id
          const found = result.some((r) => r.id === p.id)
          expect(found).toBe(true)
        }
      }
    },
  )
})
