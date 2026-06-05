import {
  deletePlantAssetForUser,
  getPlantAssetsForUser,
} from '@/lib/supabase/plant-assets'
import { getJournalEntriesByUserId } from '@/lib/supabase/journal-entries'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get('id')
  if (!id) {
    return Response.json({ ok: false, error: 'Missing equipment id' }, { status: 400 })
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const result = await deletePlantAssetForUser(user.id, id)
  console.log('[plant-assets DELETE] deletePlantAssetForUser result:', result, { id, userId: user.id })
  if (!result.ok) {
    const status = result.error === 'Equipment not found' ? 404 : 500
    return Response.json(result, { status })
  }

  const entriesResult = await getJournalEntriesByUserId()
  const plantAssets = await getPlantAssetsForUser(user.id)

  return Response.json({
    ok: true,
    error: null,
    entries: entriesResult.ok ? entriesResult.entries : [],
    plantAssets,
  })
}
