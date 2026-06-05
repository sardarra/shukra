import type {
  CostItem,
  CostType,
  ProductType,
  ProductWithCostItems,
  ProductMetrics,
  ProductSummary,
  ViabilityStatus,
  CreateProductPayload,
  CreateCostItemPayload,
} from './accounting-types'

// ─── Pure Calculation Functions ───────────────────────────────────────────────

/**
 * Contribution margin = selling price minus sum of all variable cost items.
 * Validates: Requirements 3.1
 */
export function computeContributionMargin(
  sellingPrice: number,
  costItems: CostItem[]
): number {
  const totalVariableCosts = costItems
    .filter((item) => item.costType === 'Variable')
    .reduce((sum, item) => sum + item.amount, 0)
  return sellingPrice - totalVariableCosts
}

/**
 * CM ratio = (CM / sellingPrice) * 100, rounded to 2 decimal places.
 * Returns 0 defensively if sellingPrice is 0 (guarded by validation upstream).
 * Validates: Requirements 3.2
 */
export function computeContributionMarginRatio(
  contributionMargin: number,
  sellingPrice: number
): number {
  if (sellingPrice === 0) return 0
  return Math.round((contributionMargin / sellingPrice) * 100 * 100) / 100
}

/**
 * Break-even units = ceil(sum(fixed costs) / CM).
 * Returns 'N/A' if there are no fixed cost items.
 * Returns 'Cannot break even' if CM <= 0.
 * Validates: Requirements 4.1, 4.3, 4.4
 */
export function computeBreakEvenUnits(
  costItems: CostItem[],
  contributionMargin: number
): number | 'N/A' | 'Cannot break even' {
  const fixedCostItems = costItems.filter((item) => item.costType === 'Fixed')

  if (fixedCostItems.length === 0) {
    return 'N/A'
  }

  if (contributionMargin <= 0) {
    return 'Cannot break even'
  }

  const totalFixedCosts = fixedCostItems.reduce((sum, item) => sum + item.amount, 0)
  return Math.ceil(totalFixedCosts / contributionMargin)
}

/**
 * Viability status based on contribution margin sign.
 * Validates: Requirements 5.1
 */
export function computeViabilityStatus(contributionMargin: number): ViabilityStatus {
  if (contributionMargin > 0) return 'Profitable'
  if (contributionMargin === 0) return 'Break-Even'
  return 'Unprofitable'
}

/**
 * Compute all metrics for a product in one call.
 * Validates: Requirements 2.3, 2.4, 3.4
 */
export function computeProductMetrics(product: ProductWithCostItems): ProductMetrics {
  const cm = computeContributionMargin(product.sellingPrice, product.costItems)
  const cmRatio = computeContributionMarginRatio(cm, product.sellingPrice)
  const breakEvenUnits = computeBreakEvenUnits(product.costItems, cm)
  const viabilityStatus = computeViabilityStatus(cm)

  return {
    contributionMargin: cm,
    contributionMarginRatio: cmRatio,
    breakEvenUnits,
    viabilityStatus,
  }
}

/**
 * Compute summary counts across a list of products.
 * Validates: Requirements 5.4
 */
export function computeProductSummary(products: ProductWithCostItems[]): ProductSummary {
  const summary: ProductSummary = { profitable: 0, breakEven: 0, unprofitable: 0 }
  for (const product of products) {
    const cm = computeContributionMargin(product.sellingPrice, product.costItems)
    const status = computeViabilityStatus(cm)
    if (status === 'Profitable') summary.profitable++
    else if (status === 'Break-Even') summary.breakEven++
    else summary.unprofitable++
  }
  return summary
}

/**
 * Validate a CreateProductPayload.
 * Returns a map of field -> error message, or an empty object if valid.
 * Validates: Requirements 1.5, 3.5
 */
export function validateProduct(
  payload: Partial<CreateProductPayload>
): Record<string, string> {
  const errors: Record<string, string> = {}

  if (!payload.name || payload.name.trim().length === 0) {
    errors.name = 'Product name is required.'
  } else if (payload.name.trim().length > 150) {
    errors.name = 'Product name must not exceed 150 characters.'
  }

  if (!payload.productType) {
    errors.productType = 'Product type is required.'
  }

  if (payload.sellingPrice === undefined || payload.sellingPrice === null) {
    errors.sellingPrice = 'Selling price is required.'
  } else if (payload.sellingPrice <= 0) {
    errors.sellingPrice = 'Selling price must be greater than zero.'
  }

  return errors
}

/**
 * Validate a CreateCostItemPayload.
 * Returns a map of field -> error message, or an empty object if valid.
 * Validates: Requirements 2.5
 */
export function validateCostItem(
  payload: Partial<CreateCostItemPayload>
): Record<string, string> {
  const errors: Record<string, string> = {}

  if (!payload.label || payload.label.trim().length === 0) {
    errors.label = 'Cost item label is required.'
  } else if (payload.label.trim().length > 150) {
    errors.label = 'Cost item label must not exceed 150 characters.'
  }

  if (payload.amount === undefined || payload.amount === null) {
    errors.amount = 'Amount is required.'
  } else if (typeof payload.amount !== 'number' || isNaN(payload.amount)) {
    errors.amount = 'Amount must be a valid number.'
  } else if (payload.amount < 0) {
    errors.amount = 'Amount must be greater than or equal to zero.'
  }

  return errors
}

/**
 * Filter and search a product list.
 * - searchTerm: case-insensitive match against name or description
 * - viabilityFilter: 'All' or a specific ViabilityStatus
 * - typeFilter: 'All' or a specific ProductType
 * Validates: Requirements 6.3, 6.4, 6.5
 */
export function filterProducts(
  products: ProductWithCostItems[],
  searchTerm: string,
  viabilityFilter: ViabilityStatus | 'All',
  typeFilter: ProductType | 'All'
): ProductWithCostItems[] {
  const term = searchTerm.trim().toLowerCase()

  return products.filter((product) => {
    // Search filter
    if (term.length > 0) {
      const nameMatch = product.name.toLowerCase().includes(term)
      const descriptionMatch = product.description?.toLowerCase().includes(term) ?? false
      if (!nameMatch && !descriptionMatch) return false
    }

    // Viability filter
    if (viabilityFilter !== 'All') {
      const cm = computeContributionMargin(product.sellingPrice, product.costItems)
      const status = computeViabilityStatus(cm)
      if (status !== viabilityFilter) return false
    }

    // Type filter
    if (typeFilter !== 'All') {
      if (product.productType !== typeFilter) return false
    }

    return true
  })
}
