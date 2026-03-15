import { TransactionInput } from '@/components/transaction-input'
import { DashboardStats } from '@/components/dashboard-stats'
import { RecentEntries } from '@/components/recent-entries'
import { PageHeader } from '@/components/page-header'

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Record transactions in plain English and let AI handle the accounting."
      />

      <TransactionInput />

      <DashboardStats />

      <RecentEntries />
    </div>
  )
}
