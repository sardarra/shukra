'use client'

import { useAccounting } from './accounting-provider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/accounting-store'
import { TrendingUp, TrendingDown, DollarSign, Scale } from 'lucide-react'

export function DashboardStats() {
  const { incomeStatement, balanceSheet, journalEntries, trialBalance } = useAccounting()

  const totalDebits = trialBalance.reduce((sum, row) => sum + row.debit, 0)
  const totalCredits = trialBalance.reduce((sum, row) => sum + row.credit, 0)
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01

  const stats = [
    {
      title: 'Net Income',
      value: formatCurrency(incomeStatement.netIncome),
      icon: incomeStatement.netIncome >= 0 ? TrendingUp : TrendingDown,
      description: incomeStatement.netIncome >= 0 ? 'Profit' : 'Loss',
      trend: incomeStatement.netIncome >= 0 ? 'positive' : 'negative',
    },
    {
      title: 'Total Assets',
      value: formatCurrency(balanceSheet.totalAssets),
      icon: DollarSign,
      description: `${balanceSheet.assets.length} account${balanceSheet.assets.length !== 1 ? 's' : ''}`,
      trend: 'neutral',
    },
    {
      title: 'Total Revenue',
      value: formatCurrency(incomeStatement.totalRevenue),
      icon: TrendingUp,
      description: `${incomeStatement.revenues.length} source${incomeStatement.revenues.length !== 1 ? 's' : ''}`,
      trend: 'positive',
    },
    {
      title: 'Trial Balance',
      value: isBalanced ? 'Balanced' : 'Unbalanced',
      icon: Scale,
      description: `${journalEntries.length} entries`,
      trend: isBalanced ? 'positive' : 'negative',
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {stat.title}
            </CardTitle>
            <stat.icon
              className={`h-4 w-4 ${
                stat.trend === 'positive'
                  ? 'text-success'
                  : stat.trend === 'negative'
                  ? 'text-destructive'
                  : 'text-muted-foreground'
              }`}
            />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{stat.value}</div>
            <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
