import type { JournalEntry, PlantAsset } from '@/lib/accounting-types'
import { addAccountManual } from '@/lib/accounting-types'
import type { JournalEntryInsertPayload } from '@/lib/supabase/journal-entries'

/** Asset accounts whose debit purchases are depreciable plant property. */
export const DEPRECIABLE_ASSET_ACCOUNTS = ['Equipment', 'Prepaid Equipment'] as const

const DEFAULT_USEFUL_LIFE_YEARS = 5

export function plantAssetLabel(asset: Pick<PlantAsset, 'specificName' | 'name'>): string {
  return asset.specificName?.trim() || asset.name
}

export function isDepreciablePlantPurchase(debitAccount: string): boolean {
  return DEPRECIABLE_ASSET_ACCOUNTS.includes(
    debitAccount as (typeof DEPRECIABLE_ASSET_ACCOUNTS)[number]
  )
}

export function depreciationExpenseAccount(assetName: string): string {
  return `Depreciation Expense - ${assetName}`
}

export function accumulatedDepreciationAccount(assetName: string): string {
  return `Accumulated Depreciation - ${assetName}`
}

export function depreciationEntryDescription(assetName: string, year: number): string {
  return `Depreciation: ${assetName} (${year})`
}

/** Straight-line annual depreciation. */
export function getAnnualDepreciation(plantAsset: PlantAsset): number {
  if (plantAsset.usefulLifeYears <= 0) return 0
  const depreciableBase = plantAsset.cost - plantAsset.salvageValue
  if (depreciableBase <= 0) return 0
  return depreciableBase / plantAsset.usefulLifeYears
}

// monthly depreciation
export function getMonthlyDepreciation(plantAsset: PlantAsset): number {
  return getAnnualDepreciation(plantAsset) / 12
}

export function registerDepreciationAccounts(assetName: string): void {
  addAccountManual(depreciationExpenseAccount(assetName), 'expense', 'debit')
  addAccountManual(accumulatedDepreciationAccount(assetName), 'asset', 'credit')
}

export function hasDepreciationEntryForYear(
  entries: JournalEntry[],
  assetName: string,
  year: number
): boolean {
  const marker = depreciationEntryDescription(assetName, year)
  return entries.some((e) => e.description === marker)
}

export function shouldRecordDepreciationForYear(
  plantAsset: PlantAsset,
  entries: JournalEntry[],
  asOf: Date = new Date()
): boolean {
  const year = asOf.getFullYear()
  const purchase = new Date(plantAsset.purchaseDate)
  if (year == purchase.getFullYear()) return false
  if (Number.isNaN(purchase.getTime()) || asOf < purchase) return false
  if (hasDepreciationEntryForYear(entries, plantAssetLabel(plantAsset), year)) return false

  const amount = getAnnualDepreciation(plantAsset)
  if (amount <= 0) return false

  return year >= purchase.getFullYear()
}

export function buildDepreciationJournalPayload(
  plantAsset: PlantAsset,
  asOf: Date = new Date()
): JournalEntryInsertPayload | null {
  const year = asOf.getFullYear()
  const amount = Math.round(getAnnualDepreciation(plantAsset) * 100) / 100
  if (amount <= 0) return null

  const label = plantAssetLabel(plantAsset)
  registerDepreciationAccounts(label)

  return {
    description: depreciationEntryDescription(label, year),
    debitAccount: depreciationExpenseAccount(label),
    debitAmount: amount,
    creditAccount: accumulatedDepreciationAccount(label),
    creditAmount: amount,
  }
}

export type InferredPlantAsset = {
  journalEntryId: string
  name: string
  specificName: string
  account: string
  cost: number
  salvageValue: number
  usefulLifeYears: number
  purchaseDate: string
}

/** Infer plant assets from capital equipment purchases in the journal. */
export function inferPlantAssetsFromJournalEntries(
  entries: JournalEntry[]
): InferredPlantAsset[] {
  const seen = new Set<string>()

  return entries
    .filter((e) =>
      DEPRECIABLE_ASSET_ACCOUNTS.includes(
        e.debitAccount as (typeof DEPRECIABLE_ASSET_ACCOUNTS)[number]
      )
    )
    .flatMap((entry) => {
      const sourceId = entry.id.startsWith('db:') ? entry.id.slice(3) : entry.id
      if (seen.has(sourceId)) return []
      seen.add(sourceId)

      const description =
        entry.description.trim() ||
        `${entry.debitAccount} (${entry.date})`

      return [
        {
          journalEntryId: sourceId,
          name: description,
          specificName: description,
          account: entry.debitAccount,
          cost: entry.debitAmount,
          salvageValue: 0,
          usefulLifeYears: DEFAULT_USEFUL_LIFE_YEARS,
          purchaseDate: entry.date,
        },
      ]
    })
}
