import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Product,
  CostItem,
  ProductWithCostItems,
  CreateProductPayload,
  CreateCostItemPayload,
} from '@/lib/accounting-types'

// ─── Row types (snake_case DB columns) ────────────────────────────────────────

type ProductRow = {
  id: string
  user_id: string
  name: string
  product_type: string
  description: string | null
  selling_price: number
  created_at: string
  updated_at: string
}

type CostItemRow = {
  id: string
  product_id: string
  user_id: string
  label: string
  cost_type: string
  amount: number
  created_at: string
  updated_at: string
}

type ProductWithCostItemsRow = ProductRow & {
  product_cost_items: CostItemRow[]
}

// ─── Mapping helpers ───────────────────────────────────────────────────────────

function rowToProduct(row: ProductRow): Product {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    productType: row.product_type as Product['productType'],
    description: row.description,
    sellingPrice: Number(row.selling_price),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function rowToCostItem(row: CostItemRow): CostItem {
  return {
    id: row.id,
    productId: row.product_id,
    userId: row.user_id,
    label: row.label,
    costType: row.cost_type as CostItem['costType'],
    amount: Number(row.amount),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch all products for the authenticated user, joined with their cost items,
 * ordered by created_at DESC.
 * Requirements: 7.1, 7.2
 */
export async function fetchProductsWithCostItems(
  supabase: SupabaseClient
): Promise<ProductWithCostItems[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*, product_cost_items(*)')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed loading products:', error)
    throw new Error('Failed to load products')
  }

  return ((data ?? []) as ProductWithCostItemsRow[]).map((row) => ({
    ...rowToProduct(row),
    costItems: (row.product_cost_items ?? []).map(rowToCostItem),
  }))
}

/**
 * Insert a new product record and return the created Product.
 * Requirements: 1.1, 7.3
 */
export async function insertProduct(
  supabase: SupabaseClient,
  payload: CreateProductPayload
): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .insert({
      name: payload.name,
      product_type: payload.productType,
      description: payload.description ?? null,
      selling_price: payload.sellingPrice,
    })
    .select('*')
    .single()

  if (error) {
    console.error('Failed inserting product:', error)
    throw new Error('Failed to save product. Please try again.')
  }

  return rowToProduct(data as ProductRow)
}

/**
 * Patch mutable fields on a product and return the updated Product.
 * Always sets updated_at to now().
 * Requirements: 1.3, 7.3
 */
export async function updateProduct(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<Pick<Product, 'name' | 'description' | 'productType' | 'sellingPrice'>>
): Promise<Product> {
  const snakePatch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if ('name' in patch) snakePatch['name'] = patch.name
  if ('description' in patch) snakePatch['description'] = patch.description
  if ('productType' in patch) snakePatch['product_type'] = patch.productType
  if ('sellingPrice' in patch) snakePatch['selling_price'] = patch.sellingPrice

  const { data, error } = await supabase
    .from('products')
    .update(snakePatch)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    console.error('Failed updating product:', error)
    throw new Error('Failed to save product. Please try again.')
  }

  return rowToProduct(data as ProductRow)
}

/**
 * Hard-delete a product row. Cascade FK removes all associated cost items.
 * Requirements: 1.4, 7.3
 */
export async function deleteProduct(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Failed deleting product:', error)
    throw new Error('Failed to delete product. Please try again.')
  }
}

/**
 * Insert a cost item for a product and return the created CostItem.
 * Requirements: 2.1, 7.3
 */
export async function insertCostItem(
  supabase: SupabaseClient,
  productId: string,
  payload: CreateCostItemPayload
): Promise<CostItem> {
  const { data, error } = await supabase
    .from('product_cost_items')
    .insert({
      product_id: productId,
      label: payload.label,
      cost_type: payload.costType,
      amount: payload.amount,
    })
    .select('*')
    .single()

  if (error) {
    console.error('Failed inserting cost item:', error)
    throw new Error('Failed to save cost item. Please try again.')
  }

  return rowToCostItem(data as CostItemRow)
}

/**
 * Patch mutable fields on a cost item and return the updated CostItem.
 * Always sets updated_at to now().
 * Requirements: 2.3, 7.3
 */
export async function updateCostItem(
  supabase: SupabaseClient,
  itemId: string,
  patch: Partial<Pick<CostItem, 'label' | 'costType' | 'amount'>>
): Promise<CostItem> {
  const snakePatch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if ('label' in patch) snakePatch['label'] = patch.label
  if ('costType' in patch) snakePatch['cost_type'] = patch.costType
  if ('amount' in patch) snakePatch['amount'] = patch.amount

  const { data, error } = await supabase
    .from('product_cost_items')
    .update(snakePatch)
    .eq('id', itemId)
    .select('*')
    .single()

  if (error) {
    console.error('Failed updating cost item:', error)
    throw new Error('Failed to save cost item. Please try again.')
  }

  return rowToCostItem(data as CostItemRow)
}

/**
 * Delete a cost item row.
 * Requirements: 2.4, 7.3
 */
export async function deleteCostItem(
  supabase: SupabaseClient,
  itemId: string
): Promise<void> {
  const { error } = await supabase
    .from('product_cost_items')
    .delete()
    .eq('id', itemId)

  if (error) {
    console.error('Failed deleting cost item:', error)
    throw new Error('Failed to delete cost item. Please try again.')
  }
}
