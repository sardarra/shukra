'use client'

import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useProduct } from '@/components/product-provider'
import { CostItemForm } from '@/components/products/cost-item-form'
import type { CostItem, CostType } from '@/lib/accounting-types'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface CostItemListProps {
  productId: string
  costItems: CostItem[]
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function sumItems(items: CostItem[]): number {
  return items.reduce((acc, item) => acc + item.amount, 0)
}

// ─── Section Component ─────────────────────────────────────────────────────────

interface CostSectionProps {
  heading: string
  costType: CostType
  items: CostItem[]
  productId: string
  editingItemId: string | null
  onEditStart: (id: string) => void
  onEditEnd: () => void
  onDelete: (id: string) => void
  isDeleting: string | null
}

function CostSection({
  heading,
  costType,
  items,
  productId,
  editingItemId,
  onEditStart,
  onEditEnd,
  onDelete,
  isDeleting,
}: CostSectionProps) {
  const total = sumItems(items)

  return (
    <section aria-labelledby={`cost-section-${costType.toLowerCase()}`}>
      <h3
        id={`cost-section-${costType.toLowerCase()}`}
        className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2"
      >
        {heading}
      </h3>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground italic py-2">None added yet.</p>
      ) : (
        <ul
          aria-label={`${heading} cost items`}
          className="divide-y divide-border rounded-md border"
        >
          {items.map((item) => (
            <li key={item.id} className="px-3 py-2">
              {editingItemId === item.id ? (
                // Inline edit form
                <div className="pt-1">
                  <CostItemForm
                    mode="edit"
                    productId={productId}
                    costItem={item}
                    onSuccess={onEditEnd}
                    onCancel={onEditEnd}
                  />
                </div>
              ) : (
                // Read-only row
                <div className="flex items-center justify-between gap-3 min-w-0">
                  <span className="truncate text-sm font-medium" title={item.label}>
                    {item.label}
                  </span>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-sm tabular-nums">
                      {formatCurrency(item.amount)}
                    </span>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      aria-label={`Edit cost item: ${item.label}`}
                      onClick={() => onEditStart(item.id)}
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      aria-label={`Delete cost item: ${item.label}`}
                      disabled={isDeleting === item.id}
                      onClick={() => onDelete(item.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Section total */}
      <p className="mt-2 text-sm text-right text-muted-foreground">
        Total {costType.toLowerCase()} costs:{' '}
        <span className="font-semibold text-foreground">{formatCurrency(total)}</span>
      </p>
    </section>
  )
}

// ─── CostItemList ──────────────────────────────────────────────────────────────

/**
 * Renders cost items grouped by type (Variable / Fixed).
 *
 * Each row shows:
 * - Label
 * - Formatted amount (currency, 2 d.p.)
 * - Edit button — opens an inline CostItemForm in edit mode
 * - Delete button — calls removeCostItem after a window.confirm guard
 *
 * Totals are shown at the bottom of each group.
 * Empty groups show a subtle "None added yet." message.
 *
 * Validates: Requirements 2.2, 2.4, 6.2
 */
export function CostItemList({ productId, costItems }: CostItemListProps) {
  const { removeCostItem } = useProduct()
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)

  const variableItems = costItems.filter((item) => item.costType === 'Variable')
  const fixedItems = costItems.filter((item) => item.costType === 'Fixed')

  const handleDelete = async (itemId: string) => {
    const item = costItems.find((c) => c.id === itemId)
    const confirmed = window.confirm(
      `Delete "${item?.label ?? 'this cost item'}"? This cannot be undone.`
    )
    if (!confirmed) return

    setIsDeleting(itemId)
    try {
      await removeCostItem(itemId)
    } finally {
      setIsDeleting(null)
    }
  }

  const sharedProps = {
    productId,
    editingItemId,
    onEditStart: (id: string) => setEditingItemId(id),
    onEditEnd: () => setEditingItemId(null),
    onDelete: handleDelete,
    isDeleting,
  }

  return (
    <div className="space-y-6">
      <CostSection
        heading="Variable Costs"
        costType="Variable"
        items={variableItems}
        {...sharedProps}
      />
      <CostSection
        heading="Fixed Costs"
        costType="Fixed"
        items={fixedItems}
        {...sharedProps}
      />
    </div>
  )
}
