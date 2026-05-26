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
import { formatCurrency } from '@/lib/accounting-store'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, TrendingDown } from 'lucide-react'

export function IncomeStatementView() {
  const { incomeStatement } = useAccounting()

  const hasData = incomeStatement.revenues.length > 0 || incomeStatement.expenses.length > 0

  if (!hasData) {
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyTitle>No income statement data</EmptyTitle>
          <EmptyDescription>
            Record revenue and expense transactions from the Dashboard to generate an income
            statement.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  const isProfit = incomeStatement.netIncome >= 0

  return (
    <div className="space-y-6">
      <Card className={isProfit ? 'border-success bg-success/5' : 'border-destructive bg-destructive/5'}>
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            {isProfit ? (
              <TrendingUp className="h-6 w-6 text-success" />
            ) : (
              <TrendingDown className="h-6 w-6 text-destructive" />
            )}
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {isProfit ? 'Net Income' : 'Net Loss'}
              </p>
              <p className="text-2xl font-semibold">
                {formatCurrency(Math.abs(incomeStatement.netIncome))}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead colSpan={2} className="font-semibold text-lg">
                Income Statement
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Revenues Section */}
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableCell colSpan={2} className="font-semibold">
                Revenues
              </TableCell>
            </TableRow>
            {incomeStatement.revenues.length > 0 ? (
              incomeStatement.revenues.map((item) => (
                <TableRow key={item.account}>
                  <TableCell className="pl-8">{item.account}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(item.amount)}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={2} className="pl-8 text-muted-foreground italic">
                  No revenue recorded
                </TableCell>
              </TableRow>
            )}
            <TableRow className="border-t-2 border-border">
              <TableCell className="font-semibold pl-4">Total Revenue</TableCell>
              <TableCell className="text-right font-mono font-semibold">
                {formatCurrency(incomeStatement.totalRevenue)}
              </TableCell>
            </TableRow>

            {/* Expenses Section */}
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableCell colSpan={2} className="font-semibold">
                Expenses
              </TableCell>
            </TableRow>
            {incomeStatement.expenses.length > 0 ? (
              incomeStatement.expenses.map((item) => (
                <TableRow key={item.account}>
                  <TableCell className="pl-8">{item.account}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(item.amount)}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={2} className="pl-8 text-muted-foreground italic">
                  No expenses recorded
                </TableCell>
              </TableRow>
            )}
            <TableRow className="border-t-2 border-border">
              <TableCell className="font-semibold pl-4">Total Expenses</TableCell>
              <TableCell className="text-right font-mono font-semibold">
                {formatCurrency(incomeStatement.totalExpenses)}
              </TableCell>
            </TableRow>

            {/* Net Income */}
            <TableRow className="bg-muted/70 hover:bg-muted/70">
              <TableCell className="font-bold text-lg">
                {isProfit ? 'Net Income' : 'Net Loss'}
              </TableCell>
              <TableCell className={`text-right font-mono font-bold text-lg ${isProfit ? 'text-success' : 'text-destructive'}`}>
                {formatCurrency(incomeStatement.netIncome)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
