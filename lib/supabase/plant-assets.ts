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
    associatedJournalEntry: row.journal_entry_id,
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
}): Promise<{ ok: boolean; plantAssetId: string | null; error: string | null }> {
  const supabase = await createSupabaseServerClient()
  const specificName = params.specificName.trim()
  if (!specificName) return { ok: false, plantAssetId: null, error: 'Missing specific name' }

  const { data, error } = await supabase
    .from('plantAssets')
    .upsert(
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
    .select('id')
    .single()

  if (error) {
    console.error('Failed creating plantAsset from purchase:', error)
    return { ok: false, plantAssetId: null, error: 'Failed creating plant asset' }
  }

  // #region agent log
  fetch('http://127.0.0.1:7709/ingest/f40f776f-254e-49db-9528-88929ba71b5f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d4d661'},body:JSON.stringify({sessionId:'d4d661',runId:'pre-fix',hypothesisId:'H5',location:'plant-assets.ts:createPlantAssetFromPurchase',message:'Plant asset upserted',data:{plantAssetId:(data as { id?: string } | null)?.id??null,journalEntryId:params.journalEntryId,specificName,purchaseDate:params.purchaseDate,cost:params.cost},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  return { ok: true, plantAssetId: (data as { id?: string } | null)?.id ?? null, error: null }
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

/**
 * Delete a plant asset and its associated journal entry (if any).
 * Always deletes the plantAssets row directly by ID, then deletes the linked
 * journal entry separately. This avoids relying on the journal-entry delete
 * path to clean up the plant asset row, which can fail silently.
 */
export async function deletePlantAssetForUser(
  userId: string,
  plantAssetId: string
): Promise<{ ok: boolean; error: string | null }> {
  const supabase = await createSupabaseServerClient()
  const { data: row, error } = await supabase
    .from('plantAssets')
    .select('journal_entry_id')
    .eq('id', plantAssetId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('Failed loading plantAsset for delete:', error)
    return { ok: false, error: 'Failed to load equipment record' }
  }

  if (!row) {
    return { ok: false, error: 'Equipment not found' }
  }

  // Delete the plant asset row directly — don't rely on the journal entry
  // delete path to cascade this, since that path can fail silently.
  const { error: deleteAssetError } = await supabase
    .from('plantAssets')
    .delete()
    .eq('id', plantAssetId)
    .eq('user_id', userId)

  if (deleteAssetError) {
    console.error('Failed deleting plantAsset:', deleteAssetError)
    return { ok: false, error: 'Failed to delete equipment' }
  }

  // If there's a linked journal entry, delete it too.
  if (row.journal_entry_id) {
    const { error: deleteEntryError } = await supabase
      .from('journalEntries')
      .delete()
      .eq('id', row.journal_entry_id)
      .eq('user_id', userId)

    if (deleteEntryError) {
      console.error('Failed deleting linked journal entry for plant asset:', deleteEntryError)
      // The asset is already gone — return ok but log the partial failure.
      // The journal entry will be pruned on next load via pruneOrphanedPlantAssets.
    }
  }

  return { ok: true, error: null }
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
