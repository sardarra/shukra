/*6.9 Create `components/products/product-list.tsx`
    - Render a responsive card grid of `ProductCard` components using `filteredProducts` from `ProductProvider`
    - Render filter controls: viability status multi-select, product type multi-select, and a search bar (case-insensitive, filters by name or description)
    - Display empty-state message when `filteredProducts` is empty (distinguishing "no products yet" from "no products match filters")
    - Single-column layout on viewports 375px wide with no horizontal scrolling required
    - _Requirements: 6.1, 6.3, 6.4, 6.5, 6.6, 6.7_*/

import React from 'react'
import { useProduct } from '@/components/product-provider'
import { ProductCard } from './product-card'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import type { ProductType } from '@/lib/accounting-types'

export function ProductList() {
  const {
    filteredProducts,
    products,
    searchTerm,
    setSearchTerm,
    viabilityFilter,
    setViabilityFilter,
    typeFilter,
    setTypeFilter,
  } = useProduct()

  const noProductsYet = products.length === 0
  const noMatches = filteredProducts.length === 0 && products.length > 0

  return (
    <section aria-label="Products">
      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div className="flex-1 min-w-0">
          <Input
            placeholder="Search products by name or description"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 mt-2 sm:mt-0">
          <Select value={viabilityFilter} onValueChange={(v) => setViabilityFilter(v as any)}>
            <SelectTrigger className="w-44">
              <SelectValue>{viabilityFilter}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All</SelectItem>
              <SelectItem value="Profitable">Profitable</SelectItem>
              <SelectItem value="Break-Even">Break-Even</SelectItem>
              <SelectItem value="Unprofitable">Unprofitable</SelectItem>
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as ProductType | 'All')}>
            <SelectTrigger className="w-44">
              <SelectValue>{typeFilter}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All</SelectItem>
              <SelectItem value="Physical Good">Physical Good</SelectItem>
              <SelectItem value="Service">Service</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Empty states */}
      {noProductsYet ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyTitle>No products yet</EmptyTitle>
            <EmptyDescription>Use the Add Product button to create your first product.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : noMatches ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyTitle>No products match filters</EmptyTitle>
            <EmptyDescription>Try clearing filters or adjusting your search term.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </section>
  )
}