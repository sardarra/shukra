import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { JournalEntry } from '@/lib/accounting-types'
import { isDepreciablePlantPurchase } from '@/lib/depreciation'
import { createPlantAssetFromPurchase } from '@/lib/supabase/plant-assets'

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
      await createPlantAssetFromPurchase({
        userId: user.id,
        journalEntryId: String(inserted.id),
        specificName,
        account: parsed.data.debitAccount,
        cost: parsed.data.debitAmount,
        purchaseDate,
        description: parsed.data.description,
      })
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
