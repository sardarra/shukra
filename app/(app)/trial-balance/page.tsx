import { TrialBalanceTable } from '@/components/trial-balance-table'
import { PageHeader } from '@/components/page-header'

export default function TrialBalancePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Trial Balance"
        description="Summary of all account balances to verify debits equal credits."
      />

      <TrialBalanceTable />
    </div>
  )
}
