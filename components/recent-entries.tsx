'use client'

import { useAccounting } from './accounting-provider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/accounting-store'
import { Trash2 } from 'lucide-react'
import Link from 'next/link'

export function RecentEntries() {
  const { journalEntries, deleteEntry } = useAccounting()

  // Show last 5 entries, sorted by creation date (newest first)
  const recentEntries = [...journalEntries]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold">Recent Entries</CardTitle>
        <Link href="/journal">
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            View all
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {recentEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No entries yet. Record your first transaction above.
          </p>
        ) : (
          <div className="space-y-3">
            {recentEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group"
              >
                <div className="space-y-1 flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {entry.description}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-mono">Dr.</span> {entry.debitAccount}{' '}
                    <span className="text-muted-foreground/50">|</span>{' '}
                    <span className="font-mono">Cr.</span> {entry.creditAccount}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(entry.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <span className="text-sm font-medium text-foreground">
                    {formatCurrency(entry.debitAmount)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    onClick={() => deleteEntry(entry.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Delete entry</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
