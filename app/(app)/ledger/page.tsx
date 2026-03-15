import { LedgerView } from '@/components/ledger-view'
import { PageHeader } from '@/components/page-header'

export default function LedgerPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Ledger"
        description="T-account ledgers showing running balances for each account."
      />

      <LedgerView />
    </div>
  )
}
