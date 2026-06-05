'use client'

import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { Button } from '@/components/ui/button'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useProduct } from '@/components/product-provider'
import { validateProduct } from '@/lib/products'
import type { CreateProductPayload, ProductType } from '@/lib/accounting-types'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface AddProductDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

interface FormValues {
  name: string
  productType: ProductType
  description: string
  sellingPrice: string
}

const defaultValues: FormValues = {
  name: '',
  productType: 'Physical Good',
  description: '',
  sellingPrice: '',
}

const titleId = 'add-product-dialog-title'

// ─── Component ─────────────────────────────────────────────────────────────────

/**
 * Dialog form for creating a new product.
 *
 * Validates via `validateProduct` from lib/products.ts.
 * On success, calls `createProduct` from ProductProvider.
 *
 * Validates: Requirements 1.1, 1.5
 */
export function AddProductDialog({ open, onOpenChange, onSuccess }: AddProductDialogProps) {
  const { createProduct } = useProduct()

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues,
  })

  useEffect(() => {
    if (!open) {
      reset(defaultValues)
    }
  }, [open, reset])

  const onSubmit = async (values: FormValues) => {
    const parsedPrice = parseFloat(values.sellingPrice)

    const payload: Partial<CreateProductPayload> = {
      name: values.name.trim(),
      productType: values.productType,
      description: values.description.trim() || undefined,
      sellingPrice: isNaN(parsedPrice) ? undefined : parsedPrice,
    }

    const validationErrors = validateProduct(payload)
    if (Object.keys(validationErrors).length > 0) {
      return
    }

    await createProduct(payload as CreateProductPayload)
    reset(defaultValues)
    onOpenChange(false)
    onSuccess?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        role="dialog"
        aria-labelledby={titleId}
        aria-modal="true"
        className="sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle id={titleId}>Add product</DialogTitle>
          <DialogDescription>
            Enter the product name, type, and selling price. Description is optional.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => void handleSubmit(onSubmit)(e)}
          noValidate
          aria-label="Add product"
          className="flex flex-col gap-4"
        >
          <div className="grid gap-1.5">
            <Label htmlFor="add-product-name">
              Name <span aria-hidden="true" className="text-destructive">*</span>
            </Label>
            <Input
              id="add-product-name"
              placeholder="e.g. Widget Pro"
              maxLength={150}
              aria-required="true"
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'add-product-name-error' : undefined}
              {...register('name', {
                validate: (value) => {
                  const errs = validateProduct({
                    name: value,
                    productType: 'Physical Good',
                    sellingPrice: 1,
                  })
                  return errs.name ?? true
                },
              })}
            />
            {errors.name && (
              <p id="add-product-name-error" role="alert" className="text-destructive text-sm">
                {errors.name.message}
              </p>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="add-product-type">
              Product type <span aria-hidden="true" className="text-destructive">*</span>
            </Label>
            <Controller
              control={control}
              name="productType"
              rules={{
                validate: (value) => {
                  const errs = validateProduct({
                    name: 'placeholder',
                    productType: value,
                    sellingPrice: 1,
                  })
                  return errs.productType ?? true
                },
              }}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(val) => field.onChange(val as ProductType)}
                >
                  <SelectTrigger
                    id="add-product-type"
                    className="w-full"
                    aria-required="true"
                    aria-invalid={!!errors.productType}
                    aria-describedby={
                      errors.productType ? 'add-product-type-error' : undefined
                    }
                  >
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Physical Good">Physical Good</SelectItem>
                    <SelectItem value="Service">Service</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            {errors.productType && (
              <p id="add-product-type-error" role="alert" className="text-destructive text-sm">
                {errors.productType.message}
              </p>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="add-product-description">Description</Label>
            <Textarea
              id="add-product-description"
              placeholder="Optional"
              rows={3}
              {...register('description')}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="add-product-price">
              Selling price <span aria-hidden="true" className="text-destructive">*</span>
            </Label>
            <Input
              id="add-product-price"
              type="number"
              step="any"
              min={0}
              placeholder="0.00"
              aria-required="true"
              aria-invalid={!!errors.sellingPrice}
              aria-describedby={
                errors.sellingPrice ? 'add-product-price-error' : undefined
              }
              {...register('sellingPrice', {
                validate: (value) => {
                  const parsed = parseFloat(value)
                  const errs = validateProduct({
                    name: 'placeholder',
                    productType: 'Physical Good',
                    sellingPrice: isNaN(parsed) ? undefined : parsed,
                  })
                  return errs.sellingPrice ?? true
                },
              })}
            />
            {errors.sellingPrice && (
              <p id="add-product-price-error" role="alert" className="text-destructive text-sm">
                {errors.sellingPrice.message}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating…' : 'Add product'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
