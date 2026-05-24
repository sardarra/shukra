import { IncomeStatementView } from '@/components/income-statement-view'
import { PageHeader } from '@/components/page-header'
import { IncomeStatementExportButton } from '@/components/income-statement-export-button'

export default function IncomeStatementPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Income Statement"
        description="Revenue minus expenses equals net income."
      />

      <IncomeStatementView />
      <IncomeStatementExportButton></IncomeStatementExportButton>
    </div>
  )
}
