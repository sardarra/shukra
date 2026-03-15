'use client'

import { useState } from 'react'
import { useAccounting } from './accounting-provider'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { formatCurrency } from '@/lib/accounting-store'
import { Check, X, AlertTriangle, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export function TransactionInput() {
  const [input, setInput] = useState('')
  const [clarificationAnswer, setClarificationAnswer] = useState('')
  const {
    parseTransaction,
    confirmEntry,
    cancelEntry,
    answerClarification,
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
