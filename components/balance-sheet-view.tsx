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
import { Empty } from '@/components/ui/empty'
import { Card, CardContent } from '@/components/ui/card'
import { Check, AlertTriangle } from 'lucide-react'

export function BalanceSheetView() {
  const { balanceSheet, incomeStatement } = useAccounting()

  const hasData =
    balanceSheet.assets.length > 0 ||
    balanceSheet.liabilities.length > 0 ||
    balanceSheet.equity.length > 0

  if (!hasData) {
    return (
      <Empty
        title="No balance sheet data"
        description="Record transactions from the Dashboard to generate a balance sheet."
      />
    )
  }

  const totalLiabilitiesAndEquity = balanceSheet.totalLiabilities + balanceSheet.totalEquity
  const isBalanced = Math.abs(balanceSheet.totalAssets - totalLiabilitiesAndEquity) < 0.01

  return (
    <div className="space-y-6">
      <Card className={isBalanced ? 'border-success bg-success/5' : 'border-warning bg-warning/5'}>
        <CardContent className="flex items-center gap-3 py-3">
          {isBalanced ? (
            <>
              <Check className="h-5 w-5 text-success flex-shrink-0" />
              <p className="text-sm font-medium text-success">
                Balance sheet is in balance. Assets = Liabilities + Equity
              </p>
            </>
          ) : (
            <>
              <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0" />
              <p className="text-sm font-medium text-warning-foreground">
                Balance sheet is out of balance by {formatCurrency(Math.abs(balanceSheet.totalAssets - totalLiabilitiesAndEquity))}.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Assets */}
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead colSpan={2} className="font-semibold text-lg">
                  Assets
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {balanceSheet.assets.length > 0 ? (
                balanceSheet.assets.map((item) => (
                  <TableRow key={item.account}>
                    <TableCell className="pl-6">{item.account}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(item.amount)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={2} className="pl-6 text-muted-foreground italic">
                    No assets recorded
                  </TableCell>
                </TableRow>
              )}
              <TableRow className="bg-muted/70 hover:bg-muted/70 font-semibold">
                <TableCell>Total Assets</TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(balanceSheet.totalAssets)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {/* Liabilities & Equity */}
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead colSpan={2} className="font-semibold text-lg">
                  Liabilities & Equity
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Liabilities */}
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableCell colSpan={2} className="font-semibold">
                  Liabilities
                </TableCell>
              </TableRow>
              {balanceSheet.liabilities.length > 0 ? (
                balanceSheet.liabilities.map((item) => (
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
                    No liabilities recorded
                  </TableCell>
                </TableRow>
              )}
              <TableRow className="border-t border-border">
                <TableCell className="font-semibold pl-4">Total Liabilities</TableCell>
                <TableCell className="text-right font-mono font-semibold">
                  {formatCurrency(balanceSheet.totalLiabilities)}
                </TableCell>
              </TableRow>

              {/* Equity */}
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableCell colSpan={2} className="font-semibold">
                  {"Owner's Equity"}
                </TableCell>
              </TableRow>
              {balanceSheet.equity.map((item) => (
                <TableRow key={item.account}>
                  <TableCell className="pl-8">{item.account}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(item.amount)}
                  </TableCell>
                </TableRow>
              ))}
              {incomeStatement.netIncome !== 0 && (
                <TableRow>
                  <TableCell className="pl-8">Retained Earnings (Net Income)</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(incomeStatement.netIncome)}
                  </TableCell>
                </TableRow>
              )}
              <TableRow className="border-t border-border">
                <TableCell className="font-semibold pl-4">Total Equity</TableCell>
                <TableCell className="text-right font-mono font-semibold">
                  {formatCurrency(balanceSheet.totalEquity)}
                </TableCell>
              </TableRow>

              {/* Total */}
              <TableRow className="bg-muted/70 hover:bg-muted/70 font-semibold">
                <TableCell>Total Liabilities & Equity</TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(totalLiabilitiesAndEquity)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
