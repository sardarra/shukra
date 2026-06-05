import { string } from "zod/v4"

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense' | "plant"

export interface Account {
  name: string
  type: AccountType
  normalBalance: 'debit' | 'credit'
}



export interface JournalEntry {
  id: string
  date: string
  description: string
  debitAccount: string
  debitAmount: number
  creditAccount: string
  creditAmount: number
  createdAt: string
}

export interface ParsedTransaction {
  date: string
  description: string
  debitAccount: string
  debitAmount: number
  creditAccount: string
  creditAmount: number
  confidence: number
  /** Short label for the asset, e.g. "Delivery Truck", when buying plant property. */
  plantAssetSpecificName?: string | null
  /** False when a plant purchase is missing a specific name or purchase date from the user. */
  plantAssetDetailsComplete?: boolean
  /** Claude's follow-up question(s) for the user; used for plant asset name/date. */
  messageToUser?: string | null
}

export interface LedgerEntry {
  date: string
  description: string
  debit: number | null
  credit: number | null
  balance: number
  journalEntryId: string
}

export interface Ledger {
  account: string
  accountType: AccountType
  entries: LedgerEntry[]
  balance: number
}

export interface TrialBalanceRow {
  account: string
  debit: number
  credit: number
}

export interface IncomeStatementData {
  revenues: { account: string; amount: number }[]
  expenses: { account: string; amount: number }[]
  totalRevenue: number
  totalExpenses: number
  netIncome: number
}

export interface BalanceSheetPlantAsset {
  specificName: string
  account: string
  cost: number
  accumulatedDepreciation: number
  netBookValue: number
}

export interface BalanceSheetData {
  assets: { account: string; amount: number }[]
  plantAssets: BalanceSheetPlantAsset[]
  liabilities: { account: string; amount: number }[]
  equity: { account: string; amount: number }[]
  totalAssets: number
  totalLiabilities: number
  totalEquity: number
  netIncome: number
}

export interface PlantAsset {
  id: string
  name: string
  specificName: string
  account: string        // e.g. "Equipment" (the debit account it was recorded under)
  cost: number           // original purchase cost
  salvageValue: number   // estimated residual value
  usefulLifeYears: number
  purchaseDate: string   // ISO date string
  lastDepreciatedDate: string | null  // track when we last ran depreciation
  createdAt: string
  associatedJournalEntry: string | null
}

export const ACCOUNT_NAMES = [
  'Cash',
  'Accounts Receivable',
  'Office Supplies',
  'Equipment',
  'Accounts Payable',
  'Notes Payable',
  'Bank Loan',
  "Owner's Capital",
  'Service Revenue',
  'Sales Revenue',
  'Rent Expense',
  'Utilities Expense',
  'Salaries Expense',
  'Office Supplies Expense',
] as const

export type AccountName = typeof ACCOUNT_NAMES[number]

export let ACCOUNTS: Account[] = [
  { name: 'Cash', type: 'asset', normalBalance: 'debit' },
  { name: 'Accounts Receivable', type: 'asset', normalBalance: 'debit' },
  { name: 'Office Supplies', type: 'asset', normalBalance: 'debit' },
  { name: 'Equipment', type: 'asset', normalBalance: 'debit' },
  { name: 'Inventory', type: 'asset', normalBalance: 'debit' },
  { name: 'Prepaid Rent', type: 'asset', normalBalance: 'debit' },
  { name: 'Prepaid Insurance', type: 'asset', normalBalance: 'debit' },
  { name: 'Prepaid Utilities', type: 'asset', normalBalance: 'debit' },
  { name: 'Prepaid Salaries', type: 'asset', normalBalance: 'debit' },
  { name: 'Prepaid Office Supplies', type: 'asset', normalBalance: 'debit' },
  { name: 'Prepaid Equipment', type: 'asset', normalBalance: 'debit' },
  { name: 'Prepaid Inventory', type: 'asset', normalBalance: 'debit' },
  { name: 'Accounts Payable', type: 'liability', normalBalance: 'credit' },
  { name: 'Notes Payable', type: 'liability', normalBalance: 'credit' },
  { name: 'Bank Loan', type: 'liability', normalBalance: 'credit' },
  { name: "Owner's Capital", type: 'equity', normalBalance: 'credit' },
  { name: 'Service Revenue', type: 'revenue', normalBalance: 'credit' },
  { name: 'Sales Revenue', type: 'revenue', normalBalance: 'credit' },
  { name: 'Rent Expense', type: 'expense', normalBalance: 'debit' },
  { name: 'Utilities Expense', type: 'expense', normalBalance: 'debit' },
  { name: 'Salaries Expense', type: 'expense', normalBalance: 'debit' },
  { name: 'Office Supplies Expense', type: 'expense', normalBalance: 'debit' },
  { name: 'Inventory Expense', type: 'expense', normalBalance: 'debit' },
  { name: 'Gain on Disposal', type: 'revenue', normalBalance: 'credit' },
  { name: 'Loss on Disposal', type: 'expense', normalBalance: 'debit' },
]

export function isDepreciationExpenseAccount(accountName: string): boolean {
  return accountName.startsWith('Depreciation Expense -')
}

export function isAccumulatedDepreciationAccount(accountName: string): boolean {
  return accountName.startsWith('Accumulated Depreciation -')
}

export function getAccountType(accountName: string): AccountType {
  if (isDepreciationExpenseAccount(accountName)) return 'expense'
  if (isAccumulatedDepreciationAccount(accountName)) return 'asset'
  const account = ACCOUNTS.find(a => a.name === accountName)
  return account?.type || 'asset'
}

export function getAccountNormalBalance(accountName: string): 'debit' | 'credit' {
  if (isDepreciationExpenseAccount(accountName)) return 'debit'
  if (isAccumulatedDepreciationAccount(accountName)) return 'credit'
  const account = ACCOUNTS.find(a => a.name === accountName)
  return account?.normalBalance || 'debit'
}

export function addAccount(account: Account) {
  if (!ACCOUNTS.some(a => a.name === account.name)) {
    ACCOUNTS.push(account)
  }
}

export function addAccountManual(accountName: string, accountType: AccountType, normalBalance: 'debit' | 'credit') {
  if (!ACCOUNTS.some(a => a.name === accountName)) {
    ACCOUNTS.push({ name: accountName, type: accountType, normalBalance: normalBalance })
  }
}

// ─── Equipment Management Types ───────────────────────────────────────────────

export type DepreciationMethod = 'SL' | 'DDB' | 'SYD' | 'Section179'
export type AssetStatus = 'Active' | 'Sold' | 'Retired'
export type AssetCategory =
  | 'Machinery'
  | 'Vehicles'
  | 'Computers & Technology'
  | 'Furniture & Fixtures'
  | 'Buildings & Improvements'
  | 'Other'

export type ReminderType =
  | 'warranty_expiration'
  | 'scheduled_maintenance'
  | 'insurance_renewal'
  | 'loan_payment_due'

export type AuditAction =
  | 'created'
  | 'method_changed'
  | 'status_changed'
  | 'depreciation_rejected'
  | 'field_updated'

export interface EquipmentAsset {
  id: string
  userId: string
  name: string
  specificName: string
  category: AssetCategory
  description: string | null
  account: string
  cost: number
  salvageValue: number
  usefulLifeYears: number
  depreciationMethod: DepreciationMethod
  purchaseDate: string
  lastDepreciatedDate: string | null
  status: AssetStatus
  saleDate: string | null
  salePrice: number | null
  gainLoss: number | null
  associatedJournalEntryId: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface DepreciationRow {
  year: number
  calendarYear: number
  annualDepreciation: number
  accumulatedDepreciation: number
  bookValue: number
}

export interface EquipmentReminder {
  id: string
  assetId: string
  userId: string
  type: ReminderType
  targetDate: string
  notes: string | null
  isDismissed: boolean
  createdAt: string
}

export interface EquipmentAuditLogEntry {
  id: string
  assetId: string
  userId: string
  action: AuditAction
  previousValue: string | null
  newValue: string | null
  createdAt: string
}

export interface CreateEquipmentAssetPayload {
  name: string
  specificName: string
  category: AssetCategory
  description?: string
  purchaseDate: string
  cost: number
  salvageValue: number
  usefulLifeYears: number
  depreciationMethod: DepreciationMethod
  paymentMethod: 'cash' | 'credit'
}

export interface DisposalPayload {
  disposalType: 'Sold' | 'Retired'
  saleDate: string
  salePrice?: number
}

export interface ParsedEquipmentAsset {
  assetName: string
  category: string | null
  purchaseDate: string | null
  cost: number | null
  usefulLifeYears: number | null
  depreciationMethodHint: 'SL' | 'DDB' | 'SYD' | 'Section179' | null
  salvageValue: number | null
  confidence: number
  messageToUser: string | null
  remaining: number
  resetAt: string
}

export interface PendingDepreciationBatch {
  entries: Array<{
    assetId: string
    assetName: string
    monthlyAmount: number
    debitAccount: string
    creditAccount: string
    date: string
  }>
}

export interface ReminderPayload {
  type: ReminderType
  targetDate: string
  notes?: string
}

// ─── Product Manager Types ─────────────────────────────────────────────────────

export type ProductType = 'Physical Good' | 'Service'
export type CostType = 'Variable' | 'Fixed'
export type ViabilityStatus = 'Profitable' | 'Break-Even' | 'Unprofitable'

export interface Product {
  id: string
  userId: string
  name: string
  productType: ProductType
  description: string | null
  sellingPrice: number
  createdAt: string
  updatedAt: string
}

export interface CostItem {
  id: string
  productId: string
  userId: string
  label: string
  costType: CostType
  amount: number
  createdAt: string
  updatedAt: string
}

export interface ProductWithCostItems extends Product {
  costItems: CostItem[]
}

export interface ProductMetrics {
  contributionMargin: number
  contributionMarginRatio: number
  breakEvenUnits: number | 'N/A' | 'Cannot break even'
  viabilityStatus: ViabilityStatus
}

export interface ProductSummary {
  profitable: number
  breakEven: number
  unprofitable: number
}

export interface CreateProductPayload {
  name: string
  productType: ProductType
  description?: string
  sellingPrice: number
}

export interface CreateCostItemPayload {
  label: string
  costType: CostType
  amount: number
}
