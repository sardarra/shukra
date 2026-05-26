import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { JournalEntry } from '@/lib/accounting-types'
import { isDepreciablePlantPurchase } from '@/lib/depreciation'
import {
  createPlantAssetFromPurchase,
  deletePlantAssetsByJournalEntryId,
} from '@/lib/supabase/plant-assets'

export function journalEntryIdToDbKey(entryId: string): string | null {
  if (entryId.startsWith('db:')) return entryId.slice(3)
  if (/^\d+$/.test(entryId)) return entryId
  return null
}

const journalEntryInsertSchema = z.object({
  description: z.string(),
  debitAccount: z.string().min(1),
  debitAmount: z.number().positive(),
  creditAccount: z.string().min(1),
  creditAmount: z.number().positive(),
  date: z.string().optional(),
  plantAssetSpecificName: z.string().optional(),
})

export type JournalEntryInsertPayload = z.infer<typeof journalEntryInsertSchema>

type JournalRow = {
  id: number | string
  created_at: string
  description: string | null
  debit_account: string | null
  debit_amount: number | null
  credit_account: string | null
  credit_amount: number | null
  user_id: string | null
  associated_plant_asset_id?: string | null
}

function rowToJournalEntry(row: JournalRow): JournalEntry {
  const created = row.created_at
  const date = created.includes('T') ? created.split('T')[0]! : created.slice(0, 10)
  return {
    id: `db:${String(row.id)}`,
    date,
    description: row.description ?? '',
    debitAccount: row.debit_account ?? '',
    debitAmount: row.debit_amount ?? 0,
    creditAccount: row.credit_account ?? '',
    creditAmount: row.credit_amount ?? 0,
    createdAt: created,
  }
}

/** Insert one row; `user_id` is Supabase Auth `user.id` (UUID string). */
export async function addJournalEntryToSupabase(
  input: JournalEntryInsertPayload
): Promise<{ ok: boolean; error: string | null }> {
  const parsed = journalEntryInsertSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'Invalid journal entry payload' }
  }

  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { ok: false, error: 'Unauthorized' }
    }

    const createdAt = parsed.data.date
      ? new Date(`${parsed.data.date}T12:00:00.000Z`).toISOString()
      : new Date().toISOString()

    const { data: inserted, error } = await supabase
      .from('journalEntries')
      .insert({
        created_at: createdAt,
        description: parsed.data.description,
        debit_account: parsed.data.debitAccount,
        debit_amount: parsed.data.debitAmount,
        credit_account: parsed.data.creditAccount,
        credit_amount: parsed.data.creditAmount,
        user_id: user.id,
      })
      .select('id')
      .single()

    if (error) {
      console.error('Failed inserting journalEntries row:', error)
      return { ok: false, error: 'Failed to persist journal entry' }
    }

    const specificName = parsed.data.plantAssetSpecificName?.trim()
    if (
      specificName &&
      isDepreciablePlantPurchase(parsed.data.debitAccount) &&
      inserted?.id != null
    ) {
      const purchaseDate = parsed.data.date ?? createdAt.split('T')[0]!
      const createdAsset = await createPlantAssetFromPurchase({
        userId: user.id,
        journalEntryId: String(inserted.id),
        specificName,
        account: parsed.data.debitAccount,
        cost: parsed.data.debitAmount,
        purchaseDate,
        description: parsed.data.description,
      })

      // Best-effort: link journal entry -> plant asset via the new column, if present.
      if (createdAsset.ok && createdAsset.plantAssetId) {
        const { error: linkError } = await supabase
          .from('journalEntries')
          .update({ associated_plant_asset_id: createdAsset.plantAssetId })
          .eq('id', inserted.id)
          .eq('user_id', user.id)
        if (linkError) {
          // Column may not exist in some environments; don't block the entry.
          console.warn('Could not link journal entry to plant asset:', linkError)
        }
      }
    }

    return { ok: true, error: null }
  } catch (error) {
    console.error('Unexpected insert failure in addJournalEntryToSupabase:', error)
    return { ok: false, error: 'Unexpected error while persisting journal entry' }
  }
}

/** All journal rows for the current session user, newest first. */
export async function getJournalEntriesByUserId(): Promise<{
  ok: boolean
  entries: JournalEntry[]
  error: string | null
}> {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { ok: false, entries: [], error: 'Unauthorized' }
    }

    const { data, error } = await supabase
      .from('journalEntries')
      .select('id, created_at, description, debit_account, debit_amount, credit_account, credit_amount, user_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed loading journalEntries:', error)
      return { ok: false, entries: [], error: 'Failed to load journal entries' }
    }

    const rows = (data ?? []) as JournalRow[]
    return {
      ok: true,
      entries: rows.map(rowToJournalEntry),
      error: null,
    }
  } catch (error) {
    console.error('Unexpected error in getJournalEntriesByUserId:', error)
    return { ok: false, entries: [], error: 'Unexpected error while loading journal entries' }
  }
}

/** Delete a journal row and any plant asset created from that purchase entry. */
export async function deleteJournalEntryFromSupabase(
  entryId: string
): Promise<{ ok: boolean; error: string | null }> {
  const dbId = journalEntryIdToDbKey(entryId)
  if (!dbId) {
    return { ok: false, error: 'Cannot delete entry that was not saved to the database' }
  }

  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { ok: false, error: 'Unauthorized' }
    }

    // Prefer new linkage: journalEntries.associated_plant_asset_id
    const { data: linked, error: linkedError } = await supabase
      .from('journalEntries')
      .select('associated_plant_asset_id')
      .eq('id', dbId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (linkedError) {
      // If schema isn't migrated yet, fall back to old linkage.
      console.warn('Could not fetch associated_plant_asset_id:', linkedError)
    }

    const linkedPlantAssetId =
      (linked as { associated_plant_asset_id?: string | null } | null)?.associated_plant_asset_id ??
      null

    if (linkedPlantAssetId) {
      const { error: plantDeleteError } = await supabase
        .from('plantAssets')
        .delete()
        .eq('id', linkedPlantAssetId)
        .eq('user_id', user.id)
      if (plantDeleteError) {
        console.error('Failed deleting linked plant asset:', plantDeleteError)
      }
    } else {
      await deletePlantAssetsByJournalEntryId(user.id, dbId)
    }

    const { error } = await supabase
      .from('journalEntries')
      .delete()
      .eq('id', dbId)
      .eq('user_id', user.id)

    if (error) {
      console.error('Failed deleting journalEntries row:', error)
      return { ok: false, error: 'Failed to delete journal entry' }
    }

    return { ok: true, error: null }
  } catch (error) {
    console.error('Unexpected delete failure in deleteJournalEntryFromSupabase:', error)
    return { ok: false, error: 'Unexpected error while deleting journal entry' }
  }
}
