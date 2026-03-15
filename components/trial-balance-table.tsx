'use client'

import { useAccounting } from './accounting-provider'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table'
import { formatCurrency } from '@/lib/accounting-store'
import { Empty } from '@/components/ui/empty'
import { Card, CardContent } from '@/components/ui/card'
import { Check, AlertTriangle } from 'lucide-react'

export function TrialBalanceTable() {
  const { trialBalance } = useAccounting()

  const totalDebits = trialBalance.reduce((sum, row) => sum + row.debit, 0)
  const totalCredits = trialBalance.reduce((sum, row) => sum + row.credit, 0)
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01

  if (trialBalance.length === 0) {
    return (
      <Empty
        title="No trial balance data"
        description="Record transactions from the Dashboard to generate a trial balance."
      />
    )
  }

  return (
    <div className="space-y-4">
      <Card className={isBalanced ? 'border-success bg-success/5' : 'border-warning bg-warning/5'}>
        <CardContent className="flex items-center gap-3 py-3">
          {isBalanced ? (
            <>
              <Check className="h-5 w-5 text-success flex-shrink-0" />
              <p className="text-sm font-medium text-success">
                Trial balance is in balance. Total debits equal total credits.
              </p>
            </>
          ) : (
            <>
              <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0" />
              <p className="text-sm font-medium text-warning-foreground">
                Trial balance is out of balance by {formatCurrency(Math.abs(totalDebits - totalCredits))}.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="font-semibold">Account</TableHead>
              <TableHead className="font-semibold text-right">Debit</TableHead>
              <TableHead className="font-semibold text-right">Credit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trialBalance.map((row) => (
              <TableRow key={row.account}>
                <TableCell className="font-medium">{row.account}</TableCell>
                <TableCell className="text-right font-mono">
                  {row.debit > 0 ? formatCurrency(row.debit) : '-'}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {row.credit > 0 ? formatCurrency(row.credit) : '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow className="bg-muted/70 font-semibold">
              <TableCell>Total</TableCell>
              <TableCell className="text-right font-mono">{formatCurrency(totalDebits)}</TableCell>
              <TableCell className="text-right font-mono">{formatCurrency(totalCredits)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  )
}
