import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { PlantAsset } from '@/lib/accounting-types'
import { inferPlantAssetsFromJournalEntries } from '@/lib/depreciation'
import type { JournalEntry } from '@/lib/accounting-types'

type PlantAssetRow = {
  id: string
  user_id: string
  journal_entry_id: string | null
  name: string
  specific_name: string | null
  account: string
  cost: number
  salvage_value: number
  useful_life_years: number
  purchase_date: string
  last_depreciated_date: string | null
  created_at: string
}

function rowToPlantAsset(row: PlantAssetRow): PlantAsset {
  return {
    id: row.id,
    name: row.name,
    specificName: row.specific_name?.trim() || row.name,
    account: row.account,
    cost: Number(row.cost),
    salvageValue: Number(row.salvage_value),
    usefulLifeYears: row.useful_life_years,
    purchaseDate: row.purchase_date,
    lastDepreciatedDate: row.last_depreciated_date,
    createdAt: row.created_at,
  }
}

export async function getPlantAssetsForUser(userId: string): Promise<PlantAsset[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('plantAssets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Failed loading plantAssets:', error)
    return []
  }

  return ((data ?? []) as PlantAssetRow[]).map(rowToPlantAsset)
}

export async function createPlantAssetFromPurchase(params: {
  userId: string
  journalEntryId: string
  specificName: string
  account: string
  cost: number
  purchaseDate: string
  description: string
}): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const specificName = params.specificName.trim()
  if (!specificName) return

  const { error } = await supabase.from('plantAssets').upsert(
    {
      user_id: params.userId,
      journal_entry_id: params.journalEntryId,
      name: params.description,
      specific_name: specificName,
      account: params.account,
      cost: params.cost,
      salvage_value: 0,
      useful_life_years: 5,
      purchase_date: params.purchaseDate,
    },
    { onConflict: 'user_id,journal_entry_id' }
  )

  if (error) {
    console.error('Failed creating plantAsset from purchase:', error)
  }
}

/** Create plant asset rows for equipment purchases not yet tracked. */
export async function syncPlantAssetsFromJournalEntries(
  userId: string,
  entries: JournalEntry[]
): Promise<PlantAsset[]> {
  const supabase = await createSupabaseServerClient()
  const inferred = inferPlantAssetsFromJournalEntries(entries)

  for (const asset of inferred) {
    const { error } = await supabase.from('plantAssets').upsert(
      {
        user_id: userId,
        journal_entry_id: asset.journalEntryId,
        name: asset.name,
        specific_name: asset.specificName,
        account: asset.account,
        cost: asset.cost,
        salvage_value: asset.salvageValue,
        useful_life_years: asset.usefulLifeYears,
        purchase_date: asset.purchaseDate,
      },
      { onConflict: 'user_id,journal_entry_id' }
    )

    if (error) {
      console.error('Failed upserting plantAsset:', error)
    }
  }

  return getPlantAssetsForUser(userId)
}

/** Remove plant asset row(s) tied to a journal entry (e.g. equipment purchase). */
export async function deletePlantAssetsByJournalEntryId(
  userId: string,
  journalEntryId: string
): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase
    .from('plantAssets')
    .delete()
    .eq('user_id', userId)
    .eq('journal_entry_id', journalEntryId)

  if (error) {
    console.error('Failed deleting plantAsset for journal entry:', error)
  }
}

/** Drop plant assets whose purchase journal entry no longer exists. */
export async function pruneOrphanedPlantAssets(
  userId: string,
  entries: JournalEntry[]
): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const validJournalIds = new Set(
    entries
      .map((e) => (e.id.startsWith('db:') ? e.id.slice(3) : e.id))
      .filter((id) => id.length > 0 && !id.startsWith('pending:'))
  )

  const { data, error } = await supabase
    .from('plantAssets')
    .select('id, journal_entry_id')
    .eq('user_id', userId)

  if (error) {
    console.error('Failed loading plantAssets for prune:', error)
    return
  }

  for (const row of data ?? []) {
    if (row.journal_entry_id && !validJournalIds.has(row.journal_entry_id)) {
      const { error: deleteError } = await supabase
        .from('plantAssets')
        .delete()
        .eq('id', row.id)
        .eq('user_id', userId)
      if (deleteError) {
        console.error('Failed pruning orphaned plantAsset:', deleteError)
      }
    }
  }
}

export async function markPlantAssetDepreciated(
  plantAssetId: string,
  asOf: Date = new Date()
): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase
    .from('plantAssets')
    .update({ last_depreciated_date: asOf.toISOString() })
    .eq('id', plantAssetId)

  if (error) {
    console.error('Failed updating plantAssets last_depreciated_date:', error)
  }
}
