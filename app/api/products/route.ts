/**
 * GET: authenticate via createSupabaseServerClient, call fetchProductsWithCostItems, return { ok: true, products } or error shape
 * POST: authenticate, validate body with Zod against CreateProductPayload (name max 150 chars, productType enum, sellingPrice > 0), call insertProduct, return { ok: true, product } or 400/401/500 error shape
 * Requirements: 1.1, 7.1, 7.2
 * 
 * 
 * Page assembly — wire everything together
  - [ ] 8.1 Create `app/(app)/products/page.tsx`
    - Wrap page content in `<ProductProvider>`
    - Render `ProductSummaryPanel`, `ProductList`, and a floating "Add Product" button that opens `AddProductDialog`
    - Render an alert banner when `ProductProvider.error` is non-null, with a "Retry" button that calls `retryLoad` (consistent with `AccountingProvider` pattern)
    - Render a loading skeleton and block user interaction while `isLoading` is true
    - _Requirements: 1.2, 7.5, 7.6_
 */



import { z } from 'zod'
import { NextResponse } from 'next/server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { fetchProductsWithCostItems, insertProduct } from '@/lib/supabase/products'

const createProductSchema = z.object({
  name: z.string().min(1).max(150),
  productType: z.enum(['Physical Good', 'Service']),
  description: z.string().max(1000).optional(),
  sellingPrice: z.number().positive(),
})

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return Response.json({ ok: false, error: 'Unauthorized', products: [] }, { status: 401 })
    }

    try {
      const products = await fetchProductsWithCostItems(supabase)
      return Response.json({ ok: true, error: null, products })
    } catch (err) {
      console.error('Failed fetching products:', err)
      return Response.json({ ok: false, error: 'Failed to load products', products: [] }, { status: 500 })
    }
  } catch (err) {
    console.error('Auth setup failed for products GET:', err)
    return Response.json({ ok: false, error: 'Server error', products: [] }, { status: 500 })
  }
}

export async function POST(request: Request) {
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON payload' }, { status: 400 })
  }

  const parsed = createProductSchema.safeParse(payload)
  if (!parsed.success) {
    return Response.json({ ok: false, error: 'Invalid request payload', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    try {
      const product = await insertProduct(supabase, parsed.data)
      return Response.json({ ok: true, error: null, product }, { status: 201 })
    } catch (err) {
      console.error('Failed inserting product:', err)
      return Response.json({ ok: false, error: 'Failed to save product' }, { status: 500 })
    }
  } catch (err) {
    console.error('Auth setup failed for products POST:', err)
    return Response.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}

