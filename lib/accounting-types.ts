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

export interface BalanceSheetData {
  assets: { account: string; amount: number }[]
  liabilities: { account: string; amount: number }[]
  equity: { account: string; amount: number }[]
  totalAssets: number
  totalLiabilities: number
  totalEquity: number
  netIncome: number
}

export interface PlantAsset {
  id: string
  name: string           // e.g. "Delivery Truck"
  account: string        // e.g. "Vehicles" (the debit account it was recorded under)
  cost: number           // original purchase cost
  salvageValue: number   // estimated residual value
  usefulLifeYears: number
  purchaseDate: string   // ISO date string
  lastDepreciatedDate: string | null  // track when we last ran depreciation
  createdAt: string
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
  
]

export function getAccountType(accountName: string): AccountType {
  const account = ACCOUNTS.find(a => a.name === accountName)
  return account?.type || 'asset'
}

export function getAccountNormalBalance(accountName: string): 'debit' | 'credit' {
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
