/**
 * 
 * 4.4 Create `app/api/products/[id]/cost-items/[itemId]/route.ts` (PATCH + DELETE)
    - PATCH: authenticate, validate ownership, validate body, call `updateCostItem`, return updated cost item
    - DELETE: authenticate, validate ownership, call `deleteCostItem`, return `{ ok: true }`
    - Return 404 when cost item not found; 403 when cost item belongs to different user
    - _Requirements: 2.1, 2.3, 2.4, 7.3_
 */


import { z } from 'zod'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { updateCostItem, deleteCostItem } from '@/lib/supabase/products'

const createCostItemSchema = z.object({
  label: z.string().min(1).max(150),
  costType: z.enum(['Fixed', 'Variable']),
  amount: z.number().nonnegative(),
})

const patchCostItemSchema = createCostItemSchema.partial()

export async function PATCH(req: Request) {
  const url = new URL(req.url)

  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON payload' }, { status: 400 })
  }

  const parsed = patchCostItemSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid cost item data', issues: parsed.error.issues }, { status: 400 })
  }

  // authenticate
  let supabase
  try {
    supabase = await createSupabaseServerClient()
  } catch (err) {
    console.error('Auth setup failed for cost item PATCH:', err)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  // extract ids from pathname: /api/products/:productId/cost-items/:itemId
  const parts = url.pathname.split('/').filter(Boolean)
  const costItemId = parts[parts.length - 1]
  const productId = parts[parts.length - 3]

  if (!productId || !costItemId) {
    return NextResponse.json({ ok: false, error: 'Missing product or cost item id' }, { status: 400 })
  }

  // load cost item and verify ownership
  const { data: costItem, error: costItemError } = await supabase
    .from('product_cost_items')
    .select('id, user_id, product_id')
    .eq('id', costItemId)
    .maybeSingle()

  if (costItemError) {
    console.error('Failed loading cost item:', costItemError)
    return NextResponse.json({ ok: false, error: 'Failed to load cost item' }, { status: 500 })
  }

  if (!costItem) {
    return NextResponse.json({ ok: false, error: 'Cost item not found' }, { status: 404 })
  }

  if (costItem.user_id !== user.id) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
  }

  // perform update via shared helper
  try {
    const updated = await updateCostItem(supabase, costItemId, {
      ...parsed.data,
    })
    return NextResponse.json({ ok: true, error: null, costItem: updated })
  } catch (err) {
    console.error('Failed updating cost item:', err)
    return NextResponse.json({ ok: false, error: 'Failed to update cost item' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const url = new URL(req.url)

  // authenticate
  let supabase
  try {
    supabase = await createSupabaseServerClient()
  } catch (err) {
    console.error('Auth setup failed for cost item DELETE:', err)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const parts = url.pathname.split('/').filter(Boolean)
  const costItemId = parts[parts.length - 1]
  const productId = parts[parts.length - 3]

  if (!productId || !costItemId) {
    return NextResponse.json({ ok: false, error: 'Missing product or cost item id' }, { status: 400 })
  }

  // verify ownership
  const { data: costItem, error: costItemError } = await supabase
    .from('product_cost_items')
    .select('id, user_id')
    .eq('id', costItemId)
    .maybeSingle()

  if (costItemError) {
    console.error('Failed loading cost item for delete:', costItemError)
    return NextResponse.json({ ok: false, error: 'Failed to load cost item' }, { status: 500 })
  }

  if (!costItem) {
    return NextResponse.json({ ok: false, error: 'Cost item not found' }, { status: 404 })
  }

  if (costItem.user_id !== user.id) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
  }

  try {
    await deleteCostItem(supabase, costItemId)
    return NextResponse.json({ ok: true, error: null })
  } catch (err) {
    console.error('Failed deleting cost item:', err)
    return NextResponse.json({ ok: false, error: 'Failed to delete cost item' }, { status: 500 })
  }
}

