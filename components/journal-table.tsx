'use client'

import { useAccounting } from './accounting-provider'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/accounting-store'
import { Trash2 } from 'lucide-react'
import { Empty } from '@/components/ui/empty'

export function JournalTable() {
  const { journalEntries, deleteEntry } = useAccounting()

  // Sort by date, then by creation time
  const sortedEntries = [...journalEntries].sort((a, b) => {
    const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime()
    if (dateCompare !== 0) return dateCompare
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  })

  if (journalEntries.length === 0) {
    return (
      <Empty
        title="No journal entries"
        description="Record your first transaction from the Dashboard to see entries here."
      />
    )
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="font-semibold">Date</TableHead>
            <TableHead className="font-semibold">Description</TableHead>
            <TableHead className="font-semibold">Debit Account</TableHead>
            <TableHead className="font-semibold text-right">Debit</TableHead>
            <TableHead className="font-semibold">Credit Account</TableHead>
            <TableHead className="font-semibold text-right">Credit</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedEntries.map((entry) => (
            <TableRow key={entry.id} className="group">
              <TableCell className="font-mono text-sm">
                {new Date(entry.date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </TableCell>
              <TableCell className="max-w-[200px] truncate">
                {entry.description}
              </TableCell>
              <TableCell className="font-medium">{entry.debitAccount}</TableCell>
              <TableCell className="text-right font-mono">
                {formatCurrency(entry.debitAmount)}
              </TableCell>
              <TableCell className="font-medium">{entry.creditAccount}</TableCell>
              <TableCell className="text-right font-mono">
                {formatCurrency(entry.creditAmount)}
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  onClick={() => deleteEntry(entry.id)}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">Delete entry</span>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
