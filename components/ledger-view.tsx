'use client'

import { useAccounting } from './accounting-provider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency } from '@/lib/accounting-store'
import { Empty } from '@/components/ui/empty'
import { Badge } from '@/components/ui/badge'
import type { AccountType } from '@/lib/accounting-types'

const accountTypeBadgeVariant: Record<AccountType, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  asset: 'default',
  liability: 'secondary',
  equity: 'outline',
  revenue: 'default',
  expense: 'destructive',
}

const accountTypeLabel: Record<AccountType, string> = {
  asset: 'Asset',
  liability: 'Liability',
  equity: 'Equity',
  revenue: 'Revenue',
  expense: 'Expense',
}

export function LedgerView() {
  const { ledgers } = useAccounting()

  const nonEmptyLedgers = ledgers.filter((l) => l.entries.length > 0)

  if (nonEmptyLedgers.length === 0) {
    return (
      <Empty
        title="No ledger accounts"
        description="Record transactions from the Dashboard to see T-account ledgers here."
      />
    )
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {nonEmptyLedgers.map((ledger) => (
        <Card key={ledger.account}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">{ledger.account}</CardTitle>
              <Badge variant={accountTypeBadgeVariant[ledger.accountType]}>
                {accountTypeLabel[ledger.accountType]}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="text-xs font-semibold">Date</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Debit</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Credit</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.entries.map((entry, index) => (
                    <TableRow key={`${entry.journalEntryId}-${index}`}>
                      <TableCell className="font-mono text-xs py-2">
                        {new Date(entry.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs py-2">
                        {entry.debit ? formatCurrency(entry.debit) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs py-2">
                        {entry.credit ? formatCurrency(entry.credit) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-medium py-2">
                        {formatCurrency(entry.balance)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-between items-center mt-3 pt-3 border-t border-border">
              <span className="text-sm text-muted-foreground">Account Balance</span>
              <span className="text-lg font-semibold">{formatCurrency(ledger.balance)}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
