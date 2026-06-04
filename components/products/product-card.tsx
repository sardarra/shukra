'use client'

import { useState } from 'react'
import { Pencil, Trash2, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useProduct } from '@/components/product-provider'
import { ViabilityBadge } from '@/components/products/viability-badge'
import { ProductDetailSheet } from '@/components/products/product-detail-sheet'
import { computeProductMetrics } from '@/lib/products'
import type { ProductWithCostItems } from '@/lib/accounting-types'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ProductCardProps {
  product: ProductWithCostItems
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

function formatPercent(ratio: number): string {
  return `${ratio.toFixed(2)}%`
}

// ─── ProductCard ───────────────────────────────────────────────────────────────

/**
 * Single product card component.
 *
 * Renders:
 * - Product name
 * - Product type
 * - Selling price (formatted as currency)
 * - Contribution margin (currency, 2 decimal places)
 * - Contribution margin ratio (percentage, 2 decimal places)
 * - ViabilityBadge component
 * - Inline edit and delete action buttons
 * - Card is clickable to open ProductDetailSheet
 *
 * Validates: Requirements 6.1
 */
export function ProductCard({ product }: ProductCardProps) {
  const { deleteProduct } = useProduct()
  const [isDeleting, setIsDeleting] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)

  // Compute metrics for this product
  const metrics = computeProductMetrics(product)

  // Handle delete with confirmation
  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent card click from opening sheet
    
    const confirmed = window.confirm(
      `Delete "${product.name}"? This will also delete all associated cost items and cannot be undone.`
    )
    
    if (!confirmed) return
    
    setIsDeleting(true)
    try {
      await deleteProduct(product.id)
    } finally {
      setIsDeleting(false)
    }
  }

  // Handle edit (placeholder - opens sheet for now, could be a separate dialog)
  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent card click from opening sheet
    setSheetOpen(true)
  }

  // Handle card click to open detail sheet
  const handleCardClick = () => {
    setSheetOpen(true)
  }

  return (
    <>
      <Card 
        className="cursor-pointer hover:bg-muted/30 transition-colors group relative"
        role="button"
        tabIndex={0}
        aria-label={`View details for product: ${product.name}`}
        onClick={handleCardClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleCardClick()
          }
        }}
      >
        <CardContent className="p-4">
          <div className="flex flex-col gap-3">
            {/* Header row with name and viability badge */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate text-base" title={product.name}>
                  {product.name}
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {product.productType}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <ViabilityBadge status={metrics.viabilityStatus} />
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
            </div>

            {/* Metrics grid */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Selling price</p>
                <p className="font-medium tabular-nums mt-0.5">
                  {formatCurrency(product.sellingPrice)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Contribution margin</p>
                <p className="font-medium tabular-nums mt-0.5">
                  {formatCurrency(metrics.contributionMargin)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">CM ratio</p>
                <p className="font-medium tabular-nums mt-0.5">
                  {formatPercent(metrics.contributionMarginRatio)}
                </p>
              </div>
              <div className="opacity-0">
                {/* Empty cell for alignment */}
                <p className="text-muted-foreground text-xs">Spacer</p>
                <p className="font-medium mt-0.5">&nbsp;</p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1 pt-2 border-t">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-muted-foreground hover:text-foreground flex-1"
                aria-label={`Edit product: ${product.name}`}
                onClick={handleEdit}
              >
                <Pencil className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                Edit
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-muted-foreground hover:text-destructive flex-1"
                aria-label={`Delete product: ${product.name}`}
                disabled={isDeleting}
                onClick={handleDelete}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                Delete
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Product detail sheet */}
      <ProductDetailSheet
        productId={sheetOpen ? product.id : null}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  )
}