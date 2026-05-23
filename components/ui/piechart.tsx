'use client'

import { useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { useAccounting } from '@/components/accounting-provider'
import { formatCurrency } from '@/lib/accounting-store'

const SLICE_COLORS = [
  'hsl(var(--chart-1, 220 70% 50%))',
  'hsl(var(--chart-2, 160 60% 45%))',
  'hsl(var(--chart-3, 30 80% 55%))',
  'hsl(var(--chart-4, 280 65% 60%))',
  'hsl(var(--chart-5, 340 75% 55%))',
  '#6366f1',
  '#14b8a6',
  '#f59e0b',
]

export function PieChartAssets() {
  const { balanceSheet } = useAccounting()

  const chartData = useMemo(
    () =>
      balanceSheet.assets
        .filter((asset) => asset.amount > 0)
        .map((asset) => ({ account: asset.account, amount: asset.amount })),
    [balanceSheet.assets]
  )

  if (chartData.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        Record transactions to see asset composition.
      </div>
    )
  }

  const chartColors = {
    'Cash': '#10b981',
    'Accounts Receivable': '#f59e0b',
    'Office Supplies': '#6366f1',
    'Equipment': '#f43f5e',
    'Inventory': '#14b8a6',
    'Prepaid Rent': '#f59e0b',
    'Prepaid Insurance': '#10b981',
    'Prepaid Utilities': '#6366f1',
    'Prepaid Salaries': '#f43f5e',
    'Prepaid Office Supplies': '#14b8a6',
    'Prepaid Equipment': '#6366f1',
    'Prepaid Inventory': '#f59e0b',
    'Accounts Payable': '#10b981',
    'Notes Payable': '#f43f5e',
    'Bank Loan': '#6366f1',
    'Owner\'s Capital': '#14b8a6',
    'Service Revenue': '#f59e0b',
    'Sales Revenue': '#10b981',
    'Rent Expense': '#6366f1',
    'Utilities Expense': '#f43f5e',
    'Salaries Expense': '#14b8a6',
    'Office Supplies Expense': '#f59e0b',
    'Inventory Expense': '#6366f1',
    'Prepaid Rent Expense': '#f43f5e',
    'Prepaid Insurance Expense': '#10b981',
    'Prepaid Utilities Expense': '#6366f1',
    'Prepaid Salaries Expense': '#f43f5e',
    'Prepaid Office Supplies Expense': '#14b8a6',
    'Prepaid Equipment Expense': '#6366f1',
    'Prepaid Inventory Expense': '#f59e0b',
  }

  return (
    <div className="h-[220px] w-full min-h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="amount"
            nameKey="account"
            cx="50%"
            cy="50%"
            outerRadius={72}
            innerRadius={32}
            paddingAngle={2}
            stroke="hsl(var(--background))"
            strokeWidth={2}
          >
            {chartData.map((_, index) => (
              <Cell key={chartData[index]!.account} fill={chartColors[chartData[index]!.account as keyof typeof chartColors] || SLICE_COLORS[index % SLICE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => formatCurrency(value)}
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 'var(--radius)',
            }}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value) => (
              <span className="text-xs text-foreground">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
