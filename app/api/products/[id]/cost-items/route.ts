/**
 4.3 Create `app/api/products/[id]/cost-items/route.ts` (POST)
    - POST: authenticate, validate ownership of parent product, validate body with Zod against `CreateCostItemPayload` (label non-empty max 150 chars, costType enum, amount >= 0), call `insertCostItem`, return `{ ok: true, costItem }`
    - If product insert succeeded but cost item insert fails, delete the product row (compensating transaction) and return 500
 */

import { z } from 'zod'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'


const createCostItemSchema = z.object({
  label: z.string().min(1).max(150),
  costType: z.enum(['Fixed', 'Variable']),
  amount: z.number().positive(),
})


 

export async function POST(request: Request) {
  const url = new URL(request.url)
  const id = url.searchParams.get('id')
  if (!id) return NextResponse.json({ ok: false, error: 'Missing product id' }, { status: 400 })

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON payload' }, { status: 400 })
  }

  const parsed = createCostItemSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid request payload', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })    }
    
    

  } catch (err) {
    console.error('Auth setup failed for products GET:', err)
    return NextResponse.json({ ok: false, error: 'Server error', products: [] }, { status: 500 })
  }
}