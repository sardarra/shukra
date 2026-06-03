import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { updateProduct, deleteProduct } from '@/lib/supabase/products'

const patchProductSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  productType: z.enum(['Physical Good', 'Service']).optional(),
  description: z.string().max(1000).nullable().optional(),
  sellingPrice: z.number().positive().optional(),
})

export async function PATCH(request: Request) {
  const url = new URL(request.url)
  const id = url.searchParams.get('id')
  if (!id) return Response.json({ ok: false, error: 'Missing product id' }, { status: 400 })

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON payload' }, { status: 400 })
  }

  const parsed = patchProductSchema.safeParse(payload)
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

    // Verify ownership: fetch the product row and ensure user_id matches
    const { data: existing, error: fetchError } = await supabase
      .from('products')
      .select('id, user_id')
      .eq('id', id)
      .maybeSingle()

    if (fetchError) {
      console.error('Failed loading product for patch:', fetchError)
      return Response.json({ ok: false, error: 'Failed to load product' }, { status: 500 })
    }

    if (!existing) {
      return Response.json({ ok: false, error: 'Product not found' }, { status: 404 })
    }

    if (existing.user_id !== user.id) {
      return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 })
    }

    try {
      const updated = await updateProduct(supabase, id, parsed.data)
      return Response.json({ ok: true, error: null, product: updated })
    } catch (err) {
      console.error('Failed updating product:', err)
      return Response.json({ ok: false, error: 'Failed to save product' }, { status: 500 })
    }
  } catch (err) {
    console.error('Auth setup failed for products PATCH:', err)
    return Response.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const url = new URL(request.url)
  const id = url.searchParams.get('id')
  if (!id) return Response.json({ ok: false, error: 'Missing product id' }, { status: 400 })

  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify ownership
    const { data: existing, error: fetchError } = await supabase
      .from('products')
      .select('id, user_id')
      .eq('id', id)
      .maybeSingle()

    if (fetchError) {
      console.error('Failed loading product for delete:', fetchError)
      return Response.json({ ok: false, error: 'Failed to load product' }, { status: 500 })
    }

    if (!existing) {
      return Response.json({ ok: false, error: 'Product not found' }, { status: 404 })
    }

    if (existing.user_id !== user.id) {
      return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 })
    }

    try {
      await deleteProduct(supabase, id)
      return Response.json({ ok: true, error: null })
    } catch (err) {
      console.error('Failed deleting product:', err)
      return Response.json({ ok: false, error: 'Failed to delete product' }, { status: 500 })
    }
  } catch (err) {
    console.error('Auth setup failed for products DELETE:', err)
    return Response.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
