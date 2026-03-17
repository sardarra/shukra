'use client'

import { useState } from 'react'
import { useAccounting } from './accounting-provider'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { formatCurrency } from '@/lib/accounting-store'
import { Check, X, AlertTriangle, Sparkles, PenLine } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { ACCOUNT_NAMES, type AccountName } from '@/lib/accounting-types'

export function TransactionInput() {
  const [input, setInput] = useState('')
  const [clarificationAnswer, setClarificationAnswer] = useState('')
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [manualEntry, setManualEntry] = useState({
    debitAccount: '' as AccountName | '',
    creditAccount: '' as AccountName | '',
    amount: '',
    description: '',
  })
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
  } = useAccounting()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    await parseTransaction(input.trim())
    setInput('')
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
    if (!manualEntry.debitAccount || !manualEntry.creditAccount || isNaN(amount) || amount <= 0) return
    
    addManualEntry({
      debitAccount: manualEntry.debitAccount as AccountName,
      creditAccount: manualEntry.creditAccount as AccountName,
      debitAmount: amount,
      creditAmount: amount,
      description: manualEntry.description || `Manual entry: ${manualEntry.debitAccount} / ${manualEntry.creditAccount}`,
      confidence: 1.0,
    })
    
    setManualEntry({ debitAccount: '', creditAccount: '', amount: '', description: '' })
    setShowManualEntry(false)
  }

  const isLowConfidence = pendingEntry && pendingEntry.parsed.confidence < 0.8

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <Textarea
            placeholder="Describe your transaction in plain English... (e.g., 'Received $500 from a client for consulting services')"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading || !!pendingEntry}
            className="min-h-[100px] pr-28 resize-none text-base"
          />
          <Button
            type="submit"
            disabled={!input.trim() || isLoading || !!pendingEntry}
            className="absolute bottom-3 right-3"
          >
            {isLoading ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Parsing...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Record
              </>
            )}
          </Button>
        </div>
      </form>

      {!pendingEntry && (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowManualEntry(!showManualEntry)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
          >
            <PenLine className="h-3 w-3" />
            Optional: Manually add journal entries
          </button>

          {showManualEntry && (
            <form onSubmit={handleManualSubmit} className="mt-3 p-4 border border-border rounded-lg bg-muted/30 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="debit-account" className="text-xs">Debit Account</Label>
                  <Select
                    value={manualEntry.debitAccount}
                    onValueChange={(value) => setManualEntry(prev => ({ ...prev, debitAccount: value as AccountName }))}
                  >
                    <SelectTrigger id="debit-account" className="h-9">
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {ACCOUNT_NAMES.map((account) => (
                        <SelectItem key={account} value={account}>{account}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="credit-account" className="text-xs">Credit Account</Label>
                  <Select
                    value={manualEntry.creditAccount}
                    onValueChange={(value) => setManualEntry(prev => ({ ...prev, creditAccount: value as AccountName }))}
                  >
                    <SelectTrigger id="credit-account" className="h-9">
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {ACCOUNT_NAMES.map((account) => (
                        <SelectItem key={account} value={account}>{account}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="amount" className="text-xs">Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={manualEntry.amount}
                    onChange={(e) => setManualEntry(prev => ({ ...prev, amount: e.target.value }))}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="description" className="text-xs">Description (optional)</Label>
                  <Input
                    id="description"
                    placeholder="Transaction description"
                    value={manualEntry.description}
                    onChange={(e) => setManualEntry(prev => ({ ...prev, description: e.target.value }))}
                    className="h-9"
                  />
                </div>
              </div>
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
          )}
        </div>
      )}

      {error && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-3">
            <X className="h-5 w-5 text-destructive flex-shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {pendingEntry && (
        <Card className={cn(
          "transition-all duration-300 animate-in fade-in slide-in-from-top-2",
          isLowConfidence ? "border-warning bg-warning/5" : "border-success bg-success/5"
        )}>
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              {isLowConfidence ? (
                <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
              ) : (
                <Check className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1 space-y-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    AI interpreted this as:
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    <span className="font-mono">Debit</span>{' '}
                    <span className="font-medium text-foreground">{pendingEntry.parsed.debitAccount}</span>{' '}
                    {formatCurrency(pendingEntry.parsed.debitAmount)} /{' '}
                    <span className="font-mono">Credit</span>{' '}
                    <span className="font-medium text-foreground">{pendingEntry.parsed.creditAccount}</span>{' '}
                    {formatCurrency(pendingEntry.parsed.creditAmount)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {pendingEntry.parsed.description}
                  </p>
                </div>

                {clarificationQuestion && (
                  <form onSubmit={handleClarification} className="space-y-2">
                    <p className="text-sm text-warning-foreground bg-warning/10 px-3 py-2 rounded-md">
                      {clarificationQuestion}
                    </p>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Provide more details..."
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
                  <Button size="sm" onClick={handleConfirm}>
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
      )}
    </div>
  )
}
