'use client'

import { useState } from 'react'
import { AlertCircle } from 'lucide-react'
import ProductProvider, { useProduct } from '@/components/product-provider'
import { ProductSummaryPanel } from '@/components/products/product-summary-panel'
import { ProductList } from '@/components/products/product-list'
import { AddProductDialog } from '@/components/products/add-product-dialog'
import { PageHeader } from '@/components/page-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

// ─── Loading Skeleton ──────────────────────────────────────────────────────────

function ProductsLoadingSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading products">
      {/* Summary panel skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>

      {/* Filter controls skeleton */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <Skeleton className="h-9 w-full sm:max-w-xs" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-44" />
          <Skeleton className="h-9 w-44" />
        </div>
      </div>

      {/* Cards skeleton */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    </div>
  )
}

// ─── Page Content (must be inside ProductProvider) ────────────────────────────

function ProductsPageContent() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const { isLoading, error, retryLoad } = useProduct()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Product Manager"
        description="Catalog your products and services, and track their profitability."
      />

      {/* Error banner */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Failed to load products</AlertTitle>
          <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={retryLoad}
              className="self-start sm:self-auto"
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Loading skeleton or page content */}
      {isLoading ? (
        <ProductsLoadingSkeleton />
      ) : (
        <>
          <ProductSummaryPanel />
          <ProductList />
        </>
      )}

      {/* Floating Add Product button */}
      <Button
        className="fixed bottom-6 right-6 shadow-lg z-10"
        size="lg"
        onClick={() => setDialogOpen(true)}
        disabled={isLoading}
        aria-label="Add product"
      >
        + Add Product
      </Button>

      <AddProductDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function ProductsPage() {
  return (
    <ProductProvider>
      <ProductsPageContent />
    </ProductProvider>
  )
}
