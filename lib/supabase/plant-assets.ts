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
