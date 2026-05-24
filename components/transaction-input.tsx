'use client'

import { useState } from 'react'
import { useAccounting } from './accounting-provider'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { formatCurrency, getTodayDate } from '@/lib/accounting-store'
import { Check, X, AlertTriangle, PenLine, ArrowUp, Zap } from 'lucide-react'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { ACCOUNT_NAMES, type AccountName } from '@/lib/accounting-types'
import { isDepreciablePlantPurchase } from '@/lib/depreciation'
import { DAILY_QUOTA } from '@/lib/rate-limit-constants'

type TransactionInputProps = {
  variant?: 'inline' | 'floating'
}

export function TransactionInput({ variant = 'inline' }: TransactionInputProps) {
  const [input, setInput] = useState('')
  const [clarificationAnswer, setClarificationAnswer] = useState('')
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [manualEntry, setManualEntry] = useState({
    debitAccount: '' as AccountName | '',
    creditAccount: '' as AccountName | '',
    amount: '',
    description: '',
    plantAssetName: '',
  })
  const isPlantPurchase =
    !!manualEntry.debitAccount && isDepreciablePlantPurchase(manualEntry.debitAccount)
  const {
    parseTransaction,
    confirmEntry,
    cancelEntry,
    answerClarification,
    addManualEntry,
    pendingEntry,
    isLoading,
    error,
    clarificationQuestion,
    promptsRemaining,
    promptsResetAt,
  } = useAccounting()

  // Quota is exhausted when we know the count and it's 0
  const isQuotaExhausted = promptsRemaining !== null && promptsRemaining <= 0

  /** Format the reset timestamp as a local time string, e.g. "12:00 AM" */
  function formatResetTime(resetAt: string | null): string {
    if (!resetAt) return 'midnight'
    return new Date(resetAt).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const isFloating = variant === 'floating'

  const submitInput = async () => {
    if (!input.trim() || isLoading || pendingEntry || isQuotaExhausted) return
    await parseTransaction(input.trim())
    setInput('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await submitInput()
  }

  const handleConfirm = () => {
    confirmEntry()
    setClarificationAnswer('')
  }

  const handleCancel = () => {
    cancelEntry()
    setClarificationAnswer('')
  }

  const handleClarification = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clarificationAnswer.trim()) return
    await answerClarification(clarificationAnswer.trim())
    setClarificationAnswer('')
  }

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const amount = parseFloat(manualEntry.amount)
    if (!manualEntry.debitAccount || !manualEntry.creditAccount || isNaN(amount) || amount <= 0)
      return

    addManualEntry({
      date: getTodayDate(),
      debitAccount: manualEntry.debitAccount as AccountName,
      creditAccount: manualEntry.creditAccount as AccountName,
      debitAmount: amount,
      creditAmount: amount,
      description:
        manualEntry.description ||
        `Manual entry: ${manualEntry.debitAccount} / ${manualEntry.creditAccount}`,
      confidence: 1.0,
      plantAssetSpecificName: isPlantPurchase
        ? manualEntry.plantAssetName.trim() || manualEntry.description.trim() || null
        : null,
    })

    setManualEntry({
      debitAccount: '',
      creditAccount: '',
      amount: '',
      description: '',
      plantAssetName: '',
    })
    setShowManualEntry(false)
  }

  const needsClarification = !!clarificationQuestion
  const isLowConfidence =
    needsClarification || (pendingEntry != null && pendingEntry.parsed.confidence < 0.8)

  const hasOverlay = !!(pendingEntry || error || isQuotaExhausted || (showManualEntry && !pendingEntry))

  const inputForm = (
    <form onSubmit={handleSubmit}>
      <div
        className={cn(
          'relative rounded-2xl border border-border bg-card shadow-lg',
          isFloating && 'shadow-xl'
        )}
      >
        <Textarea
          placeholder="Describe your transaction in plain English."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading || !!pendingEntry || isQuotaExhausted}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void submitInput()
            }
          }}
          className={cn(
            'min-h-[88px] resize-none border-0 bg-transparent pl-14 pr-4 pt-4 pb-4 text-base shadow-none focus-visible:ring-0',
            isFloating && 'min-h-[72px]'
          )}
        />
        <Button
          type="submit"
          size="icon"
          disabled={!input.trim() || isLoading || !!pendingEntry || isQuotaExhausted}
          className="absolute bottom-3 left-3 h-9 w-9 rounded-full shrink-0"
          aria-label={isLoading ? 'Parsing transaction' : 'Submit transaction'}
        >
          {isLoading ? (
            <Spinner className="h-4 w-4" />
          ) : (
            <ArrowUp className="h-4 w-4" />
          )}
        </Button>

        {/* Quota badge — shown when we know the count */}
        {promptsRemaining !== null && (
          <div className="absolute bottom-3 right-3 flex items-center gap-1 text-xs text-muted-foreground select-none">
            <Zap className="h-3 w-3" />
            <span>{promptsRemaining} of {DAILY_QUOTA} remaining</span>
          </div>
        )}
      </div>
    </form>
  )

  const manualEntryToggle = !pendingEntry && (
    <div className={cn('pt-2', isFloating && 'px-1')}>
      <button
        type="button"
        onClick={() => setShowManualEntry(!showManualEntry)}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
      >
        <PenLine className="h-3 w-3" />
        Optional: Manually add journal entries
      </button>
    </div>
  )

  const manualEntryForm = showManualEntry && !pendingEntry && (
    <form
      onSubmit={handleManualSubmit}
      className="p-4 border border-border rounded-xl bg-card shadow-lg space-y-4"
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="debit-account" className="text-xs">
            Debit Account
          </Label>
          <Select
            value={manualEntry.debitAccount}
            onValueChange={(value) =>
              setManualEntry((prev) => ({ ...prev, debitAccount: value as AccountName }))
            }
          >
            <SelectTrigger id="debit-account" className="h-9">
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent>
              {ACCOUNT_NAMES.map((account) => (
                <SelectItem key={account} value={account}>
                  {account}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="credit-account" className="text-xs">
            Credit Account
          </Label>
          <Select
            value={manualEntry.creditAccount}
            onValueChange={(value) =>
              setManualEntry((prev) => ({ ...prev, creditAccount: value as AccountName }))
            }
          >
            <SelectTrigger id="credit-account" className="h-9">
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent>
              {ACCOUNT_NAMES.map((account) => (
                <SelectItem key={account} value={account}>
                  {account}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="amount" className="text-xs">
            Amount
          </Label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={manualEntry.amount}
            onChange={(e) => setManualEntry((prev) => ({ ...prev, amount: e.target.value }))}
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="description" className="text-xs">
            Description (optional)
          </Label>
          <Input
            id="description"
            placeholder="Transaction description"
            value={manualEntry.description}
            onChange={(e) =>
              setManualEntry((prev) => ({ ...prev, description: e.target.value }))
            }
            className="h-9"
          />
        </div>
      </div>
      {isPlantPurchase && (
        <div className="space-y-1.5">
          <Label htmlFor="plant-asset-name" className="text-xs">
            Plant asset name
          </Label>
          <Input
            id="plant-asset-name"
            placeholder='e.g. "Delivery Truck"'
            value={manualEntry.plantAssetName}
            onChange={(e) =>
              setManualEntry((prev) => ({ ...prev, plantAssetName: e.target.value }))
            }
            className="h-9"
          />
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setShowManualEntry(false)}>
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={!manualEntry.debitAccount || !manualEntry.creditAccount || !manualEntry.amount}
        >
          Add Entry
        </Button>
      </div>
    </form>
  )

  const errorCard = error && (
    <Card className="border-destructive bg-destructive/5 shadow-lg">
      <CardContent className="flex items-center gap-3 py-3">
        <X className="h-5 w-5 text-destructive flex-shrink-0" />
        <p className="text-sm text-destructive">{error}</p>
      </CardContent>
    </Card>
  )

  const quotaExhaustedCard = isQuotaExhausted && (
    <Card className="border-orange-400 bg-orange-50 dark:bg-orange-950/20 shadow-lg">
      <CardContent className="flex items-center gap-3 py-3">
        <Zap className="h-5 w-5 text-orange-500 flex-shrink-0" />
        <p className="text-sm text-orange-700 dark:text-orange-400">
          Daily AI prompt limit reached. Resets at{' '}
          <span className="font-medium">{formatResetTime(promptsResetAt)}</span>.
        </p>
      </CardContent>
    </Card>
  )

  const pendingCard = pendingEntry && (
    
    <Card
      className={cn(
        'shadow-lg transition-all duration-300 animate-in fade-in slide-in-from-bottom-2',
        isLowConfidence ? 'border-warning bg-warning/5' : 'border-success bg-success/5'
      )}
    >
      {/** low confidence : solid yellow background */}
      <CardContent className={cn('py-4', isLowConfidence ? 'bg-warning/5' : 'bg-success/5')} style={{ backgroundColor: isLowConfidence ? '#f59e0b' : '#10b981' }}>
        <div className="flex items-start gap-3">
          {isLowConfidence ? (
            <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
          ) : (
            <Check className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1 space-y-3">
            <div>
              <p className="text-sm font-medium text-foreground">AI interpreted this as:</p>
              <p className="text-sm text-muted-foreground mt-1">
                <span className="font-mono">Debit</span>{' '}
                <span className="font-medium text-foreground">
                  {pendingEntry.parsed.debitAccount}
                </span>{' '}
                {formatCurrency(pendingEntry.parsed.debitAmount)} /{' '}
                <span className="font-mono">Credit</span>{' '}
                <span className="font-medium text-foreground">
                  {pendingEntry.parsed.creditAccount}
                </span>{' '}
                {formatCurrency(pendingEntry.parsed.creditAmount)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {pendingEntry.parsed.description}
              </p>
              {pendingEntry.parsed.plantAssetSpecificName && (
                <p className="text-sm text-muted-foreground mt-1">
                  Plant asset:{' '}
                  <span className="font-medium text-foreground">
                    {pendingEntry.parsed.plantAssetSpecificName}
                  </span>
                </p>
              )}
            </div>

            {clarificationQuestion && (
              <form onSubmit={handleClarification} className="space-y-2">
                <p className="text-sm text-warning-foreground bg-warning/10 px-3 py-2 rounded-md whitespace-pre-line">
                  {clarificationQuestion}
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder='e.g. "Delivery Truck", purchased 2024-03-15'
                    value={clarificationAnswer}
                    onChange={(e) => setClarificationAnswer(e.target.value)}
                    className="flex-1"
                  />
                  <Button type="submit" size="sm" variant="outline">
                    Clarify
                  </Button>
                </div>
              </form>
            )}

            <div className="flex items-center gap-2 pt-1">
              <Button size="sm" onClick={handleConfirm} disabled={needsClarification}>
                <Check className="mr-1.5 h-4 w-4" />
                Confirm
              </Button>
              <Button size="sm" variant="outline" onClick={handleCancel}>
                <X className="mr-1.5 h-4 w-4" />
                Cancel
              </Button>
              <span className="text-xs text-muted-foreground ml-auto">
                Confidence: {Math.round(pendingEntry.parsed.confidence * 100)}%
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  if (!isFloating) {
    return (
      <div className="space-y-4">
        {inputForm}
        {manualEntryToggle}
        {manualEntryForm}
        {quotaExhaustedCard}
        {errorCard}
        {pendingCard}
      </div>
    )
  }

  return (
    <>
      {hasOverlay && (
        <div
          className={cn(
            'fixed z-40 left-0 right-0 md:left-64',
            'bottom-[calc(7.5rem+env(safe-area-inset-bottom))]',
            'px-4 md:px-8 pointer-events-none'
          )}
        >
          <div className="mx-auto max-w-6xl w-full space-y-3 max-h-[min(50vh,24rem)] overflow-y-auto pointer-events-auto">
            {manualEntryForm}
            {quotaExhaustedCard}
            {errorCard}
            {pendingCard}
          </div>
        </div>
      )}

      <div
        className={cn(
          'fixed z-50 left-0 right-0 md:left-64 bottom-0',
          'pb-[max(1rem,env(safe-area-inset-bottom))]',
          'px-4 md:px-8',
          'bg-gradient-to-t from-background from-60% via-background/95 to-transparent pt-6'
        )}
      >
        <div className="mx-auto max-w-6xl w-full">
          {inputForm}
          {manualEntryToggle}
        </div>
      </div>
    </>
  )
}
