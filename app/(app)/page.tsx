import { TransactionInput } from '@/components/transaction-input'
import { DashboardStats } from '@/components/dashboard-stats'
import { RecentEntries } from '@/components/recent-entries'

export default function DashboardPage() {
  return (
    <>
      <div className="space-y-8 pb-44">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Home</h1>

        <DashboardStats />

        <RecentEntries />
      </div>

      <TransactionInput variant="floating" />
    </>
  )
}
