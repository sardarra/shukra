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
import { resolveClarificationQuestion } from '@/lib/depreciation'
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
  /** Remaining AI prompts for today. null = unknown (fetch in progress or failed). */
  promptsRemaining: number | null
  /** UTC ISO timestamp when the daily quota resets. */
  promptsResetAt: string | null
  parseTransaction: (input: string) => Promise<void>
  confirmEntry: () => void
  cancelEntry: () => void
  deleteEntry: (id: string) => void | Promise<void>
  deletePlantAsset: (plantAssetId: string) => void | Promise<void>
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
  const [promptsRemaining, setPromptsRemaining] = useState<number | null>(null)
  const [promptsResetAt, setPromptsResetAt] = useState<string | null>(null)

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

  // Fetch initial quota when the user is authenticated
  useEffect(() => {
    if (!isAuthReady || !user) return

    let cancelled = false
    ;(async () => {
      try {
        const response = await fetch('/api/usage', { method: 'GET' })
        if (cancelled) return
        if (response.ok) {
          const data = (await response.json()) as { remaining: number; resetAt: string }
          setPromptsRemaining(data.remaining)
          setPromptsResetAt(data.resetAt)
        }
        // On failure, leave promptsRemaining as null (indeterminate — UI stays enabled)
      } catch {
        // Network error — leave indeterminate
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

      if (response.status === 429) {
        const data = (await response.json().catch(() => ({}))) as {
          remaining?: number
          resetAt?: string
        }
        setPromptsRemaining(0)
        if (data.resetAt) setPromptsResetAt(data.resetAt)
        // Don't set a generic error — the UI will show the quota message
        return
      }

      if (!response.ok) {
        // Non-200, non-429: preserve existing quota display, show error
        setError('Failed to parse transaction. Please try again.')
        return
      }

      const data = (await response.json()) as {
        remaining?: number
        resetAt?: string
        [key: string]: unknown
      }

      // Update quota from response
      if (typeof data.remaining === 'number') setPromptsRemaining(data.remaining)
      if (typeof data.resetAt === 'string') setPromptsResetAt(data.resetAt)

      // Strip quota fields before treating as ParsedTransaction
      const { remaining: _r, resetAt: _ra, ...parsed } = data

      const parsedTx = parsed as unknown as ParsedTransaction
      const clarification = resolveClarificationQuestion(parsedTx)
      if (clarification) {
        setClarificationQuestion(clarification)
      }

      setPendingEntry({ parsed: parsedTx, originalInput: input })
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


    /**
   * 
   * What should happen when a user deletes the journal entry corresponding to a plant asset:
   * - journal entry table in supabase now holds a associated_plant_asset_id column
   * - when the journal entry is deleted, so should the plant asset associated. 
   */

    
  const deleteEntry = useCallback(async (id: string) => {
    const dbKey = id.startsWith('db:') ? id.slice(3) : /^\d+$/.test(id) ? id : null

    if (!dbKey) {
      setJournalEntries((prev) => prev.filter((entry) => entry.id !== id))
      return
    }

    try {
      const response = await fetch(`/api/journal-entries?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      const data = (await response.json().catch(() => ({}))) as {
        entries?: JournalEntry[]
        plantAssets?: PlantAsset[]
        error?: string
      }

      if (!response.ok) {
        setError(data.error ?? 'Failed to delete journal entry.')
        return
      }

      setError(null)
      setJournalEntries(Array.isArray(data.entries) ? data.entries : [])
      setPlantAssets(Array.isArray(data.plantAssets) ? data.plantAssets : [])
    } catch {
      setError('Failed to delete journal entry.')
    }
  }, [])

  const deletePlantAsset = useCallback(async (plantAssetId: string) => {
    try {
      const response = await fetch(
        `/api/plant-assets?id=${encodeURIComponent(plantAssetId)}`,
        { method: 'DELETE' }
      )
      const data = (await response.json().catch(() => ({}))) as {
        entries?: JournalEntry[]
        plantAssets?: PlantAsset[]
        error?: string
      }

      if (!response.ok) {
        setError(data.error ?? 'Failed to delete equipment.')
        return
      }

      setError(null)
      setJournalEntries(Array.isArray(data.entries) ? data.entries : [])
      setPlantAssets(Array.isArray(data.plantAssets) ? data.plantAssets : [])
    } catch {
      setError('Failed to delete equipment.')
    }
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
    promptsRemaining,
    promptsResetAt,
    parseTransaction,
    confirmEntry,
    cancelEntry,
    deleteEntry,
    deletePlantAsset,
    answerClarification,
    addManualEntry,
  }

  return (
    <AccountingContext.Provider value={value}>
      {isInitialLoad ? <LoadingScreen /> : children}
    </AccountingContext.Provider>
  )
}
