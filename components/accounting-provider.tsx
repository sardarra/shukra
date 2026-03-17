'use client'

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react'
import type {
  JournalEntry,
  Ledger,
  TrialBalanceRow,
  IncomeStatementData,
  BalanceSheetData,
  ParsedTransaction,
} from '@/lib/accounting-types'
import {
  getStarterTransactions,
  calculateLedgers,
  calculateTrialBalance,
  calculateIncomeStatement,
  calculateBalanceSheet,
  generateId,
  getTodayDate,
} from '@/lib/accounting-store'

interface AccountingState {
  journalEntries: JournalEntry[]
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

function computeDerivedState(entries: JournalEntry[]): Omit<AccountingState, 'journalEntries'> {
  const ledgers = calculateLedgers(entries)
  const trialBalance = calculateTrialBalance(ledgers)
  const incomeStatement = calculateIncomeStatement(ledgers)
  const balanceSheet = calculateBalanceSheet(ledgers, incomeStatement.netIncome)
  return { ledgers, trialBalance, incomeStatement, balanceSheet }
}

export function AccountingProvider({ children }: { children: ReactNode }) {
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>(() => getStarterTransactions())
  const [pendingEntry, setPendingEntry] = useState<PendingEntry | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clarificationQuestion, setClarificationQuestion] = useState<string | null>(null)

  const derivedState = useMemo(() => computeDerivedState(journalEntries), [journalEntries])

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
    setPendingEntry(null)
    setClarificationQuestion(null)
  }, [pendingEntry])

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
  }, [])

  const value: AccountingContextType = {
    journalEntries,
    ...derivedState,
    pendingEntry,
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
      {children}
    </AccountingContext.Provider>
  )
}
