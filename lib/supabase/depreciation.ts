import {
  buildDepreciationJournalPayload,
  shouldRecordDepreciationForYear,
} from '@/lib/depreciation'
import { addJournalEntryToSupabase } from '@/lib/supabase/journal-entries'
import { getJournalEntriesByUserId } from '@/lib/supabase/journal-entries'
import {
  markPlantAssetDepreciated,
  syncPlantAssetsFromJournalEntries,
} from '@/lib/supabase/plant-assets'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * On load: sync plant assets from equipment purchases, post missing depreciation
 * journal entries for the current calendar year, then return up-to-date entries.
 */
export async function syncDepreciationForCurrentUser(): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return

  const initial = await getJournalEntriesByUserId()
  if (!initial.ok) return

  const plantAssets = await syncPlantAssetsFromJournalEntries(user.id, initial.entries)
  if (plantAssets.length === 0) return

  const asOf = new Date()
  let entries = initial.entries

  for (const asset of plantAssets) {
    if (!shouldRecordDepreciationForYear(asset, entries, asOf)) continue

    const payload = buildDepreciationJournalPayload(asset, asOf)
    if (!payload) continue

    const result = await addJournalEntryToSupabase(payload)
    if (!result.ok) continue

    await markPlantAssetDepreciated(asset.id, asOf)

    entries = [
      {
        id: `pending:${asset.id}:${asOf.getFullYear()}`,
        date: asOf.toISOString().split('T')[0]!,
        description: payload.description,
        debitAccount: payload.debitAccount,
        debitAmount: payload.debitAmount,
        creditAccount: payload.creditAccount,
        creditAmount: payload.creditAmount,
        createdAt: asOf.toISOString(),
      },
      ...entries,
    ]
  }
}
