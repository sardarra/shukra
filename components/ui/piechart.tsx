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

type AssetSlice = { account: string; amount: number }

function buildAssetChartData(
  assets: { account: string; amount: number }[],
  plantAssets: { specificName: string; netBookValue: number }[]
): AssetSlice[] {
  const slices: AssetSlice[] = []

  for (const asset of assets) {
    if (asset.amount > 0) {
      slices.push({ account: asset.account, amount: asset.amount })
    }
  }

  for (const plant of plantAssets) {
    if (plant.netBookValue > 0) {
      slices.push({ account: plant.specificName, amount: plant.netBookValue })
    }
  }

  return slices
}

export function PieChartAssets() {
  const { balanceSheet } = useAccounting()

  const chartData = useMemo(
    () => buildAssetChartData(balanceSheet.assets, balanceSheet.plantAssets),
    [balanceSheet.assets, balanceSheet.plantAssets]
  )

  if (chartData.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        Record transactions to see asset composition.
      </div>
    )
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
              <Cell key={chartData[index]!.account} fill={SLICE_COLORS[index % SLICE_COLORS.length]} />
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
