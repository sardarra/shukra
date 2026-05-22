'use client'

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  type ReactNode,
} from 'react'
import type {
  JournalEntry,
  Ledger,
  TrialBalanceRow,
  IncomeStatementData,
  BalanceSheetData,
  ParsedTransaction,
  PlantAsset,
} from '@/lib/accounting-types'
import { isDepreciablePlantPurchase } from '@/lib/depreciation'
import {
  getStarterTransactions,
  calculateLedgers,
  calculateTrialBalance,
  calculateIncomeStatement,
  calculateBalanceSheet,
  generateId,
  getTodayDate,
} from '@/lib/accounting-store'
import { useAuth } from './auth-provider'
import { LoadingScreen } from './loading-screen'

interface AccountingState {
  journalEntries: JournalEntry[]
  plantAssets: PlantAsset[]
  ledgers: Ledger[]
  trialBalance: TrialBalanceRow[]
  incomeStatement: IncomeStatementData
  balanceSheet: BalanceSheetData
}

interface PendingEntry {
  parsed: ParsedTransaction
  originalInput: string
}

interface AccountingContextType extends AccountingState {
  pendingEntry: PendingEntry | null
  /** True while auth or initial journal entries are still loading. */
  isInitialLoad: boolean
  isLoading: boolean
  error: string | null
  clarificationQuestion: string | null
  parseTransaction: (input: string) => Promise<void>
  confirmEntry: () => void
  cancelEntry: () => void
  deleteEntry: (id: string) => void
  answerClarification: (answer: string) => Promise<void>
  addManualEntry: (entry: ParsedTransaction) => void
}

const AccountingContext = createContext<AccountingContextType | null>(null)

export function useAccounting() {
  const context = useContext(AccountingContext)
  if (!context) {
    throw new Error('useAccounting must be used within an AccountingProvider')
  }
  return context
}

function computeDerivedState(
  entries: JournalEntry[],
  plantAssets: PlantAsset[]
): Omit<AccountingState, 'journalEntries'> {
  const ledgers = calculateLedgers(entries)
  const trialBalance = calculateTrialBalance(ledgers)
  const incomeStatement = calculateIncomeStatement(ledgers)
  const balanceSheet = calculateBalanceSheet(ledgers, incomeStatement.netIncome, plantAssets)
  return { ledgers, plantAssets, trialBalance, incomeStatement, balanceSheet }
}

export function AccountingProvider({ children }: { children: ReactNode }) {
  const { user, isAuthReady } = useAuth()
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([])
  const [plantAssets, setPlantAssets] = useState<PlantAsset[]>([])
  const [pendingEntry, setPendingEntry] = useState<PendingEntry | null>(null)
  const [isEntriesLoading, setIsEntriesLoading] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clarificationQuestion, setClarificationQuestion] = useState<string | null>(null)

  const isInitialLoad = !isAuthReady || (!!user && isEntriesLoading)

  const derivedState = useMemo(
    () => computeDerivedState(journalEntries, plantAssets),
    [journalEntries, plantAssets]
  )

  // Load journal entries for the signed-in user (server uses Supabase session cookie).
  useEffect(() => {
    if (!isAuthReady) return

    if (!user) {
      setJournalEntries([])
      setPlantAssets([])
      setIsEntriesLoading(false)
      return
    }

    let cancelled = false
    setIsEntriesLoading(true)

    ;(async () => {
      try {
        const response = await fetch('/api/journal-entries', { method: 'GET' })
        const data = (await response.json().catch(() => ({}))) as {
          entries?: JournalEntry[]
          plantAssets?: PlantAsset[]
          error?: string
        }

        if (cancelled) return

        if (!response.ok) {
          if (response.status !== 401) {
            setError(data.error ?? 'Could not load journal entries from the server.')
          }
          return
        }

        setError(null)
        setJournalEntries(Array.isArray(data.entries) ? data.entries : [])
        setPlantAssets(Array.isArray(data.plantAssets) ? data.plantAssets : [])
      } catch {
        if (!cancelled) {
          setError('Could not load journal entries from the server.')
        }
      } finally {
        if (!cancelled) {
          setIsEntriesLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isAuthReady, user?.id])

  const persistEntry = useCallback(
    async (entry: JournalEntry, options?: { plantAssetSpecificName?: string | null }) => {
      try {
        const response = await fetch('/api/journal-entries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: entry.description,
            debitAccount: entry.debitAccount,
            debitAmount: entry.debitAmount,
            creditAccount: entry.creditAccount,
            creditAmount: entry.creditAmount,
            date: entry.date,
            plantAssetSpecificName: options?.plantAssetSpecificName ?? undefined,
          }),
        })

        if (!response.ok) {
          throw new Error('Persistence request failed')
        }

        const reload = await fetch('/api/journal-entries', { method: 'GET' })
        const data = (await reload.json().catch(() => ({}))) as {
          entries?: JournalEntry[]
          plantAssets?: PlantAsset[]
        }
        if (reload.ok) {
          setJournalEntries(Array.isArray(data.entries) ? data.entries : [])
          setPlantAssets(Array.isArray(data.plantAssets) ? data.plantAssets : [])
        }
      } catch {
        setError('Saved locally, but failed to sync to Supabase.')
      }
    },
    []
  )

  const parseTransaction = useCallback(async (input: string) => {
    setIsLoading(true)
    setError(null)
    setClarificationQuestion(null)

    try {
      const response = await fetch('/api/parse-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction: input, todayDate: getTodayDate() }),
      })

      if (!response.ok) {
        throw new Error('Failed to parse transaction')
      }

      const parsed: ParsedTransaction = await response.json()

      // Check confidence level
      if (parsed.confidence < 0.8) {
        setClarificationQuestion(
          `I'm not entirely sure about this transaction. Did you mean to ${parsed.description.toLowerCase()}? ` +
          `(Debiting ${parsed.debitAccount} and crediting ${parsed.creditAccount} for $${parsed.debitAmount.toFixed(2)})`
        )
      }

      setPendingEntry({ parsed, originalInput: input })
    } catch {
      setError('Failed to parse transaction. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const confirmEntry = useCallback(() => {
    if (!pendingEntry) return

    const newEntry: JournalEntry = {
      id: generateId(),
      ...pendingEntry.parsed,
      createdAt: new Date().toISOString(),
    }

    setJournalEntries((prev) => [...prev, newEntry])
    void persistEntry(newEntry, {
      plantAssetSpecificName: pendingEntry.parsed.plantAssetSpecificName,
    })
    setPendingEntry(null)
    setClarificationQuestion(null)
  }, [pendingEntry, persistEntry])

  const cancelEntry = useCallback(() => {
    setPendingEntry(null)
    setError(null)
    setClarificationQuestion(null)
  }, [])

  const deleteEntry = useCallback((id: string) => {
    setJournalEntries((prev) => prev.filter((entry) => entry.id !== id))
  }, [])

  const answerClarification = useCallback(async (answer: string) => {
    if (!pendingEntry) return
    
    // Re-parse with the clarification included
    const clarifiedInput = `${pendingEntry.originalInput}. Clarification: ${answer}`
    await parseTransaction(clarifiedInput)
  }, [pendingEntry, parseTransaction])

  const addManualEntry = useCallback((entry: ParsedTransaction) => {
    const newEntry: JournalEntry = {
      id: generateId(),
      ...entry,
      createdAt: new Date().toISOString(),
    }
    setJournalEntries((prev) => [...prev, newEntry])
    void persistEntry(newEntry, {
      plantAssetSpecificName: entry.plantAssetSpecificName,
    })
  }, [persistEntry])

  const value: AccountingContextType = {
    journalEntries,
    ...derivedState,
    pendingEntry,
    isInitialLoad,
    isLoading,
    error,
    clarificationQuestion,
    parseTransaction,
    confirmEntry,
    cancelEntry,
    deleteEntry,
    answerClarification,
    addManualEntry,
  }

  return (
    <AccountingContext.Provider value={value}>
      {isInitialLoad ? <LoadingScreen /> : children}
    </AccountingContext.Provider>
  )
}
