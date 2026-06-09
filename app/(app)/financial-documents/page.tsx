'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/page-header'
import { TrialBalanceTable } from '@/components/trial-balance-table'
import { IncomeStatementView } from '@/components/income-statement-view'
import { IncomeStatementExportButton } from '@/components/income-statement-export-button'
import { BalanceSheetView } from '@/components/balance-sheet-view'
import { BalanceSheetExportButton } from '@/components/balance-sheet-export-button'

export default function FinancialDocumentsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Financial Documents"
        description="Trial balance, income statement, and balance sheet."
      />

      <Tabs defaultValue="trial-balance">
        <TabsList>
          <TabsTrigger value="trial-balance">Trial Balance</TabsTrigger>
          <TabsTrigger value="income-statement">Income Statement</TabsTrigger>
          <TabsTrigger value="balance-sheet">Balance Sheet</TabsTrigger>
        </TabsList>

        <TabsContent value="trial-balance" className="mt-6">
          <TrialBalanceTable />
        </TabsContent>

        <TabsContent value="income-statement" className="mt-6 space-y-4">
          <IncomeStatementView />
          <IncomeStatementExportButton />
        </TabsContent>

        <TabsContent value="balance-sheet" className="mt-6 space-y-4">
          <BalanceSheetView />
          <BalanceSheetExportButton />
        </TabsContent>
      </Tabs>
    </div>
  )
}
