import { TransactionInput } from '@/components/transaction-input'
import { DashboardStats } from '@/components/dashboard-stats'
import { RecentEntries } from '@/components/recent-entries'
import { AdUnit } from '@/components/ads/AdUnit'

export default function DashboardPage() {
  return (
    <>
      <div className="space-y-8 pb-44">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Home</h1>

        <DashboardStats />

        <RecentEntries />

        <AdUnit slot="8448194599" />
        <p>This ad keeps Shukra free for everyone. Thank you for your support!</p>
      </div>

      <TransactionInput variant="floating" />
    </>
  )
}
