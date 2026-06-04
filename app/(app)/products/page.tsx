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

"use client";

import { useState } from "react";
import ProductProvider , { useProduct } from "@/components/product-provider";
import { AddProductDialog } from "@/components/products/add-product-dialog";
import { ProductList } from "@/components/products/product-list";
import { ProductSummaryPanel } from "@/components/products/product-summary-panel";

import { LoadingScreen } from "@/components/loading-screen";

import "./style.css";

function ProductsPageContent() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
    const { isLoading, error, retryLoad } = useProduct();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <p>{error}</p>
    );
  }
  
  return (
    <ProductProvider>
      <ProductSummaryPanel />
      <ProductList />
      <AddProductDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
    </ProductProvider>
  );
}

export default function ProductsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // TODO: Render a loading skeleton and block user interaction while `isLoading` is true
  const isLoading = false;

  return (
    <ProductProvider>
      
      <ProductsPageContent />
    </ProductProvider>
  )
}