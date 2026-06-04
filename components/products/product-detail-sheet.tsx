'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useProduct } from '@/components/product-provider'
import { ViabilityBadge } from '@/components/products/viability-badge'
import { CostItemList } from '@/components/products/cost-item-list'
import { CostItemForm } from '@/components/products/cost-item-form'
import { computeProductMetrics, validateProduct } from '@/lib/products'
import type { ProductType, ProductWithCostItems } from '@/lib/accounting-types'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ProductDetailSheetProps {
  productId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
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

// ─── Inline product fields ─────────────────────────────────────────────────────

interface ProductDetailsFieldsProps {
  product: ProductWithCostItems
}

function ProductDetailsFields({ product }: ProductDetailsFieldsProps) {
  const { updateProduct } = useProduct()

  const [name, setName] = useState(product.name)
  const [productType, setProductType] = useState<ProductType>(product.productType)
  const [sellingPrice, setSellingPrice] = useState(String(product.sellingPrice))
  const [description, setDescription] = useState(product.description ?? '')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [savingField, setSavingField] = useState<string | null>(null)

  useEffect(() => {
    setName(product.name)
    setProductType(product.productType)
    setSellingPrice(String(product.sellingPrice))
    setDescription(product.description ?? '')
    setFieldErrors({})
  }, [product.id, product.name, product.productType, product.sellingPrice, product.description])

  const saveField = useCallback(
    async (
      field: 'name' | 'productType' | 'sellingPrice' | 'description',
      patch: Partial<{
        name: string
        productType: ProductType
        sellingPrice: number
        description: string | null
      }>
    ) => {
      setSavingField(field)
      setFieldErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
      try {
        await updateProduct(product.id, patch)
      } catch {
        // Provider shows toast; revert local state from product on next effect sync
      } finally {
        setSavingField(null)
      }
    },
    [product.id, updateProduct]
  )

  const handleNameBlur = async () => {
    const trimmed = name.trim()
    if (trimmed === product.name) return

    const errors = validateProduct({
      name: trimmed,
      productType: product.productType,
      sellingPrice: product.sellingPrice,
    })
    if (errors.name) {
      setFieldErrors((prev) => ({ ...prev, name: errors.name }))
      setName(product.name)
      return
    }
    await saveField('name', { name: trimmed })
  }

  const handleProductTypeChange = async (value: ProductType) => {
    setProductType(value)
    if (value === product.productType) return
    await saveField('productType', { productType: value })
  }

  const handleSellingPriceBlur = async () => {
    const parsed = parseFloat(sellingPrice)
    if (!isNaN(parsed) && parsed === product.sellingPrice) return

    const errors = validateProduct({
      name: product.name,
      productType: product.productType,
      sellingPrice: isNaN(parsed) ? undefined : parsed,
    })
    if (errors.sellingPrice) {
      setFieldErrors((prev) => ({ ...prev, sellingPrice: errors.sellingPrice }))
      setSellingPrice(String(product.sellingPrice))
      return
    }
    await saveField('sellingPrice', { sellingPrice: parsed })
  }

  const handleDescriptionBlur = async () => {
    const normalized = description.trim()
    const current = (product.description ?? '').trim()
    if (normalized === current) return
    await saveField('description', { description: normalized.length > 0 ? normalized : null })
  }

  return (
    <section aria-labelledby="product-details-heading" className="space-y-4">
      <h2 id="product-details-heading" className="text-sm font-semibold">
        Product details
      </h2>

      <div className="grid gap-1.5">
        <Label htmlFor="product-detail-name">Name</Label>
        <Input
          id="product-detail-name"
          value={name}
          maxLength={150}
          disabled={savingField === 'name'}
          aria-invalid={!!fieldErrors.name}
          aria-describedby={fieldErrors.name ? 'product-detail-name-error' : undefined}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => void handleNameBlur()}
        />
        {fieldErrors.name && (
          <p id="product-detail-name-error" role="alert" className="text-destructive text-sm">
            {fieldErrors.name}
          </p>
        )}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="product-detail-type">Product type</Label>
        <Select
          value={productType}
          disabled={savingField === 'productType'}
          onValueChange={(val) => void handleProductTypeChange(val as ProductType)}
        >
          <SelectTrigger id="product-detail-type" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Physical Good">Physical Good</SelectItem>
            <SelectItem value="Service">Service</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="product-detail-price">Selling price</Label>
        <Input
          id="product-detail-price"
          type="number"
          step="any"
          min={0}
          value={sellingPrice}
          disabled={savingField === 'sellingPrice'}
          aria-invalid={!!fieldErrors.sellingPrice}
          aria-describedby={
            fieldErrors.sellingPrice ? 'product-detail-price-error' : undefined
          }
          onChange={(e) => setSellingPrice(e.target.value)}
          onBlur={() => void handleSellingPriceBlur()}
        />
        {fieldErrors.sellingPrice && (
          <p id="product-detail-price-error" role="alert" className="text-destructive text-sm">
            {fieldErrors.sellingPrice}
          </p>
        )}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="product-detail-description">Description</Label>
        <Textarea
          id="product-detail-description"
          value={description}
          rows={3}
          placeholder="Optional"
          disabled={savingField === 'description'}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => void handleDescriptionBlur()}
        />
      </div>
    </section>
  )
}

// ─── Break-even display ────────────────────────────────────────────────────────

interface BreakEvenDisplayProps {
  breakEvenUnits: ReturnType<typeof computeProductMetrics>['breakEvenUnits']
}

function BreakEvenDisplay({ breakEvenUnits }: BreakEvenDisplayProps) {
  if (typeof breakEvenUnits === 'number') {
    return (
      <p className="text-2xl font-semibold tabular-nums">
        <span aria-label={`${breakEvenUnits} units to break even`}>{breakEvenUnits}</span>
        <span className="text-base font-normal text-muted-foreground ml-1">units</span>
      </p>
    )
  }

  if (breakEvenUnits === 'N/A') {
    return (
      <div>
        <p className="text-2xl font-semibold text-muted-foreground">N/A</p>
        <p className="text-sm text-muted-foreground mt-1">
          No fixed costs have been entered for this product.
        </p>
      </div>
    )
  }

  return (
    <div>
      <p className="text-2xl font-semibold text-muted-foreground">Cannot break even</p>
      <p className="text-sm text-muted-foreground mt-1">
        This product does not cover its variable costs per unit.
      </p>
    </div>
  )
}

// ─── ProductDetailSheet ────────────────────────────────────────────────────────

/**
 * Slide-over detail view for a single product.
 *
 * - Radix Sheet (Dialog) provides focus trap while open and restores focus on close.
 * - Derived metrics recompute from ProductProvider state (no page reload).
 *
 * Validates: Requirements 2.3, 2.4, 3.3, 3.4, 4.2, 4.3, 4.4, 4.5, 6.2
 */
export function ProductDetailSheet({
  productId,
  open,
  onOpenChange,
}: ProductDetailSheetProps) {
  const { products } = useProduct()

  const product = useMemo(
    () => (productId ? products.find((p) => p.id === productId) ?? null : null),
    [products, productId]
  )

  const metrics = useMemo(
    () => (product ? computeProductMetrics(product) : null),
    [product]
  )

  // Close sheet if the product was deleted while open
  useEffect(() => {
    if (open && productId && !product) {
      onOpenChange(false)
    }
  }, [open, productId, product, onOpenChange])

  const titleId = 'product-detail-sheet-title'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        role="dialog"
        aria-labelledby={titleId}
        aria-modal="true"
        className="w-full sm:max-w-lg overflow-y-auto flex flex-col gap-0 p-0"
      >
        {product && metrics ? (
          <>
            <SheetHeader className="px-4 pt-4 pb-2 border-b shrink-0">
              <div className="flex items-start justify-between gap-3 pr-8">
                <div className="min-w-0 flex-1">
                  <SheetTitle id={titleId} className="truncate">
                    {product.name}
                  </SheetTitle>
                  <SheetDescription className="sr-only">
                    Product detail and profitability analysis for {product.name}
                  </SheetDescription>
                </div>
                <ViabilityBadge status={metrics.viabilityStatus} className="shrink-0" />
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
              <ProductDetailsFields product={product} />

              <section aria-labelledby="profitability-heading" className="space-y-3">
                <h2 id="profitability-heading" className="text-sm font-semibold">
                  Profitability
                </h2>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Contribution margin</dt>
                    <dd className="font-semibold tabular-nums mt-0.5">
                      {formatCurrency(metrics.contributionMargin)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">CM ratio</dt>
                    <dd className="font-semibold tabular-nums mt-0.5">
                      {formatPercent(metrics.contributionMarginRatio)}
                    </dd>
                  </div>
                </dl>
              </section>

              <section aria-labelledby="break-even-heading" className="space-y-2">
                <h2 id="break-even-heading" className="text-sm font-semibold">
                  Break-even analysis
                </h2>
                <BreakEvenDisplay breakEvenUnits={metrics.breakEvenUnits} />
              </section>

              <Separator />

              <section aria-labelledby="cost-items-heading" className="space-y-4">
                <h2 id="cost-items-heading" className="text-sm font-semibold">
                  Cost items
                </h2>
                <CostItemList productId={product.id} costItems={product.costItems} />
                <div className="rounded-md border p-3 bg-muted/30">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                    Add cost item
                  </h3>
                  <CostItemForm mode="add" productId={product.id} />
                </div>
              </section>
            </div>
          </>
        ) : (
          <SheetHeader className="px-4 pt-4">
            <SheetTitle id={titleId}>Product details</SheetTitle>
            <SheetDescription>Loading product…</SheetDescription>
          </SheetHeader>
        )}
      </SheetContent>
    </Sheet>
  )
}
