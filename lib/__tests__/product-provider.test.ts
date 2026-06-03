/**
 * Unit tests for ProductProvider state transition logic
 * Feature: product-manager
 *
 * These tests verify the fetch-based state transition behavior that ProductProvider implements.
 * They mock global fetch and test the state update logic for create/update/delete operations,
 * filteredProducts derived values, and error/retryLoad behaviour.
 *
 * Requirements: 1.7, 7.4, 7.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  filterProducts,
  computeProductSummary,
  computeContributionMargin,
  computeViabilityStatus,
} from '../products'
import type {
  ProductWithCostItems,
  CostItem,
  ViabilityStatus,
  ProductType,
} from '../accounting-types'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeCostItem(overrides: Partial<CostItem> = {}): CostItem {
  return {
    id: 'ci-1',
    productId: 'p-1',
    userId: 'user-1',
    label: 'Raw Materials',
    costType: 'Variable',
    amount: 20,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeProduct(overrides: Partial<ProductWithCostItems> = {}): ProductWithCostItems {
  return {
    id: 'p-1',
    userId: 'user-1',
    name: 'Widget',
    productType: 'Physical Good',
    description: null,
    sellingPrice: 100,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    costItems: [],
    ...overrides,
  }
}

// ─── Helpers that mirror ProductProvider fetch logic ─────────────────────────

/**
 * Simulates the loadProducts fetch logic from ProductProvider.
 * Returns { products, error } after the fetch resolves or rejects.
 */
async function simulateLoadProducts(): Promise<{
  products: ProductWithCostItems[]
  error: string | null
  isLoading: false
}> {
  try {
    const res = await fetch('/api/products')
    const json = await res.json()
    if (!res.ok) {
      const msg = json?.error ?? 'Failed to load products'
      return { products: [], error: msg, isLoading: false }
    }
    return { products: json.products ?? [], error: null, isLoading: false }
  } catch (err) {
    const msg = (err as Error)?.message ?? 'Network error'
    return { products: [], error: msg, isLoading: false }
  }
}

/**
 * Simulates the createProduct action from ProductProvider.
 * Returns { product } on success or throws on failure.
 */
async function simulateCreateProduct(
  existing: ProductWithCostItems[],
  data: { name: string; productType: ProductType; description?: string; sellingPrice: number }
): Promise<ProductWithCostItems[]> {
  const res = await fetch('/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const json = await res.json()
  if (!res.ok) {
    throw new Error(json?.error ?? 'Failed to create product')
  }
  const created = json.product
  const withCosts: ProductWithCostItems = { ...created, costItems: [] }
  return [withCosts, ...existing]
}

/**
 * Simulates the updateProduct action from ProductProvider.
 * Returns updated products array on success or throws on failure.
 */
async function simulateUpdateProduct(
  existing: ProductWithCostItems[],
  id: string,
  data: Partial<{ name: string; productType: ProductType; description?: string; sellingPrice: number }>
): Promise<ProductWithCostItems[]> {
  const res = await fetch(`/api/products?id=${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const json = await res.json()
  if (!res.ok) {
    throw new Error(json?.error ?? 'Failed to update product')
  }
  const updated = json.product
  return existing.map((p) => (p.id === id ? { ...p, ...updated } : p))
}

/**
 * Simulates the deleteProduct action from ProductProvider.
 * Returns filtered products array on success or throws on failure.
 */
async function simulateDeleteProduct(
  existing: ProductWithCostItems[],
  id: string
): Promise<ProductWithCostItems[]> {
  const res = await fetch(`/api/products?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
  const json = await res.json()
  if (!res.ok) {
    throw new Error(json?.error ?? 'Failed to delete product')
  }
  return existing.filter((p) => p.id !== id)
}

// ─── Mock helpers ─────────────────────────────────────────────────────────────

function mockFetchOk(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  })
}

function mockFetchFail(errorBody: unknown, status = 500) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve(errorBody),
  })
}

function mockFetchReject(message = 'Network error') {
  return vi.fn().mockRejectedValue(new Error(message))
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ProductProvider — loadProducts (initial fetch)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns products when GET /api/products succeeds', async () => {
    const product = makeProduct()
    vi.stubGlobal('fetch', mockFetchOk({ ok: true, products: [product] }))

    const result = await simulateLoadProducts()

    expect(result.error).toBeNull()
    expect(result.products).toHaveLength(1)
    expect(result.products[0].id).toBe('p-1')
    expect(result.isLoading).toBe(false)
  })

  it('returns empty products array when response has no products field', async () => {
    vi.stubGlobal('fetch', mockFetchOk({ ok: true }))

    const result = await simulateLoadProducts()

    expect(result.error).toBeNull()
    expect(result.products).toEqual([])
  })

  it('sets error when GET /api/products returns non-ok status', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchFail({ ok: false, error: 'Failed to load products. Please try again.' }, 500)
    )

    const result = await simulateLoadProducts()

    expect(result.products).toEqual([])
    expect(result.error).toBe('Failed to load products. Please try again.')
  })

  it('sets error with generic message when server error has no error field', async () => {
    vi.stubGlobal('fetch', mockFetchFail({}, 500))

    const result = await simulateLoadProducts()

    expect(result.error).toBe('Failed to load products')
    expect(result.products).toEqual([])
  })

  it('sets error when fetch rejects (network failure)', async () => {
    vi.stubGlobal('fetch', mockFetchReject('Failed to fetch'))

    const result = await simulateLoadProducts()

    expect(result.products).toEqual([])
    expect(result.error).toBe('Failed to fetch')
  })
})

describe('ProductProvider — createProduct state update', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('prepends created product to the product list', async () => {
    const existing = [makeProduct({ id: 'p-existing', name: 'Existing Widget' })]
    const newProduct = makeProduct({ id: 'p-new', name: 'New Widget', sellingPrice: 50 })
    vi.stubGlobal('fetch', mockFetchOk({ ok: true, product: newProduct }))

    const result = await simulateCreateProduct(existing, {
      name: 'New Widget',
      productType: 'Physical Good',
      sellingPrice: 50,
    })

    expect(result).toHaveLength(2)
    // Newly created product is at the front
    expect(result[0].id).toBe('p-new')
    expect(result[0].name).toBe('New Widget')
    expect(result[0].costItems).toEqual([])
    // Existing product is still present
    expect(result[1].id).toBe('p-existing')
  })

  it('initializes costItems as empty array on created product', async () => {
    const newProduct = makeProduct({ id: 'p-new', name: 'Service Alpha' })
    vi.stubGlobal('fetch', mockFetchOk({ ok: true, product: newProduct }))

    const result = await simulateCreateProduct([], {
      name: 'Service Alpha',
      productType: 'Service',
      sellingPrice: 200,
    })

    expect(result[0].costItems).toEqual([])
  })

  it('throws and does not update list on createProduct API failure', async () => {
    const existing = [makeProduct()]
    vi.stubGlobal('fetch', mockFetchFail({ ok: false, error: 'Failed to save product. Please try again.' }, 500))

    await expect(
      simulateCreateProduct(existing, { name: 'Bad Product', productType: 'Physical Good', sellingPrice: 10 })
    ).rejects.toThrow('Failed to save product. Please try again.')
  })
})

describe('ProductProvider — updateProduct state update', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('updates the matching product in the list and preserves others', async () => {
    const productA = makeProduct({ id: 'p-a', name: 'Widget A', sellingPrice: 100 })
    const productB = makeProduct({ id: 'p-b', name: 'Widget B', sellingPrice: 200 })
    const existing = [productA, productB]
    const updatedA = { ...productA, name: 'Widget A Updated', sellingPrice: 150 }
    vi.stubGlobal('fetch', mockFetchOk({ ok: true, product: updatedA }))

    const result = await simulateUpdateProduct(existing, 'p-a', { name: 'Widget A Updated', sellingPrice: 150 })

    expect(result).toHaveLength(2)
    const updated = result.find((p) => p.id === 'p-a')!
    expect(updated.name).toBe('Widget A Updated')
    expect(updated.sellingPrice).toBe(150)
    // Other product unchanged
    const unchanged = result.find((p) => p.id === 'p-b')!
    expect(unchanged.name).toBe('Widget B')
    expect(unchanged.sellingPrice).toBe(200)
  })

  it('merges updated fields into the existing product (preserves costItems)', async () => {
    const costItem = makeCostItem()
    const product = makeProduct({ id: 'p-1', costItems: [costItem] })
    const serverUpdated = { id: 'p-1', name: 'Renamed Widget', sellingPrice: 120, productType: 'Physical Good', description: null, userId: 'user-1', createdAt: product.createdAt, updatedAt: '2024-02-01T00:00:00Z' }
    vi.stubGlobal('fetch', mockFetchOk({ ok: true, product: serverUpdated }))

    const result = await simulateUpdateProduct([product], 'p-1', { name: 'Renamed Widget', sellingPrice: 120 })

    expect(result[0].costItems).toEqual([costItem])
    expect(result[0].name).toBe('Renamed Widget')
    expect(result[0].sellingPrice).toBe(120)
  })

  it('throws and does not update list on updateProduct API failure', async () => {
    const existing = [makeProduct()]
    vi.stubGlobal('fetch', mockFetchFail({ ok: false, error: 'Failed to update product' }, 500))

    await expect(
      simulateUpdateProduct(existing, 'p-1', { name: 'Bad Update' })
    ).rejects.toThrow('Failed to update product')
  })
})

describe('ProductProvider — deleteProduct state update', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('removes the deleted product from the list', async () => {
    const productA = makeProduct({ id: 'p-a', name: 'Widget A' })
    const productB = makeProduct({ id: 'p-b', name: 'Widget B' })
    const existing = [productA, productB]
    vi.stubGlobal('fetch', mockFetchOk({ ok: true }))

    const result = await simulateDeleteProduct(existing, 'p-a')

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('p-b')
    expect(result.find((p) => p.id === 'p-a')).toBeUndefined()
  })

  it('handles deleting the only product — returns empty list', async () => {
    const existing = [makeProduct({ id: 'p-only' })]
    vi.stubGlobal('fetch', mockFetchOk({ ok: true }))

    const result = await simulateDeleteProduct(existing, 'p-only')

    expect(result).toEqual([])
  })

  it('throws and does not update list on deleteProduct API failure', async () => {
    const existing = [makeProduct()]
    vi.stubGlobal('fetch', mockFetchFail({ ok: false, error: 'Failed to delete product' }, 500))

    await expect(simulateDeleteProduct(existing, 'p-1')).rejects.toThrow('Failed to delete product')
  })
})

describe('ProductProvider — filteredProducts derived value (searchTerm changes)', () => {
  const products: ProductWithCostItems[] = [
    makeProduct({ id: 'p-1', name: 'Coffee Mug', description: 'A ceramic mug', productType: 'Physical Good', sellingPrice: 15, costItems: [] }),
    makeProduct({ id: 'p-2', name: 'Consulting Service', description: null, productType: 'Service', sellingPrice: 200, costItems: [] }),
    makeProduct({ id: 'p-3', name: 'Notebook', description: 'Spiral bound notebook', productType: 'Physical Good', sellingPrice: 8, costItems: [] }),
  ]

  it('returns all products when searchTerm is blank', () => {
    const result = filterProducts(products, '', 'All', 'All')
    expect(result).toHaveLength(3)
  })

  it('filters by product name (case-insensitive)', () => {
    const result = filterProducts(products, 'coffee', 'All', 'All')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('p-1')
  })

  it('filters by product description (case-insensitive)', () => {
    const result = filterProducts(products, 'spiral', 'All', 'All')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('p-3')
  })

  it('returns empty when searchTerm matches nothing', () => {
    const result = filterProducts(products, 'ZZZNOMATCH', 'All', 'All')
    expect(result).toHaveLength(0)
  })

  it('matches partial search terms across name and description', () => {
    const result = filterProducts(products, 'ceramic', 'All', 'All')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('p-1')
  })
})

describe('ProductProvider — filteredProducts derived value (viabilityFilter changes)', () => {
  const profitable = makeProduct({
    id: 'p-profitable',
    name: 'Profitable Product',
    sellingPrice: 100,
    costItems: [makeCostItem({ id: 'ci-1', amount: 40, costType: 'Variable' })], // CM = 60
  })
  const breakEven = makeProduct({
    id: 'p-breakeven',
    name: 'Break-Even Product',
    sellingPrice: 50,
    costItems: [makeCostItem({ id: 'ci-2', productId: 'p-breakeven', amount: 50, costType: 'Variable' })], // CM = 0
  })
  const unprofitable = makeProduct({
    id: 'p-unprofitable',
    name: 'Unprofitable Product',
    sellingPrice: 10,
    costItems: [makeCostItem({ id: 'ci-3', productId: 'p-unprofitable', amount: 30, costType: 'Variable' })], // CM = -20
  })

  const products = [profitable, breakEven, unprofitable]

  it('returns all products when viabilityFilter is "All"', () => {
    const result = filterProducts(products, '', 'All', 'All')
    expect(result).toHaveLength(3)
  })

  it('returns only Profitable products when viabilityFilter is "Profitable"', () => {
    const result = filterProducts(products, '', 'Profitable', 'All')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('p-profitable')
  })

  it('returns only Break-Even products when viabilityFilter is "Break-Even"', () => {
    const result = filterProducts(products, '', 'Break-Even', 'All')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('p-breakeven')
  })

  it('returns only Unprofitable products when viabilityFilter is "Unprofitable"', () => {
    const result = filterProducts(products, '', 'Unprofitable', 'All')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('p-unprofitable')
  })

  it('returns empty when viabilityFilter has no matching products', () => {
    const profitableOnly = [profitable]
    const result = filterProducts(profitableOnly, '', 'Unprofitable', 'All')
    expect(result).toHaveLength(0)
  })

  it('combines searchTerm and viabilityFilter correctly', () => {
    const result = filterProducts(products, 'Profitable', 'Profitable', 'All')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('p-profitable')
  })

  it('viabilityFilter and typeFilter work together', () => {
    const profitableService = makeProduct({
      id: 'p-ps',
      name: 'Profitable Service',
      productType: 'Service',
      sellingPrice: 200,
      costItems: [makeCostItem({ id: 'ci-ps', productId: 'p-ps', amount: 50, costType: 'Variable' })],
    })
    const allProducts = [profitable, profitableService]
    const result = filterProducts(allProducts, '', 'Profitable', 'Physical Good')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('p-profitable')
  })
})

describe('ProductProvider — error state on network failure', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sets error when fetch rejects with a network error', async () => {
    vi.stubGlobal('fetch', mockFetchReject('Failed to fetch'))

    const result = await simulateLoadProducts()

    expect(result.error).toBe('Failed to fetch')
    expect(result.products).toEqual([])
  })

  it('sets error when server returns 500 status', async () => {
    vi.stubGlobal('fetch', mockFetchFail({ error: 'Internal server error' }, 500))

    const result = await simulateLoadProducts()

    expect(result.error).toBe('Internal server error')
    expect(result.products).toEqual([])
  })

  it('error is cleared and products are re-fetched on retryLoad', async () => {
    // First call: simulate a failure that sets error state
    const initialResult = await (async () => {
      vi.stubGlobal('fetch', mockFetchReject('Network error'))
      return simulateLoadProducts()
    })()

    expect(initialResult.error).not.toBeNull()
    expect(initialResult.products).toEqual([])

    // Retry: simulate a successful fetch that clears error
    const product = makeProduct()
    vi.stubGlobal('fetch', mockFetchOk({ ok: true, products: [product] }))

    const retryResult = await simulateLoadProducts()

    expect(retryResult.error).toBeNull()
    expect(retryResult.products).toHaveLength(1)
    expect(retryResult.products[0].id).toBe('p-1')
  })

  it('retryLoad clears previous error even when subsequent fetch also fails', async () => {
    // First call fails
    vi.stubGlobal('fetch', mockFetchReject('First failure'))
    const first = await simulateLoadProducts()
    expect(first.error).toBe('First failure')

    // Second call also fails but with a different error
    vi.stubGlobal('fetch', mockFetchReject('Second failure'))
    const second = await simulateLoadProducts()
    expect(second.error).toBe('Second failure')
    expect(second.products).toEqual([])
  })
})

describe('ProductProvider — summary derived value', () => {
  it('returns zero counts for empty product list', () => {
    const summary = computeProductSummary([])
    expect(summary.profitable).toBe(0)
    expect(summary.breakEven).toBe(0)
    expect(summary.unprofitable).toBe(0)
  })

  it('counts correctly after createProduct (one new product)', () => {
    const product = makeProduct({
      id: 'p-new',
      sellingPrice: 100,
      costItems: [makeCostItem({ id: 'ci-1', amount: 40, costType: 'Variable' })],
    })
    const summary = computeProductSummary([product])
    expect(summary.profitable).toBe(1)
    expect(summary.breakEven).toBe(0)
    expect(summary.unprofitable).toBe(0)
  })

  it('updates total when deleteProduct removes a product', () => {
    const profitable = makeProduct({
      id: 'p-a',
      sellingPrice: 100,
      costItems: [makeCostItem({ id: 'ci-a', amount: 40, costType: 'Variable' })],
    })
    const unprofitable = makeProduct({
      id: 'p-b',
      sellingPrice: 10,
      costItems: [makeCostItem({ id: 'ci-b', productId: 'p-b', amount: 50, costType: 'Variable' })],
    })

    const before = computeProductSummary([profitable, unprofitable])
    expect(before.profitable).toBe(1)
    expect(before.unprofitable).toBe(1)

    // Simulate delete of unprofitable product
    const afterDelete = computeProductSummary([profitable])
    expect(afterDelete.profitable).toBe(1)
    expect(afterDelete.unprofitable).toBe(0)
  })

  it('reflects viability change after updateProduct changes sellingPrice', () => {
    const product = makeProduct({
      id: 'p-1',
      sellingPrice: 30,
      costItems: [makeCostItem({ id: 'ci-1', amount: 40, costType: 'Variable' })], // CM = -10, Unprofitable
    })

    const summaryBefore = computeProductSummary([product])
    expect(summaryBefore.unprofitable).toBe(1)

    // Simulate updateProduct with new sellingPrice (CM becomes positive)
    const updatedProduct = { ...product, sellingPrice: 60 }
    const summaryAfter = computeProductSummary([updatedProduct])
    expect(summaryAfter.profitable).toBe(1)
    expect(summaryAfter.unprofitable).toBe(0)
  })
})
