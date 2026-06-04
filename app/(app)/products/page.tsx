/**
 * 
 * 
 * 8.1 Create `app/(app)/products/page.tsx`
    - Wrap page content in `<ProductProvider>`
    - Render `ProductSummaryPanel`, `ProductList`, and a floating "Add Product" button that opens `AddProductDialog`
    - Render an alert banner when `ProductProvider.error` is non-null, with a "Retry" button that calls `retryLoad` (consistent with `AccountingProvider` pattern)
    - Render a loading skeleton and block user interaction while `isLoading` is true
    - _Requirements: 1.2, 7.5, 7.6_
 */

import ProductProvider from "@/components/product-provider";
import { ProductSummaryPanel } from "@/components/products/product-summary-panel";

export default function ProductsPage() {
  return <ProductProvider>
    <ProductSummaryPanel />

  </ProductProvider>
}