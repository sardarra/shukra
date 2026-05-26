import { EquipmentView } from '@/components/equipment-view'
import { PageHeader } from '@/components/page-header'

export default function EquipmentPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Equipment Manager"
        description="Depreciable plant assets linked to your purchase journal entries."
      />
      <EquipmentView />
    </div>
  )
}
