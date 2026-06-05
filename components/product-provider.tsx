import React, { createContext, useState, useMemo, useContext, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { filterProducts, computeProductSummary } from '@/lib/products'
import type { ProductWithCostItems, ViabilityStatus, ProductType } from '@/lib/accounting-types'


interface ProductContextType {
    products: ProductWithCostItems[];
    isLoading: boolean;
    error: string | null;
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    viabilityFilter: ViabilityStatus | 'All';
    setViabilityFilter: (status: ViabilityStatus | 'All') => void;
    typeFilter: ProductType | 'All';
    setTypeFilter: (type: ProductType | 'All') => void;
    filteredProducts: ProductWithCostItems[];
    summary: ReturnType<typeof computeProductSummary>;
    retryLoad: () => void;
    createProduct: (data: { name: string; productType: ProductType; description?: string; sellingPrice: number }) => Promise<void>;
    updateProduct: (id: string, data: Partial<{ name: string; productType: ProductType; description?: string | null; sellingPrice: number }>) => Promise<void>;
    deleteProduct: (id: string) => Promise<void>;
    addCostItem: (productId: string, data: { label: string; costType: 'Variable' | 'Fixed'; amount: number }) => Promise<void>;
    updateCostItem: (productId: string, itemId: string, data: Partial<{ label: string; costType: 'Variable' | 'Fixed'; amount: number }>) => Promise<void>;
    removeCostItem: (productId: string, itemId: string) => Promise<void>;
}

const ProductContext = createContext<ProductContextType | undefined>(undefined)

export default function ProductProvider({ children }: { children: React.ReactNode }) {
  const [products, setProducts] = useState<ProductWithCostItems[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [viabilityFilter, setViabilityFilter] = useState<ViabilityStatus | 'All'>('All')
  const [typeFilter, setTypeFilter] = useState<ProductType | 'All'>('All')

  const loadProducts = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/products')
      const json = await res.json()
      if (!res.ok) {
        const msg = json?.error ?? 'Failed to load products'
        setError(msg)
        toast.error(msg)
        setProducts([])
      } else {
        // Expecting { ok: true, products }
        setProducts(json.products ?? [])
      }
    } catch (err) {
      const msg = (err as Error)?.message ?? 'Network error'
      setError(msg)
      toast.error('Failed to load products')
      setProducts([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  const retryLoad = useCallback(() => {
    void loadProducts()
  }, [loadProducts])

  const filteredProducts = useMemo(() => {
    return filterProducts(products, searchTerm, viabilityFilter, typeFilter)
  }, [products, searchTerm, viabilityFilter, typeFilter])

  const summary = useMemo(() => computeProductSummary(products), [products])

  // Actions
  const createProduct = useCallback(async (data: { name: string; productType: ProductType; description?: string; sellingPrice: number }) => {
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) {
        const msg = json?.error ?? 'Failed to create product'
        toast.error(msg)
        throw new Error(msg)
      }
      const created = json.product
      // ensure costItems array exists for UI
      const withCosts: ProductWithCostItems = { ...created, costItems: [] }
      setProducts((p) => [withCosts, ...p])
    } catch (err) {
      toast.error('Could not create product')
      throw err
    }
  }, [])

  const updateProduct = useCallback(async (id: string, data: Partial<{ name: string; productType: ProductType; description?: string | null; sellingPrice: number }>) => {
    try {
      const res = await fetch(`/api/products?id=${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) {
        const msg = json?.error ?? 'Failed to update product'
        toast.error(msg)
        throw new Error(msg)
      }
      const updated = json.product
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)))
    } catch (err) {
      toast.error('Could not update product')
      throw err
    }
  }, [])

  const deleteProduct = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/products?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) {
        const msg = json?.error ?? 'Failed to delete product'
        toast.error(msg)
        throw new Error(msg)
      }
      setProducts((prev) => prev.filter((p) => p.id !== id))
    } catch (err) {
      toast.error('Could not delete product')
      throw err
    }
  }, [])

  const addCostItem = useCallback(async (productId: string, data: { label: string; costType: 'Variable' | 'Fixed'; amount: number }) => {
    try {
      const res = await fetch(`/api/products/${encodeURIComponent(productId)}/cost-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) {
        const msg = json?.error ?? 'Failed to add cost item'
        toast.error(msg)
        throw new Error(msg)
      }
      // reload products to ensure balances are correct
      await loadProducts()
    } catch (err) {
      toast.error('Could not add cost item')
      throw err
    }
  }, [loadProducts])

  const updateCostItem = useCallback(async (productId: string, itemId: string, data: Partial<{ label: string; costType: 'Variable' | 'Fixed'; amount: number }>) => {
    try {
      const res = await fetch(`/api/products/${encodeURIComponent(productId)}/cost-items/${encodeURIComponent(itemId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) {
        const msg = json?.error ?? 'Failed to update cost item'
        toast.error(msg)
        throw new Error(msg)
      }
      // reload to reflect updated balances
      await loadProducts()
    } catch (err) {
      toast.error('Could not update cost item')
      throw err
    }
  }, [loadProducts])

  const removeCostItem = useCallback(async (productId: string, itemId: string) => {
    try {
      const res = await fetch(`/api/products/${encodeURIComponent(productId)}/cost-items/${encodeURIComponent(itemId)}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (!res.ok) {
        const msg = json?.error ?? 'Failed to delete cost item'
        toast.error(msg)
        throw new Error(msg)
      }
      await loadProducts()
    } catch (err) {
      toast.error('Could not delete cost item')
      throw err
    }
  }, [loadProducts])

  const value: ProductContextType = {
    products,
    isLoading,
    error,
    searchTerm,
    setSearchTerm,
    viabilityFilter,
    setViabilityFilter,
    typeFilter,
    setTypeFilter,
    filteredProducts,
    summary,
    retryLoad,
    createProduct,
    updateProduct,
    deleteProduct,
    addCostItem,
    updateCostItem,
    removeCostItem,
  }

  return <ProductContext.Provider value={value}>{children}</ProductContext.Provider>
}

export function useProduct() {
  const ctx = useContext(ProductContext)
  if (!ctx) throw new Error('useProduct must be used within ProductProvider')
  return ctx
}