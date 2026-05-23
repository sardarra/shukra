import { z } from 'zod'
import { syncDepreciationForCurrentUser } from '@/lib/supabase/depreciation'
import {
  addJournalEntryToSupabase,
  deleteJournalEntryFromSupabase,
  getJournalEntriesByUserId,
} from '@/lib/supabase/journal-entries'
import { getPlantAssetsForUser, pruneOrphanedPlantAssets } from '@/lib/supabase/plant-assets'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const persistJournalEntrySchema = z.object({
  description: z.string(),
  debitAccount: z.string().min(1),
  debitAmount: z.number().positive(),
  creditAccount: z.string().min(1),
  creditAmount: z.number().positive(),
  date: z.string().optional(),
  plantAssetSpecificName: z.string().optional(),
})

export async function POST(request: Request) {
  const payload = await request.json()
  const parsed = persistJournalEntrySchema.safeParse(payload)

  if (!parsed.success) {
    return Response.json(
      { ok: false, error: 'Invalid request payload' },
      { status: 400 }
    )
  }

  const result = await addJournalEntryToSupabase(parsed.data)
  if (!result.ok) {
    const status = result.error === 'Unauthorized' ? 401 : 500
    return Response.json(result, { status })
  }

  return Response.json(result)
}

export async function GET() {
  await syncDepreciationForCurrentUser()
  const result = await getJournalEntriesByUserId()
  if (!result.ok) {
    const status = result.error === 'Unauthorized' ? 401 : 500
    return Response.json(
      { ok: false, error: result.error, entries: [], plantAssets: [] },
      { status }
    )
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) {
    await pruneOrphanedPlantAssets(user.id, result.entries)
  }
  const plantAssets = user ? await getPlantAssetsForUser(user.id) : []

  return Response.json({
    ok: true,
    error: null,
    entries: result.entries,
    plantAssets,
  })
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get('id')
  if (!id) {
    return Response.json({ ok: false, error: 'Missing entry id' }, { status: 400 })
  }

  const result = await deleteJournalEntryFromSupabase(id)
  if (!result.ok) {
    const status =
      result.error === 'Unauthorized'
        ? 401
        : result.error === 'Cannot delete entry that was not saved to the database'
          ? 400
          : 500
    return Response.json(result, { status })
  }

  const entriesResult = await getJournalEntriesByUserId()
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user && entriesResult.ok) {
    await pruneOrphanedPlantAssets(user.id, entriesResult.entries)
  }

  const plantAssets = user ? await getPlantAssetsForUser(user.id) : []

  return Response.json({
    ok: true,
    error: null,
    entries: entriesResult.ok ? entriesResult.entries : [],
    plantAssets,
  })
}
