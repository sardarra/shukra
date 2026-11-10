import { z } from 'zod'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { insertCostItem } from '@/lib/supabase/products'

const createCostItemSchema = z.object({
  label: z.string().min(1).max(150),
  costType: z.enum(['Fixed', 'Variable']),
  amount: z.number().nonnegative(),
})

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: productId } = await context.params
  if (!productId) {
    return NextResponse.json({ ok: false, error: 'Missing product id' }, { status: 400 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON payload' }, { status: 400 })
  }

  const parsed = createCostItemSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Invalid request payload', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, user_id')
      .eq('id', productId)
      .maybeSingle()

    if (productError) {
      console.error('Failed loading product for cost item insert:', productError)
      return NextResponse.json({ ok: false, error: 'Failed to load product' }, { status: 500 })
    }

    if (!product) {
      return NextResponse.json({ ok: false, error: 'Product not found' }, { status: 404 })
    }

    if (product.user_id !== user.id) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
    }

    try {
      const costItem = await insertCostItem(supabase, user.id, productId, parsed.data)
      return NextResponse.json({ ok: true, error: null, costItem }, { status: 201 })
    } catch (err) {
      console.error('Failed inserting cost item:', err)
      return NextResponse.json({ ok: false, error: 'Failed to save cost item' }, { status: 500 })
    }
  } catch (err) {
    console.error('Auth setup failed for cost item POST:', err)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
