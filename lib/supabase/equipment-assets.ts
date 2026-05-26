import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  EquipmentAsset,
  EquipmentAuditLogEntry,
  EquipmentReminder,
  CreateEquipmentAssetPayload,
  ReminderPayload,
} from '@/lib/accounting-types'

// ─── Row types (snake_case DB columns) ────────────────────────────────────────

type EquipmentAssetRow = {
  id: string
  user_id: string
  name: string
  specific_name: string
  category: string
  description: string | null
  account: string
  cost: number
  salvage_value: number
  useful_life_years: number
  depreciation_method: string
  purchase_date: string
  last_depreciated_date: string | null
  status: string
  sale_date: string | null
  sale_price: number | null
  gain_loss: number | null
  associated_journal_entry_id: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

type EquipmentReminderRow = {
  id: string
  asset_id: string
  user_id: string
  type: string
  target_date: string
  notes: string | null
  is_dismissed: boolean
  created_at: string
}

type EquipmentAuditLogRow = {
  id: string
  asset_id: string
  user_id: string
  action: string
  previous_value: string | null
  new_value: string | null
  created_at: string
}

// ─── Mapping helpers ───────────────────────────────────────────────────────────

function rowToEquipmentAsset(row: EquipmentAssetRow): EquipmentAsset {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    specificName: row.specific_name,
    category: row.category as EquipmentAsset['category'],
    description: row.description,
    account: row.account,
    cost: Number(row.cost),
    salvageValue: Number(row.salvage_value),
    usefulLifeYears: row.useful_life_years,
    depreciationMethod: row.depreciation_method as EquipmentAsset['depreciationMethod'],
    purchaseDate: row.purchase_date,
    lastDepreciatedDate: row.last_depreciated_date,
    status: row.status as EquipmentAsset['status'],
    saleDate: row.sale_date,
    salePrice: row.sale_price !== null ? Number(row.sale_price) : null,
    gainLoss: row.gain_loss !== null ? Number(row.gain_loss) : null,
    associatedJournalEntryId: row.associated_journal_entry_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }
}

function rowToEquipmentReminder(row: EquipmentReminderRow): EquipmentReminder {
  return {
    id: row.id,
    assetId: row.asset_id,
    userId: row.user_id,
    type: row.type as EquipmentReminder['type'],
    targetDate: row.target_date,
    notes: row.notes,
    isDismissed: row.is_dismissed,
    createdAt: row.created_at,
  }
}

function rowToAuditLogEntry(row: EquipmentAuditLogRow): EquipmentAuditLogEntry {
  return {
    id: row.id,
    assetId: row.asset_id,
    userId: row.user_id,
    action: row.action as EquipmentAuditLogEntry['action'],
    previousValue: row.previous_value,
    newValue: row.new_value,
    createdAt: row.created_at,
  }
}

/**
 * Convert a camelCase patch object to snake_case DB columns.
 * Only includes keys that are present in the patch.
 */
function patchToSnakeCase(patch: Partial<EquipmentAsset>): Record<string, unknown> {
  const map: Record<keyof EquipmentAsset, string> = {
    id: 'id',
    userId: 'user_id',
    name: 'name',
    specificName: 'specific_name',
    category: 'category',
    description: 'description',
    account: 'account',
    cost: 'cost',
    salvageValue: 'salvage_value',
    usefulLifeYears: 'useful_life_years',
    depreciationMethod: 'depreciation_method',
    purchaseDate: 'purchase_date',
    lastDepreciatedDate: 'last_depreciated_date',
    status: 'status',
    saleDate: 'sale_date',
    salePrice: 'sale_price',
    gainLoss: 'gain_loss',
    associatedJournalEntryId: 'associated_journal_entry_id',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
  }

  const result: Record<string, unknown> = {}
  for (const [camel, snake] of Object.entries(map) as [keyof EquipmentAsset, string][]) {
    if (camel in patch) {
      result[snake] = patch[camel]
    }
  }
  return result
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch all equipment assets for the authenticated user, ordered by purchase_date DESC.
 * Requirements: 1.4, 1.5
 */
export async function fetchEquipmentAssets(
  supabase: SupabaseClient
): Promise<{ ok: boolean; assets: EquipmentAsset[]; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('equipment_assets')
      .select('*')
      .order('purchase_date', { ascending: false })

    if (error) {
      console.error('Failed loading equipment_assets:', error)
      return { ok: false, assets: [], error: 'Failed to load equipment assets' }
    }

    const assets = ((data ?? []) as EquipmentAssetRow[]).map(rowToEquipmentAsset)
    return { ok: true, assets, error: null }
  } catch (err) {
    console.error('Unexpected error in fetchEquipmentAssets:', err)
    return { ok: false, assets: [], error: 'Unexpected error while loading equipment assets' }
  }
}

/**
 * Insert a new equipment asset row and return the created record.
 * Requirements: 1.4
 */
export async function insertEquipmentAsset(
  supabase: SupabaseClient,
  payload: CreateEquipmentAssetPayload & { userId: string; account?: string }
): Promise<{ ok: boolean; asset: EquipmentAsset | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('equipment_assets')
      .insert({
        user_id: payload.userId,
        name: payload.name,
        specific_name: payload.specificName,
        category: payload.category,
        description: payload.description ?? null,
        account: payload.account ?? 'Equipment',
        cost: payload.cost,
        salvage_value: payload.salvageValue,
        useful_life_years: payload.usefulLifeYears,
        depreciation_method: payload.depreciationMethod,
        purchase_date: payload.purchaseDate,
        status: 'Active',
      })
      .select('*')
      .single()

    if (error) {
      console.error('Failed inserting equipment_assets row:', error)
      return { ok: false, asset: null, error: 'Failed to persist asset' }
    }

    return { ok: true, asset: rowToEquipmentAsset(data as EquipmentAssetRow), error: null }
  } catch (err) {
    console.error('Unexpected error in insertEquipmentAsset:', err)
    return { ok: false, asset: null, error: 'Unexpected error while persisting asset' }
  }
}

/**
 * Patch mutable fields on an equipment asset and return the updated record.
 * Always sets updated_at to now().
 * Requirements: 5.1
 */
export async function updateEquipmentAsset(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<EquipmentAsset>
): Promise<{ ok: boolean; asset: EquipmentAsset | null; error: string | null }> {
  try {
    const snakePatch = patchToSnakeCase(patch)
    // Always refresh updated_at
    snakePatch['updated_at'] = new Date().toISOString()

    const { data, error } = await supabase
      .from('equipment_assets')
      .update(snakePatch)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      console.error('Failed updating equipment_assets row:', error)
      return { ok: false, asset: null, error: 'Failed to update asset' }
    }

    return { ok: true, asset: rowToEquipmentAsset(data as EquipmentAssetRow), error: null }
  } catch (err) {
    console.error('Unexpected error in updateEquipmentAsset:', err)
    return { ok: false, asset: null, error: 'Unexpected error while updating asset' }
  }
}

/**
 * Soft-delete an equipment asset by setting status = 'Retired' and deleted_at.
 * Requirements: 5.1
 */
export async function softDeleteEquipmentAsset(
  supabase: SupabaseClient,
  id: string
): Promise<{ ok: boolean; asset: EquipmentAsset | null; error: string | null }> {
  try {
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('equipment_assets')
      .update({
        status: 'Retired',
        deleted_at: now,
        updated_at: now,
      })
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      console.error('Failed soft-deleting equipment_assets row:', error)
      return { ok: false, asset: null, error: 'Failed to retire asset' }
    }

    return { ok: true, asset: rowToEquipmentAsset(data as EquipmentAssetRow), error: null }
  } catch (err) {
    console.error('Unexpected error in softDeleteEquipmentAsset:', err)
    return { ok: false, asset: null, error: 'Unexpected error while retiring asset' }
  }
}

/**
 * Insert an audit log entry into equipment_audit_log.
 * Requirements: 6.4
 */
export async function insertAuditLogEntry(
  supabase: SupabaseClient,
  entry: Omit<EquipmentAuditLogEntry, 'id' | 'createdAt'>
): Promise<{ ok: boolean; entry: EquipmentAuditLogEntry | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('equipment_audit_log')
      .insert({
        asset_id: entry.assetId,
        user_id: entry.userId,
        action: entry.action,
        previous_value: entry.previousValue ?? null,
        new_value: entry.newValue ?? null,
      })
      .select('*')
      .single()

    if (error) {
      console.error('Failed inserting equipment_audit_log row:', error)
      return { ok: false, entry: null, error: 'Failed to persist audit log entry' }
    }

    return {
      ok: true,
      entry: rowToAuditLogEntry(data as EquipmentAuditLogRow),
      error: null,
    }
  } catch (err) {
    console.error('Unexpected error in insertAuditLogEntry:', err)
    return { ok: false, entry: null, error: 'Unexpected error while persisting audit log entry' }
  }
}

/**
 * Insert a reminder into equipment_reminders.
 * Requirements: 6.5
 */
export async function insertReminder(
  supabase: SupabaseClient,
  reminder: ReminderPayload & { assetId: string; userId: string }
): Promise<{ ok: boolean; reminder: EquipmentReminder | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('equipment_reminders')
      .insert({
        asset_id: reminder.assetId,
        user_id: reminder.userId,
        type: reminder.type,
        target_date: reminder.targetDate,
        notes: reminder.notes ?? null,
      })
      .select('*')
      .single()

    if (error) {
      console.error('Failed inserting equipment_reminders row:', error)
      return { ok: false, reminder: null, error: 'Failed to persist reminder' }
    }

    return {
      ok: true,
      reminder: rowToEquipmentReminder(data as EquipmentReminderRow),
      error: null,
    }
  } catch (err) {
    console.error('Unexpected error in insertReminder:', err)
    return { ok: false, reminder: null, error: 'Unexpected error while persisting reminder' }
  }
}

/**
 * Fetch reminders for the authenticated user, optionally filtered by asset ID.
 * Requirements: 6.5
 */
export async function fetchReminders(
  supabase: SupabaseClient,
  assetId?: string
): Promise<{ ok: boolean; reminders: EquipmentReminder[]; error: string | null }> {
  try {
    let query = supabase
      .from('equipment_reminders')
      .select('*')
      .order('target_date', { ascending: true })

    if (assetId) {
      query = query.eq('asset_id', assetId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Failed loading equipment_reminders:', error)
      return { ok: false, reminders: [], error: 'Failed to load reminders' }
    }

    const reminders = ((data ?? []) as EquipmentReminderRow[]).map(rowToEquipmentReminder)
    return { ok: true, reminders, error: null }
  } catch (err) {
    console.error('Unexpected error in fetchReminders:', err)
    return { ok: false, reminders: [], error: 'Unexpected error while loading reminders' }
  }
}
