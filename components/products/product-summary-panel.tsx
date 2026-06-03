'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useProduct } from '@/components/product-provider'

interface KpiCardProps {
  label: string
  count: number
  colorClass: string
  borderClass: string
}

function KpiCard({ label, count, colorClass, borderClass }: KpiCardProps) {
  return (
    <Card className={`border-l-4 ${borderClass}`}>
      <CardHeader className="pb-2">
        <CardTitle className={`text-sm font-medium ${colorClass}`}>{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p
          className="text-3xl font-semibold tabular-nums"
          aria-label={`${count} ${label.toLowerCase()} product${count !== 1 ? 's' : ''}`}
        >
          {count === 0 ? '0' : count}
        </p>
      </CardContent>
    </Card>
  )
}

/**
 * Displays a summary panel with 3 KPI cards showing the count of
 * Profitable, Break-Even, and Unprofitable products.
 *
 * Reads `summary` from ProductProvider context — purely reactive, no local state.
 * Updates within 500ms of any viability status change (Requirement 5.4).
 */
export function ProductSummaryPanel() {
  const { summary } = useProduct()

  return (
    <section aria-label="Product viability summary">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Profitable"
          count={summary.profitable}
          colorClass="text-green-700 dark:text-green-400"
          borderClass="border-green-500"
        />
        <KpiCard
          label="Break-Even"
          count={summary.breakEven}
          colorClass="text-yellow-700 dark:text-yellow-400"
          borderClass="border-yellow-500"
        />
        <KpiCard
          label="Unprofitable"
          count={summary.unprofitable}
          colorClass="text-red-700 dark:text-red-400"
          borderClass="border-red-500"
        />
      </div>
    </section>
  )
}
