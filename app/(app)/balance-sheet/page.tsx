import { BalanceSheetView } from '@/components/balance-sheet-view'
import { BalanceSheetExportButton } from '@/components/balance-sheet-export-button'
import { PageHeader } from '@/components/page-header'

export default function BalanceSheetPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Balance Sheet"
        description="Assets equals liabilities plus owner's equity."
      />

      <BalanceSheetView />
      <BalanceSheetExportButton />
    </div>
  )
}
