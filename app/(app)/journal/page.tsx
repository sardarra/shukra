import { JournalTable } from '@/components/journal-table'
import { PageHeader } from '@/components/page-header'

export default function JournalPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="General Journal"
        description="All recorded transactions with debits and credits."
      />

      <JournalTable />
    </div>
  )
}
