'use client'

import { useAccounting } from '@/components/accounting-provider'
import { Button } from '@/components/ui/button'
import { exportBalanceSheetToXlsx } from '@/lib/export-to-xlsx'

export function BalanceSheetExportButton() {
  const { ledgers, plantAssets } = useAccounting()

  return (
    <Button type="button" onClick={() => exportBalanceSheetToXlsx(ledgers, plantAssets)}>
      Export to Excel
    </Button>
  )
}
