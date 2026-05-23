import type {
  JournalEntry,
  Ledger,
  LedgerEntry,
  TrialBalanceRow,
  IncomeStatementData,
  BalanceSheetData,
  AccountType,
  PlantAsset,
} from './accounting-types'
import {
  ACCOUNTS,
  getAccountType,
  getAccountNormalBalance,
} from './accounting-types'
import {
  accumulatedDepreciationAccount,
  DEPRECIABLE_ASSET_ACCOUNTS,
  plantAssetLabel,
} from './depreciation'
import {
  isAccumulatedDepreciationAccount,
  isDepreciationExpenseAccount,
} from './accounting-types'

// Generate unique IDs
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

// Get today's date in YYYY-MM-DD format
export function getTodayDate(): string {
  return new Date().toISOString().split('T')[0]
}

// Initial starter transactions
export function getStarterTransactions(): JournalEntry[] {
  const today = getTodayDate()
  return [
    {
      id: generateId(),
      date: today,
      description: 'Owner invested cash into the business',
      debitAccount: 'Cash',
      debitAmount: 10000,
      creditAccount: "Owner's Capital",
      creditAmount: 10000,
      createdAt: new Date().toISOString(),
    },
    {
      id: generateId(),
      date: today,
      description: 'Paid monthly office rent',
      debitAccount: 'Rent Expense',
      debitAmount: 1200,
      creditAccount: 'Cash',
      creditAmount: 1200,
      createdAt: new Date().toISOString(),
    },
    {
      id: generateId(),
      date: today,
      description: 'Received payment from client for services',
      debitAccount: 'Cash',
      debitAmount: 3500,
      creditAccount: 'Service Revenue',
      creditAmount: 3500,
      createdAt: new Date().toISOString(),
    },
    {
      id: generateId(),
      date: today,
      description: 'Purchased office supplies with cash',
      debitAccount: 'Office Supplies Expense',
      debitAmount: 400,
      creditAccount: 'Cash',
      creditAmount: 400,
      createdAt: new Date().toISOString(),
    },
    {
      id: generateId(),
      date: today,
      description: 'Received a loan from the bank',
      debitAccount: 'Cash',
      debitAmount: 2000,
      creditAccount: 'Bank Loan',
      creditAmount: 2000,
      createdAt: new Date().toISOString(),
    },
  ]
}

// Calculate ledgers from journal entries
export function calculateLedgers(entries: JournalEntry[]): Ledger[] {
  const ledgerMap = new Map<string, LedgerEntry[]>()

  // Initialize all accounts
  ACCOUNTS.forEach(account => {
    ledgerMap.set(account.name, [])
  })

  // Process each journal entry
  entries.forEach(entry => {
    // Add debit entry
    const debitEntries = ledgerMap.get(entry.debitAccount) || []
    debitEntries.push({
      date: entry.date,
      description: entry.description,
      debit: entry.debitAmount,
      credit: null,
      balance: 0, // Will calculate later
      journalEntryId: entry.id,
    })
    ledgerMap.set(entry.debitAccount, debitEntries)

    // Add credit entry
    const creditEntries = ledgerMap.get(entry.creditAccount) || []
    creditEntries.push({
      date: entry.date,
      description: entry.description,
      debit: null,
      credit: entry.creditAmount,
      balance: 0, // Will calculate later
      journalEntryId: entry.id,
    })
    ledgerMap.set(entry.creditAccount, creditEntries)
  })

  // Calculate running balances and create ledger objects
  const ledgers: Ledger[] = []

  ledgerMap.forEach((ledgerEntries, accountName) => {
    if (ledgerEntries.length === 0) return

    const accountType = getAccountType(accountName)
    const normalBalance = getAccountNormalBalance(accountName)

    // Sort entries by date
    ledgerEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // Calculate running balance
    let runningBalance = 0
    ledgerEntries.forEach(entry => {
      if (normalBalance === 'debit') {
        runningBalance += (entry.debit || 0) - (entry.credit || 0)
      } else {
        runningBalance += (entry.credit || 0) - (entry.debit || 0)
      }
      entry.balance = runningBalance
    })

    ledgers.push({
      account: accountName,
      accountType,
      entries: ledgerEntries,
      balance: runningBalance,
    })
  })

  // Sort ledgers by account type order
  const typeOrder: AccountType[] = ['asset', 'liability', 'equity', 'revenue', 'expense']
  ledgers.sort((a, b) => typeOrder.indexOf(a.accountType) - typeOrder.indexOf(b.accountType))

  return ledgers
}

// Calculate trial balance from ledgers
export function calculateTrialBalance(ledgers: Ledger[]): TrialBalanceRow[] {
  const rows: TrialBalanceRow[] = []

  ledgers.forEach(ledger => {
    if (ledger.balance === 0) return

    const normalBalance = getAccountNormalBalance(ledger.account)
    rows.push({
      account: ledger.account,
      debit: normalBalance === 'debit' ? ledger.balance : 0,
      credit: normalBalance === 'credit' ? ledger.balance : 0,
    })
  })

  return rows
}

// Calculate income statement from ledgers
export function calculateIncomeStatement(ledgers: Ledger[]): IncomeStatementData {
  const revenues: { account: string; amount: number }[] = []
  const expenses: { account: string; amount: number }[] = []

  ledgers.forEach(ledger => {
    if (ledger.balance === 0) return

    if (ledger.accountType === 'revenue') {
      revenues.push({ account: ledger.account, amount: ledger.balance })
    } else if (ledger.accountType === 'expense') {
      expenses.push({ account: ledger.account, amount: ledger.balance })
    }
  })

  const totalRevenue = revenues.reduce((sum, r) => sum + r.amount, 0)
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)
  const netIncome = totalRevenue - totalExpenses

  return {
    revenues,
    expenses,
    totalRevenue,
    totalExpenses,
    netIncome,
  }
}

/** Net book value for Equipment / Prepaid Equipment (one line per account on the balance sheet). */
function netBookForDepreciableAccount(
  accountName: (typeof DEPRECIABLE_ASSET_ACCOUNTS)[number],
  ledgers: Ledger[],
  plantAssets: PlantAsset[]
): number {
  const relatedPlants = plantAssets.filter((p) => p.account === accountName)
  if (relatedPlants.length > 0) {
    return relatedPlants.reduce((sum, asset) => {
      const label = plantAssetLabel(asset)
      const accDep =
        ledgers.find((l) => l.account === accumulatedDepreciationAccount(label))?.balance ?? 0
      return sum + Math.max(0, asset.cost - accDep)
    }, 0)
  }

  const gross = ledgers.find((l) => l.account === accountName)?.balance ?? 0
  if (gross <= 0) return 0

  const accDepTotal = ledgers
    .filter((l) => isAccumulatedDepreciationAccount(l.account))
    .reduce((sum, l) => sum + l.balance, 0)
  return Math.max(0, gross - accDepTotal)
}

function isExcludedFromBalanceSheetAssets(account: string): boolean {
  if (isDepreciationExpenseAccount(account)) return true
  if (isAccumulatedDepreciationAccount(account)) return true
  return DEPRECIABLE_ASSET_ACCOUNTS.includes(
    account as (typeof DEPRECIABLE_ASSET_ACCOUNTS)[number]
  )
}

/** Amount contributed to total assets (contra-assets subtract). */
function balanceSheetAssetContribution(ledger: Ledger): number {
  if (ledger.accountType !== 'asset') return 0
  const normalBalance = getAccountNormalBalance(ledger.account)
  if (normalBalance === 'credit') {
    return -ledger.balance
  }
  return ledger.balance
}

// Calculate balance sheet from ledgers
export function calculateBalanceSheet(
  ledgers: Ledger[],
  netIncome: number,
  plantAssets: PlantAsset[] = []
): BalanceSheetData {
  const assets: { account: string; amount: number }[] = []
  const liabilities: { account: string; amount: number }[] = []
  const equity: { account: string; amount: number }[] = []
  ledgers.forEach(ledger => {
    if (ledger.balance === 0) return
    if (isExcludedFromBalanceSheetAssets(ledger.account)) return

    if (ledger.accountType === 'asset') {
      const amount = balanceSheetAssetContribution(ledger)
      if (amount === 0) return
      assets.push({ account: ledger.account, amount })
    } else if (ledger.accountType === 'liability') {
      liabilities.push({ account: ledger.account, amount: ledger.balance })
    } else if (ledger.accountType === 'equity') {
      equity.push({ account: ledger.account, amount: ledger.balance })
    }
  })

  for (const accountName of DEPRECIABLE_ASSET_ACCOUNTS) {
    const amount = netBookForDepreciableAccount(accountName, ledgers, plantAssets)
    if (amount > 0) {
      assets.push({ account: accountName, amount })
    }
  }

  const totalAssets = assets.reduce((sum, a) => sum + a.amount, 0)
  const totalLiabilities = liabilities.reduce((sum, l) => sum + l.amount, 0)
  const totalEquity = equity.reduce((sum, e) => sum + e.amount, 0) + netIncome

  return {
    assets,
    plantAssets: [],
    liabilities,
    equity,
    totalAssets,
    totalLiabilities,
    totalEquity,
    netIncome,
  }
}

// Format currency
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount)
}

export { getAnnualDepreciation as calculateDepreciation } from '@/lib/depreciation'